import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";

const allowedStatuses = new Set(["draft", "published", "archived"]);
const allowedMediaExtensions = new Set(["mp4", "webm", "mov", "m4v"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getMediaBucket() {
  return process.env.MEDIA_BUCKET?.trim() || "media";
}

function readPositiveInteger(value: unknown, fallback?: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function isSafeMediaPath(value: string) {
  const path = value.trim();

  if (!path || /[\x00-\x1F\x7F]/.test(path) || path.includes("\\")) {
    return false;
  }

  const parts = path.split("/");

  if (parts.length === 0 || parts.some((part) => !part || part === "." || part === "..")) {
    return false;
  }

  const extension = parts.at(-1)?.split(".").pop()?.toLowerCase();
  return Boolean(extension && allowedMediaExtensions.has(extension));
}

function isStorageMediaUrl(mediaUrl: string) {
  const [bucket, ...pathParts] = mediaUrl.split("/");
  return bucket === getMediaBucket() && isSafeMediaPath(pathParts.join("/"));
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

  return isStorageMediaUrl(mediaUrl) ? mediaUrl : "";
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const seriesId = typeof input.seriesId === "string" ? input.seriesId.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const seasonNumber = readPositiveInteger(input.seasonNumber, 1);
  const episodeNumber = readPositiveInteger(input.episodeNumber);
  const durationSeconds = readPositiveInteger(input.durationSeconds);
  const status = typeof input.status === "string" ? input.status : "draft";
  const mediaSource = typeof input.mediaSource === "string" ? input.mediaSource : "";
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);

  if (!uuidPattern.test(seriesId)) {
    return NextResponse.json({ error: "Invalid seriesId" }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Episode title is required" }, { status: 400 });
  }

  if (!seasonNumber || !episodeNumber) {
    return NextResponse.json({ error: "Invalid season or episode number" }, { status: 400 });
  }

  if (!durationSeconds) {
    return NextResponse.json({ error: "Invalid durationSeconds" }, { status: 400 });
  }

  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (mediaUrl === "") {
    return NextResponse.json({ error: "Invalid mediaUrl" }, { status: 400 });
  }

  if (mediaSource === "storage") {
    if (!mediaUrl) {
      return NextResponse.json({ error: "Storage mediaUrl is required" }, { status: 400 });
    }

    if (!isStorageMediaUrl(mediaUrl)) {
      return NextResponse.json({ error: "Storage mediaUrl must use the configured media bucket" }, { status: 400 });
    }
  }

  const { data, error } = await admin.supabase
    .from("episodes")
    .insert({
      series_id: seriesId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      title,
      description,
      media_url: mediaUrl,
      duration_seconds: durationSeconds,
      status
    })
    .select("id,series_id,season_number,episode_number,title,description,media_url,duration_seconds,status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create episode" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
