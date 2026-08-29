"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import JSZip from "jszip";
import type { GeneratedProject, ProjectFile } from "@/lib/project/types";
import { validateGeneratedProject } from "@/lib/project/project-validator";
import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import {
  createRenderEvidenceMatrix,
  isRenderGateReport,
  recordRenderEvidence,
  RENDER_EVIDENCE_WIDTHS,
  type RenderEvidenceWidth,
} from "@/lib/project/render-gate";
import styles from "./ProjectWorkbench.module.css";
import { projectFileDataUrl } from "@/lib/project/brand-kit";
import type { WorkbenchFocusMode } from "./ProjectWorkbench";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: Array<{ id: Viewport; label: string; width: string; pixels: RenderEvidenceWidth }> = [
  { id: "mobile", label: "360", width: "360px", pixels: 360 },
  { id: "tablet", label: "768", width: "768px", pixels: 768 },
  { id: "desktop", label: "1440", width: "1440px", pixels: 1440 },
];

const subscribeToHydration = () => () => undefined;
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

async function downloadFiles(projectName: string, files: ProjectFile[]): Promise<void> {
  const zip = new JSZip();
  for (const item of files) zip.file(item.path, item.content, item.encoding === "base64" ? { base64: true } : undefined);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type Props = {
  project: GeneratedProject;
  onProjectChange?: (project: GeneratedProject) => void;
  readOnly?: boolean;
  focusMode?: WorkbenchFocusMode;
  showDiagnostics?: boolean;
};

export default function NativeHtmlWorkbench({ project, onProjectChange, readOnly = false, focusMode = "split", showDiagnostics = true }: Props) {
  const baseProbeId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [files, setFiles] = useState(project.files);
  const [selectedPath, setSelectedPath] = useState(project.entryFile);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [renderEvidence, setRenderEvidence] = useState(createRenderEvidenceMatrix);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const activeProbeId = `${baseProbeId}-${previewRevision}`;
  const previewReady = useSyncExternalStore(subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot);

  const selectedFile = files.find((item) => item.path === selectedPath) ?? files[0]!;
  const editedProject = useMemo<GeneratedProject>(() => ({ ...project, files }), [project, files]);
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const srcDoc = useMemo(() => buildHtmlPreviewDocument(editedProject, activeProbeId), [activeProbeId, editedProject]);
  const selectedViewport = VIEWPORTS.find((item) => item.id === viewport)!;
  const staticProblems = validation.checks.filter((item) => item.status !== "pass");
  const renderProblems = RENDER_EVIDENCE_WIDTHS.flatMap((width) =>
    (renderEvidence.reports[width]?.checks ?? [])
      .filter((item) => item.status !== "pass")
      .map((item) => ({ ...item, viewportWidth: width }))
  );
  const renderFailures = renderEvidence.failures;
  const renderWarnings = renderEvidence.warnings;
  const totalProblems = staticProblems.length + renderProblems.length;
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const riskBlocked = project.readiness.status === "blocked" || project.warnings.some((warning) => warning.startsWith("BLOCKING:"));
  const renderScore = renderEvidence.covered > 0 ? renderEvidence.score : 85;
  const readinessScore = Math.min(validation.score, riskScore, renderScore);
  const readinessStatus = validation.status === "blocked" || renderFailures > 0 || riskBlocked
    ? "blocked"
    : !renderEvidence.complete
      ? "verifying"
      : validation.status === "review-required" || project.warnings.length > 0 || renderWarnings > 0
        ? "review-required"
        : "ready";
  const renderGateStatus = `${renderEvidence.status.toUpperCase()} ${renderEvidence.covered}/3`;

  const receiveReport = useEffectEvent((message: MessageEvent<unknown>) => {
    if (message.source !== iframeRef.current?.contentWindow) return;
    if (isRenderGateReport(message.data, activeProbeId)) {
      const report = message.data;
      setRenderEvidence((current) => recordRenderEvidence(current, report));
    }
  });

  useEffect(() => {
    window.addEventListener("message", receiveReport);
    return () => window.removeEventListener("message", receiveReport);
  }, []);

  useEffect(() => {
    onProjectChange?.(editedProject);
  }, [editedProject, onProjectChange]);

  const updateSelectedFile = (content: string) => {
    setRenderEvidence(createRenderEvidenceMatrix());
    setPreviewRevision((revision) => revision + 1);
    setFiles((current) => current.map((item) => item.path === selectedFile.path ? { ...item, content } : item));
  };

  const resetFiles = () => {
    setFiles(project.files);
    setSelectedPath(project.entryFile);
    setRenderEvidence(createRenderEvidenceMatrix());
    setPreviewRevision((revision) => revision + 1);
  };

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadFiles(project.name, files);
    } finally {
      setDownloading(false);
    }
  };

  const edited = files.some((item, index) => item.content !== project.files[index]?.content);

  return (
    <section className={styles.workbench} aria-label="Generated HTML project workspace">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PROJECT ENGINE / {readinessStatus.replace("-", " ").toUpperCase()}</span>
          <h3>{project.name}</h3>
          <p>{files.length} files · html · entry: {project.entryFile} · readiness: {readinessScore}/100{edited ? " · edited" : ""}</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.viewportGroup} role="group" aria-label="Preview viewport">
            {VIEWPORTS.map((item) => (
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
          {edited && !readOnly && <button type="button" className={styles.reset} onClick={resetFiles}>Reset edits</button>}
          <button type="button" className={styles.download} onClick={downloadProject} disabled={downloading}>
            {downloading ? "Packing…" : `Download ${edited ? "edited " : ""}ZIP`}
          </button>
        </div>
      </header>

      <div className={styles.sandboxPolicy} role="status">
        <strong>Native HTML preview · zero package downloads</strong>
        <p>HTML, CSS, and local JavaScript run in an isolated browser frame. The exported project keeps its original multi-file structure.</p>
      </div>

      {project.warnings.length > 0 && (
        <div className={styles.warning} role="status">
          <strong>Generation warnings</strong>
          <ul>{project.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}

      <div className={styles.nativeLayout} data-mode={focusMode}>
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

        <section className={styles.sourcePanel} aria-label={`${selectedFile.path} editor`}>
          <div className={styles.sourceMeta}><span>{selectedFile.path}</span><span>{selectedFile.language}</span></div>
          {selectedFile.encoding === "base64" ? (
            <div className={styles.assetInspector}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local user-owned preview */}
              <img src={projectFileDataUrl(selectedFile) ?? ""} alt="User-owned project asset preview" />
              <p>Binary asset · {selectedFile.mediaType} · included in preview and ZIP</p>
            </div>
          ) : (
            <textarea
              className={styles.nativeEditor}
              value={selectedFile.content}
              onChange={(event) => updateSelectedFile(event.target.value)}
              readOnly={readOnly}
              spellCheck={false}
              aria-label={`Edit ${selectedFile.path}`}
            />
          )}
        </section>

        <div className={styles.previewRail}>
          <div className={styles.previewMeta}>
            <span>NATIVE HTML · RUNNING / RENDER GATE · {renderGateStatus}</span>
            <span>{selectedViewport.width}</span>
          </div>
          <div className={styles.previewViewport} style={{ width: selectedViewport.width }}>
            <iframe
              ref={iframeRef}
              className={styles.nativePreview}
              title={`${project.name} live preview`}
              sandbox="allow-scripts"
              srcDoc={previewReady ? srcDoc : undefined}
            />
          </div>
        </div>
      </div>

      {showDiagnostics && <div className={styles.bottomPanel}>
        <div className={styles.bottomTabs}>
          <div className={styles.inspectorTab}>Problems <span>{totalProblems}</span></div>
          <div className={styles.validationSummary}>{validation.failed} failed · {validation.warnings} warnings · {validation.checks.length} checks</div>
        </div>
        <div className={styles.problems} aria-live="polite">
          {staticProblems.map((item) => (
            <div key={item.id} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
              <b>{item.title}</b><span>{item.message}{item.file ? ` · ${item.file}` : ""}</span>
            </div>
          ))}
          {renderProblems.map((item) => (
            <div key={`render-${item.viewportWidth}-${item.id}`} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
              <b>Render · {item.title}</b><span>{item.message}</span>
            </div>
          ))}
          {totalProblems === 0 && renderEvidence.complete && <p className={styles.noProblems}>Static validation and all three rendered viewports passed.</p>}
          {totalProblems === 0 && !renderEvidence.complete && <p className={styles.renderPending}>Viewport evidence {renderEvidence.covered}/3. Open each width to complete the render audit.</p>}
        </div>
      </div>}
    </section>
  );
}
