import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { resolveLocalMediaPath } from "@/lib/media/local";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const maxMediaBytes = 1024 * 1024 * 1024;
const allowedExtensions = new Set(["mp4", "webm", "mov", "m4v"]);

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type MediaStorage = "local" | "supabase";

function getMediaBucket() {
  return process.env.MEDIA_BUCKET?.trim() || "media";
}

function getMediaStorage(): MediaStorage {
  return process.env.MEDIA_STORAGE?.trim().toLowerCase() === "local" ? "local" : "supabase";
}

function getMediaExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && allowedExtensions.has(fromName)) {
    return fromName;
  }

  if (file.type === "video/mp4") {
    return "mp4";
  }

  if (file.type === "video/webm") {
    return "webm";
  }

  if (file.type === "video/quicktime") {
    return "mov";
  }

  if (file.type === "video/x-m4v") {
    return "m4v";
  }

  return "";
}

function positiveInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function slugifyPathPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureMediaBucket(supabase: SupabaseAdminClient, bucket: string) {
  const { data } = await supabase.storage.getBucket(bucket);

  if (data) {
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: `${maxMediaBytes}`
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

async function saveLocalMedia(file: File, objectPath: string) {
  const resolved = resolveLocalMediaPath(objectPath.split("/"));

  if (!resolved) {
    throw new Error("Invalid local media path");
  }

  await mkdir(path.dirname(resolved.filePath), { recursive: true });
  await writeFile(resolved.filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Media file is required" }, { status: 400 });
  }

  if (file.size > maxMediaBytes) {
    return NextResponse.json({ error: "Media file is too large" }, { status: 400 });
  }

  const extension = getMediaExtension(file);

  if (!extension) {
    return NextResponse.json({ error: "Unsupported media file type" }, { status: 400 });
  }

  const bucket = getMediaBucket();
  const seasonNumber = positiveInt(formData?.get("seasonNumber") ?? null, 1);
  const episodeNumber = positiveInt(formData?.get("episodeNumber") ?? null, 1);
  const title = String(formData?.get("title") ?? "");
  const season = String(seasonNumber).padStart(2, "0");
  const episode = String(episodeNumber).padStart(2, "0");
  const stem = slugifyPathPart(title) || `s${season}e${episode}`;
  const objectPath = `s${season}/${stem}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const mediaStorage = getMediaStorage();

  if (mediaStorage === "local") {
    try {
      await saveLocalMedia(file, objectPath);
    } catch {
      return NextResponse.json({ error: "Failed to save local media" }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: {
          bucket: "local",
          path: objectPath,
          mediaUrl: `local/${objectPath}`
        }
      },
      { status: 201 }
    );
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 });
  }

  try {
    await ensureMediaBucket(supabaseAdmin, bucket);
  } catch {
    return NextResponse.json({ error: "Failed to prepare media bucket" }, { status: 500 });
  }

  const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, file, {
    contentType: file.type || `video/${extension}`,
    upsert: false
  });

  if (error) {
    return NextResponse.json({ error: "Failed to upload media" }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        bucket,
        path: objectPath,
        mediaUrl: `${bucket}/${objectPath}`
      }
    },
    { status: 201 }
  );
}
