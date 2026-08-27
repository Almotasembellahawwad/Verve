"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { GeneratedProject, ProjectFile } from "@/lib/project/types";
import { validateGeneratedProject } from "@/lib/project/project-validator";
import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import { isRenderGateReport, type RenderGateReport } from "@/lib/project/render-gate";
import styles from "./ProjectWorkbench.module.css";
import { projectFileDataUrl } from "@/lib/project/brand-kit";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: Array<{ id: Viewport; label: string; width: string }> = [
  { id: "mobile", label: "360", width: "360px" },
  { id: "tablet", label: "768", width: "768px" },
  { id: "desktop", label: "Fluid", width: "100%" },
];

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

export default function NativeHtmlWorkbench({ project }: { project: GeneratedProject }) {
  const probeId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [files, setFiles] = useState(project.files);
  const [selectedPath, setSelectedPath] = useState(project.entryFile);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [renderReport, setRenderReport] = useState<RenderGateReport | null>(null);
  const [downloading, setDownloading] = useState(false);

  const selectedFile = files.find((item) => item.path === selectedPath) ?? files[0]!;
  const editedProject = useMemo<GeneratedProject>(() => ({ ...project, files }), [project, files]);
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const srcDoc = useMemo(() => buildHtmlPreviewDocument(editedProject, probeId), [editedProject, probeId]);
  const selectedViewport = VIEWPORTS.find((item) => item.id === viewport)!;
  const staticProblems = validation.checks.filter((item) => item.status !== "pass");
  const renderProblems = renderReport?.checks.filter((item) => item.status !== "pass") ?? [];
  const renderFailures = renderProblems.filter((item) => item.status === "fail").length;
  const renderWarnings = renderProblems.filter((item) => item.status === "warning").length;
  const totalProblems = staticProblems.length + renderProblems.length;
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const riskBlocked = project.readiness.status === "blocked" || project.warnings.some((warning) => warning.startsWith("BLOCKING:"));
  const renderScore = renderReport ? Math.max(0, 100 - renderFailures * 35 - renderWarnings * 8) : 85;
  const readinessScore = Math.min(validation.score, riskScore, renderScore);
  const readinessStatus = validation.status === "blocked" || renderFailures > 0 || riskBlocked
    ? "blocked"
    : !renderReport
      ? "verifying"
      : validation.status === "review-required" || project.warnings.length > 0 || renderWarnings > 0
        ? "review-required"
        : "ready";
  const renderGateStatus = !renderReport ? "WAITING" : renderFailures > 0 ? "FAIL" : renderWarnings > 0 ? "REVIEW" : "PASS";

  useEffect(() => {
    const receiveReport = (message: MessageEvent<unknown>) => {
      if (message.source !== iframeRef.current?.contentWindow) return;
      if (isRenderGateReport(message.data, probeId)) setRenderReport(message.data);
    };
    window.addEventListener("message", receiveReport);
    // Attach srcDoc only after the report listener exists. On a statically rendered
    // result page the iframe can otherwise finish before React hydrates the parent.
    if (iframeRef.current) iframeRef.current.srcdoc = srcDoc;
    return () => window.removeEventListener("message", receiveReport);
  }, [probeId, srcDoc]);

  const updateSelectedFile = (content: string) => {
    setRenderReport(null);
    setFiles((current) => current.map((item) => item.path === selectedFile.path ? { ...item, content } : item));
  };

  const resetFiles = () => {
    setFiles(project.files);
    setSelectedPath(project.entryFile);
    setRenderReport(null);
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
                onClick={() => {
                  setRenderReport(null);
                  setViewport(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {edited && <button type="button" className={styles.reset} onClick={resetFiles}>Reset edits</button>}
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

      <div className={styles.nativeLayout}>
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
          <div className={styles.previewViewport} style={{ maxWidth: selectedViewport.width }}>
            <iframe
              ref={iframeRef}
              className={styles.nativePreview}
              title={`${project.name} live preview`}
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>

      <div className={styles.bottomPanel}>
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
            <div key={`render-${item.id}`} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
              <b>Render · {item.title}</b><span>{item.message}</span>
            </div>
          ))}
          {totalProblems === 0 && renderReport && <p className={styles.noProblems}>Static validation and the rendered result both passed.</p>}
          {totalProblems === 0 && !renderReport && <p className={styles.renderPending}>Render Gate is waiting for the preview document.</p>}
        </div>
      </div>
    </section>
  );
}
