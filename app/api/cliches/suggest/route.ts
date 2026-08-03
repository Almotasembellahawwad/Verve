import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SuggestionSchema = z.object({
  pattern: z.string().min(5).max(200),
  example: z.string().min(5).max(500),
  category: z.enum(["color", "typography", "layout", "motion", "copy"]),
  severity: z.enum(["high", "medium", "low"]).optional().default("medium"),
  context: z.string().max(1000).optional(),
});

// In Phase 1, suggestions are logged server-side. 
// Phase 2: wire to a DB or GitHub API to open a PR.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SuggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid suggestion", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Log the suggestion (Phase 2: write to DB/GitHub)
    console.log("[CLICHÉ SUGGESTION]", JSON.stringify(parsed.data, null, 2));

    return NextResponse.json({
      success: true,
      message: "Thank you! Your cliché pattern has been submitted for review. See CONTRIBUTING.md to open a PR directly.",
      suggestion: parsed.data,
    });
  } catch (err) {
    console.error("[/api/cliches/suggest]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
