import { NextResponse } from "next/server";
import { listSeries } from "@/lib/data";

export async function GET() {
  const series = await listSeries();
  return NextResponse.json({ data: series });
}
