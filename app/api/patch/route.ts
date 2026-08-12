// app/api/patch/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Patch Mode — Iterative Code Editing
//
// Receives: currentCode + designPlan (JSON) + instruction + provider/model/apiKey
// Returns:  patchedCode (plain text, same format as original code)
//
// Cost: ~$0.03-0.05 per edit (vs ~$0.14+ for full pipeline re-run)
// Speed: ~5-8 seconds (vs ~45 seconds for full pipeline)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdapter } from "@/lib/llm-adapter";
import type { Provider } from "@/lib/llm-adapter/types";

const PatchSchema = z.object({
  currentCode:  z.string().min(50).max(80000),
  instruction:  z.string().min(3).max(2000),
  designPlan:   z.string().max(10000).optional(), // Compact JSON summary of plan
  brief:        z.string().max(1000).optional(),
  framework:    z.enum(["nextjs", "react", "html"]).optional().default("html"),
  provider:     z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model:        z.string().optional(),
  apiKey:       z.string().min(1),
});

const SYSTEM_PROMPT = `You are a senior frontend developer applying precise, minimal edits to existing code.

PATCH MODE RULES:
1. Apply ONLY the requested change — nothing else. Preserve all other code exactly as-is.
2. Return the COMPLETE updated code file. No partial snippets.
3. Do NOT add unrequested features, sections, or styles.
4. If the instruction is ambiguous, make the most logical minimal interpretation.
5. Preserve all existing comments, class names, CSS variables, and structure unless directly relevant to the change.
6. Return ONLY the code — no markdown, no explanations.`;

export async function POST(req: NextRequest) {
  let parsed;
  try {
    const body = await req.json();
    parsed = PatchSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { currentCode, instruction, designPlan, brief, framework, provider, model, apiKey } = parsed;

  const adapter = createAdapter(provider as Provider, apiKey, model);

  // Build a compact context message — just what the AI needs, nothing more
  const contextBlock = [
    brief        ? `Original brief: "${brief}"` : "",
    designPlan   ? `Design plan context:\n${designPlan}` : "",
  ].filter(Boolean).join("\n\n");

  const userMessage =
    `${contextBlock ? contextBlock + "\n\n---\n\n" : ""}` +
    `Current code (${framework}):\n\`\`\`\n${currentCode}\n\`\`\`\n\n` +
    `EDIT INSTRUCTION:\n${instruction}`;

  try {
    const patchedCode = await adapter.complete(
      [{ role: "user", content: userMessage }],
      {
        systemPrompt: SYSTEM_PROMPT,
        temperature:  0.3,   // Low temp = precise, conservative edits
        maxTokens:    12000, // Same as code-generator — enough for full page
      }
    );

    // Strip markdown code fences if the model added them
    const cleaned = patchedCode
      .replace(/^```[\w]*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();

    return NextResponse.json({ code: cleaned });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Patch generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
