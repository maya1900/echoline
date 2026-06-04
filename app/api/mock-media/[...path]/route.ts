import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const mockRoot = path.resolve(process.cwd(), "mock");

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathParts } = await params;
  const target = path.resolve(mockRoot, ...pathParts);

  if (!target.startsWith(`${mockRoot}${path.sep}`) || !target.endsWith(".mp4") || !fs.existsSync(target)) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const stat = fs.statSync(target);
  const range = request.headers.get("range");

  if (!range) {
    return new Response(fs.createReadStream(target) as unknown as BodyInit, {
      headers: {
        "Content-Length": String(stat.size),
        "Content-Type": "video/mp4"
      }
    });
  }

  const match = range.match(/bytes=(\d+)-(\d*)/);
  const start = Number(match?.[1] ?? 0);
  const end = match?.[2] ? Number(match[2]) : stat.size - 1;

  if (start >= stat.size || end >= stat.size || start > end) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${stat.size}`
      }
    });
  }

  return new Response(fs.createReadStream(target, { start, end }) as unknown as BodyInit, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Type": "video/mp4"
    }
  });
}
