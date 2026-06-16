import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthOptions, Profile, TokenSet } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { accounts, profiles, sessions, users, verificationTokens } from "@/lib/db/schema";
import { bootstrapUserProfile, touchUserSignIn } from "@/lib/auth/profile";

type LinuxDoProfile = Profile & {
  id?: string | number;
  sub?: string;
  uid?: string | number;
  user_id?: string | number;
  username?: string;
  login?: string;
  preferred_username?: string;
  name?: string;
  nickname?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  avatar?: string;
  picture?: string;
  image?: string;
  avatar_template?: string;
  data?: LinuxDoProfile;
  user?: LinuxDoProfile;
};
type LinuxDoOAuthProviderContext = {
  clientId?: string;
  clientSecret?: string;
  callbackUrl: string;
};
type LinuxDoTokenParams = {
  code?: unknown;
};
type LinuxDoEndpointResult =
  | {
      ok: true;
      status: number;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number | "network";
      payload: Record<string, unknown>;
    };

const linuxDoAuthorizationUrl = "https://connect.linux.do/oauth2/authorize";
const linuxDoTokenUrl = "https://connect.linux.do/oauth2/token";
const linuxDoUserinfoUrl = "https://connect.linux.do/api/user";
const linuxDoRequestTimeoutMs = 12_000;

function readProfileString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readProfileId(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function getLinuxDoProfilePayload(profile: LinuxDoProfile) {
  return profile.data ?? profile.user ?? profile;
}

function getLinuxDoClaims(tokens: TokenSet) {
  const claimsReader = (tokens as TokenSet & { claims?: () => Record<string, unknown> }).claims;

  if (typeof claimsReader !== "function") {
    return {};
  }

  try {
    return claimsReader();
  } catch {
    return {};
  }
}

function normalizeLinuxDoAvatar(value: unknown) {
  const avatar = readProfileString(value);

  return avatar?.includes("{size}") ? avatar.replace("{size}", "240") : avatar;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 240) };
  }
}

function readErrorMessage(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const message = value.trim();
  return message ? message.slice(0, 240) : undefined;
}

function getLinuxDoFailureMessage(result: LinuxDoEndpointResult) {
  const error =
    readErrorMessage(result.payload.error) ??
    readErrorMessage(result.payload.error_description) ??
    readErrorMessage(result.payload.message) ??
    readErrorMessage(result.payload.detail);

  return error ? `${result.status}: ${error}` : String(result.status);
}

async function requestLinuxDoToken(
  provider: LinuxDoOAuthProviderContext,
  params: LinuxDoTokenParams,
  authMethod: "client_secret_post" | "client_secret_basic"
): Promise<LinuxDoEndpointResult> {
  const code = readProfileString(params.code);

  if (!code) {
    throw new Error("Linux.do OAuth callback missing code");
  }

  if (!provider.clientId || !provider.clientSecret) {
    throw new Error("Linux.do OAuth client is not configured");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: provider.callbackUrl,
    client_id: provider.clientId
  });
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json"
  };

  if (authMethod === "client_secret_basic") {
    headers.Authorization = `Basic ${Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", provider.clientId);
    body.set("client_secret", provider.clientSecret);
  }

  const response = await fetch(process.env.LINUXDO_TOKEN_URL ?? linuxDoTokenUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(linuxDoRequestTimeoutMs)
  }).catch((error: unknown) => ({ error }));

  if (!(response instanceof Response)) {
    return {
      ok: false,
      status: "network",
      payload: { error: response.error instanceof Error ? response.error.message : String(response.error) }
    };
  }

  const payload = await readJsonResponse(response);

  return { ok: response.ok, status: response.status, payload };
}

async function requestLinuxDoTokens({
  provider,
  params
}: {
  provider: LinuxDoOAuthProviderContext;
  params: LinuxDoTokenParams;
}): Promise<{ tokens: TokenSet }> {
  const postResponse = await requestLinuxDoToken(provider, params, "client_secret_post");

  if (postResponse.ok) {
    return { tokens: postResponse.payload as TokenSet };
  }

  const basicResponse = await requestLinuxDoToken(provider, params, "client_secret_basic");

  if (basicResponse.ok) {
    return { tokens: basicResponse.payload as TokenSet };
  }

  console.error("[auth][linuxdo] token request failed", {
    clientSecretPost: getLinuxDoFailureMessage(postResponse),
    clientSecretBasic: getLinuxDoFailureMessage(basicResponse)
  });

  throw new Error(`Linux.do token request failed: ${getLinuxDoFailureMessage(postResponse)} / ${getLinuxDoFailureMessage(basicResponse)}`);
}

async function requestLinuxDoUserinfo({ tokens }: { tokens: TokenSet }) {
  if (!tokens.access_token) {
    throw new Error("Linux.do OAuth response missing access_token");
  }

  const userinfoUrls = process.env.LINUXDO_USERINFO_URL
    ? [process.env.LINUXDO_USERINFO_URL]
    : [linuxDoUserinfoUrl, "https://connect.linux.do/oauth2/userinfo", "https://connect.linux.do/userinfo"];
  const failures: Array<{ url: string; result: LinuxDoEndpointResult }> = [];

  for (const userinfoUrl of userinfoUrls) {
    const response = await fetch(userinfoUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokens.access_token}`
      },
      signal: AbortSignal.timeout(linuxDoRequestTimeoutMs)
    }).catch((error: unknown) => ({ error }));

    if (!(response instanceof Response)) {
      failures.push({
        url: userinfoUrl,
        result: {
          ok: false,
          status: "network",
          payload: { error: response.error instanceof Error ? response.error.message : String(response.error) }
        }
      });
      continue;
    }

    const payload = await readJsonResponse(response);

    if (response.ok) {
      return payload as LinuxDoProfile;
    }

    failures.push({ url: userinfoUrl, result: { ok: false, status: response.status, payload } });
  }

  const claims = getLinuxDoClaims(tokens);

  if (readProfileId(claims.sub)) {
    return claims as LinuxDoProfile;
  }

  console.error("[auth][linuxdo] userinfo request failed", {
    attempts: failures.map((failure) => ({
      url: failure.url,
      error: getLinuxDoFailureMessage(failure.result)
    }))
  });

  throw new Error(`Linux.do userinfo request failed: ${failures.map((failure) => getLinuxDoFailureMessage(failure.result)).join(" / ") || "network"}`);
}

function linuxDoProvider(): OAuthConfig<LinuxDoProfile> {
  return {
    id: "linuxdo",
    name: "Linux.do",
    type: "oauth",
    authorization: {
      url: process.env.LINUXDO_AUTHORIZATION_URL ?? linuxDoAuthorizationUrl,
      params: { scope: "openid profile email" }
    },
    token: {
      url: process.env.LINUXDO_TOKEN_URL ?? linuxDoTokenUrl,
      request: requestLinuxDoTokens
    },
    userinfo: {
      url: process.env.LINUXDO_USERINFO_URL ?? linuxDoUserinfoUrl,
      request: requestLinuxDoUserinfo
    },
    clientId: process.env.LINUXDO_CLIENT_ID,
    clientSecret: process.env.LINUXDO_CLIENT_SECRET,
    checks: ["state"],
    profile(profile, tokens) {
      const payload = getLinuxDoProfilePayload(profile);
      const claims = getLinuxDoClaims(tokens);
      const id =
        readProfileId(payload.id) ??
        readProfileId(payload.sub) ??
        readProfileId(payload.user_id) ??
        readProfileId(payload.uid) ??
        readProfileId(claims.sub) ??
        readProfileId(payload.username) ??
        readProfileId(payload.login) ??
        readProfileId(payload.preferred_username);
      const name =
        readProfileString(payload.name) ??
        readProfileString(payload.nickname) ??
        readProfileString(payload.display_name) ??
        readProfileString(payload.username) ??
        readProfileString(payload.login) ??
        "Linux.do 用户";

      if (!id) {
        throw new Error("Linux.do profile response is missing a stable user id");
      }

      return {
        id,
        name,
        email: readProfileString(payload.email) ?? null,
        image: normalizeLinuxDoAvatar(payload.avatar_url ?? payload.avatar ?? payload.picture ?? payload.image ?? payload.avatar_template) ?? null
      };
    }
  };
}

async function authorizeCredentials(credentials: Record<"email" | "password", string> | undefined) {
  const db = getDb();

  if (!db || !credentials?.email || !credentials.password) {
    return null;
  }

  const email = credentials.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user?.passwordHash) {
    return null;
  }

  const passwordMatches = await compare(credentials.password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image
  };
}

const db = getDb();

export const authOptions: NextAuthOptions = {
  adapter: db
    ? (DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens
      }) as Adapter)
    : undefined,
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" }
      },
      authorize: authorizeCredentials
    }),
    linuxDoProvider()
  ],
  pages: {
    signIn: "/login"
  },
  debug: process.env.NEXTAUTH_DEBUG === "true",
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
      }

      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (!user.id) {
        return;
      }

      await bootstrapUserProfile({
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        image: user.image
      });
      await touchUserSignIn(user.id);
    }
  }
};

export const getProfileRole = cache(async (userId: string) => {
  const database = getDb();

  if (!database) {
    return null;
  }

  const [profile] = await database.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return profile?.role ?? null;
});
