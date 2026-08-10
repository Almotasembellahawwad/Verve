"use client";
// components/Certificate.tsx
// Verve Score Certificate — shareable design quality card
//
// Renders a styled certificate modal showing:
//   - Composite score + grade
//   - Don Norman 3-Level bars (V/B/R)
//   - Brand Archetype
//   - Signature Element
//   - Brief (truncated)
//   - "Copy as image" via html2canvas (lazy-loaded)
//
// Design language: dark, editorial, no gradients —
// the certificate should feel like a technical spec sheet,
// not a trophy.

import { useRef, useState, useCallback } from "react";
import styles from "./Certificate.module.css";

type NormanLevel = {
  score: number;
  grade: string;
};

type CertificateData = {
  score: number;
  grade: string;
  normanLevels?: {
    visceral:   NormanLevel;
    behavioral: NormanLevel;
    reflective: NormanLevel;
  };
  archetypeId?: string;
  archetypeCoherence?: number;
  signatureElement?: string;
  brief: string;
  durationMs: number;
  revisionCount: number;
};

type Props = {
  data: CertificateData;
  onClose: () => void;
};

const GRADE_COLORS: Record<string, string> = {
  S: "#A78BFA",
  A: "#34D399",
  B: "#FBBF24",
  C: "#F97316",
  D: "#FF5050",
};

function Bar({ score, color, label, grade }: { score: number; color: string; label: string; grade: string }) {
  return (
    <div className={styles.barRow}>
      <div className={styles.barLabel}>
        <span className={styles.barName}>{label}</span>
        <span className={styles.barGrade} style={{ color }}>{grade}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${score}%`, background: color }} />
      </div>
      <span className={styles.barScore} style={{ color }}>{score}</span>
    </div>
  );
}

export default function Certificate({ data, onClose }: Props) {
  const certRef  = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const gradeColor = GRADE_COLORS[data.grade] ?? "#fff";
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const handleCopyImage = useCallback(async () => {
    if (!certRef.current) return;
    setCopying(true);
    try {
      // Lazy-load html2canvas — users who don't need it won't pay the cost
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(certRef.current, {
        backgroundColor: "#0C0C0C",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // Fallback: download instead
          const url = URL.createObjectURL(blob);
          const a   = document.createElement("a");
          a.href     = url;
          a.download = `verve-certificate-${data.grade}-${data.score}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch (e) {
      console.error("Certificate copy failed:", e);
    } finally {
      setCopying(false);
    }
  }, [data.grade, data.score]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Verve Score Certificate">
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal shell */}
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Score Certificate</span>
          <div className={styles.modalActions}>
            <button
              className={styles.copyImgBtn}
              onClick={handleCopyImage}
              disabled={copying}
              id="cert-copy-image"
              aria-label="Copy certificate as image"
            >
              {copying ? "Rendering…" : copied ? "✓ Copied" : "⎘ Copy as image"}
            </button>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close certificate"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Certificate card — this is what gets captured ── */}
        <div className={styles.cert} ref={certRef} id="verve-certificate">
          {/* Header row */}
          <div className={styles.certHeader}>
            <div className={styles.certBrand}>
              <span className={styles.certLogoMark}>▋</span>
              VERVE
            </div>
            <div className={styles.certMeta}>
              <span className={styles.certDate}>{now}</span>
              <span className={styles.certDuration}>{(data.durationMs / 1000).toFixed(1)}s</span>
              {data.revisionCount > 0 && (
                <span className={styles.certRevision}>{data.revisionCount} rev</span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className={styles.certScore}>
            <div
              className={styles.certGrade}
              style={{ color: gradeColor }}
              aria-label={`Grade ${data.grade}`}
            >
              {data.grade}
            </div>
            <div className={styles.certScoreNum}>
              {data.score}
              <span className={styles.certScoreOut}>/100</span>
            </div>
            <div className={styles.certScoreLabel}>Distinctiveness Score</div>
          </div>

          {/* Norman 3-Level bars */}
          {data.normanLevels && (
            <div className={styles.certSection}>
              <div className={styles.certSectionTitle}>Don Norman 3-Level</div>
              <div className={styles.bars}>
                <Bar score={data.normanLevels.visceral.score}   color="#A78BFA" label="Visceral"   grade={data.normanLevels.visceral.grade}   />
                <Bar score={data.normanLevels.behavioral.score} color="#34D399" label="Behavioral" grade={data.normanLevels.behavioral.grade} />
                <Bar score={data.normanLevels.reflective.score} color="#FBBF24" label="Reflective" grade={data.normanLevels.reflective.grade} />
              </div>
            </div>
          )}

          {/* Archetype */}
          {data.archetypeId && data.archetypeId !== "unknown" && (
            <div className={styles.certSection}>
              <div className={styles.certSectionTitle}>Brand Archetype</div>
              <div className={styles.certArchetype}>
                <span className={styles.certArchetypeName}>{data.archetypeId}</span>
                {data.archetypeCoherence !== undefined && (
                  <span className={styles.certArchetypeCoh}>{data.archetypeCoherence}% coherence</span>
                )}
              </div>
            </div>
          )}

          {/* Signature Element */}
          {data.signatureElement && (
            <div className={styles.certSection}>
              <div className={styles.certSectionTitle}>Signature Element</div>
              <div className={styles.certSignature}>
                {data.signatureElement.slice(0, 120)}
                {data.signatureElement.length > 120 ? "…" : ""}
              </div>
            </div>
          )}

          {/* Brief */}
          <div className={styles.certSection}>
            <div className={styles.certSectionTitle}>Brief</div>
            <div className={styles.certBrief}>
              {data.brief.slice(0, 160)}{data.brief.length > 160 ? "…" : ""}
            </div>
          </div>

          {/* Footer */}
          <div className={styles.certFooter}>
            <span className={styles.certFooterNote}>Generated by Verve Design Pipeline</span>
            <span className={styles.certFooterUrl}>verve.design</span>
          </div>
        </div>

        <p className={styles.shareHint}>
          Share on LinkedIn, X, or Dribbble to show your design scored above the generic field.
        </p>
      </div>
    </div>
  );
}
