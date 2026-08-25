"use client";

import { useState, useEffect } from "react";
import styles from "./CritiquePanel.module.css";
import { getLocalApiKey, LOCAL_KEYS_CHANGED_EVENT } from "@/lib/client/key-storage";

type DesignCritique = {
  hierarchyIssues: { issue: string; severity: string; fix: string }[];
  contrastIssues: { issue: string; severity: string; fix: string }[];
  spacingIssues: { issue: string; severity: string; fix: string }[];
  typographyIssues: { issue: string; severity: string; fix: string }[];
  clicheMatches: { pattern: string; evidence: string; fix: string }[];
  signatureOpportunities: string[];
  overallScore: number;
  summary: string;
};

type InputMode = "url" | "code";

const SECTION_CONFIG = [
  { key: "hierarchyIssues", label: "Hierarchy", icon: "▤" },
  { key: "contrastIssues", label: "Contrast", icon: "◐" },
  { key: "spacingIssues", label: "Spacing", icon: "↔" },
  { key: "typographyIssues", label: "Typography", icon: "T" },
] as const;

export default function CritiquePanel() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignCritique | null>(null);
  const [missingKey, setMissingKey] = useState(false);

  useEffect(() => {
    const onStorageChange = () => {
      const stored = getLocalApiKey("anthropic");
      if (stored) setMissingKey(false);
    };
    window.addEventListener(LOCAL_KEYS_CHANGED_EVENT, onStorageChange);
    return () => window.removeEventListener(LOCAL_KEYS_CHANGED_EVENT, onStorageChange);
  }, []);

  const openApiKeyModal = () => {
    window.dispatchEvent(new CustomEvent("verve:open-api-key-modal"));
  };

  const handleCritique = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMissingKey(false);

    const currentKey = getLocalApiKey("anthropic");
    if (!currentKey) {
      setMissingKey(true);
      setLoading(false);
      return;
    }

    const payload: Record<string, string> = { apiKey: currentKey };
    if (mode === "url") {
      if (!url.trim()) { setError("Please enter a URL."); setLoading(false); return; }
      payload.url = url;
    } else {
      if (!code.trim()) { setError("Please paste some code."); setLoading(false); return; }
      payload.code = code;
    }

    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === "NO_API_KEY") {
          setMissingKey(true);
          return;
        }
        throw new Error(data.error ?? "Critique failed");
      }

      const data = await res.json();
      setResult(data.critique);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const totalIssues = result
    ? result.hierarchyIssues.length +
      result.contrastIssues.length +
      result.spacingIssues.length +
      result.typographyIssues.length +
      result.clicheMatches.length
    : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.inputSection}>
        <div className={styles.modeSwitch} role="group" aria-label="Input mode">
          <button
            className={`${styles.modeBtn} ${mode === "url" ? styles.modeBtnActive : ""}`}
            onClick={() => setMode("url")}
            aria-pressed={mode === "url"}
            type="button"
          >
            URL
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "code" ? styles.modeBtnActive : ""}`}
            onClick={() => setMode("code")}
            aria-pressed={mode === "code"}
            type="button"
          >
            Code
          </button>
        </div>

        {mode === "url" ? (
          <div className={styles.inputGroup}>
            <label htmlFor="url-input" className={styles.label}>
              URL to critique
            </label>
            <input
              id="url-input"
              type="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              disabled={loading}
              aria-describedby="url-hint"
            />
            <p id="url-hint" className={styles.hint}>
              Verve securely fetches the public HTML/CSS and performs a source-based critique. It does not pretend to inspect rendered pixels or a screenshot.
            </p>
          </div>
        ) : (
          <div className={styles.inputGroup}>
            <label htmlFor="code-input" className={styles.label}>
              HTML / JSX / CSS to critique
            </label>
            <textarea
              id="code-input"
              className={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your component code here..."
              rows={10}
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <div className={styles.error} role="alert">
            <span>⚠</span> {error}
          </div>
        )}

        {missingKey && (
          <div className={styles.apiKeyBanner} role="alert">
            <div className={styles.apiKeyBannerIcon} aria-hidden="true">🔑</div>
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

        <button
          className={styles.critiqueBtn}
          onClick={handleCritique}
          disabled={loading}
          id="critique-submit"
          aria-busy={loading}
          type="button"
        >
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Analyzing
            </>
          ) : (
            <>
              <span aria-hidden="true">◈</span>
              Run critique
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={styles.results}>
          {/* Score Header */}
          <div className={styles.scoreRow}>
            <div className={styles.scoreBlock}>
              <span className={styles.score}>{result.overallScore}</span>
              <span className={styles.scoreLabel}>/100</span>
            </div>
            <div className={styles.issueSummary}>
              <span>{totalIssues} issue{totalIssues !== 1 ? "s" : ""} found</span>
              <span>·</span>
              <span>{result.clicheMatches.length} cliché{result.clicheMatches.length !== 1 ? "s" : ""} detected</span>
            </div>
          </div>

          <p className={styles.summary}>{result.summary}</p>

          {/* Issue Sections */}
          {SECTION_CONFIG.map(({ key, label, icon }) => {
            const issues = result[key as keyof DesignCritique] as {
              issue: string;
              severity: string;
              fix: string;
            }[];
            if (!issues.length) return null;
            return (
              <details key={key} className={styles.issueSection} open>
                <summary className={styles.issueSectionHeader}>
                  <span className={styles.issueIcon} aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                  <span className={styles.issueCount}>{issues.length}</span>
                </summary>
                <div className={styles.issueList}>
                  {issues.map((issue, i) => (
                    <div key={i} className={`${styles.issue} ${styles[`sev-${issue.severity}`]}`}>
                      <div className={styles.issueHeader}>
                        <span className={styles.issueSeverity}>{issue.severity}</span>
                        <span className={styles.issueText}>{issue.issue}</span>
                      </div>
                      <div className={styles.fix}>
                        <span className={styles.fixLabel}>fix →</span>
                        {issue.fix}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}

          {/* Cliché Matches */}
          {result.clicheMatches.length > 0 && (
            <details className={styles.issueSection} open>
              <summary className={styles.issueSectionHeader}>
                <span className={styles.issueIcon} aria-hidden="true">⊗</span>
                <span>Cliché patterns</span>
                <span className={styles.issueCount} style={{ background: "rgba(255,80,80,0.12)", color: "#FF5050" }}>
                  {result.clicheMatches.length}
                </span>
              </summary>
              <div className={styles.issueList}>
                {result.clicheMatches.map((c, i) => (
                  <div key={i} className={`${styles.issue} ${styles["sev-high"]}`}>
                    <div className={styles.issueHeader}>
                      <span className={styles.issueSeverity}>cliché</span>
                      <span className={styles.issueText}>{c.pattern}</span>
                    </div>
                    <p className={styles.evidence}>{c.evidence}</p>
                    <div className={styles.fix}>
                      <span className={styles.fixLabel}>fix →</span>
                      {c.fix}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Signature Opportunities */}
          {result.signatureOpportunities.length > 0 && (
            <div className={styles.opportunities}>
              <h3 className={styles.opportunitiesTitle}>
                <span className="signal-text">◆</span> Signature opportunities
              </h3>
              <ul className={styles.opportunityList}>
                {result.signatureOpportunities.map((op, i) => (
                  <li key={i} className={styles.opportunity}>{op}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
