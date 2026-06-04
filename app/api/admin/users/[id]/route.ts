import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RoleUpdate = {
  role?: "user" | "admin";
  displayName?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as RoleUpdate;
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 });
  }

  if (body.role && !["user", "admin"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (body.role === "user") {
    const { count, error: countError } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "At least one admin is required" }, { status: 400 });
    }
  }

  const updatePayload: Record<string, string> = {};

  if (body.role) {
    updatePayload.role = body.role;
  }

  if (typeof body.displayName === "string") {
    updatePayload.display_name = body.displayName.trim();
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", id)
    .select("id,email,display_name,role,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
