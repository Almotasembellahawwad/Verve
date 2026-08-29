"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AiDevelopmentPanel, { type AiStudioProposal } from "@/components/AiDevelopmentPanel";
import ProjectWorkbench, { type WorkbenchFocusMode } from "@/components/ProjectWorkbench";
import { SignalNav } from "@/components/SignalNav";
import { PUBLIC_DEMOS } from "@/lib/demo/public-demo-gallery";
import type { EditorProjectRecord } from "@/lib/ports/editor-projects";
import type { GeneratedProject } from "@/lib/project/types";
import {
  createEditorProject,
  createEditorProjectRecord,
  createEditorSnapshot,
  deleteEditorProject,
  getActiveEditorProjectId,
  getEditorProject,
  listEditorProjects,
  recordEditorAiDecision,
  saveEditorProject,
  setActiveEditorProjectId,
} from "@/lib/client/editor-workspace";
import styles from "./editor.module.css";

type SaveState = "loading" | "saved" | "unsaved" | "saving" | "error";
const MAX_IMPORT_BYTES = 15_000_000;
const MAX_PROJECT_CONTENT = 12_000_000;

function sameProjectContent(left: GeneratedProject | null, right: GeneratedProject): boolean {
  return Boolean(left)
    && left!.name === right.name
    && left!.framework === right.framework
    && left!.files.length === right.files.length
    && left!.files.every((file, index) => file.path === right.files[index]?.path && file.content === right.files[index]?.content);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string");
}

function isGeneratedProject(value: unknown): value is GeneratedProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<GeneratedProject>;
  const paths = Array.isArray(project.files) ? project.files.map((file) => file?.path) : [];
  const safePaths = paths.every((path) => typeof path === "string"
    && path.length > 0
    && path.length <= 240
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").includes(".."));
  const uniquePaths = new Set(paths).size === paths.length;
  const contentSize = Array.isArray(project.files)
    ? project.files.reduce((total, file) => total + (typeof file?.content === "string" ? file.content.length : 0), 0)
    : Number.POSITIVE_INFINITY;
  return project.schemaVersion === 1
    && typeof project.name === "string"
    && project.name.length > 0
    && project.name.length <= 120
    && ["nextjs", "react", "html"].includes(String(project.framework))
    && typeof project.entryFile === "string"
    && Array.isArray(project.files)
    && project.files.length > 0
    && project.files.length <= 80
    && safePaths
    && uniquePaths
    && paths.includes(project.entryFile)
    && contentSize <= MAX_PROJECT_CONTENT
    && project.files.every((file) => file
      && typeof file.path === "string"
      && typeof file.content === "string"
      && typeof file.language === "string"
      && ["source", "config", "asset", "documentation"].includes(String(file.role))
      && (file.encoding === undefined || ["utf8", "base64"].includes(file.encoding)))
    && isStringRecord(project.dependencies)
    && isStringRecord(project.scripts)
    && Array.isArray(project.warnings)
    && project.warnings.every((warning) => typeof warning === "string")
    && Boolean(project.readiness && typeof project.readiness === "object")
    && Boolean(project.validation && typeof project.validation === "object");
}

function downloadJson(record: EditorProjectRecord, project: GeneratedProject): void {
  const blob = new Blob([JSON.stringify({ ...record, project }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${record.title.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "verve-project"}.verve.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EditorClient({ initialProjectId, initialDemoId }: { initialProjectId: string | null; initialDemoId: string | null }) {
  const importRef = useRef<HTMLInputElement>(null);
  const latestProjectRef = useRef<GeneratedProject | null>(null);
  const [records, setRecords] = useState<EditorProjectRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<EditorProjectRecord | null>(null);
  const [workingProject, setWorkingProject] = useState<GeneratedProject | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<AiStudioProposal | null>(null);
  const [workspaceView, setWorkspaceView] = useState<Exclude<WorkbenchFocusMode, "split">>("preview");
  const [aiOpen, setAiOpen] = useState(true);
  const [checksOpen, setChecksOpen] = useState(false);

  const refreshRecords = useCallback(async () => {
    const next = await listEditorProjects();
    setRecords(next);
    return next;
  }, []);

  const activate = useCallback(async (record: EditorProjectRecord) => {
    setActiveEditorProjectId(record.id);
    setActiveRecord(record);
    latestProjectRef.current = record.project;
    setWorkingProject(record.project);
    setSaveState("saved");
    setAiProposal(null);
    setWorkspaceVersion((version) => version + 1);
    window.history.replaceState({}, "", `/editor?project=${encodeURIComponent(record.id)}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const available = await refreshRecords();
        const requestedId = initialProjectId ?? getActiveEditorProjectId();
        let record = requestedId ? await getEditorProject(requestedId) : available[0];
        if (!record && initialDemoId) {
          const demo = PUBLIC_DEMOS.find((item) => item.id === initialDemoId);
          if (demo) record = await createEditorProject(demo.result.project, "demo");
        }
        if (!record && available.length === 0) setSaveState("saved");
        if (record && !cancelled) await activate(record);
        if (!cancelled) await refreshRecords();
      } catch {
        if (!cancelled) {
          const fallback = createEditorProjectRecord(PUBLIC_DEMOS[0].result.project, "demo");
          setRecords([fallback]);
          setActiveRecord(fallback);
          latestProjectRef.current = fallback.project;
          setWorkingProject(fallback.project);
          setWorkspaceVersion((version) => version + 1);
          setSaveState("error");
          setNotice("Browser project storage is unavailable. The editor can still run, but this session may not persist.");
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activate, initialDemoId, initialProjectId, refreshRecords]);

  useEffect(() => {
    if (!activeRecord || !workingProject || saveState !== "unsaved") return;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved = await saveEditorProject(activeRecord, workingProject, activeRecord.title);
        setActiveRecord(saved);
        setRecords((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setNotice("Autosave could not reach browser storage. Export a project snapshot before closing this tab.");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeRecord, saveState, workingProject]);

  const handleProjectChange = useCallback((project: GeneratedProject) => {
    if (aiProposal) return;
    if (sameProjectContent(latestProjectRef.current, project)) return;
    latestProjectRef.current = project;
    setWorkingProject(project);
    setSaveState((current) => current === "loading" ? current : "unsaved");
  }, [aiProposal]);

  const acceptAiProposal = async (proposal: AiStudioProposal) => {
    if (!activeRecord || !workingProject) return;
    const saved = await recordEditorAiDecision(activeRecord, workingProject, proposal.project, {
      id: proposal.id,
      createdAt: proposal.createdAt,
      instruction: proposal.instruction,
      summary: proposal.proposal.summary,
      provider: proposal.provider,
      model: proposal.model,
      mode: proposal.mode,
      status: "accepted",
      files: proposal.files.map((file) => file.path),
    });
    setActiveRecord(saved);
    latestProjectRef.current = saved.project;
    setWorkingProject(saved.project);
    setAiProposal(null);
    setAiOpen(false);
    setWorkspaceVersion((version) => version + 1);
    setRecords((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
    setSaveState("saved");
    setNotice(`AI proposal accepted · ${proposal.files.length} file${proposal.files.length === 1 ? "" : "s"} changed.`);
  };

  const rejectAiProposal = async (proposal: AiStudioProposal) => {
    if (!activeRecord || !workingProject) return;
    const saved = await recordEditorAiDecision(activeRecord, workingProject, workingProject, {
      id: proposal.id,
      createdAt: proposal.createdAt,
      instruction: proposal.instruction,
      summary: proposal.proposal.summary,
      provider: proposal.provider,
      model: proposal.model,
      mode: proposal.mode,
      status: "rejected",
      files: proposal.files.map((file) => file.path),
    });
    setActiveRecord(saved);
    setRecords((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
    setAiProposal(null);
    setAiOpen(false);
    setNotice("AI proposal rejected. The accepted project was not changed.");
  };

  const createDemoWorkspace = async () => {
    const demo = PUBLIC_DEMOS[(records.length + 1) % PUBLIC_DEMOS.length];
    const record = await createEditorProject(demo.result.project, "demo");
    await activate(record);
    await refreshRecords();
  };

  const switchProject = async (id: string) => {
    const record = await getEditorProject(id);
    if (record) await activate(record);
  };

  const saveTitle = async (title: string) => {
    if (!activeRecord || !workingProject) return;
    const optimistic = { ...activeRecord, title };
    setActiveRecord(optimistic);
    setSaveState("saving");
    try {
      const saved = await saveEditorProject(optimistic, workingProject, title);
      setActiveRecord(saved);
      await refreshRecords();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const snapshot = async () => {
    if (!activeRecord || !workingProject) return;
    const saved = await createEditorSnapshot(activeRecord, workingProject, `Revision ${activeRecord.snapshots.length + 1}`);
    setActiveRecord(saved);
    await refreshRecords();
    setSaveState("saved");
    setNotice("Revision captured locally.");
  };

  const restoreSnapshot = async (snapshotId: string) => {
    if (!activeRecord) return;
    const selected = activeRecord.snapshots.find((item) => item.id === snapshotId);
    if (!selected) return;
    const saved = await saveEditorProject(activeRecord, selected.project, activeRecord.title);
    setActiveRecord(saved);
    latestProjectRef.current = saved.project;
    setWorkingProject(saved.project);
    setWorkspaceVersion((version) => version + 1);
    setSaveState("saved");
    setNotice(`${selected.label} restored.`);
  };

  const removeActiveProject = async () => {
    if (!activeRecord || !window.confirm(`Delete “${activeRecord.title}” from this browser?`)) return;
    await deleteEditorProject(activeRecord.id);
    const remaining = await refreshRecords();
    if (remaining[0]) await activate(remaining[0]);
    else {
      setActiveRecord(null);
      setWorkingProject(null);
      latestProjectRef.current = null;
      setAiProposal(null);
      setSaveState("saved");
      window.history.replaceState({}, "", "/editor");
    }
  };

  const importProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("Project export is too large");
      const parsed = JSON.parse(await file.text()) as unknown;
      const project = isGeneratedProject(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && isGeneratedProject((parsed as { project?: unknown }).project)
          ? (parsed as { project: GeneratedProject }).project
          : null;
      if (!project) throw new Error("Not a Verve project");
      const record = await createEditorProject(project, "import");
      await activate(record);
      await refreshRecords();
      setNotice("Project imported into local workspace.");
    } catch {
      setNotice("That file is not a valid Verve project export.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <main className={styles.page}>
      <SignalNav />
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importProject(event.target.files?.[0])} />

      <header className={styles.appBar} aria-label="Editor controls">
        <div className={styles.editorIdentity}><strong>Editor</strong><span data-state={saveState}>{saveState === "saved" ? "Saved locally" : saveState}</span></div>
        <label className={styles.projectPicker}>
          <span>Project</span>
          <select value={activeRecord?.id ?? ""} onChange={(event) => void switchProject(event.target.value)} disabled={!activeRecord}>
            {records.map((record) => <option value={record.id} key={record.id}>{record.title}</option>)}
            {!activeRecord && <option value="">No project open</option>}
          </select>
        </label>
        {activeRecord && workingProject && <>
          <div className={styles.viewSwitch} role="group" aria-label="Workspace view">
            <button type="button" aria-pressed={workspaceView === "preview"} onClick={() => setWorkspaceView("preview")}>Preview</button>
            <button type="button" aria-pressed={workspaceView === "code"} onClick={() => setWorkspaceView("code")}>Code</button>
          </div>
          <button type="button" className={styles.toolToggle} aria-pressed={aiOpen} onClick={() => setAiOpen((value) => !value)}>AI</button>
          <button type="button" className={styles.toolToggle} aria-pressed={checksOpen} onClick={() => setChecksOpen((value) => !value)}>Checks</button>
          <details className={styles.projectMenu}>
            <summary>Project <span aria-hidden="true">⌄</span></summary>
            <div className={styles.projectMenuPanel}>
              <label><span>Name</span><input value={activeRecord.title} onChange={(event) => setActiveRecord({ ...activeRecord, title: event.target.value })} onBlur={(event) => void saveTitle(event.target.value)} maxLength={120} /></label>
              <dl><div><dt>Framework</dt><dd>{workingProject.framework}</dd></div><div><dt>Files</dt><dd>{workingProject.files.length}</dd></div><div><dt>Readiness</dt><dd>{workingProject.readiness.score}/100</dd></div></dl>
              <div className={styles.menuActions}>
                <button type="button" onClick={() => void snapshot()}>Capture revision</button>
                <button type="button" onClick={() => downloadJson(activeRecord, workingProject)}>Export session</button>
                <button type="button" onClick={() => importRef.current?.click()}>Import project</button>
                <button type="button" onClick={() => void createDemoWorkspace()}>Open example project</button>
                <Link href="/create">Create another project</Link>
                <button type="button" className={styles.danger} onClick={() => void removeActiveProject()}>Delete local project</button>
              </div>
              <div className={styles.revisions}><span>History / {activeRecord.snapshots.length}</span>{activeRecord.snapshots.map((item) => <button type="button" onClick={() => void restoreSnapshot(item.id)} key={item.id}><strong>{item.label}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}{activeRecord.snapshots.length === 0 && <p>No captured revisions yet.</p>}</div>
            </div>
          </details>
        </>}
      </header>

      {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}

      {activeRecord && workingProject ? (
        <section className={styles.editorShell} data-ai-open={aiOpen || undefined}>
          <div className={styles.canvas}>
            {aiProposal && <div className={styles.proposalBanner} role="status"><b>Proposal preview</b><span>You are viewing staged AI changes. The accepted project is still untouched.</span></div>}
            <div className={styles.canvasMeta}><span>{workspaceView === "preview" ? "LIVE PREVIEW" : "PROJECT FILES"}</span><span>{aiProposal ? "PROPOSAL" : "ACCEPTED PROJECT"} · {workingProject.readiness.score}/100</span></div>
            <ProjectWorkbench
              key={`${activeRecord.id}-${workspaceVersion}-${aiProposal?.id ?? "accepted"}`}
              project={aiProposal?.project ?? workingProject}
              onProjectChange={aiProposal ? undefined : handleProjectChange}
              readOnly={Boolean(aiProposal)}
              focusMode={workspaceView}
              showDiagnostics={checksOpen}
            />
          </div>
          {aiOpen && <aside className={styles.aiDrawer} aria-label="AI change assistant"><AiDevelopmentPanel key={activeRecord.id} project={workingProject} iterations={activeRecord.iterations ?? []} onPreview={(proposal) => { setAiProposal(proposal); if (proposal) setAiOpen(true); }} onAccept={acceptAiProposal} onReject={rejectAiProposal} /></aside>}
        </section>
      ) : (
        saveState === "loading" ? <section className={styles.loading} aria-live="polite">Opening your local projects…</section> : <section className={styles.emptyState}><span>EDITOR / NO PROJECT OPEN</span><h1>What would you like to develop?</h1><p>Create a new project, explore a ready example, or import a Verve workspace from this browser.</p><div><Link href="/create">Create a project →</Link><Link href="/examples">Open an example</Link><button type="button" onClick={() => importRef.current?.click()}>Import .verve.json</button></div></section>
      )}
    </main>
  );
}
