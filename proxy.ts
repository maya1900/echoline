import { NextResponse, type NextRequest } from "next/server";

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const maxBuckets = 5000;

const defaultApiRule: RateLimitRule = { key: "api", limit: 300, windowMs: 60_000 };
const mediaRule: RateLimitRule = { key: "media", limit: 900, windowMs: 60_000 };

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function getRateLimitRule(pathname: string, method: string): RateLimitRule {
  if (pathname.startsWith("/api/mock-media/") || pathname.startsWith("/api/media/local/")) {
    return mediaRule;
  }

  if (pathname === "/api/auth/register" && method === "POST") {
    return { key: "auth-register", limit: 5, windowMs: 60 * 60_000 };
  }

  if (pathname === "/api/auth/callback/credentials" && method === "POST") {
    return { key: "auth-credentials", limit: 10, windowMs: 15 * 60_000 };
  }

  if (pathname === "/api/define" && method === "GET") {
    return { key: "define", limit: 60, windowMs: 60_000 };
  }

  if (pathname === "/api/attempts/score" && method === "POST") {
    return { key: "attempts-score", limit: 20, windowMs: 60_000 };
  }

  if (pathname === "/api/settings/asr-test" && method === "POST") {
    return { key: "asr-test", limit: 10, windowMs: 60_000 };
  }

  return defaultApiRule;
}

function cleanupBuckets(now: number) {
  if (buckets.size <= maxBuckets) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= maxBuckets) {
    return;
  }

  const overflow = buckets.size - maxBuckets;
  let deleted = 0;

  for (const key of buckets.keys()) {
    buckets.delete(key);
    deleted += 1;

    if (deleted >= overflow) {
      break;
    }
  }
}

function hitRateLimit(identifier: string, rule: RateLimitRule) {
  const now = Date.now();
  const key = `${rule.key}:${identifier}`;

  cleanupBuckets(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    buckets.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: rule.limit - 1,
      resetAt,
      retryAfter: 0
    };
  }

  if (current.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - current.count),
    resetAt: current.resetAt,
    retryAfter: 0
  };
}

export function proxy(request: NextRequest) {
  const rule = getRateLimitRule(request.nextUrl.pathname, request.method);
  const result = hitRateLimit(getClientIp(request), rule);
  const headers = {
    "X-RateLimit-Limit": String(rule.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests"
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(result.retryAfter)
        }
      }
    );
  }

  const response = NextResponse.next();

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*"
};
