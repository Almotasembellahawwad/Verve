"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { GeneratedProject } from "@/lib/project/types";
import type { VerveProjectSpec } from "@/lib/domain/project-spec";
import { downloadProjectArchive } from "@/lib/client/project-archive";
import { validateGeneratedProject } from "@/lib/project/project-validator";
import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import { isNativeNavigationMessage, nativePreviewPages, resolveNativePreviewLink, type NativePreviewLocation } from "@/lib/project/html-preview-navigation";
import {
  isRenderGateReport,
  visualFingerprintDistance,
  type RenderEvidenceWidth,
} from "@/lib/project/render-gate";
import {
  buildDirectionRealizationReport,
  createVisualTruthMatrix,
  recordVisualTruth,
  privacySafeSurfaceKey,
  renderEvidenceFromVisualTruth,
} from "@/lib/project/visual-truth";
import styles from "./ProjectWorkbench.module.css";
import DesignChoices from "./DesignChoices";
import { projectFileDataUrl } from "@/lib/project/brand-kit";
import type { WorkbenchFocusMode } from "./ProjectWorkbench";
import { getRecentVisualFingerprints, rememberVisualFingerprint } from "@/lib/client/design-memory";
import { summarizeRenderAudit } from "@/lib/client/render-audit";
import type { RenderedEvaluationEvidence } from "@/lib/engine/evaluation-coherence";
import { useProjectRevision } from "@/lib/client/use-project-revision";

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: Array<{ id: Viewport; label: string; width: string; pixels: RenderEvidenceWidth }> = [
  { id: "mobile", label: "360", width: "360px", pixels: 360 },
  { id: "tablet", label: "768", width: "768px", pixels: 768 },
  { id: "desktop", label: "1440", width: "1440px", pixels: 1440 },
];

const subscribeToHydration = () => () => undefined;
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

type Props = {
  project: GeneratedProject;
  projectSpec?: VerveProjectSpec;
  onProjectChange?: (project: GeneratedProject) => void;
  readOnly?: boolean;
  focusMode?: WorkbenchFocusMode;
  showDiagnostics?: boolean;
  visualDiversityThreshold?: number;
  memoryProjectId?: string;
  onVisualDiversity?: (distance: number | null) => void;
  onRenderAudit?: (audit: RenderedEvaluationEvidence) => void;
};

export default function NativeHtmlWorkbench({ project, projectSpec, onProjectChange, readOnly = false, focusMode = "split", showDiagnostics = true, visualDiversityThreshold = 0.35, memoryProjectId, onVisualDiversity, onRenderAudit }: Props) {
  const baseProbeId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [files, setFiles] = useState(project.files);
  const [selectedPath, setSelectedPath] = useState(project.entryFile);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [visualTruth, setVisualTruth] = useState(() => createVisualTruthMatrix(projectSpec, nativePreviewPages(project, projectSpec).map((page) => page.routeId)));
  const [navigation, setNavigation] = useState<{ entries: NativePreviewLocation[]; index: number }>(() => ({ entries: [{ file: project.entryFile, query: "", fragment: "" }], index: 0 }));
  const [navigationWarning, setNavigationWarning] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [visualArchiveDistance, setVisualArchiveDistance] = useState<number | null>(null);
  const visualMeasuredProbeRef = useRef<string | null>(null);
  const activeProbeId = `${baseProbeId}-${previewRevision}`;
  const previewReady = useSyncExternalStore(subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot);

  const selectedFile = files.find((item) => item.path === selectedPath) ?? files[0]!;
  const editedProject = useMemo<GeneratedProject>(() => ({ ...project, files }), [project, files]);
  const pages = useMemo(() => nativePreviewPages(editedProject, projectSpec), [editedProject, projectSpec]);
  const location = navigation.entries[navigation.index];
  const activePage = pages.find((page) => page.file === location.file) ?? pages[0];
  const renderEvidence = useMemo(() => renderEvidenceFromVisualTruth(visualTruth), [visualTruth]);
  const revision = useProjectRevision(editedProject, projectSpec);
  const validation = useMemo(() => validateGeneratedProject(editedProject), [editedProject]);
  const srcDoc = useMemo(() => activePage ? buildHtmlPreviewDocument(editedProject, activeProbeId, projectSpec, {
    entryFile: activePage.file, routeId: activePage.routeId, routePath: activePage.routePath,
    routeCount: pages.length, navigation: { fragment: location.fragment },
  }) : "<h1>No delivered HTML page</h1>", [activePage, activeProbeId, editedProject, location.fragment, pages.length, projectSpec]);
  const selectedViewport = VIEWPORTS.find((item) => item.id === viewport)!;
  const staticProblems = validation.checks.filter((item) => item.status !== "pass");
  const renderProblems = Object.entries(visualTruth.reports).flatMap(([surface, report]) =>
    report.checks
      .filter((item) => item.status !== "pass")
      .map((item) => ({ ...item, surface, viewportWidth: report.viewport.width, page: pages.find((page) => privacySafeSurfaceKey(page.routeId) === report.surface?.routeKey)?.file ?? "Planned route" }))
  );
  const renderFailures = renderEvidence.failures;
  const renderWarnings = renderEvidence.warnings;
  const directionRealization = useMemo(
    () => projectSpec ? buildDirectionRealizationReport(projectSpec, visualTruth) : null,
    [projectSpec, visualTruth]
  );
  const totalProblems = staticProblems.length + renderProblems.length;
  const riskScore = Math.max(0, 100 - project.warnings.length * 18);
  const riskBlocked = project.readiness.status === "blocked" || project.warnings.some((warning) => warning.startsWith("BLOCKING:"));
  const visualReviewRequired = visualArchiveDistance !== null && visualArchiveDistance < visualDiversityThreshold;
  const directionReviewRequired = Boolean(projectSpec && renderEvidence.complete && directionRealization?.status !== "pass");
  const renderScore = renderEvidence.covered > 0 ? renderEvidence.score : 85;
  const readinessScore = Math.min(validation.score, riskScore, renderScore);
  const readinessStatus = validation.status === "blocked" || renderFailures > 0 || riskBlocked
    ? "blocked"
    : !renderEvidence.complete || !revision
      ? "verifying"
      : validation.status === "review-required" || project.warnings.length > 0 || renderWarnings > 0 || visualReviewRequired || directionReviewRequired
        ? "review-required"
        : "ready";
  const renderGateStatus = `${renderEvidence.status.toUpperCase()} ${renderEvidence.covered}/3${renderEvidence.firstViewportScore == null ? "" : ` · FVE ${renderEvidence.firstViewportScore.toFixed(2)}`}${renderEvidence.functionalVisualScore == null ? "" : ` · FVF ${renderEvidence.functionalVisualScore.toFixed(2)}`}${renderEvidence.renderedEvidenceScore == null ? "" : ` · RES ${renderEvidence.renderedEvidenceScore.toFixed(2)}`}${renderEvidence.renderedCompositionScore == null ? "" : ` · RCR ${renderEvidence.renderedCompositionScore.toFixed(2)}`}${directionRealization ? ` · DF ${directionRealization.fidelity.toFixed(2)}` : ""}`;

  const receiveReport = useEffectEvent((message: MessageEvent<unknown>) => {
    if (message.source !== iframeRef.current?.contentWindow) return;
    if (isNativeNavigationMessage(message.data, activeProbeId) && activePage) {
      const target = resolveNativePreviewLink(pages, activePage.file, message.data.href);
      if (target) navigate(target);
      else setNavigationWarning("This link is not a delivered HTML page. External links and missing routes are not opened inside the preview; use the exported project to check them.");
      return;
    }
    if (isRenderGateReport(message.data, activeProbeId)) {
      const report = message.data;
      if (!activePage || report.surface?.routeKey !== privacySafeSurfaceKey(activePage.routeId)) return;
      // Archive comparison remains entry-page evidence, not an average of unrelated pages.
      if (activePage.file === project.entryFile && !readOnly && memoryProjectId && Math.abs(report.viewport.width - 1440) <= 2 && visualMeasuredProbeRef.current !== activeProbeId) {
        visualMeasuredProbeRef.current = activeProbeId;
        const archive = getRecentVisualFingerprints(24, memoryProjectId);
        const distance = archive.length ? Math.min(...archive.map((fingerprint) => visualFingerprintDistance(report.fingerprint, fingerprint))) : null;
        setVisualArchiveDistance(distance);
        onVisualDiversity?.(distance);
        rememberVisualFingerprint(report.fingerprint, memoryProjectId);
      }
      setVisualTruth((current) => recordVisualTruth(current, report));
    }
  });

  useEffect(() => {
    window.addEventListener("message", receiveReport);
    return () => window.removeEventListener("message", receiveReport);
  }, []);

  useEffect(() => {
    onProjectChange?.(editedProject);
  }, [editedProject, onProjectChange]);

  useEffect(() => {
    if (!readOnly) onRenderAudit?.(summarizeRenderAudit(renderEvidence, directionRealization, visualArchiveDistance, revision, visualTruth));
  }, [directionRealization, onRenderAudit, readOnly, renderEvidence, revision, visualArchiveDistance, visualTruth]);

  const updateSelectedFile = (content: string) => {
    setVisualArchiveDistance(null);
    setVisualTruth(createVisualTruthMatrix(projectSpec, pages.map((page) => page.routeId)));
    setPreviewRevision((revision) => revision + 1);
    setFiles((current) => current.map((item) => item.path === selectedFile.path ? { ...item, content } : item));
  };

  const resetFiles = () => {
    setVisualArchiveDistance(null);
    setFiles(project.files);
    setSelectedPath(project.entryFile);
    setVisualTruth(createVisualTruthMatrix(projectSpec, nativePreviewPages(project, projectSpec).map((page) => page.routeId)));
    setNavigation({ entries: [{ file: project.entryFile, query: "", fragment: "" }], index: 0 });
    setNavigationWarning(null);
    setPreviewRevision((revision) => revision + 1);
  };

  const downloadProject = async () => {
    setDownloading(true);
    try {
      await downloadProjectArchive(editedProject);
    } finally {
      setDownloading(false);
    }
  };

  const edited = files.some((item, index) => item.content !== project.files[index]?.content);

  function navigate(target: NativePreviewLocation) {
    setNavigation((current) => {
      const entries = [...current.entries.slice(0, current.index + 1), target].slice(-50);
      return { entries, index: entries.length - 1 };
    });
    setNavigationWarning(null);
    setPreviewRevision((value) => value + 1);
  }

  function stepNavigation(delta: -1 | 1) {
    setNavigation((current) => ({ ...current, index: Math.max(0, Math.min(current.entries.length - 1, current.index + delta)) }));
    setNavigationWarning(null);
    setPreviewRevision((value) => value + 1);
  }

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
      <DesignChoices project={editedProject} />

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
      {visualReviewRequired && (
        <div className={styles.warning} role="status">
          <strong>Visual diversity review</strong>
          <p>This render is close to a recent local result ({visualArchiveDistance.toFixed(2)} distance). Fast results should be reviewed; Creative results should be regenerated from another direction.</p>
        </div>
      )}
      {directionReviewRequired && directionRealization && (
        <div className={styles.warning} role="status">
          <strong>Direction realization needs evidence · DF {directionRealization.fidelity.toFixed(2)}</strong>
          <p>{directionRealization.unverified.slice(0, 3).join(" ")}</p>
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
              {selectedFile.mediaType?.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element -- local user-owned preview
                <img src={projectFileDataUrl(selectedFile) ?? ""} alt="Bundled project asset preview" />
              )}
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
          <nav className={styles.nativeRouteBar} aria-label="Preview pages">
            <button type="button" aria-label="Previous preview page" disabled={navigation.index === 0} onClick={() => stepNavigation(-1)}>Back</button>
            <button type="button" aria-label="Next preview page" disabled={navigation.index >= navigation.entries.length - 1} onClick={() => stepNavigation(1)}>Forward</button>
            <label>Page
              <select aria-label="Preview page" value={activePage?.file ?? ""} onChange={(event) => navigate({ file: event.target.value, query: "", fragment: "" })}>
                {pages.map((page) => <option key={page.file} value={page.file}>{page.routePath} — {page.file}</option>)}
              </select>
            </label>
          </nav>
          <p className={styles.nativeCoverage} aria-live="polite">
            Pages {visualTruth.coveredRoutes}/{visualTruth.expectedRoutes} · page/width checks {visualTruth.coveredRouteViewports}/{visualTruth.expectedRouteViewports} · state/width observations {visualTruth.coveredStateViewports}/{visualTruth.expectedStateViewports}
          </p>
          {navigationWarning && <p className={styles.renderPending} role="status">{navigationWarning}</p>}
          <div className={styles.previewMeta}>
            <span>NATIVE HTML · RUNNING / RENDER GATE · {renderGateStatus}</span>
            <span>{selectedViewport.width}</span>
          </div>
          <div className={`${styles.previewViewport} ${styles.nativePreviewViewport}`} style={{ width: selectedViewport.width }}>
            <iframe
              key={activeProbeId}
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
            <div key={`render-${item.surface}-${item.id}`} className={item.status === "fail" ? styles.problemFail : styles.problemWarning}>
              <b>Render · {item.title}</b><span>{item.page} · {item.viewportWidth}px · {item.message}</span>
            </div>
          ))}
          {totalProblems === 0 && renderEvidence.complete && <p className={styles.noProblems}>Static validation and the expected page/state/width coverage passed. Observed state hashes do not prove every interaction is correct.</p>}
          {totalProblems === 0 && !renderEvidence.complete && <p className={styles.renderPending}>Viewport evidence {renderEvidence.covered}/3. Visit every page at each width and exercise its states to complete the render audit. State counts are coverage evidence, not a functional test suite.</p>}
        </div>
      </div>}
    </section>
  );
}
