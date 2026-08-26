export type ProjectFramework = "nextjs" | "react" | "html";

export type ProjectFile = {
  path: string;
  content: string;
  language: string;
  role: "source" | "config" | "asset" | "documentation";
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
    status: "ready" | "review-required";
    score: number;
  };
};
