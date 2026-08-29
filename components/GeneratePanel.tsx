"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./GeneratePanel.module.css";
import { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";
import type { Provider } from "@/lib/llm-adapter/types";
import { addHistory, entryFromResult } from "@/lib/history";
import type { HistoryEntry } from "@/lib/history";
import { downloadCSS, downloadFigmaTokens, downloadREADME } from "@/lib/export";
import HistoryDrawer from "./HistoryDrawer";
import Certificate  from "./Certificate";
import PatchPanel   from "./PatchPanel";
import { getLocalApiKey, LOCAL_KEYS_CHANGED_EVENT } from "@/lib/client/key-storage";
import ProjectWorkbench from "./ProjectWorkbench";
import VoiceBriefInput from "./VoiceBriefInput";
import type { GeneratedProject } from "@/lib/project/types";
import { buildRecoveryProject } from "@/lib/project/project-builder";
import { readWithInactivityTimeout, StreamInactivityError } from "@/lib/client/generation-stream";
import {
  checkpointMatchesInput,
  isPipelineCheckpoint,
  type PipelineCheckpoint,
} from "@/lib/engine/pipeline-checkpoint";
import ResultShareKit from "./ResultShareKit";
import BrandKitInput from "./BrandKitInput";
import { launchProjectEditor } from "@/lib/client/editor-workspace";
import {
  attachOwnedAssets,
  ownedAssetManifest,
  stripOwnedAssetContent,
  type BrandProfile,
  type LocalOwnedAsset,
} from "@/lib/project/brand-kit";
import { DEFAULT_GENERATION_MODE, type GenerationMode } from "@/lib/domain/generation-mode";
import type { DirectionPortfolio } from "@/lib/domain/design-direction";
import { fingerprintDirection } from "@/lib/engine/direction-portfolio";
import {
  getRecentLocalDesignFingerprints,
  rememberLocalDesignDirection,
} from "@/lib/client/design-memory";

const PROVIDERS: { id: Provider; label: string; icon: string }[] = [
  { id: "anthropic",  label: "Claude",     icon: "A" },
  { id: "openai",     label: "GPT",        icon: "O" },
  { id: "gemini",     label: "Gemini",     icon: "G" },
  { id: "openrouter", label: "OpenRouter", icon: "R" },
];

// ─── Pipeline telemetry stages (SSE real events now power this) ───────────────
const PIPELINE_STAGES = [
  { id: "01",   name: "BRIEF ANALYZER",         module: "brief-analyzer.ts",   status: "EXTRACTING"  },
  { id: "02",   name: "ASSETS + BLOCKLIST + L",  module: "H+Blocklist+L",       status: "SCANNING"    },
  { id: "02.5", name: "BRAND ARCHETYPE",         module: "Module I",            status: "RESOLVING"   },
  { id: "02.6", name: "ANIMATION LANGUAGE",      module: "Module K",            status: "DERIVING"    },
  { id: "03",   name: "PLAN + ADVERSARIAL REVIEW", module: "PlanGenerator + G", status: "CRITIQUING"  },
  { id: "04",   name: "DESIGN CONTRACT GATES",   module: "contrast + spec + QD", status: "VERIFYING"   },
  { id: "05",   name: "CODE GENERATION",         module: "code-generator.ts",   status: "COMPILING"   },
  { id: "05.5", name: "CODE VALIDATION",         module: "CodeQualityLoop",     status: "REPAIRING"    },
  { id: "06",   name: "NORMAN 3-LEVEL SCORE",    module: "scorer.ts",           status: "SCORING"     },
  { id: "07",   name: "PROJECT ASSEMBLY",        module: "ProjectEngine",       status: "PACKAGING"   },
] as const;

// ─── Sample Briefs ────────────────────────────────────────────────────────────
const SAMPLE_BRIEFS = [
  { label: "Interior Design",   brief: "Interior design company in Abu Dhabi. High-end residential and hospitality. Target: HNW individuals and hotel developers. Goal: consultation bookings." },
  { label: "Motion Portfolio",  brief: "Portfolio for a senior motion designer at a major studio. Title sequences and brand films. Must feel different from typical creative portfolios." },
  { label: "SaaS Analytics",    brief: "B2B analytics platform for e-commerce teams. Helps merchandisers understand product performance without SQL. Target: non-technical team leads." },
  { label: "Luxury Skincare",   brief: "Skincare brand launching in the UK. Ingredients from Norway. Clinical efficacy, but brand voice should be warm and accessible, not pharmaceutical." },
  { label: "Law Firm",          brief: "Employment law firm specializing in discrimination and unfair dismissal. Clients are individuals, not corporations. Must feel trustworthy and on their side." },
  { label: "Architecture",      brief: "Architecture practice in London specializing in adaptive reuse — converting industrial buildings into residential and cultural spaces. 40 completed projects." },
] as const;

const GENERATION_MODE_OPTIONS: ReadonlyArray<{
  id: GenerationMode;
  title: string;
  badge: string;
  budget: string;
  description: string;
}> = [
  {
    id: "fast",
    title: "Fast",
    badge: "Recommended",
    budget: "2 core model calls",
    description: "Local brief, archetype, and critique. Deterministic validation with resumable checkpoints.",
  },
  {
    id: "studio",
    title: "Studio",
    badge: "Deep review",
    budget: "Variable, bounded calls",
    description: "Provider critique, one optional plan revision, and one targeted repair when needed.",
  },
];

type StageState = "waiting" | "running" | "done" | "flagged";

type PipelineResult = {
  demo?: true;
  mode: GenerationMode;
  briefAnalysis: {
    subject: string;
    audience: string;
    primaryJob: string;
    tone: string;
    industry: string;
  };
  assetBundle?: {
    photos: { url: string; alt: string; photographer: string; credit: string }[];
    mediaRequirement: {
      level: "required" | "recommended" | "optional" | "avoid";
      minimumAssets: number;
      reason: string;
      suggestedSubjects: string[];
    };
    warnings: string[];
    readinessWarnings: string[];
  };
  assetUsage?: {
    available: number;
    required: number;
    used: number;
    attributed: number;
    warnings: string[];
  };
  execution?: {
    requestedMode: GenerationMode;
    effectiveMode: "fast" | "studio" | "studio-degraded";
    provider: Provider;
    requestedModel: string;
    resolvedModel: string;
    critiqueSource: "provider" | "local-preflight" | "local-fallback";
    scoreConfidence: "structural" | "adversarial";
    degraded: boolean;
    degradations: { stageId: string; reason: string; message: string }[];
  };
  plan: {
    colorPalette: { name: string; hex: string; role: string }[];
    typePairing: { display: string; body: string; rationale: string };
    layoutConcept: string;
    signatureElement: { name: string; description: string; justification: string };
    referencesSampled: string[];
    directionPortfolio?: DirectionPortfolio;
  };
  directionDiversity?: {
    passed: boolean;
    diversityScore: number;
    historicalNoveltyScore: number | null;
    recommendedDirectionId: string;
    warnings: string[];
  };
  critique: {
    passed: boolean;
    flaggedElements: { element: string; reason: string; severity: string }[];
    positiveElements: string[];
    verdict: string;
    transcript: string;
  };
  code: {
    code: string;
    framework: string;
    componentName: string;
    setupNotes: string;
  };
  // Module I
  archetype?: {
    id: string;
    name: string;
    secondaryId: string | null;
    confidence: number;
    reasoning: string;
    emotionalJob: string;
    archetypeConflict: string;
  };
  // Module K
  animationLanguage?: {
    archetypeId: string;
    codeGenHint: string;
    primaryEasing: { name: string; css: string; description: string };
    durations: { instant: number; fast: number; medium: number; slow: number; dramatic: number };
  };
  distinctivenessReport: {
    score: number;
    grade: string;
    clichesAvoided: string[];
    clichesDetected: string[];
    signatureElement: string;
    critiqueSummary: string;
    revisionCount: number;
    recommendations: string[];
    // Module I
    archetypeId?: string;
    archetypeCoherence?: number;
    // Module J — Don Norman 3-Level
    normanLevels?: {
      visceral:   { score: number; grade: string; rationale: string; improvements: string[] };
      behavioral: { score: number; grade: string; rationale: string; improvements: string[] };
      reflective: { score: number; grade: string; rationale: string; improvements: string[] };
    };
    normanSummary?: string;
  };
  // Module N -- Restraint Check (Dieter Rams)
  restraintResult?: {
    verdict: "disciplined" | "restrained-further" | "over-designed";
    boldestElement: string;
    reasoning: string;
    suggestion: string | null;
    restraintScore: number;
  };
  // Engineering Score -- Dual Scoring axis 2
  engineeringResult?: {
    compositeScore: number;
    grade: string;
    passed: boolean;
    dimensions: { id: string; name: string; score: number; weight: number; flags: string[]; passed: boolean }[];
    criticalFailures: string[];
    recommendations: string[];
  };
  diversityResult?: {
    passed: boolean;
    fingerprints: string[];
    scoreCap: number | null;
    warnings: string[];
    recommendation: string | null;
  };
  revisionCount: number;
  durationMs: number;
  project: GeneratedProject;
};

function rememberResultDirection(result: PipelineResult, outcome: "generated" | "accepted"): void {
  const portfolio = result.plan.directionPortfolio;
  const selected = portfolio?.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId);
  if (selected) {
    const deliveredCode = result.project.files
      .filter((file) => file.role === "source" && file.encoding !== "base64")
      .map((file) => file.content)
      .join("\n");
    rememberLocalDesignDirection(fingerprintDirection(selected, deliveredCode), outcome);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used as type source below
const FRAMEWORKS = ["nextjs", "react", "html"] as const;
type Framework = (typeof FRAMEWORKS)[number];

// ─── Telemetry Log Component ──────────────────────────────────────────────────
function TelemetryLog({ stages, extras = {} }: { stages: StageState[]; extras?: Record<string, string> }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [stages]);

  return (
    <div className={styles.telemetry} ref={logRef} aria-live="polite" aria-label="Pipeline progress">
      <div className={styles.telemetryHeader}>
        <span className={styles.telemetryTitle}>{"// VERVE PIPELINE — RUNNING"}</span>
        <span className={styles.telemetryDot} aria-hidden="true" />
      </div>
      {PIPELINE_STAGES.map((stage, i) => {
        const state = stages[i] ?? "waiting";
        return (
          <div key={stage.id} className={`${styles.telemetryLine} ${styles[`tl-${state}`]}`}>
            <span className={styles.tlStageId}>[{stage.id}]</span>
            <span className={styles.tlName}>{stage.name}</span>
            <span className={styles.tlModule}>{stage.module}</span>
            <span className={styles.tlStatus}>
              {state === "waiting" && <span className={styles.tlWaiting}>waiting...</span>}
              {state === "running" && <span className={styles.tlRunning}>{stage.status}<span className={styles.tlDots} /></span>}
              {state === "done" && <span className={styles.tlDone}>✓ DONE{extras[stage.id] ? ` · ${extras[stage.id]}` : ""}</span>}
              {state === "flagged" && <span className={styles.tlFlagged}>⚑ FLAGGED → RETRY</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GeneratePanel() {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [existingCode, setExistingCode] = useState("");
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({ colors: [] });
  const [ownedAssets, setOwnedAssets] = useState<LocalOwnedAsset[]>([]);
  const [framework, setFramework] = useState<Framework>("nextjs");
  const [mode, setMode] = useState<GenerationMode>(DEFAULT_GENERATION_MODE);
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [patchedCode, setPatchedCode] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"project" | "plan" | "code" | "report">("project");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState<string>(DEFAULT_MODEL.anthropic);
  const [apiKey, setApiKey] = useState("");
  const [pexelsReady, setPexelsReady] = useState(false);
  const [missingKey, setMissingKey] = useState(false);
  const [stageStates, setStageStates] = useState<StageState[]>([]);
  const [stageExtras, setStageExtras] = useState<Record<string, string>>({});
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [recoveryProject, setRecoveryProject] = useState<GeneratedProject | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryCheckpoint, setRecoveryCheckpoint] = useState<PipelineCheckpoint | null>(null);
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [certOpen,     setCertOpen]     = useState(false);
  const telemetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const latestCheckpointRef = useRef<PipelineCheckpoint | null>(null);

  useEffect(() => {
    setHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect -- prevent native details toggles before hydration
  }, []);

  // Reload apiKey when provider changes — reads from localStorage (external system)
  useEffect(() => {
    setApiKey( // eslint-disable-line react-hooks/set-state-in-effect
      getLocalApiKey(provider)
    );
  }, [provider]);

  // Read browser-only route state after hydration so SSR and the first client
  // render stay identical, then remove it from the address bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const routeBrief = params.get("brief");
    if (routeBrief !== null) {
      setBrief(routeBrief); // eslint-disable-line react-hooks/set-state-in-effect
      const url = new URL(window.location.href);
      url.searchParams.delete("brief");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const onStorageChange = () => {
      const stored = getLocalApiKey(provider);
      setApiKey(stored);
      setPexelsReady(Boolean(getLocalApiKey("pexels")));
      if (stored) setMissingKey(false);
    };
    onStorageChange();
    window.addEventListener("storage", onStorageChange);
    window.addEventListener(LOCAL_KEYS_CHANGED_EVENT, onStorageChange);
    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener(LOCAL_KEYS_CHANGED_EVENT, onStorageChange);
    };
  }, [provider]);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULT_MODEL[p]);
    const stored = getLocalApiKey(p);
    setApiKey(stored);
    setMissingKey(false);
    if (p === "openrouter") setMode("fast");
  };

  const openApiKeyModal = () => {
    window.dispatchEvent(new CustomEvent("verve:open-api-key-modal"));
  };

  // ── SSE-based telemetry: update stage from real events ──────────────────
  const updateStage = (stageId: string, state: StageState, extra?: string) => {
    const normalizedStageId = stageId.startsWith("03.r")
      ? "03"
      : stageId.startsWith("04.")
        ? "04"
        : stageId;
    setStageStates((prev) => {
      const idx = PIPELINE_STAGES.findIndex((s) => s.id === normalizedStageId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = state;
      return next;
    });
    if (extra) {
      setStageExtras((prev) => ({ ...prev, [normalizedStageId]: extra }));
    }
  };

  const stopTelemetry = (completed = true) => {
    telemetryTimers.current.forEach(clearTimeout);
    if (completed) setStageStates(PIPELINE_STAGES.map(() => "done"));
  };

  const handleGenerate = async (
    requestedMode: GenerationMode = mode,
    resumeCheckpoint?: PipelineCheckpoint
  ) => {
    if (!brief.trim() || brief.length < 10) {
      setError("Please enter a design brief (at least 10 characters).");
      return;
    }

    const currentKey = getLocalApiKey(provider) || apiKey;
    if (!currentKey) {
      setMissingKey(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMissingKey(false);
    setResult(null);
    setRecoveryProject(null);
    setRecoveryMessage(null);
    setRecoveryCheckpoint(null);
    latestCheckpointRef.current = resumeCheckpoint ?? null;
    setPatchedCode(null); // reset patched code on new generation
    setRetryMessage(null);
    setStageExtras({});
    setStageStates(PIPELINE_STAGES.map(() => "waiting"));

    // ── SSE streaming via fetch + ReadableStream ─────────────────────────
    const requestController = new AbortController();
    abortRef.current = requestController;
    const assetManifest = ownedAssets.map((asset) => ownedAssetManifest(asset, framework));
    const brandContext = JSON.stringify({ brandProfile, ownedAssets: assetManifest });

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({
          brief,
          existingCode: existingCode || undefined,
          framework,
          apiKey: currentKey,
          provider,
          model,
          mode: requestedMode,
          pexelsKey: getLocalApiKey("pexels") || undefined,
          brandProfile,
          ownedAssets: assetManifest,
          recentDirectionFingerprints: getRecentLocalDesignFingerprints(),
          checkpoint: resumeCheckpoint && checkpointMatchesInput(resumeCheckpoint, {
            brief,
            existingCode: existingCode || undefined,
            framework,
            mode: requestedMode,
            brandContext,
          }) ? resumeCheckpoint : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if ((data as Record<string, string>).code === "NO_API_KEY") { setMissingKey(true); return; }
        throw new Error((data as Record<string, string>).error ?? "Generation failed");
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let receivedTerminalEvent = false;

      while (true) {
        const { done, value } = await readWithInactivityTimeout(reader);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let dataStr   = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: "))  dataStr   = line.slice(6).trim();
          }
          if (!dataStr) continue;

          let payload: Record<string, unknown>;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          if (eventType === "stage_start") {
            updateStage(payload.id as string, "running");
            setRetryMessage(null); // clear retry banner when next stage begins
          } else if (eventType === "stage_done") {
            const extra = payload.extra as Record<string, unknown> | undefined;
            const hint  = extra ? Object.entries(extra).map(([k,v]) => `${k}: ${v}`).join(" · ") : undefined;
            updateStage(payload.id as string, "done", hint);
            setRetryMessage(null);
          } else if (eventType === "stage_retry") {
            const attempt = String(payload.attempt ?? "");
            const retryModel = String(payload.model ?? "provider");
            const waitSeconds = Math.ceil(Number(payload.waitMs ?? 0) / 1000);
            setRetryMessage(`Attempt ${attempt} · ${retryModel} · retrying in ${waitSeconds}s`);
          } else if (eventType === "stage_flag") {
            updateStage(payload.id as string, "flagged", payload.reason as string);
          } else if (eventType === "stage_degraded") {
            updateStage(String(payload.id ?? ""), "running", "local fallback");
            setRetryMessage(String(payload.message ?? "Optional provider review was replaced by the local preflight."));
          } else if (eventType === "checkpoint") {
            if (isPipelineCheckpoint(payload.checkpoint)) {
              latestCheckpointRef.current = payload.checkpoint;
            }
          } else if (eventType === "result") {
            receivedTerminalEvent = true;
            setRetryMessage(null);
            stopTelemetry();
            const data = payload as PipelineResult;
            const enriched = ownedAssets.length > 0
              ? { ...data, project: attachOwnedAssets(data.project, ownedAssets) }
              : data;
            rememberResultDirection(enriched, "generated");
            setResult(enriched);
            latestCheckpointRef.current = null;
            setActiveView("project");
            // ── Save to history ──────────────────────────────────────────
            try {
              const historyResult = ownedAssets.length > 0
                ? { ...enriched, project: stripOwnedAssetContent(enriched.project) }
                : enriched;
              addHistory(entryFromResult(brief, historyResult));
            } catch {}
          } else if (eventType === "heartbeat") {
            const stageElapsed = Math.max(1, Math.round(Number(payload.stageElapsedMs ?? 0) / 1000));
            const totalElapsed = Math.max(stageElapsed, Math.round(Number(payload.totalElapsedMs ?? 0) / 1000));
            setRetryMessage(`Provider is working · stage ${String(payload.stageId ?? "")} ${stageElapsed}s · total ${totalElapsed}s`);
          } else if (eventType === "stage_error") {
            setRecoveryMessage(String(payload.message ?? "The provider stopped before completing this stage."));
          } else if (eventType === "recovery") {
            receivedTerminalEvent = true;
            stopTelemetry(false);
            setRecoveryMessage(String(payload.message ?? "A recovery draft was preserved."));
            setRecoveryProject(payload.project as GeneratedProject);
            const checkpoint = isPipelineCheckpoint(payload.checkpoint)
              ? payload.checkpoint
              : latestCheckpointRef.current;
            setRecoveryCheckpoint(checkpoint);
          } else if (eventType === "error") {
            const errPayload = payload as Record<string, string>;
            const msg = errPayload.message || errPayload.error || errPayload.code || "Pipeline error";
            throw new Error(msg);
          }
        }
      }

      if (!receivedTerminalEvent) {
        throw new Error("Pipeline stream ended before delivering a result.");
      }

    } catch (err) {
      const wasCancelled = err instanceof DOMException && err.name === "AbortError";
      const streamStalled = err instanceof StreamInactivityError;
      if (streamStalled) {
        requestController.abort(err);
        setRecoveryMessage("The live connection stopped receiving heartbeats. A local recovery checkpoint was created immediately.");
        setRecoveryProject(buildRecoveryProject(brief, framework, "stream"));
        setRecoveryCheckpoint(latestCheckpointRef.current);
      }
      if (!wasCancelled) stopTelemetry(false);
      const raw = err instanceof Error ? err.message : "Something went wrong";
      // Translate technical errors to user-friendly messages
      let friendly = wasCancelled ? "Generation cancelled." : streamStalled ? "The provider stream stalled; your recovery checkpoint is ready below." : raw;
      if (raw.includes("rate limit") || raw.includes("429") || raw.includes("Too Many Requests") || raw === "RATE_LIMITED") {
        friendly = "Rate limit reached. Please wait a moment and try again, or switch to a model with higher limits.";
      } else if (raw.includes("No API key") || raw.includes("ANTHROPIC_API_KEY") || raw === "NO_API_KEY") {
        friendly = "No API key set. Click \"Key set\" or \"Add key\" above to add your API key.";
      } else if (raw.includes("401") || raw.includes("Unauthorized") || raw.includes("Invalid API key") || raw.includes("incorrect API key")) {
        friendly = "Invalid API key. Please check your key in the settings and try again.";
      } else if (raw.includes("insufficient_quota") || raw.includes("quota") || raw.includes("billing")) {
        friendly = "Account quota/billing limit exceeded on your AI provider. Please check your API credits/billing.";
      } else if (raw.includes("timed out") || raw.includes("timeout") || raw.includes("AbortError") || raw === "TIMEOUT") {
        friendly = "Request timed out while generating. Reasoning models can take longer — try GPT-5.6 Luna or Claude Sonnet 4.6.";
      } else if (raw.includes("reasoning") || raw.includes("reasoning_content") || raw.includes("token budget")) {
        friendly = "The reasoning model consumed its token budget before completing output. Try GPT-5.6 Luna or Claude Sonnet 4.6.";
      } else if (raw.includes("does not exist") || raw.includes("model_not_found") || raw.includes("unknown model")) {
        friendly = "Selected model is unavailable. Please select a supported model in the settings panel.";
      } else if (raw.includes("context_length") || raw.includes("maximum context") || raw.includes("prompt is too long") || raw.includes("too many tokens")) {
        friendly = "Input too long for this model. Try a shorter design brief or switch to a model with a larger context window.";
      }
      setError(friendly);
    } finally {
      setLoading(false);
      if (abortRef.current === requestController) abortRef.current = null;
    }
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setHistoryOpen(false);
    setBrief(entry.brief);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry.fullResult) { setResult(entry.fullResult as any); setActiveView("project"); }
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "S": return "var(--brand)";
      case "A": return "var(--status-success)";
      case "B": return "var(--status-warning)";
      case "C": return "var(--status-info)";
      case "D": return "var(--status-danger)";
      default: return "var(--text-muted)";
    }
  };

  return (
    <>
      {/* ── History Drawer ────────────────────────────────────────────── */}
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} onRestore={handleRestoreHistory} />

      {/* ── Certificate ─────────────────────────────────────────── */}
      {certOpen && result && (
        <Certificate
          onClose={() => setCertOpen(false)}
          data={{
            score:              result.distinctivenessReport.score,
            grade:              result.distinctivenessReport.grade,
            normanLevels:       result.distinctivenessReport.normanLevels,
            archetypeId:        result.distinctivenessReport.archetypeId,
            archetypeCoherence: result.distinctivenessReport.archetypeCoherence,
            signatureElement:   result.distinctivenessReport.signatureElement,
            brief,
            durationMs:         result.durationMs,
            revisionCount:      result.revisionCount,
          }}
        />
      )}

      <div className={styles.panel}>
        <div className={styles.workbenchHeader}>
          <div>
            <span>CREATE / BRIEF</span>
            <h3>Begin with the intent.</h3>
          </div>
          <p>Fast is ready by default. Provider, framework, brand, and media controls stay available when you need them.</p>
        </div>
        {/* ── Top toolbar ─────────────────────────────────────────── */}
        <div className={styles.panelToolbar}>
          <button
            className={styles.toolbarBtn}
            onClick={() => setHistoryOpen(true)}
            id="history-btn"
            title="View past generations"
          >
            ◱ History
          </button>
        </div>
      {/* -- Provider Row -------------------------------------------------------- */}
      <details className={styles.advancedSettings} inert={hydrated ? undefined : true}>
        <summary><span>Provider settings</span><b>{PROVIDERS.find((item) => item.id === provider)?.label} · {apiKey ? "key ready" : "key needed"}</b><i>+</i></summary>
      <div className={styles.providerRow}>
        <div className={styles.providerGroup}>
          <span className={styles.label}>AI provider</span>
          <div className={styles.providerTabs} role="group" aria-label="Select AI provider">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={`${styles.providerTab} ${provider === p.id ? styles.providerTabActive : ""}`}
                onClick={() => handleProviderChange(p.id)}
                type="button"
                disabled={loading}
              >
                <span aria-hidden="true">{p.icon}</span>
                {p.label}
                {p.id === "openrouter" && <span className={styles.freeTag}>FREE</span>}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.inputGroup} style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="model-select" className={styles.label}>Model</label>
          <select
            id="model-select"
            className={styles.select}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
          >
            {PROVIDER_MODELS[provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} &mdash; {m.description}
              </option>
            ))}
          </select>
        </div>
        {/* Key status badge -- opens modal instead of inline input */}
        <div className={styles.inputGroup}>
          <span className={styles.label}>{PROVIDER_KEY_LABELS[provider].label}</span>
          <button
            type="button"
            className={apiKey ? styles.keySetBadge : styles.keyMissingBadge}
            onClick={openApiKeyModal}
            title={apiKey ? "Click to manage API keys" : "Click to add API key"}
          >
            {apiKey
              ? <><span className={styles.keySetDot} />Key set &#10003;<span className={styles.keyManageHint}>Manage &#8599;</span></>
              : <>Add key &#8599;</>}
          </button>
        </div>
      </div>

      <button
        type="button"
        className={styles.assetSourceStatus}
        onClick={openApiKeyModal}
        aria-label="Manage the optional Pexels visual asset source"
      >
        <span>VISUAL SOURCE</span>
        <strong>{pexelsReady ? "Pexels connected" : "Pexels not connected"}</strong>
        <small>
          {pexelsReady
            ? "Media Gate can source approved photography."
            : "Image-dependent launches will be blocked until approved media is added."}
        </small>
        <b aria-hidden="true">Manage ↗</b>
      </button>
      </details>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className={styles.inputSection}>
        <div className={styles.inputGroup}>
          <label htmlFor="brief-input" className={styles.label}>
            Design brief
          </label>

          {/* Sample Briefs quick-fill */}
          <div className={styles.sampleBriefs} role="group" aria-label="Sample briefs">
            {SAMPLE_BRIEFS.map((s) => (
              <button
                key={s.label}
                className={styles.sampleChip}
                onClick={() => setBrief(s.brief)}
                disabled={loading}
                title={s.brief}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>

          <VoiceBriefInput
            disabled={loading}
            onTranscript={(transcript) => setBrief((current) => `${current}${current.trim() ? " " : ""}${transcript}`)}
          />

          <textarea
            id="brief-input"
            className={styles.textarea}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you're building. Be specific: who uses it, what it must accomplish, what tone is appropriate. Generic briefs produce generic plans — that's the problem Verve solves."
            rows={6}
            disabled={loading}
            aria-describedby="brief-hint"
          />
          <p id="brief-hint" className={styles.hint}>
            Example: &ldquo;A landing page for a carbon accounting SaaS for manufacturing CFOs. Must communicate precision and credibility, not environmentalism.&rdquo;
          </p>
        </div>

        <details className={styles.advancedSettings} inert={hydrated ? undefined : true}>
          <summary><span>Project options</span><b>{mode === "fast" ? "Fast" : "Studio"} · {framework}</b><i>+</i></summary>
          <div className={styles.advancedBody}>
        <div className={styles.optionsRow}>
          <fieldset className={styles.modeFieldset} disabled={loading}>
            <legend className={styles.label}>Generation mode</legend>
            <div className={styles.modeGrid}>
              {GENERATION_MODE_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`${styles.modeCard} ${mode === option.id ? styles.modeCardActive : ""}`}
                >
                  <input
                    className={styles.modeInput}
                    type="radio"
                    name="generation-mode"
                    value={option.id}
                    checked={mode === option.id}
                    onChange={() => setMode(option.id)}
                    aria-describedby={`generation-mode-${option.id}-description`}
                  />
                  <span className={styles.modeCardHead}>
                    <strong>{option.title}</strong>
                    <b>{option.badge}</b>
                  </span>
                  <span className={styles.modeBudget}>{option.budget}</span>
                  <small id={`generation-mode-${option.id}-description`}>{option.description}</small>
                </label>
              ))}
            </div>
            {provider === "openrouter" && mode === "studio" && (
              <span className={styles.modeNotice} role="status">
                Free OpenRouter capacity is more reliable in Fast. Studio remains available and may degrade to local review.
              </span>
            )}
          </fieldset>
          <div className={styles.inputGroup}>
            <label htmlFor="framework-select" className={styles.label}>
              Framework
            </label>
            <select
              id="framework-select"
              className={styles.select}
              value={framework}
              onChange={(e) => setFramework(e.target.value as Framework)}
              disabled={loading}
            >
              <option value="nextjs">Next.js 16</option>
              <option value="react">React 19</option>
              <option value="html">HTML + CSS</option>
            </select>
          </div>

          <button
            className={styles.toggleCode}
            onClick={() => setShowCode((v) => !v)}
            aria-expanded={showCode}
            type="button"
          >
            {showCode ? "Hide existing code" : "Paste existing code (optional)"}
          </button>
        </div>

        {showCode && (
          <div className={styles.inputGroup}>
            <label htmlFor="existing-code" className={styles.label}>
              Existing code to redesign
            </label>
            <textarea
              id="existing-code"
              className={styles.textarea}
              value={existingCode}
              onChange={(e) => setExistingCode(e.target.value)}
              placeholder="Paste existing HTML, JSX, or CSS here..."
              rows={8}
              disabled={loading}
            />
          </div>
        )}

        <BrandKitInput
          profile={brandProfile}
          assets={ownedAssets}
          disabled={loading}
          onProfileChange={setBrandProfile}
          onAssetsChange={setOwnedAssets}
        />
          </div>
        </details>

        {/* Missing API Key Banner */}
        {missingKey && (
          <div className={styles.apiKeyBanner} role="alert">
            <div className={styles.apiKeyBannerIcon} aria-hidden="true">⚿</div>
            <div className={styles.apiKeyBannerText}>
              <strong>API key required.</strong> Verve runs on your own {PROVIDERS.find((item) => item.id === provider)?.label} API key —
              it&apos;s never stored server-side.
              <br />
              <a
                href="https://console.anthropic.com/account/keys"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.apiKeyBannerGetLink}
              >
                Get a free key at console.anthropic.com ↗
              </a>
            </div>
            <button
              className={styles.apiKeyBannerBtn}
              onClick={openApiKeyModal}
              type="button"
            >
              Set API key
            </button>
          </div>
        )}

        {error && (
          <div
            className={styles.error}
            role="alert"
            style={error.toLowerCase().includes("rate limit")
              ? { borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.05)", color: "rgba(251,191,36,0.85)" }
              : undefined}
          >
            <span aria-hidden="true">
              {error.toLowerCase().includes("rate limit") ? "⏳" : "⚠"}
            </span>
            {" "}{error}
          </div>
        )}

        <button
          className={`${styles.generateBtn} ${loading ? styles.cancelBtn : ""}`}
          onClick={loading ? () => abortRef.current?.abort() : () => void handleGenerate()}
          disabled={!loading && !brief.trim()}
          id="generate-submit"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span aria-hidden="true">■</span>
              Cancel generation
            </>
          ) : (
            <>
              <span aria-hidden="true">▶</span>
              Run {mode === "fast" ? "Fast" : "Studio"} pipeline
            </>
          )}
        </button>
      </div>

      {/* -- Live Telemetry Log (visible while loading) -------------------- */}
      {loading && stageStates.length > 0 && (
        <>
          {retryMessage && (
            <div style={{
              fontSize: "11px",
              color: "rgba(251,191,36,0.85)",
              background: "rgba(251,191,36,0.07)",
              border: "0.5px solid rgba(251,191,36,0.25)",
              padding: "8px 14px",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "pulse 1.5s ease-in-out infinite",
            }}>
              <span>&#9201;</span>
              {retryMessage}
            </div>
          )}
          <TelemetryLog stages={stageStates} extras={stageExtras} />
        </>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {recoveryProject && (
        <div className={styles.recoveryResult}>
          <div className={styles.recoveryHeader} role="alert">
            <div>
              <span>RECOVERY CHECKPOINT</span>
              <strong>The run stopped, but Verve did not discard your work.</strong>
              <p>{recoveryMessage}</p>
              {recoveryCheckpoint?.completedStage === "04" && (
                <p className={styles.checkpointNote}>Plan and contrast are saved locally. Resume spends only the code-generation call.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("fast");
                const matchingCheckpoint = recoveryCheckpoint && checkpointMatchesInput(recoveryCheckpoint, {
                  brief,
                  existingCode: existingCode || undefined,
                  framework,
                  mode: "fast",
                  brandContext: JSON.stringify({ brandProfile, ownedAssets: ownedAssets.map((asset) => ownedAssetManifest(asset, framework)) }),
                }) ? recoveryCheckpoint : undefined;
                void handleGenerate("fast", matchingCheckpoint);
              }}
            >
              {recoveryCheckpoint?.completedStage === "04" ? "Resume code generation" : "Retry in Fast mode"}
            </button>
          </div>
          <ProjectWorkbench project={recoveryProject} />
        </div>
      )}

      {result && (
        <div className={styles.results} id="generation-result">
          {/* Score Banner */}
          <div className={styles.scoreBanner}>
            <div className={styles.scoreMain}>
              <span
                className={styles.grade}
                style={{ color: gradeColor(result.distinctivenessReport.grade) }}
                aria-label={`Grade ${result.distinctivenessReport.grade}`}
              >
                {result.distinctivenessReport.grade}
              </span>
              <div>
                <div className={styles.scoreNum}>
                  {result.distinctivenessReport.score}
                  <span className={styles.scoreOutOf}>/100</span>
                </div>
                <div className={styles.scoreLabel}>distinctiveness score</div>
              </div>
            </div>
            <div className={styles.scoreMeta}>
              {result.revisionCount > 0 && (
                <span className={styles.badge} title="Plan was revised after failing self-critique">
                  {result.revisionCount} revision{result.revisionCount > 1 ? "s" : ""}
                </span>
              )}
              {result.demo ? (
                <span className={styles.demoBadge}>CURATED DEMO · NO MODEL CALL</span>
              ) : (
                <span className={styles.duration}>{(result.durationMs / 1000).toFixed(1)}s</span>
              )}
              {result.execution && (
                <span className={result.execution.degraded ? styles.degradedBadge : styles.evidenceBadge}>
                  {result.execution.effectiveMode.replace("-", " ")} · {result.execution.scoreConfidence}
                </span>
              )}
              <button
                className={styles.certBtn}
                onClick={() => setCertOpen(true)}
                id="open-certificate"
                title="View shareable score certificate"
              >
                ▤ Certificate
              </button>
              <button
                className={styles.editorLaunchBtn}
                type="button"
                onClick={() => {
                  rememberResultDirection(result, "accepted");
                  void launchProjectEditor(result.project, result.demo ? "demo" : "generation").then((href) => router.push(href));
                }}
              >
                Open in Editor ↗
              </button>
            </div>
          </div>

          <ResultShareKit
            projectName={result.project.name}
            framework={result.project.framework}
            score={result.distinctivenessReport.score}
            grade={result.distinctivenessReport.grade}
            engineeringScore={result.engineeringResult?.compositeScore}
          />

          {/* View Tabs */}
          <div className={styles.viewTabs} role="tablist">
            {(["project", "plan", "code", "report"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={activeView === v}
                className={`${styles.viewTab} ${activeView === v ? styles.viewTabActive : ""}`}
                onClick={() => setActiveView(v)}
              >
                {v === "project" && "Live Project"}
                {v === "plan" && "Design Plan"}
                {v === "code" && (patchedCode ? "Code ✎" : "Code")}
                {v === "report" && "Critique Report"}
              </button>
            ))}
          </div>

          {activeView === "project" && result.project && (
            <div role="tabpanel" className={styles.projectView}>
              <ProjectWorkbench project={result.project} />
            </div>
          )}

          {/* Plan View */}
          {activeView === "plan" && (
            <div className={styles.planView} role="tabpanel">
              <div className={styles.planCard}>
                <h3 className={styles.planCardTitle}>Brief Analysis</h3>
                <div className={styles.metaGrid}>
                  <div><span className={styles.metaKey}>Subject</span><span className={styles.metaVal}>{result.briefAnalysis.subject}</span></div>
                  <div><span className={styles.metaKey}>Audience</span><span className={styles.metaVal}>{result.briefAnalysis.audience}</span></div>
                  <div><span className={styles.metaKey}>Primary Job</span><span className={styles.metaVal}>{result.briefAnalysis.primaryJob}</span></div>
                  <div><span className={styles.metaKey}>Tone</span><span className={styles.metaVal}>{result.briefAnalysis.tone}</span></div>
                </div>
              </div>

              {result.plan.directionPortfolio && (
                <div className={styles.planCard}>
                  <h3 className={styles.planCardTitle}>Direction Portfolio</h3>
                  <div className={styles.metaGrid}>
                    <div>
                      <span className={styles.metaKey}>Structural diversity</span>
                      <span className={styles.metaVal}>{result.directionDiversity?.diversityScore ?? 0}/100</span>
                    </div>
                    <div>
                      <span className={styles.metaKey}>Recent-result novelty</span>
                      <span className={styles.metaVal}>
                        {result.directionDiversity?.historicalNoveltyScore == null
                          ? "New memory"
                          : `${result.directionDiversity.historicalNoveltyScore}/100`}
                      </span>
                    </div>
                    {result.plan.directionPortfolio.candidates.map((candidate) => (
                      <div key={candidate.id} style={{ gridColumn: "1/-1" }}>
                        <span className={styles.metaKey}>
                          {candidate.id === result.plan.directionPortfolio?.selectedDirectionId ? "Selected direction" : "Alternative direction"}
                        </span>
                        <span className={styles.metaVal}>{candidate.concept} / fit {candidate.briefFit}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Module I: Archetype Card */}
              {result.archetype && (
                <div className={styles.planCard}>
                  <h3 className={styles.planCardTitle}>Brand Archetype — Module I</h3>
                  <div className={styles.metaGrid}>
                    <div>
                      <span className={styles.metaKey}>Primary</span>
                      <span className={styles.metaVal} style={{ color: "var(--signal)" }}>
                        {result.archetype.name} ({result.archetype.id})
                      </span>
                    </div>
                    {result.archetype.secondaryId && (
                      <div>
                        <span className={styles.metaKey}>Secondary</span>
                        <span className={styles.metaVal}>{result.archetype.secondaryId}</span>
                      </div>
                    )}
                    <div>
                      <span className={styles.metaKey}>Confidence</span>
                      <span className={styles.metaVal}>{Math.round((result.archetype.confidence ?? 0) * 100)}%</span>
                    </div>
                    <div>
                      <span className={styles.metaKey}>Emotional Job (JTBD)</span>
                      <span className={styles.metaVal}>{result.archetype.emotionalJob}</span>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <span className={styles.metaKey}>Reasoning</span>
                      <span className={styles.metaVal}>{result.archetype.reasoning}</span>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <span className={styles.metaKey} style={{ color: "#FF5050" }}>Archetype Conflict (avoid)</span>
                      <span className={styles.metaVal}>{result.archetype.archetypeConflict}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.planCard}>
                <h3 className={styles.planCardTitle}>Color Palette</h3>
                <div className={styles.palette}>
                  {result.plan.colorPalette.map((c) => (
                    <div key={c.name} className={styles.swatch}>
                      <div className={styles.swatchColor} style={{ background: c.hex }} title={c.hex} />
                      <code className={styles.swatchHex}>{c.hex}</code>
                      <span className={styles.swatchName}>{c.name}</span>
                      <span className={styles.swatchRole}>{c.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.planCard}>
                <h3 className={styles.planCardTitle}>Type Pairing</h3>
                <div className={styles.typeInfo}>
                  <div><span className={styles.metaKey}>Display</span><span className={styles.metaVal}>{result.plan.typePairing.display}</span></div>
                  <div><span className={styles.metaKey}>Body</span><span className={styles.metaVal}>{result.plan.typePairing.body}</span></div>
                  <div><span className={styles.metaKey}>Rationale</span><span className={styles.metaVal}>{result.plan.typePairing.rationale}</span></div>
                </div>
              </div>

              <div className={`${styles.planCard} ${styles.signatureCard}`}>
                <div className={styles.signatureBadge}>signature element</div>
                <h3 className={styles.planCardTitle}>{result.plan.signatureElement.name}</h3>
                <p className={styles.signatureDesc}>{result.plan.signatureElement.description}</p>
                <p className={styles.signatureJustification}>
                  <span className={styles.metaKey}>Why this works for this brief: </span>
                  {result.plan.signatureElement.justification}
                </p>
              </div>

              <div className={styles.planCard}>
                <h3 className={styles.planCardTitle}>Layout Concept</h3>
                <pre className={styles.layoutPre}>{result.plan.layoutConcept}</pre>
              </div>

              {result.plan.referencesSampled.length > 0 && (
                <div className={styles.planCard}>
                  <h3 className={styles.planCardTitle}>References sampled</h3>
                  <div className={styles.refs}>
                    {result.plan.referencesSampled.map((r) => (
                      <span key={r} className={styles.ref}>{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code View */}
          {activeView === "code" && (
            <div className={styles.codeView} role="tabpanel">
              <div className={styles.codeHeader}>
                <code className={styles.componentName}>{result.code.componentName}</code>
                <span className={styles.frameworkBadge}>{result.code.framework}</span>
                {patchedCode && (
                  <span style={{ fontSize: "0.7rem", color: "var(--signal)", marginRight: "auto", marginLeft: 8 }}>✎ Edited</span>
                )}
                <button
                  className={styles.copyBtn}
                  onClick={() => navigator.clipboard.writeText(patchedCode ?? result.code.code)}
                  aria-label="Copy code to clipboard"
                >
                  Copy
                </button>
                {patchedCode && (
                  <button
                    className={styles.copyBtn}
                    onClick={() => setPatchedCode(null)}
                    title="Revert to original generated code"
                    style={{ marginLeft: 4, opacity: 0.6 }}
                  >
                    ↩ Revert
                  </button>
                )}
              </div>
              <pre className={styles.codePre}>
                <code>{patchedCode ?? result.code.code}</code>
              </pre>
              {result.code.setupNotes && (
                <p className={styles.setupNotes}>{result.code.setupNotes}</p>
              )}

              {/* Patch / Refine Panel */}
              <PatchPanel
                currentCode={patchedCode ?? result.code.code}
                framework={result.code.framework}
                brief={brief}
                designPlan={JSON.stringify({
                  colors:    (result.plan.colorPalette ?? []).map((c) => `${c.name}: ${c.hex} (${c.role})`),
                  fonts:     result.plan.typePairing,
                  signature: result.plan.signatureElement?.name,
                  layout:    result.plan.layoutConcept?.slice(0, 200),
                })}
                provider={provider}
                model={model}
                apiKey={apiKey}
                onCodePatched={setPatchedCode}
              />

              {/* Export Panel */}
              <div className={styles.exportPanel}>
                <div className={styles.exportTitle}>Export Design Tokens</div>
                <div className={styles.exportBtns}>
                  <button
                    className={styles.exportBtn}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => downloadCSS(result.plan as any, result.briefAnalysis.subject.slice(0, 20).toLowerCase().replace(/\s+/g, "-"))}
                    title="Download CSS custom properties file"
                  >
                    ⇩ CSS Variables
                  </button>
                  <button
                    className={styles.exportBtn}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => downloadFigmaTokens(result.plan as any, result.briefAnalysis.subject.slice(0, 20).toLowerCase().replace(/\s+/g, "-"))}
                    title="Download Style Dictionary JSON for Figma"
                  >
                    ⇩ Figma Tokens
                  </button>
                  <button
                    className={styles.exportBtn}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => downloadREADME(result.plan as any, brief, result.briefAnalysis.subject.slice(0, 20).toLowerCase().replace(/\s+/g, "-"))}
                    title="Download setup guide with font imports and editing instructions"
                  >
                    ⇩ README.md
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Critique Report */}
          {activeView === "report" && (
            <div className={styles.reportView} role="tabpanel">
              <div className={styles.reportSummary}>
                <p className={styles.verdict}>{result.critique.verdict}</p>
              </div>

              {result.execution && (
                <section className={styles.evidenceCard} aria-label="Generation evidence">
                  <div className={styles.evidenceHead}>
                    <div><span>EXECUTION RECEIPT</span><strong>{result.execution.effectiveMode.replace("-", " ")}</strong></div>
                    <b>{result.execution.scoreConfidence} evidence</b>
                  </div>
                  <dl className={styles.evidenceGrid}>
                    <div><dt>Requested</dt><dd>{result.execution.requestedMode}</dd></div>
                    <div><dt>Critique</dt><dd>{result.execution.critiqueSource.replace("-", " ")}</dd></div>
                    <div><dt>Provider</dt><dd>{result.execution.provider}</dd></div>
                    <div><dt>Resolved model</dt><dd>{result.execution.resolvedModel}</dd></div>
                  </dl>
                  {result.execution.degradations.length > 0 && (
                    <ul className={styles.evidenceWarnings}>
                      {result.execution.degradations.map((item, index) => (
                        <li key={`${item.stageId}-${index}`}>Stage {item.stageId}: {item.message} ({item.reason})</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {result.project.readiness.axes && (
                <section className={styles.evidenceCard} aria-label="Project readiness evidence">
                  <div className={styles.evidenceHead}>
                    <div><span>PROJECT READINESS</span><strong>{result.project.readiness.status.replace("-", " ")}</strong></div>
                    <b>{result.project.readiness.score}/100 launch</b>
                  </div>
                  <dl className={styles.evidenceGrid}>
                    {Object.entries(result.project.readiness.axes).map(([name, value]) => (
                      <div key={name}><dt>{name}</dt><dd>{value.score}/100 · {value.status.replace("-", " ")}</dd></div>
                    ))}
                  </dl>
                </section>
              )}

              {result.distinctivenessReport.clichesDetected.length > 0 && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    <span style={{ color: "#FF5050" }}>✕</span> Patterns flagged
                  </h3>
                  <ul className={styles.reportList}>
                    {result.distinctivenessReport.clichesDetected.map((c) => (
                      <li key={c} className={styles.reportItem}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.distinctivenessReport.clichesAvoided.length > 0 && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    <span className="signal-text">✓</span> Specific strengths
                  </h3>
                  <ul className={styles.reportList}>
                    {result.distinctivenessReport.clichesAvoided.map((c) => (
                      <li key={c} className={styles.reportItem}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.critique.flaggedElements.length > 0 && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>Critique flags</h3>
                  {result.critique.flaggedElements.map((f, i) => (
                    <div key={i} className={`${styles.critiqueFlag} ${styles[`flag-${f.severity}`]}`}>
                      <div className={styles.flagHeader}>
                        <span className={styles.flagSeverity}>{f.severity}</span>
                        <span className={styles.flagElement}>{f.element}</span>
                      </div>
                      <p className={styles.flagReason}>{f.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.assetBundle?.mediaRequirement && (
                <div className={styles.mediaGate} data-level={result.assetBundle.mediaRequirement.level}>
                  <div className={styles.mediaGateHead}>
                    <div>
                      <span>MEDIA GATE</span>
                      <strong>{result.assetBundle.mediaRequirement.level}</strong>
                    </div>
                    <b>
                      {result.assetUsage
                        ? `${result.assetUsage.available} found · ${result.assetUsage.used} used · ${result.assetUsage.required} required`
                        : `${result.assetBundle.photos.length} found · ${result.assetBundle.mediaRequirement.minimumAssets} required`}
                    </b>
                  </div>
                  <p>{result.assetBundle.mediaRequirement.reason}</p>
                  {result.assetBundle.readinessWarnings.length > 0 ? (
                    <ul>
                      {result.assetBundle.readinessWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  ) : (
                    <small>{result.assetUsage?.used
                      ? `${result.assetUsage.used} asset(s) are present in the delivered code.`
                      : "Available assets were not automatically treated as selected or used."}</small>
                  )}
                  {result.assetUsage && result.assetUsage.warnings.length > 0 && (
                    <ul>{result.assetUsage.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                  )}
                </div>
              )}

              {result.diversityResult && (
                <div className={styles.mediaGate} data-level={result.diversityResult.passed ? "optional" : "required"}>
                  <div className={styles.mediaGateHead}>
                    <div><span>TEMPLATE DIVERSITY GATE</span><strong>{result.diversityResult.passed ? "pass" : "review"}</strong></div>
                    <b>{result.diversityResult.passed ? "No configured house fingerprint detected" : `Score capped at ${result.diversityResult.scoreCap}`}</b>
                  </div>
                  {result.diversityResult.fingerprints.length > 0 ? (
                    <ul>{result.diversityResult.fingerprints.map((fingerprint) => <li key={fingerprint}>{fingerprint}</li>)}</ul>
                  ) : <small>The deterministic fingerprints did not match. This is structural evidence, not proof of visual uniqueness.</small>}
                  {result.diversityResult.recommendation && <p>{result.diversityResult.recommendation}</p>}
                </div>
              )}

              {result.distinctivenessReport.recommendations.length > 0 && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>Recommendations</h3>
                  <ul className={styles.reportList}>
                    {result.distinctivenessReport.recommendations.map((r, i) => (
                      <li key={i} className={styles.reportItem}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Module J — Don Norman 3-Level Score */}
              {result.distinctivenessReport.normanLevels && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>Don Norman 3-Level Analysis — Module J</h3>
                  {result.distinctivenessReport.normanSummary && (
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: 1.6 }}>
                      {result.distinctivenessReport.normanSummary}
                    </p>
                  )}
                  {([
                    { key: "visceral",   label: "Visceral",   desc: "First impression — visual boldness", color: "var(--brand)" },
                    { key: "behavioral", label: "Behavioral", desc: "Usability — function, clarity (evaluated blind to aesthetics)", color: "var(--status-success)" },
                    { key: "reflective", label: "Reflective", desc: "Shareability — would someone be proud to show this?", color: "var(--status-info)" },
                  ] as const).map(({ key, label, desc, color }) => {
                    const level = result.distinctivenessReport.normanLevels![key];
                    return (
                      <div key={key} style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {label} — Grade {level.grade}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color }}>{level.score}/100</span>
                        </div>
                        <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", marginBottom: "4px" }}>
                          <div style={{ height: "100%", width: `${level.score}%`, background: color, borderRadius: "2px", transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "4px" }}>{desc}</div>
                        {level.improvements.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: "14px" }}>
                            {level.improvements.slice(0, 2).map((imp, i) => (
                              <li key={i} style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{imp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  {result.distinctivenessReport.archetypeCoherence !== undefined && (
                    <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", paddingTop: "10px", marginTop: "4px", fontSize: "11px", color: "var(--text-dim)" }}>
                      Archetype coherence ({result.distinctivenessReport.archetypeId}): <strong style={{ color: "var(--signal)" }}>{result.distinctivenessReport.archetypeCoherence}%</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Module N -- Restraint Check (Dieter Rams) */}
              {result.restraintResult && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    Restraint Check &mdash; Module N
                    <span style={{
                      fontSize: "10px", letterSpacing: "0.1em", marginLeft: 8,
                      color: result.restraintResult.verdict === "disciplined" ? "#34D399"
                        : result.restraintResult.verdict === "restrained-further" ? "#FBBF24"
                        : "#FF5050"
                    }}>
                      {result.restraintResult.verdict.toUpperCase().replace(/-/g, " ")}
                    </span>
                  </h3>

                  {/* Score bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${result.restraintResult.restraintScore}%`,
                        background: result.restraintResult.verdict === "disciplined" ? "#34D399"
                          : result.restraintResult.verdict === "restrained-further" ? "#FBBF24" : "#FF5050",
                        transition: "width 0.7s ease"
                      }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", width: 36, textAlign: "right" }}>
                      {result.restraintResult.restraintScore}/100
                    </span>
                  </div>

                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    <strong style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                      Boldest element:
                    </strong>{" "}{result.restraintResult.boldestElement}
                  </p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 8 }}>
                    {result.restraintResult.reasoning}
                  </p>
                  {result.restraintResult.suggestion && (
                    <div style={{
                      fontSize: "11px", lineHeight: 1.7,
                      borderLeft: "2px solid rgba(251,191,36,0.4)",
                      paddingLeft: 10, color: "rgba(251,191,36,0.7)"
                    }}>
                      <strong style={{ color: "rgba(251,191,36,0.9)" }}>Suggestion:</strong>{" "}
                      {result.restraintResult.suggestion}
                    </div>
                  )}
                </div>
              )}

              {/* Engineering Score -- Dual Scoring axis 2 */}
              {result.engineeringResult && (
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    Engineering Score &mdash; Dual Scoring
                    <span style={{
                      fontSize: "10px", letterSpacing: "0.1em", marginLeft: 8,
                      color: result.engineeringResult.passed ? "#34D399" : "#FF5050"
                    }}>
                      Grade {result.engineeringResult.grade}
                      {result.engineeringResult.passed ? " \u2713 PASS" : " \u2715 FAIL"}
                    </span>
                  </h3>

                  {/* Composite bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${result.engineeringResult.compositeScore}%`,
                        background: result.engineeringResult.compositeScore >= 75 ? "#34D399"
                          : result.engineeringResult.compositeScore >= 55 ? "#FBBF24" : "#FF5050",
                        transition: "width 0.7s ease"
                      }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", width: 36, textAlign: "right" }}>
                      {result.engineeringResult.compositeScore}/100
                    </span>
                  </div>

                  {/* Dimension bars */}
                  {result.engineeringResult.dimensions.map((dim) => (
                    <div key={dim.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: "10px", letterSpacing: "0.07em", textTransform: "uppercase", color: dim.passed ? "rgba(255,255,255,0.5)" : "#FF5050" }}>
                          {dim.name}
                        </span>
                        <span style={{ fontSize: "10px", color: dim.passed ? "rgba(255,255,255,0.4)" : "#FF5050", fontWeight: 600 }}>
                          {dim.score}
                        </span>
                      </div>
                      <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: 1, overflow: "hidden", marginBottom: 3 }}>
                        <div style={{
                          height: "100%", width: `${dim.score}%`,
                          background: dim.passed ? "rgba(255,255,255,0.2)" : "rgba(255,80,80,0.5)",
                          transition: "width 0.6s ease"
                        }} />
                      </div>
                      {dim.flags.length > 0 && (
                        <p style={{ fontSize: "10px", color: "rgba(255,80,80,0.6)", margin: 0 }}>
                          &#9651; {dim.flags[0]}
                        </p>
                      )}
                    </div>
                  ))}

                  {result.engineeringResult.recommendations.length > 0 && (
                    <div style={{ marginTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                      <div style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 6, textTransform: "uppercase" }}>
                        Top fixes
                      </div>
                      {result.engineeringResult.recommendations.map((rec, i) => (
                        <p key={i} style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: "0 0 4px" }}>
                          {i + 1}. {rec}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Competitive Field -- Module L */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cf = (result as any).competitiveField;
                if (!cf?.matched) return null;
                return (
                  <div className={styles.reportSection}>
                    <h3 className={styles.reportSectionTitle}>
                      Competitive Field &mdash; Module L
                      <span style={{ fontSize: "10px", letterSpacing: "0.1em", marginLeft: 8, color: cf.temperature === "hot" ? "#FF5050" : cf.temperature === "warm" ? "#FBBF24" : "#34D399" }}>
                        {cf.temperature?.toUpperCase()} MARKET
                      </span>
                    </h3>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "10px", lineHeight: 1.7 }}>{cf.opportunity}</p>
                    <div className={styles.detailLabel} style={{ marginBottom: 6 }}>Patterns avoided in this design ({cf.industry})</div>
                    {(cf.patterns as string[])?.map((p, i) => (
                      <div key={i} className={styles.avoidChip}><span style={{ color: "#FF5050", marginRight: 6 }}>&#10005;</span>{p}</div>
                    ))}
                  </div>
                );
              })()}

              <details className={styles.transcriptDetails}>
                <summary className={styles.transcriptSummary}>
                  Full critique transcript
                </summary>
                <pre className={styles.transcript}>{result.critique.transcript}</pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  </>
  );
}
