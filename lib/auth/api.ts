import { NextResponse } from "next/server";
import { getProfileRole } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/bootstrap";
import { getDb, type AppDb } from "@/lib/db/client";
import type { CurrentUser } from "@/lib/auth/profile";

type RequestAuthResult = { error: NextResponse; db: null; user: null } | { error: null; db: AppDb; user: CurrentUser };

export async function requireUserRequest(): Promise<RequestAuthResult> {
  const db = getDb();

  if (!db) {
    return { error: NextResponse.json({ error: "Database is not configured" }, { status: 503 }), db: null, user: null };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), db: null, user: null };
  }

  return { error: null, db, user };
}

export async function requireAdminRequest(): Promise<RequestAuthResult> {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth;
  }

  const role = await getProfileRole(auth.user.id);

  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), db: null, user: null };
  }

  return auth;
}
