"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import type { GeneratedProject } from "@/lib/project/types";
import type { VerveProjectSpec } from "@/lib/domain/project-spec";
import { downloadProjectArchive } from "@/lib/client/project-archive";
import { validateGeneratedProject } from "@/lib/project/project-validator";
import { mergeEditorFiles } from "@/lib/project/editor-project";
import { liveSandboxTemplate, supportsLiveSandbox } from "@/lib/project/live-sandbox";
import {
  createRenderEvidenceMatrix,
  instrumentSandboxFiles,
  isRenderGateReport,
  recordRenderEvidence,
  RENDER_EVIDENCE_WIDTHS,
  visualFingerprintDistance,
  type RenderEvidenceWidth,
} from "@/lib/project/render-gate";
import NativeHtmlWorkbench from "./NativeHtmlWorkbench";
import styles from "./ProjectWorkbench.module.css";
import { projectFileDataUrl } from "@/lib/project/brand-kit";
import { getRecentVisualFingerprints, rememberVisualFingerprint } from "@/lib/client/design-memory";

type Viewport = "mobile" | "tablet" | "desktop";
type BottomPanel = "problems" | "console";
export type WorkbenchFocusMode = "preview" | "code" | "split";

type ProjectWorkbenchProps = {
  project: GeneratedProject;
  projectSpec?: VerveProjectSpec;
  onProjectChange?: (project: GeneratedProject) => void;
  readOnly?: boolean;
  focusMode?: WorkbenchFocusMode;
  showDiagnostics?: boolean;
  visualDiversityThreshold?: number;
  onVisualDiversity?: (distance: number | null) => void;
};

const VIEWPORT_LABELS: Array<{ id: Viewport; label: string; width: string; pixels: RenderEvidenceWidth }> = [
  { id: "mobile", label: "360", width: "360px", pixels: 360 },
  { id: "tablet", label: "768", width: "768px", pixels: 768 },
  { id: "desktop", label: "1440", width: "1440px", pixels: 1440 },
];

function projectTemplate(project: GeneratedProject): "react" | "static" {
  return liveSandboxTemplate(project.framework);
}

function sandboxFilesRevision(files: Record<string, { code: string }>): number {
  let hash = 2166136261;
  for (const [path, file] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const value = `${path}\u0000${file.code}`;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

function NextProjectInspector({ project, onProjectChange, readOnly = false, showDiagnostics = true }: ProjectWorkbenchProps) {
  const [files, setFiles] = useState(project.files);
  const [selectedPath, setSelectedPath] = useState(project.entryFile);
  const [downloading, setDownloading] = useState(false);
  const editedProject = useMemo<GeneratedProject>(() => ({ ...project, files }), [project, files]);
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const selectedFile = files.find((item) => item.path === selectedPath) ?? files[0]!;
  const problemChecks = validation.checks.filter((item) => item.status !== "pass");
  const edited = files.some((item, index) => item.content !== project.files[index]?.content);

  useEffect(() => {
    onProjectChange?.(editedProject);
  }, [editedProject, onProjectChange]);

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadProjectArchive(editedProject);
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
          <p>{files.length} files · Next.js · entry: {project.entryFile} · readiness: {validation.score}/100{edited ? " · edited" : ""}</p>
        </div>
        <div className={styles.actions}>
          {edited && !readOnly && <button type="button" className={styles.reset} onClick={() => setFiles(project.files)}>Reset edits</button>}
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
          {files.map((item) => (
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
          {selectedFile.encoding === "base64" ? (
            <div className={styles.assetInspector}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local user-owned preview */}
              <img src={projectFileDataUrl(selectedFile) ?? ""} alt="Bundled project asset preview" />
              <p>Binary asset · {selectedFile.mediaType} · included in ZIP</p>
            </div>
          ) : (
            <textarea
              className={styles.nextEditor}
              value={selectedFile.content}
              onChange={(event) => setFiles((current) => current.map((item) => item.path === selectedFile.path ? { ...item, content: event.target.value } : item))}
              readOnly={readOnly}
              spellCheck={false}
              aria-label={`Edit ${selectedFile.path}`}
            />
          )}
        </section>
      </div>

      {showDiagnostics && <div className={styles.bottomPanel}>
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
      </div>}
    </section>
  );
}

function ProjectWorkspaceBody({ project, probeId, onProjectChange, readOnly = false, focusMode = "split", showDiagnostics = true, visualDiversityThreshold = 0.35, onVisualDiversity }: ProjectWorkbenchProps & { probeId: string }) {
  const { sandpack } = useSandpack();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("problems");
  const [downloading, setDownloading] = useState(false);
  const [visualArchiveDistance, setVisualArchiveDistance] = useState<number | null>(null);
  const visualMeasuredRevisionRef = useRef<number | null>(null);
  const filesRevision = useMemo(() => sandboxFilesRevision(sandpack.files), [sandpack.files]);
  const [renderEvidenceState, setRenderEvidenceState] = useState(() => ({
    revision: filesRevision,
    evidence: createRenderEvidenceMatrix(),
  }));
  const renderEvidence = renderEvidenceState.revision === filesRevision
    ? renderEvidenceState.evidence
    : createRenderEvidenceMatrix();
  const selectedViewport = VIEWPORT_LABELS.find((item) => item.id === viewport)!;

  const editedProject = useMemo<GeneratedProject>(
    () => mergeEditorFiles(project, sandpack.files),
    [project, sandpack.files]
  );
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const problemChecks = validation.checks.filter((item) => item.status !== "pass");
  const runtimeError = sandpack.error?.message ?? null;
  const renderProblems = RENDER_EVIDENCE_WIDTHS.flatMap((width) =>
    (renderEvidence.reports[width]?.checks ?? [])
      .filter((item) => item.status !== "pass")
      .map((item) => ({ ...item, viewportWidth: width }))
  );
  const renderFailures = renderEvidence.failures;
  const renderWarnings = renderEvidence.warnings;
  const totalProblems = problemChecks.length + renderProblems.length + (runtimeError ? 1 : 0);
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const visualReviewRequired = visualArchiveDistance !== null && visualArchiveDistance < visualDiversityThreshold;
  const renderScore = renderEvidence.covered > 0 ? renderEvidence.score : 85;
  const readinessScore = Math.min(validation.score, riskScore, renderScore);
  const readinessStatus = validation.status === "blocked" || renderFailures > 0 || runtimeError
    ? "blocked"
    : !renderEvidence.complete
      ? "verifying"
    : validation.status === "review-required" || project.warnings.length > 0 || renderWarnings > 0 || visualReviewRequired
      ? "review-required"
      : "ready";
  const renderGateStatus = `${renderEvidence.status.toUpperCase()} ${renderEvidence.covered}/3${renderEvidence.firstViewportScore == null ? "" : ` · FVE ${renderEvidence.firstViewportScore.toFixed(2)}`}${renderEvidence.functionalVisualScore == null ? "" : ` · FVF ${renderEvidence.functionalVisualScore.toFixed(2)}`}`;

  useEffect(() => {
    const receiveReport = (event: MessageEvent<unknown>) => {
      if (isRenderGateReport(event.data, probeId)) {
        const report = event.data;
        if (!readOnly && Math.abs(report.viewport.width - 1440) <= 2 && visualMeasuredRevisionRef.current !== filesRevision) {
          visualMeasuredRevisionRef.current = filesRevision;
          const archive = getRecentVisualFingerprints();
          const distance = archive.length ? Math.min(...archive.map((fingerprint) => visualFingerprintDistance(report.fingerprint, fingerprint))) : null;
          setVisualArchiveDistance(distance);
          onVisualDiversity?.(distance);
          rememberVisualFingerprint(report.fingerprint);
        }
        setRenderEvidenceState((current) => ({
          revision: filesRevision,
          evidence: recordRenderEvidence(
            current.revision === filesRevision ? current.evidence : createRenderEvidenceMatrix(),
            report
          ),
        }));
      }
    };
    window.addEventListener("message", receiveReport);
    return () => window.removeEventListener("message", receiveReport);
  }, [filesRevision, onVisualDiversity, probeId, readOnly]);

  useEffect(() => {
    onProjectChange?.(editedProject);
  }, [editedProject, onProjectChange]);

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadProjectArchive(editedProject);
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
          {sandpack.editorState === "dirty" && !readOnly && (
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
      {visualReviewRequired && (
        <div className={styles.warning} role="status">
          <strong>Visual diversity review</strong>
          <p>This render is close to a recent local result ({visualArchiveDistance.toFixed(2)} distance). Fast results should be reviewed; Creative results should be regenerated from another direction.</p>
        </div>
      )}

      <SandpackLayout className={styles.sandpackLayout} data-mode={focusMode}>
        <SandpackFileExplorer className={styles.explorer} />
        <SandpackCodeEditor className={styles.editor} showTabs showLineNumbers wrapContent readOnly={readOnly} />
        <div className={styles.previewRail}>
          <div className={styles.previewMeta}>
            <span>LIVE SANDBOX · {sandpack.status.toUpperCase()} / RENDER GATE · {renderGateStatus}</span>
            <span>{selectedViewport.width}</span>
          </div>
          <div className={styles.previewViewport} style={{ width: selectedViewport.width }}>
            <SandpackPreview
              className={styles.preview}
              showOpenInCodeSandbox={false}
              showRefreshButton
              showNavigator
            />
          </div>
        </div>
      </SandpackLayout>

      {showDiagnostics && <div className={styles.bottomPanel}>
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
              <div key={`render-${item.viewportWidth}-${item.id}`} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
                <b>Render · {item.title}</b>
                <span>{item.message}</span>
              </div>
            ))}
            {totalProblems === 0 && renderEvidence.complete && <p className={styles.noProblems}>Static validation and all three rendered viewports passed.</p>}
            {totalProblems === 0 && !renderEvidence.complete && <p className={styles.renderPending}>Viewport evidence {renderEvidence.covered}/3. Open each width to complete the render audit.</p>}
          </div>
        ) : (
          <div role="tabpanel" className={styles.consolePanel}>
            <SandpackConsole standalone showHeader={false} showSetupProgress />
          </div>
        )}
      </div>}
    </section>
  );
}

export default function ProjectWorkbench({ project, projectSpec, onProjectChange, readOnly = false, focusMode = "split", showDiagnostics = true, visualDiversityThreshold = 0.35, onVisualDiversity }: ProjectWorkbenchProps) {
  const probeId = useId();
  const projectRevision = useMemo(() => sandboxFilesRevision(Object.fromEntries(
    project.files.map((file) => [file.path, { code: file.content }])
  )), [project.files]);
  const files = useMemo(
    () => instrumentSandboxFiles(project, probeId, projectSpec),
    [project, probeId, projectSpec]
  );

  if (!supportsLiveSandbox(project.framework)) {
    return <NextProjectInspector key={projectRevision} project={project} onProjectChange={onProjectChange} readOnly={readOnly} focusMode={focusMode} showDiagnostics={showDiagnostics} />;
  }

  if (project.framework === "html") {
    return <NativeHtmlWorkbench key={`${project.name}-${projectRevision}`} project={project} projectSpec={projectSpec} onProjectChange={onProjectChange} readOnly={readOnly} focusMode={focusMode} showDiagnostics={showDiagnostics} visualDiversityThreshold={visualDiversityThreshold} onVisualDiversity={onVisualDiversity} />;
  }

  return (
    <SandpackProvider
      key={`${project.name}-${projectRevision}`}
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
      <ProjectWorkspaceBody project={project} projectSpec={projectSpec} probeId={probeId} onProjectChange={onProjectChange} readOnly={readOnly} focusMode={focusMode} showDiagnostics={showDiagnostics} visualDiversityThreshold={visualDiversityThreshold} onVisualDiversity={onVisualDiversity} />
    </SandpackProvider>
  );
}
