export type ProjectFramework = "nextjs" | "react" | "html";

export type ProjectFile = {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
  mediaType?: string;
  language: string;
  role: "source" | "config" | "asset" | "documentation";
};

export type ProjectCheck = {
  id: string;
  title: string;
  status: "pass" | "warning" | "fail";
  message: string;
  file?: string;
};

export type ProjectValidation = {
  status: "ready" | "review-required" | "blocked";
  score: number;
  checks: ProjectCheck[];
  failed: number;
  warnings: number;
};

export type ProjectReadinessAxis = {
  status: "ready" | "review-required" | "blocked";
  score: number;
  blockers: string[];
  warnings: string[];
};

export type ProjectReadiness = {
  status: "ready" | "review-required" | "blocked";
  score: number;
  axes?: {
    technical: ProjectReadinessAxis;
    content: ProjectReadinessAxis;
    launch: ProjectReadinessAxis;
  };
};

export type GeneratedProject = {
  schemaVersion: 1;
  name: string;
  framework: ProjectFramework;
  entryFile: string;
  files: ProjectFile[];
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  warnings: string[];
  readiness: ProjectReadiness;
  validation: ProjectValidation;
};
