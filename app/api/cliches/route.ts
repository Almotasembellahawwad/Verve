import { NextResponse } from "next/server";
import { getAllCliches } from "@/lib/engine/blocklist-filter";

export async function GET() {
  const data = getAllCliches();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
