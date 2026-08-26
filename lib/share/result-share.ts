import { REPOSITORY_URL, SITE_URL } from "@/lib/site";

export type ResultShareInput = {
  projectName: string;
  framework: string;
  score: number;
  grade: string;
  engineeringScore?: number;
};

function cleanLabel(value: string, fallback: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 80) || fallback;
}

export function normalizeResultShareInput(input: ResultShareInput): ResultShareInput {
  return {
    projectName: cleanLabel(input.projectName, "Untitled project"),
    framework: cleanLabel(input.framework, "web"),
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    grade: cleanLabel(input.grade, "—").slice(0, 2).toUpperCase(),
    engineeringScore: typeof input.engineeringScore === "number"
      ? Math.max(0, Math.min(100, Math.round(input.engineeringScore)))
      : undefined,
  };
}

export function buildResultShareText(input: ResultShareInput): string {
  const safe = normalizeResultShareInput(input);
  const engineering = safe.engineeringScore === undefined ? "" : ` · Engineering ${safe.engineeringScore}/100`;
  return `Built ${safe.projectName} with Verve — ${safe.framework}. Distinctiveness ${safe.score}/100 (${safe.grade})${engineering}.\n\nInspect the open-source project intelligence pipeline: ${SITE_URL}`;
}

export function buildResultCardFilename(projectName: string): string {
  const slug = cleanLabel(projectName, "verve-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "verve-project";
  return `${slug}-verve-score.png`;
}

export function buildFeedbackUrl(): string {
  const url = new URL(`${REPOSITORY_URL}/issues/new`);
  url.searchParams.set("template", "feature_request.yml");
  url.searchParams.set("title", "[Public Beta feedback] ");
  return url.toString();
}
