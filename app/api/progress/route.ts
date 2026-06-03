import { NextResponse } from "next/server";
import { getProgressData } from "@/lib/data";

export async function GET() {
  const { rows: progressRows, summary: progressSummary } = await getProgressData();
  return NextResponse.json({ data: { summary: progressSummary, rows: progressRows } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ data: { ...body, saved: true } });
}
