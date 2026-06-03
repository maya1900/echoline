import { NextResponse } from "next/server";
import { getEpisode } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await getEpisode(id);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  if (!episode.mediaUrl || episode.mediaUrl.startsWith("http") || episode.mediaUrl.startsWith("/")) {
    return NextResponse.json({ data: { mediaUrl: episode.mediaUrl, expiresIn: null } });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ data: { mediaUrl: episode.mediaUrl, expiresIn: null } });
  }

  const [bucket, ...pathParts] = episode.mediaUrl.split("/");
  const path = pathParts.join("/");

  if (!bucket || !path) {
    return NextResponse.json({ data: { mediaUrl: episode.mediaUrl, expiresIn: null } });
  }

  const expiresIn = 60 * 15;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to sign media URL" }, { status: 500 });
  }

  return NextResponse.json({ data: { mediaUrl: data.signedUrl, expiresIn } });
}
