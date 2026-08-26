"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
import { liveSandboxTemplate, supportsLiveSandbox } from "@/lib/project/live-sandbox";
import { instrumentSandboxFiles, isRenderGateReport, type RenderGateReport } from "@/lib/project/render-gate";
import styles from "./ProjectWorkbench.module.css";

type Viewport = "mobile" | "tablet" | "desktop";
type BottomPanel = "problems" | "console";

const VIEWPORT_LABELS: Array<{ id: Viewport; label: string; width: string }> = [
  { id: "mobile", label: "360", width: "360px" },
  { id: "tablet", label: "768", width: "768px" },
  { id: "desktop", label: "Fluid", width: "100%" },
];

function projectTemplate(project: GeneratedProject): "react" | "static" {
  return liveSandboxTemplate(project.framework);
}

async function downloadProjectFiles(project: GeneratedProject): Promise<void> {
  const zip = new JSZip();
  for (const item of project.files) zip.file(item.path, item.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function NextProjectInspector({ project }: { project: GeneratedProject }) {
  const [selectedPath, setSelectedPath] = useState(project.entryFile);
  const [downloading, setDownloading] = useState(false);
  const validation = useMemo(() => validateGeneratedProject(project), [project]);
  const selectedFile = project.files.find((item) => item.path === selectedPath) ?? project.files[0]!;
  const problemChecks = validation.checks.filter((item) => item.status !== "pass");

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadProjectFiles(project);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={styles.workbench} aria-label="Generated Next.js project inspector">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PROJECT ENGINE / NEXT.JS EXPORT</span>
          <h3>{project.name}</h3>
          <p>{project.files.length} files · Next.js · entry: {project.entryFile} · readiness: {project.readiness.score}/100</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.download} onClick={downloadProject} disabled={downloading}>
            {downloading ? "Packing…" : "Download ZIP"}
          </button>
        </div>
      </header>

      <div className={styles.sandboxPolicy} role="status">
        <strong>Live preview intentionally disabled for Next.js</strong>
        <p>
          Verve does not run full Next.js projects in the browser sandbox. Download and run this project locally;
          choose React or HTML when you need an instant live preview with no Next.js shell.
        </p>
      </div>

      {project.warnings.length > 0 && (
        <div className={styles.warning} role="status">
          <strong>Generation warnings</strong>
          <ul>{project.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <div className={styles.inspectorLayout}>
        <nav className={styles.fileList} aria-label="Project files">
          {project.files.map((item) => (
            <button
              type="button"
              key={item.path}
              aria-current={item.path === selectedFile.path ? "page" : undefined}
              onClick={() => setSelectedPath(item.path)}
            >
              {item.path}
            </button>
          ))}
        </nav>
        <section className={styles.sourcePanel} aria-label={`${selectedFile.path} source`}>
          <div className={styles.sourceMeta}>
            <span>{selectedFile.path}</span>
            <span>{selectedFile.language}</span>
          </div>
          <pre tabIndex={0}><code>{selectedFile.content}</code></pre>
        </section>
      </div>

      <div className={styles.bottomPanel}>
        <div className={styles.bottomTabs}>
          <div className={styles.inspectorTab}>Problems <span>{problemChecks.length}</span></div>
          <div className={styles.validationSummary}>
            {validation.failed} failed · {validation.warnings} warnings · {validation.checks.length} checks
          </div>
        </div>
        <div className={styles.problems} aria-live="polite">
          {problemChecks.map((item) => (
            <div key={item.id} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
              <b>{item.title}</b>
              <span>{item.message}{item.file ? ` · ${item.file}` : ""}</span>
            </div>
          ))}
          {problemChecks.length === 0 && <p className={styles.noProblems}>No deterministic problems detected.</p>}
        </div>
      </div>
    </section>
  );
}

function ProjectWorkspaceBody({ project, probeId }: { project: GeneratedProject; probeId: string }) {
  const { sandpack } = useSandpack();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("problems");
  const [downloading, setDownloading] = useState(false);
  const [renderReport, setRenderReport] = useState<RenderGateReport | null>(null);
  const selectedViewport = VIEWPORT_LABELS.find((item) => item.id === viewport)!;

  const editedProject = useMemo<GeneratedProject>(
    () => mergeEditorFiles(project, sandpack.files),
    [project, sandpack.files]
  );
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const problemChecks = validation.checks.filter((item) => item.status !== "pass");
  const runtimeError = sandpack.error?.message ?? null;
  const renderProblems = renderReport?.checks.filter((item) => item.status !== "pass") ?? [];
  const renderFailures = renderProblems.filter((item) => item.status === "fail").length;
  const renderWarnings = renderProblems.filter((item) => item.status === "warning").length;
  const totalProblems = problemChecks.length + renderProblems.length + (runtimeError ? 1 : 0);
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const renderScore = renderReport ? Math.max(0, 100 - renderFailures * 35 - renderWarnings * 8) : 85;
  const readinessScore = Math.min(validation.score, riskScore, renderScore);
  const readinessStatus = validation.status === "blocked" || renderFailures > 0 || runtimeError
    ? "blocked"
    : !renderReport
      ? "verifying"
    : validation.status === "review-required" || project.warnings.length > 0 || renderWarnings > 0
      ? "review-required"
      : "ready";
  const renderGateStatus = !renderReport ? "WAITING" : renderFailures > 0 ? "FAIL" : renderWarnings > 0 ? "REVIEW" : "PASS";

  useEffect(() => {
    const receiveReport = (event: MessageEvent<unknown>) => {
      if (isRenderGateReport(event.data, probeId)) setRenderReport(event.data);
    };
    window.addEventListener("message", receiveReport);
    return () => window.removeEventListener("message", receiveReport);
  }, [probeId]);

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadProjectFiles(editedProject);
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
                onClick={() => {
                  setRenderReport(null);
                  setViewport(item.id);
                }}
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
            <span>LIVE SANDBOX · {sandpack.status.toUpperCase()} / RENDER GATE · {renderGateStatus}</span>
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
            {renderProblems.map((item) => (
              <div key={`render-${item.id}`} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
                <b>Render · {item.title}</b>
                <span>{item.message}</span>
              </div>
            ))}
            {totalProblems === 0 && renderReport && <p className={styles.noProblems}>Static validation and the rendered result both passed.</p>}
            {totalProblems === 0 && !renderReport && <p className={styles.renderPending}>Render Gate is waiting for the preview document.</p>}
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
  const probeId = useId();
  const files = useMemo(
    () => instrumentSandboxFiles(project, probeId),
    [project, probeId]
  );

  if (!supportsLiveSandbox(project.framework)) {
    return <NextProjectInspector project={project} />;
  }

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
      <ProjectWorkspaceBody project={project} probeId={probeId} />
    </SandpackProvider>
  );
}
