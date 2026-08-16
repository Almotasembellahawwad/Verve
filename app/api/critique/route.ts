import { NextRequest, NextResponse } from "next/server";
import { critiqueDesign } from "@/lib/engine/design-critic";
import { createAdapter } from "@/lib/llm-adapter";
import { z } from "zod";

const RequestSchema = z.object({
  url:        z.string().url().optional(),
  code:       z.string().max(20000).optional(),
  screenshot: z.string().max(10000).optional(),
  apiKey:     z.string().min(1),
  provider:   z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model:      z.string().optional(),
}).refine((d) => d.url ?? d.code ?? d.screenshot, {
  message: "At least one of url, code, or screenshot is required",
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider, model, ...input } = parsed.data;
    const llm = createAdapter(provider, apiKey, model);

    const critique = await critiqueDesign(llm, input);
    return NextResponse.json({ critique });

  } catch (err) {
    console.error("[/api/critique]", err);
    // Return a generic message — don't leak provider error details
    return NextResponse.json(
      { error: "Critique generation failed. Please try again." },
      { status: 500 }
    );
  }
}
