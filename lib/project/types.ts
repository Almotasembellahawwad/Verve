export type ProjectFramework = "nextjs" | "react" | "html";

export type ProjectFile = {
  path: string;
  content: string;
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

export type GeneratedProject = {
  schemaVersion: 1;
  name: string;
  framework: ProjectFramework;
  entryFile: string;
  files: ProjectFile[];
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  warnings: string[];
  readiness: {
    status: "ready" | "review-required" | "blocked";
    score: number;
  };
  validation: ProjectValidation;
};
