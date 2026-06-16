import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { episodes } from "@/lib/db/schema";

const allowedStatuses = new Set(["draft", "published", "archived"]);
const allowedMediaExtensions = new Set(["mp4", "webm", "mov", "m4v"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid episodeId" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const title = readText(input.title);
  const description = readText(input.description);
  const seasonNumber = readPositiveInteger(input.seasonNumber);
  const episodeNumber = readPositiveInteger(input.episodeNumber);
  const durationSeconds = readPositiveInteger(input.durationSeconds);
  const status = typeof input.status === "string" ? input.status : undefined;
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);

  if (!title) {
    return NextResponse.json({ error: "Episode title is required" }, { status: 400 });
  }

  if (!seasonNumber || !episodeNumber) {
    return NextResponse.json({ error: "Invalid season or episode number" }, { status: 400 });
  }

  if (!durationSeconds) {
    return NextResponse.json({ error: "Invalid durationSeconds" }, { status: 400 });
  }

  if (mediaUrl === "") {
    return NextResponse.json({ error: "Invalid mediaUrl" }, { status: 400 });
  }

  if (status && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const [data] = await admin.db
      .update(episodes)
      .set({
        seasonNumber,
        episodeNumber,
        title,
        description,
        mediaUrl,
        durationSeconds,
        status: status as "draft" | "published" | "archived" | undefined,
        updatedAt: new Date()
      })
      .where(eq(episodes.id, id))
      .returning();

    if (!data) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("episodes_series_season_episode_unique")) {
      return NextResponse.json({ error: "Episode number already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update episode" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { id } = await params;

  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid episodeId" }, { status: 400 });
  }

  const [data] = await admin.db.delete(episodes).where(eq(episodes.id, id)).returning({ id: episodes.id, seriesId: episodes.seriesId });

  if (!data) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return undefined;
}

function isSafeMediaPath(value: string) {
  const mediaPath = value.trim();

  if (!mediaPath || /[\x00-\x1F\x7F]/.test(mediaPath) || mediaPath.includes("\\")) {
    return false;
  }

  const parts = mediaPath.split("/");

  if (parts.length === 0 || parts.some((part) => !part || part === "." || part === "..")) {
    return false;
  }

  const extension = parts.at(-1)?.split(".").pop()?.toLowerCase();
  return Boolean(extension && allowedMediaExtensions.has(extension));
}

function normalizeMediaUrl(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return "";
  }

  const mediaUrl = value.trim();

  if (!mediaUrl || /[\x00-\x1F\x7F]/.test(mediaUrl) || mediaUrl.includes("\\")) {
    return "";
  }

  if (/^https?:\/\//i.test(mediaUrl)) {
    try {
      const url = new URL(mediaUrl);
      return url.protocol === "http:" || url.protocol === "https:" ? mediaUrl : "";
    } catch {
      return "";
    }
  }

  if (mediaUrl.startsWith("/")) {
    if ((mediaUrl.startsWith("/mock/") || mediaUrl.startsWith("/api/mock-media/")) && isSafeMediaPath(mediaUrl.slice(1))) {
      return mediaUrl;
    }

    return "";
  }

  if (mediaUrl.startsWith("local/")) {
    return isSafeMediaPath(mediaUrl.slice("local/".length)) ? mediaUrl : "";
  }

  return "";
}
