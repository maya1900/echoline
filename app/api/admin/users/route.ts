import { NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/admin-data";
import { requireAdminRequest } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 });
  }

  const users = await listAdminUsers();

  return NextResponse.json({ data: users });
}
