import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/bootstrap";
import { hasDatabaseEnv } from "@/lib/db/client";

export async function POST() {
  if (!hasDatabaseEnv()) {
    return NextResponse.json({ data: { bootstrapped: false, reason: "database_not_configured" } });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: { bootstrapped: true } });
}
