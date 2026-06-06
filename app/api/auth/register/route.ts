import { hash } from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/admin-data";
import { getDb } from "@/lib/db/client";
import { profiles, studyPlans, users } from "@/lib/db/schema";

function readEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(value: unknown) {
  return typeof value === "string" ? value : "";
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

  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  const isFirstUser = userCount === 0;
  const siteSettings = await getSiteSettings();

  if (!isFirstUser && !siteSettings.allowPublicSignup) {
    return NextResponse.json({ error: "当前未开放注册，请联系管理员创建账号。" }, { status: 403 });
  }

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    return NextResponse.json({ error: "该邮箱已注册，请直接登录。" }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : email.split("@")[0];
  const passwordHash = await hash(password, 12);
  const now = new Date();

  await db.transaction(async (tx) => {
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
      role: isFirstUser ? "admin" : "user",
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

  return NextResponse.json({ data: { id: userId, email, role: isFirstUser ? "admin" : "user" } }, { status: 201 });
}
