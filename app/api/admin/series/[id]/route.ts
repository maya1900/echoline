import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { series } from "@/lib/db/schema";

const allowedStatuses = new Set(["draft", "published", "archived"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid seriesId" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const title = readText(input.title);
  const status = typeof input.status === "string" ? input.status : undefined;

  if (!title) {
    return NextResponse.json({ error: "Series title is required" }, { status: 400 });
  }

  if (status && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [data] = await admin.db
    .update(series)
    .set({
      title,
      originalTitle: readText(input.originalTitle) || title,
      description: readText(input.description),
      coverUrl: readText(input.coverUrl),
      difficulty: readText(input.difficulty) || "B1",
      genre: readText(input.genre),
      status: status as "draft" | "published" | "archived" | undefined,
      updatedAt: new Date()
    })
    .where(eq(series.id, id))
    .returning();

  if (!data) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid seriesId" }, { status: 400 });
  }

  const [data] = await admin.db.delete(series).where(eq(series.id, id)).returning({ id: series.id });

  if (!data) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
