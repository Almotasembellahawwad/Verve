"use client";

import { useState, useRef } from "react";
import styles from "./ComparePanel.module.css";
import type { Provider } from "@/lib/llm-adapter/types";
import { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";

// ── Telemetry stages for both pipelines ─────────────────────────
const BASELINE_STAGES = [
  { id: "B1", name: "PROMPT SENT",      durationMs: 1200 },
  { id: "B2", name: "GENERATING...",    durationMs: 7000 },
  { id: "B3", name: "SCORING CLICHÉS",  durationMs: 500  },
];

const VERVE_STAGES = [
  { id: "V1", name: "BRIEF ANALYZER",      durationMs: 1800 },
  { id: "V2", name: "CLICHÉ BLOCKLIST",    durationMs: 600  },
  { id: "V3", name: "DESIGN PLAN",         durationMs: 6000 },
  { id: "V4", name: "ADVERSARIAL CRITIQUE",durationMs: 5000 },
  { id: "V5", name: "CODE GENERATION",     durationMs: 9000 },
  { id: "V6", name: "DISTINCTIVENESS",     durationMs: 500  },
];

type StageSt = "waiting" | "running" | "done";

type CompareResult = {
  baseline: {
    code: string;
    score: number;
    grade: string;
    clichesDetected: string[];
    error: string | null;
  };
  verve: {
    code: string;
    score: number;
    grade: string;
    clichesAvoided: string[];
    clichesDetected: string[];
    plan: {
      colorPalette: { name: string; hex: string; role: string }[];
      typePairing: { display: string; body: string; rationale: string };
      signatureElement: { name: string; description: string; justification: string };
    } | null;
    signatureElement: string;
    revisionCount: number;
    error: string | null;
  };
  delta: {
    scoreDelta: number;
    clichesEliminated: number;
    signatureElement: string;
    verdict: string;
  };
};

const GRADE_COLOR: Record<string, string> = {
  S: "var(--data-pass)",
  A: "#7EE2A8",
  B: "var(--brand)",
  C: "#FF9040",
  D: "#E06050",
};

const PROVIDERS: { id: Provider; label: string; icon: string }[] = [
  { id: "anthropic", label: "Claude",  icon: "◆" },
  { id: "openai",    label: "GPT",     icon: "◎" },
  { id: "gemini",    label: "Gemini",  icon: "✦" },
];

export default function ComparePanel() {
  const [brief, setBrief] = useState("");
  const [framework, setFramework] = useState<"nextjs" | "react" | "html">("nextjs");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState<string>(DEFAULT_MODEL.anthropic);
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("verve_anthropic_api_key") ?? "" : ""
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"visual" | "code">("visual");
  const [baselineStages, setBaselineStages] = useState<StageSt[]>([]);
  const [verveStages, setVerveStages] = useState<StageSt[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Update model default when provider changes
  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULT_MODEL[p]);
    // Load stored key for this provider
    const key = localStorage.getItem(`verve_${p}_api_key`) ?? "";
    setApiKey(key);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(`verve_${provider}_api_key`, key);
    // Also save as primary key for backward compat with anthropic
    if (provider === "anthropic") {
      localStorage.setItem("verve_anthropic_api_key", key);
    }
  };

  const startTelemetry = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setBaselineStages(BASELINE_STAGES.map(() => "waiting"));
    setVerveStages(VERVE_STAGES.map(() => "waiting"));

    // Animate baseline stages
    let bDelay = 0;
    BASELINE_STAGES.forEach((s, i) => {
      const t1 = setTimeout(() => {
        setBaselineStages((prev) => { const n = [...prev]; n[i] = "running"; return n; });
      }, bDelay);
      bDelay += s.durationMs;
      const t2 = setTimeout(() => {
        setBaselineStages((prev) => { const n = [...prev]; n[i] = "done"; return n; });
      }, bDelay);
      timers.current.push(t1, t2);
    });

    // Animate verve stages
    let vDelay = 0;
    VERVE_STAGES.forEach((s, i) => {
      const t1 = setTimeout(() => {
        setVerveStages((prev) => { const n = [...prev]; n[i] = "running"; return n; });
      }, vDelay);
      vDelay += s.durationMs;
      const t2 = setTimeout(() => {
        setVerveStages((prev) => { const n = [...prev]; n[i] = "done"; return n; });
      }, vDelay);
      timers.current.push(t1, t2);
    });
  };

  const stopTelemetry = () => {
    timers.current.forEach(clearTimeout);
    setBaselineStages(BASELINE_STAGES.map(() => "done"));
    setVerveStages(VERVE_STAGES.map(() => "done"));
  };

  const handleCompare = async () => {
    if (!brief.trim()) {
      setError("Please enter a brief to compare.");
      return;
    }
    if (!apiKey.trim()) {
      setError(`Please enter your ${PROVIDER_KEY_LABELS[provider].label}.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    startTelemetry();

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, framework, apiKey, provider, model }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Comparison failed");

      stopTelemetry();
      setResult(data);
    } catch (err) {
      stopTelemetry();
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.panel}>
      {/* Input */}
      <div className={styles.inputArea}>
        <div className={styles.providerRow}>
          <div className={styles.providerGroup}>
            <span className={styles.sectionLabel}>Provider</span>
            <div className={styles.providerTabs} role="group" aria-label="Select AI provider">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.providerTab} ${provider === p.id ? styles.providerTabActive : ""}`}
                  onClick={() => handleProviderChange(p.id)}
                  type="button"
                >
                  <span aria-hidden="true">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.modelGroup}>
            <label htmlFor="compare-model" className={styles.sectionLabel}>Model</label>
            <select
              id="compare-model"
              className={styles.select}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
            >
              {PROVIDER_MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* API Key for selected provider */}
        <div className={styles.keyRow}>
          <label htmlFor="compare-apikey" className={styles.sectionLabel}>
            {PROVIDER_KEY_LABELS[provider].label}
          </label>
          <div className={styles.keyInput}>
            <input
              id="compare-apikey"
              type="password"
              className={styles.input}
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              placeholder={PROVIDER_KEY_LABELS[provider].placeholder}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
            <a
              href={PROVIDER_KEY_LABELS[provider].docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.getKeyLink}
            >
              Get key ↗
            </a>
          </div>
        </div>

        <div className={styles.briefRow}>
          <label htmlFor="compare-brief" className={styles.sectionLabel}>
            Design brief
          </label>
          <textarea
            id="compare-brief"
            className={styles.textarea}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you're building. Example: 'A landing page for a carbon accounting SaaS targeting manufacturing CFOs.'"
            rows={4}
            disabled={loading}
          />
        </div>

        <div className={styles.actionsRow}>
          <div className={styles.frameworkGroup}>
            <label htmlFor="compare-framework" className={styles.sectionLabel}>Framework</label>
            <select
              id="compare-framework"
              className={styles.select}
              value={framework}
              onChange={(e) => setFramework(e.target.value as typeof framework)}
              disabled={loading}
            >
              <option value="nextjs">Next.js</option>
              <option value="react">React</option>
              <option value="html">HTML + CSS</option>
            </select>
          </div>

          <button
            className={styles.compareBtn}
            onClick={handleCompare}
            disabled={loading || !brief.trim() || !apiKey.trim()}
            id="compare-submit"
            aria-busy={loading}
          >
            {loading ? (
              <><span className={styles.spinner} aria-hidden="true" />Running both…</>
            ) : (
              <><span aria-hidden="true">⇄</span>Run comparison</>
            )}
          </button>
        </div>

        {error && (
          <div className={styles.error} role="alert"><span>⚠</span> {error}</div>
        )}
      </div>

      {/* Live Dual Telemetry */}
      {loading && baselineStages.length > 0 && (
        <div className={styles.dualTelemetry}>
          {/* Baseline */}
          <div className={styles.telemetryBox}>
            <div className={styles.telemetryBoxHeader}>
              <span className={styles.telemetryBoxBadge} data-side="baseline">WITHOUT VERVE</span>
              <span className={styles.telemetryBoxModel}>{provider} / {model}</span>
            </div>
            {BASELINE_STAGES.map((s, i) => (
              <div key={s.id} className={`${styles.tlLine} ${styles[`tl-${baselineStages[i] ?? "waiting"}`]}`}>
                <span className={styles.tlId}>[{s.id}]</span>
                <span className={styles.tlName}>{s.name}</span>
                {baselineStages[i] === "running" && <span className={styles.tlDots} />}
                {baselineStages[i] === "done" && <span className={styles.tlDone}>✓</span>}
              </div>
            ))}
          </div>

          {/* Verve */}
          <div className={styles.telemetryBox}>
            <div className={styles.telemetryBoxHeader}>
              <span className={styles.telemetryBoxBadge} data-side="verve">WITH VERVE</span>
              <span className={styles.telemetryBoxModel}>6-step pipeline</span>
            </div>
            {VERVE_STAGES.map((s, i) => (
              <div key={s.id} className={`${styles.tlLine} ${styles[`tl-${verveStages[i] ?? "waiting"}`]}`}>
                <span className={styles.tlId}>[{s.id}]</span>
                <span className={styles.tlName}>{s.name}</span>
                {verveStages[i] === "running" && <span className={styles.tlDots} />}
                {verveStages[i] === "done" && <span className={styles.tlDone}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className={styles.results}>
          {/* Delta Banner */}
          <div className={styles.deltaBanner}>
            <div className={styles.deltaLeft}>
              <span className={styles.deltaNum} style={{ color: result.delta.scoreDelta >= 0 ? "var(--data-pass)" : "#E06050" }}>
                {result.delta.scoreDelta >= 0 ? "+" : ""}{result.delta.scoreDelta}
              </span>
              <span className={styles.deltaLabel}>points — Verve vs plain {provider}</span>
            </div>
            <div className={styles.deltaRight}>
              {result.delta.clichesEliminated > 0 && (
                <span className={styles.deltaStat}>
                  <span className={styles.deltaStatNum}>{result.delta.clichesEliminated}</span>
                  clichés eliminated
                </span>
              )}
              {result.verve.signatureElement && (
                <span className={styles.deltaStat}>
                  <span className={styles.deltaStatNum}>✦</span>
                  {result.verve.plan?.signatureElement?.name ?? result.verve.signatureElement}
                </span>
              )}
            </div>
          </div>
          <p className={styles.deltaVerdict}>{result.delta.verdict}</p>

          {/* View toggle */}
          <div className={styles.viewToggle} role="group">
            <button className={`${styles.viewBtn} ${activeView === "visual" ? styles.viewBtnActive : ""}`} onClick={() => setActiveView("visual")}>Visual</button>
            <button className={`${styles.viewBtn} ${activeView === "code" ? styles.viewBtnActive : ""}`} onClick={() => setActiveView("code")}>Code</button>
          </div>

          {/* Side-by-side comparison */}
          <div className={styles.compareGrid}>
            {/* LEFT: Baseline */}
            <div className={styles.side}>
              <div className={styles.sideHeader} data-side="baseline">
                <span className={styles.sideBadge} data-side="baseline">WITHOUT VERVE</span>
                <div className={styles.sideScore}>
                  <span className={styles.sideGrade} style={{ color: GRADE_COLOR[result.baseline.grade] }}>
                    {result.baseline.grade}
                  </span>
                  <span className={styles.sideScoreNum}>{result.baseline.score}/100</span>
                </div>
              </div>

              {activeView === "visual" && (
                <div className={styles.visualPane}>
                  {/* Clichés detected */}
                  {result.baseline.clichesDetected.length > 0 && (
                    <div className={styles.clicheList} data-side="baseline">
                      <span className={styles.clicheListLabel}>Clichés detected:</span>
                      {result.baseline.clichesDetected.map((c) => (
                        <span key={c} className={styles.clicheTag} data-side="baseline">{c}</span>
                      ))}
                    </div>
                  )}
                  {/* Generic pattern illustration */}
                  <div className={styles.genericMockup}>
                    <div className={styles.gmNavbar}>
                      <span className={styles.gmLogo}>BrandName</span>
                      <div className={styles.gmLinks}>
                        <span>Features</span><span>Pricing</span><span>About</span>
                      </div>
                      <div className={styles.gmCta}>Get Started</div>
                    </div>
                    <div className={styles.gmHero}>
                      <div className={styles.gmBadge}>🚀 Introducing v2.0</div>
                      <div className={styles.gmHeadline}>Build faster.<br />Ship smarter.</div>
                      <div className={styles.gmSub}>The all-in-one platform to grow your business with AI-powered tools.</div>
                      <div className={styles.gmButtons}>
                        <div className={styles.gmBtnPrimary}>Try for free</div>
                        <div className={styles.gmBtnSecondary}>Watch demo</div>
                      </div>
                    </div>
                    <div className={styles.gmFeatures}>
                      {["⚡ Fast", "🔒 Secure", "📊 Analytics", "🤝 Collaborate"].map((f) => (
                        <div key={f} className={styles.gmFeatureCard}>{f}</div>
                      ))}
                    </div>
                    <div className={styles.gmOverlay}>
                      <span className={styles.gmOverlayText}>Typical AI output</span>
                    </div>
                  </div>
                </div>
              )}

              {activeView === "code" && (
                <div className={styles.codeSide}>
                  <div className={styles.codeControls}>
                    <span className={styles.codeLabel}>Plain {provider} output</span>
                    <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(result.baseline.code)}>Copy</button>
                  </div>
                  <pre className={styles.codePre}><code>{result.baseline.code}</code></pre>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className={styles.vsBar}>
              <span className={styles.vsLabel}>vs</span>
              <div className={styles.vsArrow}>→</div>
            </div>

            {/* RIGHT: Verve */}
            <div className={styles.side}>
              <div className={styles.sideHeader} data-side="verve">
                <span className={styles.sideBadge} data-side="verve">WITH VERVE</span>
                <div className={styles.sideScore}>
                  <span className={styles.sideGrade} style={{ color: GRADE_COLOR[result.verve.grade] }}>
                    {result.verve.grade}
                  </span>
                  <span className={styles.sideScoreNum}>{result.verve.score}/100</span>
                </div>
              </div>

              {activeView === "visual" && (
                <div className={styles.visualPane}>
                  {/* Design plan summary */}
                  {result.verve.plan && (
                    <div className={styles.planSummary}>
                      {/* Color palette */}
                      <div className={styles.paletteMini}>
                        {result.verve.plan.colorPalette.slice(0, 5).map((c) => (
                          <div key={c.hex} className={styles.swatchMini} style={{ background: c.hex }} title={`${c.name} — ${c.role}`} />
                        ))}
                        <span className={styles.paletteMiniLabel}>
                          {result.verve.plan.colorPalette.slice(0, 2).map((c) => c.name).join(" + ")}
                        </span>
                      </div>
                      {/* Type */}
                      <div className={styles.typeMini}>
                        <span className={styles.typeMiniLabel}>Type:</span>
                        {result.verve.plan.typePairing.display} + {result.verve.plan.typePairing.body}
                      </div>
                      {/* Signature element */}
                      <div className={styles.signatureMini}>
                        <span className={styles.signatureMiniIcon}>✦</span>
                        <div>
                          <div className={styles.signatureMiniName}>{result.verve.plan.signatureElement.name}</div>
                          <div className={styles.signatureMiniDesc}>{result.verve.plan.signatureElement.description}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Clichés avoided */}
                  {result.verve.clichesAvoided.length > 0 && (
                    <div className={styles.clicheList} data-side="verve">
                      <span className={styles.clicheListLabel}>Deliberately avoided:</span>
                      {result.verve.clichesAvoided.slice(0, 4).map((c) => (
                        <span key={c} className={styles.clicheTag} data-side="verve">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeView === "code" && (
                <div className={styles.codeSide}>
                  <div className={styles.codeControls}>
                    <span className={styles.codeLabel}>Verve pipeline output</span>
                    <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(result.verve.code)}>Copy</button>
                  </div>
                  <pre className={styles.codePre}><code>{result.verve.code}</code></pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
