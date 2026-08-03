import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const readmePath = join(process.cwd(), "README.md");
    const content = readFileSync(readmePath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="VERVE_README.md"',
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "README not found" }, { status: 404 });
  }
}
