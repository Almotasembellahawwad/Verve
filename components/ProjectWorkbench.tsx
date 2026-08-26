"use client";

import { useMemo, useState } from "react";
import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import JSZip from "jszip";
import type { GeneratedProject } from "@/lib/project/types";
import { validateGeneratedProject } from "@/lib/project/project-validator";
import { mergeEditorFiles } from "@/lib/project/editor-project";
import styles from "./ProjectWorkbench.module.css";

type Viewport = "mobile" | "tablet" | "desktop";
type BottomPanel = "problems" | "console";

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

function ProjectWorkspaceBody({ project }: { project: GeneratedProject }) {
  const { sandpack } = useSandpack();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("problems");
  const [downloading, setDownloading] = useState(false);
  const selectedViewport = VIEWPORT_LABELS.find((item) => item.id === viewport)!;

  const editedProject = useMemo<GeneratedProject>(
    () => mergeEditorFiles(project, sandpack.files),
    [project, sandpack.files]
  );
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const problemChecks = validation.checks.filter((item) => item.status !== "pass");
  const runtimeError = sandpack.error?.message ?? null;
  const totalProblems = problemChecks.length + (runtimeError ? 1 : 0);
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const readinessScore = Math.min(validation.score, riskScore);
  const readinessStatus = validation.status === "blocked"
    ? "blocked"
    : validation.status === "review-required" || project.warnings.length > 0
      ? "review-required"
      : "ready";

  const downloadProject = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const item of editedProject.files) zip.file(item.path, item.content);
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
          <span className={styles.eyebrow}>PROJECT ENGINE / {readinessStatus.replace("-", " ").toUpperCase()}</span>
          <h3>{project.name}</h3>
          <p>
            {project.files.length} files · {project.framework} · entry: {project.entryFile} · readiness: {readinessScore}/100
            {sandpack.editorState === "dirty" ? " · edited" : ""}
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
          {sandpack.editorState === "dirty" && (
            <button type="button" className={styles.reset} onClick={sandpack.resetAllFiles}>Reset edits</button>
          )}
          <button type="button" className={styles.download} onClick={downloadProject} disabled={downloading}>
            {downloading ? "Packing…" : `Download ${sandpack.editorState === "dirty" ? "edited " : ""}ZIP`}
          </button>
        </div>
      </header>

      {project.warnings.length > 0 && (
        <div className={styles.warning} role="status">
          <strong>Generation warnings</strong>
          <ul>{project.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <SandpackLayout className={styles.sandpackLayout}>
        <SandpackFileExplorer className={styles.explorer} />
        <SandpackCodeEditor className={styles.editor} showTabs showLineNumbers wrapContent />
        <div className={styles.previewRail}>
          <div className={styles.previewMeta}>
            <span>LIVE SANDBOX · {sandpack.status.toUpperCase()}</span>
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

      <div className={styles.bottomPanel}>
        <div className={styles.bottomTabs} role="tablist" aria-label="Project diagnostics">
          <button type="button" role="tab" aria-selected={bottomPanel === "problems"} onClick={() => setBottomPanel("problems")}>
            Problems <span>{totalProblems}</span>
          </button>
          <button type="button" role="tab" aria-selected={bottomPanel === "console"} onClick={() => setBottomPanel("console")}>
            Console
          </button>
          <div className={styles.validationSummary}>
            {validation.failed} failed · {validation.warnings} warnings · {validation.checks.length} checks
          </div>
        </div>

        {bottomPanel === "problems" ? (
          <div className={styles.problems} role="tabpanel" aria-live="polite">
            {runtimeError && (
              <div className={styles.problemFail}><b>Runtime</b><span>{runtimeError}</span></div>
            )}
            {problemChecks.map((item) => (
              <div key={item.id} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
                <b>{item.title}</b>
                <span>{item.message}{item.file ? ` · ${item.file}` : ""}</span>
              </div>
            ))}
            {totalProblems === 0 && <p className={styles.noProblems}>No deterministic or runtime problems detected.</p>}
          </div>
        ) : (
          <div role="tabpanel" className={styles.consolePanel}>
            <SandpackConsole standalone showHeader={false} showSetupProgress />
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProjectWorkbench({ project }: { project: GeneratedProject }) {
  const files = useMemo(
    () => Object.fromEntries(project.files.map((item) => [`/${item.path}`, { code: item.content }])),
    [project]
  );

  return (
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
      <ProjectWorkspaceBody project={project} />
    </SandpackProvider>
  );
}
