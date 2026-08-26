"use client";

import { useMemo, useState } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import JSZip from "jszip";
import type { GeneratedProject } from "@/lib/project/types";
import styles from "./ProjectWorkbench.module.css";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORT_LABELS: Array<{ id: Viewport; label: string; width: string }> = [
  { id: "mobile", label: "360", width: "360px" },
  { id: "tablet", label: "768", width: "768px" },
  { id: "desktop", label: "Fluid", width: "100%" },
];

function projectTemplate(project: GeneratedProject): "nextjs" | "react" | "static" {
  if (project.framework === "nextjs" && project.entryFile !== "index.html") return "nextjs";
  if (project.framework === "react") return "react";
  return "static";
}

export default function ProjectWorkbench({ project }: { project: GeneratedProject }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [downloading, setDownloading] = useState(false);
  const files = useMemo(
    () => Object.fromEntries(project.files.map((item) => [`/${item.path}`, { code: item.content }])),
    [project]
  );
  const selectedViewport = VIEWPORT_LABELS.find((item) => item.id === viewport)!;

  const downloadProject = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const item of project.files) zip.file(item.path, item.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={styles.workbench} aria-label="Generated project workspace">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PROJECT ENGINE / READY</span>
          <h3>{project.name}</h3>
          <p>
            {project.files.length} files · {project.framework} · entry: {project.entryFile} · readiness: {project.readiness?.score ?? "—"}/100
          </p>
        </div>
        <div className={styles.actions}>
          <div className={styles.viewportGroup} role="group" aria-label="Preview viewport">
            {VIEWPORT_LABELS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={viewport === item.id ? styles.activeViewport : ""}
                onClick={() => setViewport(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.download} onClick={downloadProject} disabled={downloading}>
            {downloading ? "Packing…" : "Download ZIP"}
          </button>
        </div>
      </header>

      {project.warnings.length > 0 && (
        <div className={styles.warning} role="status">
          <strong>Production check</strong>
          <ul>{project.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <SandpackProvider
        key={`${project.name}-${project.files.length}`}
        template={projectTemplate(project)}
        files={files}
        customSetup={{ dependencies: project.dependencies }}
        theme={{
          colors: {
            surface1: "#101113",
            surface2: "#17181b",
            surface3: "#222329",
            clickable: "#a8a9af",
            base: "#f1eee7",
            disabled: "#666870",
            hover: "#ffffff",
            accent: "#ff5a36",
            error: "#ff6b6b",
            errorSurface: "#311b1b",
          },
          syntax: {
            plain: "#e8e4db",
            comment: { color: "#777981", fontStyle: "italic" },
            keyword: "#ff704d",
            tag: "#e2a43a",
            punctuation: "#b8bbc2",
            definition: "#72d6b0",
            property: "#a8b8ff",
            static: "#dd92d7",
            string: "#d8c58d",
          },
          font: { body: "var(--font-manrope), sans-serif", mono: "var(--font-plex-mono), monospace", size: "13px", lineHeight: "1.55" },
        }}
        options={{ activeFile: `/${project.entryFile}`, visibleFiles: project.files.map((item) => `/${item.path}`) }}
      >
        <SandpackLayout className={styles.sandpackLayout}>
          <SandpackFileExplorer className={styles.explorer} />
          <SandpackCodeEditor className={styles.editor} showTabs showLineNumbers wrapContent />
          <div className={styles.previewRail}>
            <div className={styles.previewMeta}>
              <span>LIVE SANDBOX</span>
              <span>{selectedViewport.width}</span>
            </div>
            <div className={styles.previewViewport} style={{ maxWidth: selectedViewport.width }}>
              <SandpackPreview
                className={styles.preview}
                showOpenInCodeSandbox={false}
                showRefreshButton
                showNavigator
              />
            </div>
          </div>
        </SandpackLayout>
      </SandpackProvider>
    </section>
  );
}
