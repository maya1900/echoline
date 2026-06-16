import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { series } from "@/lib/db/schema";

export async function POST(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => ({}));

  const [data] = await admin.db
    .insert(series)
    .values({
      title: body.title,
      originalTitle: body.originalTitle,
      description: body.description,
      coverUrl: body.coverUrl,
      difficulty: body.difficulty ?? "B1",
      genre: body.genre,
      status: body.status ?? "draft",
      createdBy: admin.user.id
    })
    .returning();

  if (!data) {
    return NextResponse.json({ error: "Failed to create series" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
