import { DESIGN_CONTRACT_PATH, designContractCss, type DesignContract } from "../domain/design-contract";
import { DesignContractSchema } from "../engine/design-contract-schema";
import type { GeneratedProject } from "./types";
import { hasHtmlStartTag, insertBeforeHtmlEndTag } from "../security/structural-html";

export function readProjectDesignContract(project: Pick<GeneratedProject, "files">): DesignContract | null {
  const file = project.files.find((candidate) => candidate.path === DESIGN_CONTRACT_PATH && candidate.encoding !== "base64");
  if (!file) return null;
  try { return DesignContractSchema.parse(JSON.parse(file.content)); } catch { return null; }
}

/** Reserve one stylesheet and receipt across frameworks; avoid rewriting authored scene CSS. */
export function attachDesignContract(project: GeneratedProject, contract: DesignContract): void {
  const valid = DesignContractSchema.parse(contract);
  const cssPath = project.framework === "html" ? "verve-design.css" : project.framework === "react" ? "src/verve-design.css" : "app/verve-design.css";
  project.files = project.files.filter((file) => file.path !== DESIGN_CONTRACT_PATH && file.path !== cssPath);
  project.files.push(
    { path: DESIGN_CONTRACT_PATH, content: `${JSON.stringify(valid, null, 2)}\n`, language: "json", role: "documentation" },
    { path: cssPath, content: designContractCss(valid), language: "css", role: "source" },
  );
  const entryPath = project.framework === "html" ? project.entryFile : project.framework === "react" ? "src/main.tsx" : "app/layout.tsx";
  if (project.framework === "html") {
    for (const entry of project.files.filter((file) => /\.html?$/i.test(file.path) && file.encoding !== "base64")) {
      const prefix = "../".repeat(entry.path.split("/").length - 1) || "./";
      const href = `${prefix}verve-design.css`;
      if (!hasHtmlStartTag(entry.content, "link", (attributes) => attributes.get("href") === href
        && attributes.get("rel")?.toLowerCase().split(/\s+/).includes("stylesheet") === true)) {
        entry.content = insertBeforeHtmlEndTag(entry.content, "head", `<link rel="stylesheet" href="${href}" />`);
      }
    }
    return;
  }
  const entry = project.files.find((file) => file.path === entryPath);
  if (entry && !entry.content.includes('import "./verve-design.css"')) {
    entry.content = `${entry.content.trimEnd()}\nimport "./verve-design.css";\n`;
  }
}
