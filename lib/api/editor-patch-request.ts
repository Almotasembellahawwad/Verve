import { z } from "zod";
import { isSafeProjectPath } from "../project/ai-patch";

const TextFileSchema = z.object({
  path: z.string().max(240).refine(isSafeProjectPath),
  content: z.string().max(120_000),
  language: z.string().min(1).max(40),
  role: z.enum(["source", "config", "documentation"]),
});

const ProjectContextSchema = z.object({
  name: z.string().min(1).max(120),
  framework: z.enum(["nextjs", "react", "html"]),
  entryFile: z.string().max(240).refine(isSafeProjectPath),
  files: z.array(TextFileSchema).min(1).max(60),
  assetManifest: z.array(z.object({
    path: z.string().max(240).refine(isSafeProjectPath),
    mediaType: z.string().max(120).optional(),
  })).max(40),
  dependencies: z.record(z.string().max(120), z.string().max(120)),
  scripts: z.record(z.string().max(80), z.string().max(300)),
  diagnostics: z.array(z.string().max(2_000)).max(24),
}).superRefine((project, context) => {
  const size = project.files.reduce((total, file) => total + file.content.length, 0);
  if (size > 420_000) context.addIssue({ code: "custom", message: "Project context is too large", path: ["files"] });
  const paths = project.files.map((file) => file.path);
  if (new Set(paths).size !== paths.length) context.addIssue({ code: "custom", message: "Project paths must be unique", path: ["files"] });
  if (!paths.includes(project.entryFile)) context.addIssue({ code: "custom", message: "Entry file is missing", path: ["entryFile"] });
});

export const EditorPatchRequestSchema = z.object({
  project: ProjectContextSchema,
  instruction: z.string().trim().min(3).max(3_000),
  mode: z.enum(["fast", "studio"]).default("fast"),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(1).max(500),
});
