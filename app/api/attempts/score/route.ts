import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.episodeId || !body.subtitleLineId || !body.targetText) {
    return NextResponse.json({ error: "Missing scoring input" }, { status: 400 });
  }

  return NextResponse.json({ error: "Repeat scoring service is not connected yet" }, { status: 501 });
}
