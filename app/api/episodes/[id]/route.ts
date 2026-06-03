import { NextResponse } from "next/server";
import { getEpisode, getSeriesForEpisode } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = getEpisode(id);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { ...episode, series: getSeriesForEpisode(id) } });
}
