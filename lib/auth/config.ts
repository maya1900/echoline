import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthOptions, Profile } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { getDb } from "@/lib/db/client";
import { accounts, profiles, sessions, users, verificationTokens } from "@/lib/db/schema";
import { bootstrapUserProfile, touchUserSignIn } from "@/lib/auth/profile";

type LinuxDoProfile = Profile & {
  id?: string | number;
  sub?: string;
  username?: string;
  login?: string;
  name?: string;
  nickname?: string;
  email?: string;
  avatar_url?: string;
  avatar?: string;
  picture?: string;
};

function linuxDoProvider(): OAuthConfig<LinuxDoProfile> {
  return {
    id: "linuxdo",
    name: "Linux.do",
    type: "oauth",
    authorization: {
      url: process.env.LINUXDO_AUTHORIZATION_URL ?? "https://connect.linux.do/oauth2/authorize",
      params: { scope: "openid profile email" }
    },
    token: process.env.LINUXDO_TOKEN_URL ?? "https://connect.linux.do/oauth2/token",
    userinfo: process.env.LINUXDO_USERINFO_URL ?? "https://connect.linux.do/api/user",
    clientId: process.env.LINUXDO_CLIENT_ID,
    clientSecret: process.env.LINUXDO_CLIENT_SECRET,
    checks: ["state"],
    profile(profile) {
      const id = profile.id ?? profile.sub ?? profile.username ?? profile.login;
      const name = profile.name ?? profile.nickname ?? profile.username ?? profile.login ?? "Linux.do 用户";

      return {
        id: String(id),
        name,
        email: profile.email ?? null,
        image: profile.avatar_url ?? profile.avatar ?? profile.picture ?? null
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

export async function getProfileRole(userId: string) {
  const database = getDb();

  if (!database) {
    return null;
  }

  const [profile] = await database.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return profile?.role ?? null;
}
