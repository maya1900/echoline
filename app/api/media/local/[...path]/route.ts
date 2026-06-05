import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const mediaTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".vtt": "text/vtt"
};

function getLocalMediaRoot() {
  return process.env.LOCAL_MEDIA_ROOT?.trim() || "/data/your-english-coach/media";
}

function resolveMediaPath(parts: string[]) {
  const root = path.resolve(/*turbopackIgnore: true*/ getLocalMediaRoot());
  const filePath = path.resolve(/*turbopackIgnore: true*/ root, ...parts);
  const isInsideRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);

  return isInsideRoot ? { root, filePath } : null;
}

function parseRangeHeader(rangeHeader: string | null, size: number) {
  if (!rangeHeader) {
    return null;
  }

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);

  if (!match) {
    return null;
  }

  const [, startValue, endValue] = match;
  const start = startValue ? Number(startValue) : 0;
  const end = endValue ? Number(endValue) : size - 1;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return false;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: requestedPath } = await params;
  const resolved = resolveMediaPath(requestedPath);

  if (!resolved) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const fileStat = await stat(resolved.filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "Media file not found" }, { status: 404 });
  }

  const contentType = mediaTypes[path.extname(resolved.filePath).toLowerCase()] ?? "application/octet-stream";
  const range = parseRangeHeader(request.headers.get("range"), fileStat.size);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=0"
  });

  if (range) {
    const contentLength = range.end - range.start + 1;

    headers.set("Content-Length", String(contentLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);

    return new Response(Readable.toWeb(createReadStream(resolved.filePath, { start: range.start, end: range.end })) as BodyInit, {
      status: 206,
      headers
    });
  }

  headers.set("Content-Length", String(fileStat.size));

  return new Response(Readable.toWeb(createReadStream(resolved.filePath)) as BodyInit, {
    headers
  });
}
