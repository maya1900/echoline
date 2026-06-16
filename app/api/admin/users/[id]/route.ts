import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { profiles } from "@/lib/db/schema";

type RoleUpdate = {
  role?: "user" | "admin";
  displayName?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = (await request.json().catch(() => ({}))) as RoleUpdate;

  if (body.role && !["user", "admin"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (body.role === "user") {
    const [{ value: adminCount }] = await admin.db.select({ value: count() }).from(profiles).where(eq(profiles.role, "admin"));

    if (adminCount <= 1) {
      return NextResponse.json({ error: "At least one admin is required" }, { status: 400 });
    }
  }

  const updatePayload: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };

  if (body.role) {
    updatePayload.role = body.role;
  }

  if (typeof body.displayName === "string") {
    updatePayload.displayName = body.displayName.trim();
  }

  if (Object.keys(updatePayload).length === 1) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const [data] = await admin.db
    .update(profiles)
    .set(updatePayload)
    .where(eq(profiles.id, id))
    .returning({
      id: profiles.id,
      email: profiles.email,
      display_name: profiles.displayName,
      role: profiles.role,
      created_at: profiles.createdAt
    });

  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
