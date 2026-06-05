import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { getEpisode } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;
  const episode = await getEpisode(id);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  if (episode.mediaUrl.startsWith("local/")) {
    const localPath = episode.mediaUrl.slice("local/".length);
    const pathParts = localPath.split("/").filter(Boolean);

    if (pathParts.length === 0 || pathParts.some((part) => part === "." || part === "..")) {
      return NextResponse.json({ error: "Invalid local media path" }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        mediaUrl: `/api/media/local/${pathParts.map(encodeURIComponent).join("/")}`,
        expiresIn: null
      }
    });
  }

  if (!episode.mediaUrl || episode.mediaUrl.startsWith("http") || episode.mediaUrl.startsWith("/")) {
    return NextResponse.json({ data: { mediaUrl: episode.mediaUrl, expiresIn: null } });
  }

  const { supabase } = auth;
  const [bucket, ...pathParts] = episode.mediaUrl.split("/");
  const path = pathParts.join("/");

  if (!bucket || !path) {
    return NextResponse.json({ error: "Invalid storage media path" }, { status: 400 });
  }

  const expiresIn = 60 * 15;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error || !data) {
    return NextResponse.json({ error: "Failed to sign media URL" }, { status: 500 });
  }

  return NextResponse.json({ data: { mediaUrl: data.signedUrl, expiresIn } });
}
