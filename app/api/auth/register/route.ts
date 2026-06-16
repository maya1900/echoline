import { hash } from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/admin-data";
import { getDb } from "@/lib/db/client";
import { profiles, studyPlans, users } from "@/lib/db/schema";

class RegistrationError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function readEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function POST(request: Request) {
  const db = getDb();

  if (!db) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = readEmail(body.email);
  const password = readPassword(body.password);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  const siteSettings = await getSiteSettings();
  const userId = crypto.randomUUID();
  const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : email.split("@")[0];
  const passwordHash = await hash(password, 12);
  const now = new Date();
  let role: "admin" | "user" = "user";

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(827173919)`);

      const [existingUser] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

      if (existingUser) {
        throw new RegistrationError("该邮箱已注册，请直接登录。", 409);
      }

      const [{ value: userCount }] = await tx.select({ value: count() }).from(users);
      const isFirstUser = userCount === 0;

      if (!isFirstUser && !siteSettings.allowPublicSignup) {
        throw new RegistrationError("当前未开放注册，请联系管理员创建账号。", 403);
      }

      role = isFirstUser ? "admin" : "user";

      await tx.insert(users).values({
        id: userId,
        email,
        name: displayName,
        passwordHash,
        createdAt: now,
        updatedAt: now
      });

      await tx.insert(profiles).values({
        id: userId,
        email,
        displayName,
        role,
        createdAt: now,
        updatedAt: now
      });

      await tx.insert(studyPlans).values({
        userId,
        dailyMinutes: siteSettings.defaultDailyMinutes,
        dailyLines: siteSettings.defaultDailyLines,
        dailyRepeats: siteSettings.defaultDailyRepeats,
        active: true,
        createdAt: now,
        updatedAt: now
      });
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "该邮箱已注册，请直接登录。" }, { status: 409 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to register" }, { status: 500 });
  }

  return NextResponse.json({ data: { id: userId, email, role } }, { status: 201 });
}
