import { NextResponse } from "next/server";
import { listAdminUsers } from "@/lib/admin-data";
import { requireAdminRequest } from "@/lib/auth/api";

export async function GET() {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const users = await listAdminUsers();

  return NextResponse.json({ data: users });
}
