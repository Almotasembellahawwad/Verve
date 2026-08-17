import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { v4 as uuidv4 } from "uuid";

const SuggestionSchema = z.object({
  pattern:  z.string().min(5).max(200),
  example:  z.string().min(5).max(500),
  category: z.enum(["color", "typography", "layout", "motion", "copy"]),
  severity: z.enum(["high", "medium", "low"]).optional().default("medium"),
  context:  z.string().max(1000).optional(),
});

// In-memory only — no LLM call, just rate-limited logging
export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["cliches-suggest"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();

  try {
    const body   = await req.json();
    const parsed = SuggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", requestId, details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Log server-side only — no API key used here
    console.log(`[CLICHÉ SUGGESTION] requestId=${requestId}`, JSON.stringify(parsed.data, null, 2));

    return NextResponse.json({
      success: true,
      requestId,
      message: "Thank you! Your cliché pattern has been submitted for review.",
    });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR", requestId }, { status: 500 });
  }
}
