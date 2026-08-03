import { getLLMAdapter } from "../llm-adapter";

export type BriefAnalysis = {
  subject: string;
  audience: string;
  primaryJob: string;
  tone: string;
  industry: string;
  constraints: string[];
  rawBrief: string;
};

const SYSTEM_PROMPT = `You are a senior product designer analyzing a design brief to extract structured information.
Your goal is to identify:
1. The specific subject of this design (what it IS, concretely)
2. The primary audience (who will use it, specifically)
3. The single most important job of this page/component (not multiple — the ONE thing it must accomplish)
4. The appropriate tone (specific adjectives, not generic ones like "professional" or "modern")
5. The industry vertical
6. Any hard constraints from the brief

Be specific. "An enterprise B2B SaaS dashboard for logistics managers tracking live shipments" is useful. "A website for a business" is not.

Respond ONLY in valid JSON matching this exact schema:
{
  "subject": "string — specific, concrete description",
  "audience": "string — who will use this",
  "primaryJob": "string — single most important page job",
  "tone": "string — 3-5 specific descriptive words",
  "industry": "string — industry vertical",
  "constraints": ["array of any explicit technical/design constraints mentioned"]
}`;

export async function analyzeBrief(brief: string, existingCode?: string): Promise<BriefAnalysis> {
  const llm = getLLMAdapter();

  const userMessage = existingCode
    ? `Design brief:\n${brief}\n\nExisting code to redesign:\n\`\`\`\n${existingCode.slice(0, 3000)}\n\`\`\``
    : `Design brief:\n${brief}`;

  const raw = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 1000,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Brief analyzer returned invalid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<BriefAnalysis, "rawBrief">;
  return { ...parsed, rawBrief: brief };
}
