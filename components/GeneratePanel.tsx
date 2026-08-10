"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./GeneratePanel.module.css";
import { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";
import type { Provider } from "@/lib/llm-adapter/types";
import { addHistory, entryFromResult } from "@/lib/history";
import type { HistoryEntry } from "@/lib/history";
import { downloadCSS, downloadFigmaTokens, downloadREADME } from "@/lib/export";
import HistoryDrawer from "./HistoryDrawer";
import Certificate  from "./Certificate";

const ANTHROPIC_KEY = "verve_anthropic_api_key";
const getStorageKey = (p: Provider) => `verve_${p}_api_key`;

const PROVIDERS: { id: Provider; label: string; icon: string; color: string }[] = [
  { id: "anthropic",  label: "Claude",      icon: "◆", color: "#D49020" },
  { id: "openai",     label: "GPT",         icon: "◎", color: "#74B87E" },
  { id: "gemini",     label: "Gemini",      icon: "✦", color: "#6B9FE4" },
  { id: "openrouter", label: "OpenRouter",   icon: "⬡", color: "#9A6FF0" },
];

// ─── Pipeline telemetry stages (SSE real events now power this) ───────────────
const PIPELINE_STAGES = [
  { id: "01",   name: "BRIEF ANALYZER",         module: "brief-analyzer.ts",   status: "EXTRACTING"  },
  { id: "02",   name: "ASSETS + BLOCKLIST + L",  module: "H+Blocklist+L",       status: "SCANNING"    },
  { id: "02.5", name: "BRAND ARCHETYPE",         module: "Module I",            status: "RESOLVING"   },
  { id: "02.6", name: "ANIMATION LANGUAGE",      module: "Module K",            status: "DERIVING"    },
  { id: "03",   name: "DESIGN PLAN + COGNITIVE", module: "plan-generator.ts",   status: "GENERATING"  },
  { id: "04",   name: "ADVERSARIAL CRITIQUE",    module: "critique-loop.ts",    status: "CRITIQUING"  },
  { id: "05",   name: "CODE GENERATION",         module: "code-generator.ts",   status: "COMPILING"   },
  { id: "06",   name: "NORMAN 3-LEVEL SCORE",    module: "scorer.ts",           status: "SCORING"     },
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

type StageState = "waiting" | "running" | "done" | "flagged";

type PipelineResult = {
  briefAnalysis: {
    subject: string;
    audience: string;
    primaryJob: string;
    tone: string;
    industry: string;
  };
  plan: {
    colorPalette: { name: string; hex: string; role: string }[];
    typePairing: { display: string; body: string; rationale: string };
    layoutConcept: string;
    signatureElement: { name: string; description: string; justification: string };
    referencesSampled: string[];
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
  revisionCount: number;
  durationMs: number;
};

const FRAMEWORKS = ["nextjs", "react", "html"] as const;
type Framework = (typeof FRAMEWORKS)[number];

// ─── Telemetry Log Component ──────────────────────────────────────────────────
function TelemetryLog({ stages, extras }: { stages: StageState[]; extras: Record<string, string> }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [stages]);

  return (
    <div className={styles.telemetry} ref={logRef} aria-live="polite" aria-label="Pipeline progress">
      <div className={styles.telemetryHeader}>
        <span className={styles.telemetryTitle}>// VERVE PIPELINE — RUNNING</span>
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
              {state === "done" && <span className={styles.tlDone}>✓ DONE</span>}
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
  const [brief, setBrief] = useState("");
  const [existingCode, setExistingCode] = useState("");
  const [framework, setFramework] = useState<Framework>("nextjs");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [activeView, setActiveView] = useState<"plan" | "code" | "report">("plan");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState<string>(DEFAULT_MODEL.anthropic);
  const [apiKey, setApiKey] = useState("");
  const [missingKey, setMissingKey] = useState(false);
  const [stageStates, setStageStates] = useState<StageState[]>([]);
  const [stageExtras, setStageExtras] = useState<Record<string, string>>({});
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [certOpen,     setCertOpen]     = useState(false);
  const telemetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(provider))
      ?? localStorage.getItem(ANTHROPIC_KEY)
      ?? "";
    setApiKey(stored);
  }, [provider]);

  // Pick up ?brief= query param (set by Lab "Run in workspace" button)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const prefilled = params.get("brief");
    if (prefilled) {
      setBrief(decodeURIComponent(prefilled));
      // Clean the URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("brief");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const onStorageChange = () => {
      const stored = localStorage.getItem(getStorageKey(provider)) ?? "";
      setApiKey(stored);
      if (stored) setMissingKey(false);
    };
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("verve:api-key-saved", onStorageChange);
    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("verve:api-key-saved", onStorageChange);
    };
  }, [provider]);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULT_MODEL[p]);
    const stored = localStorage.getItem(getStorageKey(p)) ?? "";
    setApiKey(stored);
    setMissingKey(false);
  };

  const openApiKeyModal = () => {
    window.dispatchEvent(new CustomEvent("verve:open-api-key-modal"));
  };

  // ── SSE-based telemetry: update stage from real events ──────────────────
  const updateStage = (stageId: string, state: StageState, extra?: string) => {
    setStageStates((prev) => {
      const idx = PIPELINE_STAGES.findIndex((s) => s.id === stageId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = state;
      return next;
    });
    if (extra) {
      setStageExtras((prev) => ({ ...prev, [stageId]: extra }));
    }
  };

  const stopTelemetry = () => {
    telemetryTimers.current.forEach(clearTimeout);
    setStageStates(PIPELINE_STAGES.map(() => "done"));
  };

  const handleGenerate = async () => {
    if (!brief.trim() || brief.length < 10) {
      setError("Please enter a design brief (at least 10 characters).");
      return;
    }

    const currentKey = localStorage.getItem(getStorageKey(provider)) ?? apiKey;
    if (!currentKey) {
      setMissingKey(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMissingKey(false);
    setResult(null);
    setStageExtras({});
    setStageStates(PIPELINE_STAGES.map(() => "waiting"));

    // ── SSE streaming via fetch + ReadableStream ─────────────────────────
    let aborted = false;
    abortRef.current = () => { aborted = true; };

    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          existingCode: existingCode || undefined,
          framework,
          apiKey: currentKey,
          provider,
          model,
          pexelsKey: localStorage.getItem("verve_pexels_api_key") || undefined,
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

      while (!aborted) {
        const { done, value } = await reader.read();
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
          } else if (eventType === "stage_done") {
            const extra = payload.extra as Record<string, unknown> | undefined;
            const hint  = extra ? Object.entries(extra).map(([k,v]) => `${k}: ${v}`).join(" · ") : undefined;
            updateStage(payload.id as string, "done", hint);
          } else if (eventType === "stage_flag") {
            updateStage(payload.id as string, "flagged", payload.reason as string);
          } else if (eventType === "result") {
            stopTelemetry();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = payload as any;
            setResult(data);
            setActiveView("plan");
            // ── Save to history ──────────────────────────────────────────
            try { addHistory(entryFromResult(brief, data)); } catch {}
          } else if (eventType === "error") {
            throw new Error((payload as Record<string, string>).message ?? "Pipeline error");
          }
        }
      }

    } catch (err) {
      stopTelemetry();
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setHistoryOpen(false);
    setBrief(entry.brief);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (entry.fullResult) { setResult(entry.fullResult as any); setActiveView("plan"); }
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "S": return "var(--signal-green)";
      case "A": return "#7EE2A8";
      case "B": return "var(--signal-amber)";
      case "C": return "#FF9040";
      case "D": return "#FF5050";
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
          <a href="/lab" className={styles.toolbarLink} target="_blank" title="Prompt Engineering Lab">
            ▧ Lab
          </a>
        </div>
      {/* -- Provider Row -------------------------------------------------------- */}
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
                style={provider === p.id ? { "--provider-color": p.color } as React.CSSProperties : undefined}
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

        <div className={styles.optionsRow}>
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
              <option value="nextjs">Next.js 15</option>
              <option value="react">React 18</option>
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

        {/* Missing API Key Banner */}
        {missingKey && (
          <div className={styles.apiKeyBanner} role="alert">
            <div className={styles.apiKeyBannerIcon} aria-hidden="true">⚿</div>
            <div className={styles.apiKeyBannerText}>
              <strong>API key required.</strong> Verve runs on your own Anthropic API key —
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
          <div className={styles.error} role="alert">
            <span>⚠</span> {error}
          </div>
        )}

        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={loading || !brief.trim()}
          id="generate-submit"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Running pipeline
            </>
          ) : (
            <>
              <span aria-hidden="true">▶</span>
              Run Verve pipeline
            </>
          )}
        </button>
      </div>

      {/* ── Live Telemetry Log (visible while loading) ────────────────────── */}
      {loading && stageStates.length > 0 && (
        <TelemetryLog stages={stageStates} extras={stageExtras} />
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && (
        <div className={styles.results}>
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
              <span className={styles.duration}>
                {(result.durationMs / 1000).toFixed(1)}s
              </span>
              <button
                className={styles.certBtn}
                onClick={() => setCertOpen(true)}
                id="open-certificate"
                title="View shareable score certificate"
              >
                ▤ Certificate
              </button>
            </div>
          </div>

          {/* View Tabs */}
          <div className={styles.viewTabs} role="tablist">
            {(["plan", "code", "report"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={activeView === v}
                className={`${styles.viewTab} ${activeView === v ? styles.viewTabActive : ""}`}
                onClick={() => setActiveView(v)}
              >
                {v === "plan" && "Design Plan"}
                {v === "code" && "Code"}
                {v === "report" && "Critique Report"}
              </button>
            ))}
          </div>

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
                <button
                  className={styles.copyBtn}
                  onClick={() => navigator.clipboard.writeText(result.code.code)}
                  aria-label="Copy code to clipboard"
                >
                  Copy
                </button>
              </div>
              <pre className={styles.codePre}>
                <code>{result.code.code}</code>
              </pre>
              {result.code.setupNotes && (
                <p className={styles.setupNotes}>{result.code.setupNotes}</p>
              )}

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
                    <span className="signal-text">✓</span> Deliberately avoided
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
                    <p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "12px", lineHeight: 1.6 }}>
                      {result.distinctivenessReport.normanSummary}
                    </p>
                  )}
                  {([
                    { key: "visceral",   label: "Visceral",   desc: "First impression — visual boldness",      color: "#A78BFA" },
                    { key: "behavioral", label: "Behavioral", desc: "Usability — function, clarity (evaluated blind to aesthetics)", color: "#34D399" },
                    { key: "reflective", label: "Reflective", desc: "Shareability — would someone be proud to show this?", color: "#FBBF24" },
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

              {/* Competitive Field — Module L */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cf = (result as any).competitiveField;
                if (!cf?.matched) return null;
                return (
                  <div className={styles.reportSection}>
                    <h3 className={styles.reportSectionTitle}>
                      Competitive Field — Module L
                      <span style={{ fontSize: "9px", letterSpacing: "0.1em", marginLeft: 8, color: cf.temperature === "hot" ? "#FF5050" : cf.temperature === "warm" ? "#FBBF24" : "#34D399" }}>
                        {cf.temperature?.toUpperCase()} MARKET
                      </span>
                    </h3>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "10px", lineHeight: 1.7 }}>{cf.opportunity}</p>
                    <div className={styles.detailLabel} style={{ marginBottom: 6 }}>Patterns avoided in this design ({cf.industry})</div>
                    {(cf.patterns as string[])?.map((p, i) => (
                      <div key={i} className={styles.avoidChip}><span style={{ color: "#FF5050", marginRight: 6 }}>✕</span>{p}</div>
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
