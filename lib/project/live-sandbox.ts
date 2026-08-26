import type { ProjectFramework } from "./types";

export type LightweightSandboxTemplate = "react" | "static";

export function supportsLiveSandbox(framework: ProjectFramework): boolean {
  return framework === "html" || framework === "react";
}

export function liveSandboxTemplate(framework: ProjectFramework): LightweightSandboxTemplate {
  if (!supportsLiveSandbox(framework)) {
    throw new Error(`Live Sandbox does not run full ${framework} projects.`);
  }
  return framework === "react" ? "react" : "static";
}
