import { NextRequest, NextResponse } from "next/server";
import { critiqueDesign } from "@/lib/engine/design-critic";
import { z } from "zod";

const RequestSchema = z.object({
  url: z.string().url().optional(),
  code: z.string().max(20000).optional(),
  screenshot: z.string().max(10000).optional(),
  apiKey: z.string().optional(),
}).refine((d) => d.url ?? d.code ?? d.screenshot, {
  message: "At least one of url, code, or screenshot is required",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.apiKey) {
      process.env.ANTHROPIC_API_KEY = parsed.data.apiKey;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: "No API key configured. Please provide your Anthropic API key in the settings panel.",
          code: "NO_API_KEY",
        },
        { status: 401 }
      );
    }

    const critique = await critiqueDesign(parsed.data);
    return NextResponse.json({ critique });
  } catch (err) {
    console.error("[/api/critique]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
