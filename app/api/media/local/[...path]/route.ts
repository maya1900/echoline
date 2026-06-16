import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { localMediaTypes, resolveLocalMediaPath } from "@/lib/media/local";

export const runtime = "nodejs";

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

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const { path: requestedPath } = await params;
  const resolved = resolveLocalMediaPath(requestedPath);

  if (!resolved) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const fileStat = await stat(resolved.filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "Media file not found" }, { status: 404 });
  }

  const contentType = localMediaTypes[path.extname(resolved.filePath).toLowerCase()] ?? "application/octet-stream";
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
