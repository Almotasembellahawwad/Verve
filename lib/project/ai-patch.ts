import { z } from "zod";
import { inspectProductionRisks } from "./project-builder";
import { validateGeneratedProject } from "./project-validator";
import { evaluateProjectReadiness } from "./readiness";
import type { GeneratedProject, ProjectFile } from "./types";

const SAFE_NEW_FILE = /\.(?:html?|css|scss|js|jsx|ts|tsx|json|md|txt|svg)$/i;

export function isSafeProjectPath(path: string): boolean {
  return path.length > 0
    && path.length <= 240
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").some((part) => !part || part === "." || part === "..")
    && !/(?:^|\/)\.env(?:\.|$)/i.test(path)
    && !/(?:^|\/)(?:node_modules|\.git|\.next|dist)(?:\/|$)/i.test(path);
}

export const ProjectPatchChangeSchema = z.object({
  path: z.string().max(240).refine(isSafeProjectPath, "Unsafe project path"),
  operation: z.enum(["replace_file", "replace_text"]).optional(),
  content: z.string().max(120_000),
  search: z.string().max(120_000).optional(),
  replacement: z.string().max(120_000).optional(),
  reason: z.string().min(3).max(300),
}).superRefine((change, context) => {
  if (change.operation === "replace_text" && !change.search) {
    context.addIssue({ code: "custom", message: "replace_text requires an exact search value", path: ["search"] });
  }
  if (change.operation === "replace_text" && change.replacement === undefined) {
    context.addIssue({ code: "custom", message: "replace_text requires a replacement value", path: ["replacement"] });
  }
  if (change.operation === "replace_text" && change.content.length > 0) {
    context.addIssue({ code: "custom", message: "replace_text must leave content empty", path: ["content"] });
  }
  if (change.operation === "replace_file" && (change.search || change.replacement)) {
    context.addIssue({ code: "custom", message: "replace_file must leave search and replacement empty", path: ["search"] });
  }
});

export const ProjectPatchProposalSchema = z.object({
  summary: z.string().min(3).max(240),
  rationale: z.string().min(3).max(1_200),
  changes: z.array(ProjectPatchChangeSchema).min(1).max(12),
}).superRefine((value, context) => {
  const paths = value.changes.map((change) => change.path);
  if (new Set(paths).size !== paths.length) {
    context.addIssue({ code: "custom", message: "Patch paths must be unique", path: ["changes"] });
  }
});

export type ProjectPatchChange = z.infer<typeof ProjectPatchChangeSchema>;
export type ProjectPatchProposal = z.infer<typeof ProjectPatchProposalSchema>;

export type ProjectPatchContext = {
  name: string;
  framework: GeneratedProject["framework"];
  entryFile: string;
  files: Array<Pick<ProjectFile, "path" | "content" | "language" | "role">>;
  assetManifest: Array<Pick<ProjectFile, "path" | "mediaType">>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  diagnostics: string[];
};

export type AppliedProjectPatch = {
  project: GeneratedProject;
  files: Array<{
    path: string;
    reason: string;
    addedLines: number;
    removedLines: number;
    created: boolean;
  }>;
};

export const PROJECT_PATCH_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rationale", "changes"],
  properties: {
    summary: { type: "string", minLength: 3, maxLength: 240 },
    rationale: { type: "string", minLength: 3, maxLength: 1200 },
    changes: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "operation", "content", "search", "replacement", "reason"],
        properties: {
          path: { type: "string", minLength: 1, maxLength: 240 },
          operation: { type: "string", enum: ["replace_file", "replace_text"] },
          content: { type: "string", maxLength: 120000 },
          search: { type: "string", maxLength: 120000 },
          replacement: { type: "string", maxLength: 120000 },
          reason: { type: "string", minLength: 3, maxLength: 300 },
        },
      },
    },
  },
};

function languageForPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    html: "html", htm: "html", css: "css", scss: "scss", js: "javascript",
    jsx: "jsx", ts: "typescript", tsx: "tsx", json: "json", md: "markdown",
    txt: "text", svg: "svg",
  };
  return languages[extension ?? ""] ?? "text";
}

function roleForPath(path: string): ProjectFile["role"] {
  if (/README|\.md$/i.test(path)) return "documentation";
  if (/(?:^|\/)(?:package|tsconfig|vite\.config|next\.config|eslint\.config)[^/]*\.(?:json|js|ts)$/i.test(path)) return "config";
  return "source";
}

function lineDelta(before: string, after: string): { addedLines: number; removedLines: number } {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix
    && suffix < afterLines.length - prefix
    && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) suffix += 1;
  return {
    removedLines: Math.max(0, beforeLines.length - prefix - suffix),
    addedLines: Math.max(0, afterLines.length - prefix - suffix),
  };
}

function packageMetadata(files: ProjectFile[], project: GeneratedProject): Pick<GeneratedProject, "dependencies" | "scripts"> {
  const packageFile = files.find((file) => file.path === "package.json" && file.encoding !== "base64");
  if (!packageFile) return { dependencies: project.dependencies, scripts: project.scripts };
  try {
    const parsed = JSON.parse(packageFile.content) as { dependencies?: unknown; scripts?: unknown };
    const strings = (value: unknown): value is Record<string, string> => Boolean(value)
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.values(value as Record<string, unknown>).every((item) => typeof item === "string");
    return {
      dependencies: strings(parsed.dependencies) ? parsed.dependencies : project.dependencies,
      scripts: strings(parsed.scripts) ? parsed.scripts : project.scripts,
    };
  } catch {
    return { dependencies: project.dependencies, scripts: project.scripts };
  }
}

export function projectPatchContext(project: GeneratedProject): ProjectPatchContext {
  return {
    name: project.name,
    framework: project.framework,
    entryFile: project.entryFile,
    files: project.files
      .filter((file) => file.encoding !== "base64" && file.role !== "asset")
      .map(({ path, content, language, role }) => ({ path, content, language, role })),
    assetManifest: project.files
      .filter((file) => file.encoding === "base64" || file.role === "asset")
      .map(({ path, mediaType }) => ({ path, mediaType })),
    dependencies: project.dependencies,
    scripts: project.scripts,
    diagnostics: [
      ...project.warnings,
      ...project.validation.checks
        .filter((check) => check.status !== "pass")
        .map((check) => `${check.status.toUpperCase()}: ${check.title} — ${check.message}${check.file ? ` (${check.file})` : ""}`),
    ].slice(0, 24),
  };
}

export function applyProjectPatchProposal(project: GeneratedProject, proposal: ProjectPatchProposal): AppliedProjectPatch {
  const existing = new Map(project.files.map((file) => [file.path, file]));
  const changed = proposal.changes.map((change) => {
    if (!isSafeProjectPath(change.path)) throw new Error(`AI patch proposed an unsafe project path: ${change.path}.`);
    const previous = existing.get(change.path);
    if (previous?.encoding === "base64") throw new Error(`AI patches cannot overwrite binary asset ${change.path}.`);
    if (!previous && !SAFE_NEW_FILE.test(change.path)) throw new Error(`AI patch proposed an unsupported new file: ${change.path}.`);
    const operation = change.operation ?? "replace_file";
    let nextContent = change.content;
    if (operation === "replace_text") {
      if (!previous) throw new Error(`AI patch proposed a text replacement in missing file ${change.path}.`);
      if (!change.search) throw new Error(`AI patch proposed an empty text search in ${change.path}.`);
      const occurrences = previous.content.split(change.search).length - 1;
      if (occurrences !== 1) {
        throw new Error(`AI patch text search must match exactly once in ${change.path}; matched ${occurrences} times.`);
      }
      nextContent = previous.content.replace(change.search, change.replacement ?? "");
    }
    const delta = lineDelta(previous?.content ?? "", nextContent);
    existing.set(change.path, previous
      ? { ...previous, content: nextContent }
      : { path: change.path, content: nextContent, language: languageForPath(change.path), role: roleForPath(change.path) });
    return { path: change.path, reason: change.reason, ...delta, created: !previous };
  });

  const files = [...project.files.map((file) => existing.get(file.path)!), ...proposal.changes
    .filter((change) => !project.files.some((file) => file.path === change.path))
    .map((change) => existing.get(change.path)!)];
  const metadata = packageMetadata(files, project);
  const warnings = inspectProductionRisks(
    files.filter((file) => file.role === "source" && file.encoding !== "base64").map((file) => file.content).join("\n")
  );
  const provisional: GeneratedProject = {
    ...project,
    ...metadata,
    files,
    warnings,
    validation: { status: "ready", score: 100, checks: [], failed: 0, warnings: 0 },
  };
  const validation = validateGeneratedProject(provisional);
  return {
    project: { ...provisional, validation, readiness: evaluateProjectReadiness(validation, warnings) },
    files: changed,
  };
}
