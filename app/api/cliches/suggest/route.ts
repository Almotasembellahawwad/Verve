import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { submitClicheSuggestionUseCase } from "@/lib/application/content-use-cases";
import { LoggedClicheSuggestionRepository } from "@/lib/adapters/storage/logged-cliche-suggestion-repository";
import { checkRateLimit, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";

const SuggestionSchema = z.object({
  pattern: z.string().min(5).max(200),
  example: z.string().min(5).max(500),
  category: z.enum(["color", "typography", "layout", "motion", "copy"]),
  severity: z.enum(["high", "medium", "low"]).optional().default("medium"),
  context: z.string().max(1_000).optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["cliches-suggest"]!);
  if (rateLimited) return rateLimited;
  const requestId = uuidv4();
  const parsed = SuggestionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", requestId, details: parsed.error.issues }, { status: 400 });
  }
  submitClicheSuggestionUseCase(new LoggedClicheSuggestionRepository(), parsed.data, requestId);
  return NextResponse.json({ success: true, requestId, message: "Thank you! Your pattern was submitted for review." });
}
