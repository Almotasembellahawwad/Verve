import { getLLMAdapter } from "../llm-adapter";
import { getAllCliches } from "./blocklist-filter";

export type DesignCritique = {
  hierarchyIssues: { issue: string; severity: "high" | "medium" | "low"; fix: string }[];
  contrastIssues: { issue: string; severity: "high" | "medium" | "low"; fix: string }[];
  spacingIssues: { issue: string; severity: "high" | "medium" | "low"; fix: string }[];
  typographyIssues: { issue: string; severity: "high" | "medium" | "low"; fix: string }[];
  clicheMatches: { pattern: string; evidence: string; fix: string }[];
  signatureOpportunities: string[];
  overallScore: number;
  summary: string;
};

export async function critiqueDesign(input: {
  url?: string;
  code?: string;
  screenshot?: string; // base64 or description
}): Promise<DesignCritique> {
  const llm = getLLMAdapter();
  const clicheData = getAllCliches();

  const blocklistSummary = clicheData.cliches
    .map((c) => `[${c.severity}] ${c.category}: ${c.pattern}`)
    .join("\n");

  const systemPrompt = `You are an expert design critic with 15 years of experience in product design, typography, and visual systems.

Your critique must be:
- SPECIFIC: name exact measurements, values, and elements — not "the spacing feels off" but "the 8px gap between the headline and subhead is too tight for the font size used (likely 48px+), which creates optical crowding"
- ACTIONABLE: every issue must have a concrete fix
- HONEST: do not soften criticism. If something is generic, say so.

Known AI-design clichés to watch for:
${blocklistSummary}

Critique dimensions:
1. Hierarchy: Is information priority visually clear? Does scale, weight, and position communicate importance?
2. Contrast: Is color contrast sufficient for accessibility? Are there contrast-as-composition opportunities being missed?
3. Spacing: Is the spatial rhythm consistent? Are there obvious tension or crowding issues?
4. Typography: Is the type pairing deliberate? Is scale contrast being used? Are line-height and measure appropriate?
5. Clichés: Which known AI-design tells are present?
6. Signature Opportunities: What ONE bold move would make this design memorable?

Respond ONLY in valid JSON:
{
  "hierarchyIssues": [{ "issue": "string", "severity": "high|medium|low", "fix": "string" }],
  "contrastIssues": [{ "issue": "string", "severity": "high|medium|low", "fix": "string" }],
  "spacingIssues": [{ "issue": "string", "severity": "high|medium|low", "fix": "string" }],
  "typographyIssues": [{ "issue": "string", "severity": "high|medium|low", "fix": "string" }],
  "clicheMatches": [{ "pattern": "string", "evidence": "string", "fix": "string" }],
  "signatureOpportunities": ["string — specific, named, implementable ideas"],
  "overallScore": number,
  "summary": "string — 3-4 sentences, specific and honest"
}`;

  let userContent = "Please critique this design:\n\n";
  if (input.url) userContent += `URL: ${input.url}\n`;
  if (input.code) userContent += `Code:\n\`\`\`\n${input.code.slice(0, 6000)}\n\`\`\`\n`;
  if (input.screenshot) userContent += `Screenshot description / content: ${input.screenshot}\n`;

  if (!input.url && !input.code && !input.screenshot) {
    throw new Error("At least one of url, code, or screenshot is required");
  }

  const raw = await llm.complete([{ role: "user", content: userContent }], {
    systemPrompt,
    temperature: 0.4,
    maxTokens: 3000,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Design critic returned invalid JSON");

  return JSON.parse(jsonMatch[0]) as DesignCritique;
}
