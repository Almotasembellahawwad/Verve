"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./GeneratePanel.module.css";

const STORAGE_KEY = "verve_anthropic_api_key";

// ─── Pipeline telemetry stages ────────────────────────────────────────────────
// Heuristic timing based on real Claude API call durations.
// When SSE streaming is implemented, these will be replaced by real events.
const PIPELINE_STAGES = [
  { id: "01", name: "BRIEF ANALYZER",       module: "brief-analyzer.ts",    durationMs: 1800,  status: "EXTRACTING"  },
  { id: "02", name: "CLICHÉ BLOCKLIST",     module: "blocklist-filter.ts",  durationMs: 600,   status: "SCANNING"    },
  { id: "03", name: "DESIGN PLAN",          module: "plan-generator.ts",    durationMs: 6000,  status: "GENERATING"  },
  { id: "04", name: "ADVERSARIAL CRITIQUE", module: "critique-loop.ts",     durationMs: 5000,  status: "CRITIQUING"  },
  { id: "05", name: "CODE GENERATION",      module: "code-generator.ts",    durationMs: 9000,  status: "COMPILING"   },
  { id: "06", name: "DISTINCTIVENESS",      module: "scorer.ts",            durationMs: 500,   status: "SCORING"     },
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
  distinctivenessReport: {
    score: number;
    grade: string;
    clichesAvoided: string[];
    clichesDetected: string[];
    signatureElement: string;
    critiqueSummary: string;
    revisionCount: number;
    recommendations: string[];
  };
  revisionCount: number;
  durationMs: number;
};

const FRAMEWORKS = ["nextjs", "react", "html"] as const;
type Framework = (typeof FRAMEWORKS)[number];

// ─── Telemetry Log Component ──────────────────────────────────────────────────
function TelemetryLog({ stages }: { stages: StageState[] }) {
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
  const [apiKey, setApiKey] = useState("");
  const [missingKey, setMissingKey] = useState(false);
  const [stageStates, setStageStates] = useState<StageState[]>([]);
  const telemetryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    const onStorageChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      setApiKey(stored ?? "");
      if (stored) setMissingKey(false);
    };
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("verve:api-key-saved", onStorageChange);
    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("verve:api-key-saved", onStorageChange);
    };
  }, []);

  const openApiKeyModal = () => {
    window.dispatchEvent(new CustomEvent("verve:open-api-key-modal"));
  };

  // ── Heuristic telemetry progress ──────────────────────────────────────────
  const startTelemetry = () => {
    telemetryTimers.current.forEach(clearTimeout);
    telemetryTimers.current = [];

    const initial: StageState[] = PIPELINE_STAGES.map(() => "waiting");
    setStageStates(initial);

    let elapsed = 0;
    PIPELINE_STAGES.forEach((stage, i) => {
      // Mark as running
      const runTimer = setTimeout(() => {
        setStageStates((prev) => {
          const next = [...prev];
          next[i] = "running";
          return next;
        });
      }, elapsed);

      elapsed += stage.durationMs;

      // Mark as done
      const doneTimer = setTimeout(() => {
        setStageStates((prev) => {
          const next = [...prev];
          // Stage 04 (critique) has a chance to show FLAGGED briefly if there are revisions
          next[i] = "done";
          return next;
        });
      }, elapsed);

      telemetryTimers.current.push(runTimer, doneTimer);
    });
  };

  const stopTelemetry = () => {
    telemetryTimers.current.forEach(clearTimeout);
    // Mark all remaining as done
    setStageStates(PIPELINE_STAGES.map(() => "done"));
  };

  const handleGenerate = async () => {
    if (!brief.trim() || brief.length < 10) {
      setError("Please enter a design brief (at least 10 characters).");
      return;
    }

    const currentKey = localStorage.getItem(STORAGE_KEY) ?? apiKey;
    if (!currentKey) {
      setMissingKey(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMissingKey(false);
    setResult(null);
    startTelemetry();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          existingCode: existingCode || undefined,
          framework,
          apiKey: currentKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === "NO_API_KEY") {
          setMissingKey(true);
          return;
        }
        throw new Error(data.error ?? "Generation failed");
      }

      const data = await res.json();
      stopTelemetry();
      setResult(data);
      setActiveView("plan");
    } catch (err) {
      stopTelemetry();
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
    <div className={styles.panel}>
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className={styles.inputSection}>
        <div className={styles.inputGroup}>
          <label htmlFor="brief-input" className={styles.label}>
            Design brief
          </label>
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
        <TelemetryLog stages={stageStates} />
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
  );
}
