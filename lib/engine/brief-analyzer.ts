import type { LLMAdapter } from "./llm-utils";
import { extractJSON } from "./llm-utils";
import { z } from "zod";

// ── Schema ─────────────────────────────────────────────────────────────────────
const BriefAnalysisSchema = z.object({
  subject:     z.string().min(1),
  audience:    z.string().min(1),
  primaryJob:  z.string().min(1),
  tone:        z.string().min(1),
  industry:    z.string().min(1),
  constraints: z.array(z.string()).default([]),
});

const BRIEF_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string", minLength: 1 },
    audience: { type: "string", minLength: 1 },
    primaryJob: { type: "string", minLength: 1 },
    tone: { type: "string", minLength: 1 },
    industry: { type: "string", minLength: 1 },
    constraints: { type: "array", items: { type: "string" } },
  },
  required: ["subject", "audience", "primaryJob", "tone", "industry", "constraints"],
};

export type BriefAnalysis = z.infer<typeof BriefAnalysisSchema> & {
  rawBrief: string;
};

type LocalDirection = {
  pattern: RegExp;
  industry: string;
  audience: string;
  primaryJob: string;
  tone: string;
};

const LOCAL_DIRECTIONS: LocalDirection[] = [
  {
    pattern: /مطعم|restaurant|مطاعم|cafe|café|مقهى|food|dining/i,
    industry: "Food & Hospitality",
    audience: "Local diners and visitors",
    primaryJob: "Turn interest into a reservation, visit, or direct enquiry",
    tone: "Appetizing, grounded, hospitable, place-specific",
  },
  {
    pattern: /عقار|architecture|architect|عمارة|interior|داخلي|hospitality design/i,
    industry: "Architecture / Interior Design",
    audience: "Prospective clients and project partners",
    primaryJob: "Build confidence in the practice and start a qualified enquiry",
    tone: "Measured, spatial, material, exacting",
  },
  {
    pattern: /skincare|skin care|بشرة|beauty|تجميل|cosmetic/i,
    industry: "Beauty / Skincare",
    audience: "Prospective customers researching the product",
    primaryJob: "Explain the product truthfully and guide a purchase decision",
    tone: "Tactile, precise, reassuring, evidence-aware",
  },
  {
    pattern: /saas|analytics|dashboard|software|برنامج|تحليلات|منصة/i,
    industry: "Software / SaaS",
    audience: "Prospective product users and decision makers",
    primaryJob: "Clarify the product value and start a trial or sales conversation",
    tone: "Direct, systematic, credible, efficient",
  },
  {
    pattern: /law|legal|محام|قانون/i,
    industry: "Legal Services",
    audience: "Prospective clients seeking legal guidance",
    primaryJob: "Establish trust and start a confidential consultation",
    tone: "Authoritative, calm, discreet, clear",
  },
];

function hasArabic(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}

/**
 * A conservative local extraction path for Fast mode and provider outages.
 * It never invents business facts: the supplied brief remains the subject and
 * source of truth, while only the design category and page job are inferred.
 */
export function analyzeBriefLocally(brief: string, existingCode?: string): BriefAnalysis {
  const compactBrief = brief.replace(/\s+/g, " ").trim();
  const direction = LOCAL_DIRECTIONS.find((candidate) => candidate.pattern.test(compactBrief));
  const constraints: string[] = [];
  if (hasArabic(compactBrief)) constraints.push("Arabic-first content with correct RTL behavior");
  if (/القاهرة|cairo/i.test(compactBrief)) constraints.push("Cairo context supplied by the brief");
  if (existingCode?.trim()) constraints.push("Preserve and improve the supplied implementation where safe");

  return {
    subject: compactBrief.slice(0, 280),
    audience: direction?.audience ?? "The people explicitly targeted by the brief",
    primaryJob: direction?.primaryJob ?? "Communicate the offer clearly and lead to one truthful primary action",
    tone: direction?.tone ?? "Specific, clear, restrained, context-aware",
    industry: direction?.industry ?? "General Business",
    constraints,
    rawBrief: brief,
  };
}

const SYSTEM_PROMPT = `You are a senior product designer analyzing a design brief to extract structured information.
Your goal is to identify:
1. The specific subject of this design (what it IS, concretely)
2. The primary audience (who will use it, specifically)
3. The single most important job of this page/component (not multiple — the ONE thing it must accomplish)
4. The appropriate tone (specific adjectives, not generic ones like "professional" or "modern")
5. The industry vertical
6. Any hard constraints from the brief

Be specific. "An enterprise B2B SaaS dashboard for logistics managers tracking live shipments" is useful. "A website for a business" is not.
Industry means the market category of the subject, not the requested artifact. For example, a skincare brand or skincare launch identity is "Beauty / Skincare", never "Personal Brand" merely because the word brand appears. Prefer a concrete product/service vertical over broad labels such as Portfolio, Startup, or Personal Brand whenever the brief supplies one.

Respond ONLY in valid JSON matching this exact schema:
{
  "subject": "string — specific, concrete description",
  "audience": "string — who will use this",
  "primaryJob": "string — single most important page job",
  "tone": "string — 3-5 specific descriptive words",
  "industry": "string — industry vertical",
  "constraints": ["array of any explicit technical/design constraints mentioned"]
}`;

export async function analyzeBrief(llm: LLMAdapter, brief: string, existingCode?: string): Promise<BriefAnalysis> {
  const userMessage = existingCode
    ? `Design brief:\n${brief}\n\nExisting code to redesign:\n\`\`\`\n${existingCode.slice(0, 3000)}\n\`\`\``
    : `Design brief:\n${brief}`;

  let raw = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt: SYSTEM_PROMPT,
    temperature:  0.3,
    maxTokens:    1000,
    reasoningEffort: "low",
    timeoutMs: 35_000,
    responseFormat: { name: "brief_analysis", schema: BRIEF_ANALYSIS_JSON_SCHEMA },
  });

  // First attempt
  let parsed = extractJSON<z.infer<typeof BriefAnalysisSchema>>(raw, "Brief Analyzer");
  const result = BriefAnalysisSchema.safeParse(parsed);

  if (!result.success) {
    // One retry with explicit schema feedback
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    const retryMsg = `${userMessage}\n\nYour previous response had schema issues:\n${issues}\n\nPlease fix and respond with ONLY valid JSON.`;
    raw    = await llm.complete([{ role: "user", content: retryMsg }], {
      systemPrompt:    SYSTEM_PROMPT,
      temperature:     0.1,
      maxTokens:       800,
      reasoningEffort: "low",
      timeoutMs:       35_000,
      responseFormat:  { name: "brief_analysis", schema: BRIEF_ANALYSIS_JSON_SCHEMA },
    });
    parsed = BriefAnalysisSchema.parse(
      extractJSON<z.infer<typeof BriefAnalysisSchema>>(raw, "Brief Analyzer")
    );
  } else {
    parsed = result.data;
  }

  return { ...parsed, rawBrief: brief };
}
