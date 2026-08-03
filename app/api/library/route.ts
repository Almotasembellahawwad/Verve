import { NextResponse } from "next/server";
import refData from "@/data/reference-library.json";

export async function GET() {
  return NextResponse.json(refData, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
