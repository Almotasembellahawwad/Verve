"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./BeforeAfterHero.module.css";

// â”€â”€â”€ BEFORE: Generic AI output â€” every clichÃ© documented â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Inter font, cream background, soft-shadow card, indigo CTA, vague copy.
// This is the literal pattern from cliches.json â€” displayed, not hidden.
const BEFORE_HTML = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  .b-wrap {
    font-family: 'Inter', sans-serif;
    padding: 28px 24px;
    max-width: 340px;
    width: 100%;
  }
  .b-badge {
    display: inline-block;
    background: #EEF2FF;
    color: #6366F1;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 16px;
    letter-spacing: 0.04em;
  }
  .b-h2 {
    color: #111827;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 10px;
  }
  .b-p {
    color: #6B7280;
    font-size: 13px;
    line-height: 1.65;
    margin-bottom: 20px;
  }
  .b-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
  }
  .b-card {
    background: #fff;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  }
  .b-card-icon {
    font-size: 18px;
    margin-bottom: 6px;
  }
  .b-card-label {
    font-size: 11px;
    font-weight: 600;
    color: #374151;
  }
  .b-card-val {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }
  .b-btn {
    display: block;
    width: 100%;
    background: linear-gradient(135deg, #6366F1, #8B5CF6);
    color: #fff;
    padding: 11px 20px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    text-align: center;
    font-family: 'Inter', sans-serif;
  }
  .b-social {
    display: flex;
    gap: 6px;
    margin-top: 14px;
    font-size: 11px;
    color: #9CA3AF;
    align-items: center;
    justify-content: center;
  }
  .b-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    margin-left: -4px;
    display: inline-block;
  }
</style>
<div class="b-wrap">
  <span class="b-badge">âœ¦ AI-Powered Platform</span>
  <h2 class="b-h2">Build faster.<br>Boost productivity.</h2>
  <p class="b-p">Streamline your workflow and deliver results with our powerful, easy-to-use platform. Trusted by 10,000+ teams.</p>
  <div class="b-cards">
    <div class="b-card">
      <div class="b-card-icon">âš¡</div>
      <div class="b-card-label">Speed</div>
      <div class="b-card-val">3Ã— faster</div>
    </div>
    <div class="b-card">
      <div class="b-card-icon">ðŸ›¡</div>
      <div class="b-card-label">Secure</div>
      <div class="b-card-val">SOC 2</div>
    </div>
  </div>
  <button class="b-btn">Get Started Free â†’</button>
  <div class="b-social">
    <span style="background:#E5E7EB;border-radius:50%;width:20px;height:20px;display:inline-block"></span>
    <span style="background:#D1D5DB;border-radius:50%;width:20px;height:20px;display:inline-block;margin-left:-6px"></span>
    <span style="background:#C4C4C4;border-radius:50%;width:20px;height:20px;display:inline-block;margin-left:-6px"></span>
    &nbsp;Joined 10k+ users
  </div>
</div>`;

// â”€â”€â”€ AFTER: Verve output â€” every clichÃ© explicitly countered â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IBM Plex Mono body, Space Grotesk display, amber accent, clip-path CTA,
// editorial annotation style, no rounded cards, no gradients, no vague copy.
const AFTER_HTML = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap');
  .a-wrap {
    font-family: 'IBM Plex Mono', monospace;
    padding: 24px 26px;
    max-width: 340px;
    width: 100%;
  }
  .a-score {
    font-size: 10px;
    color: #D49020;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 16px;
    opacity: 0.9;
    font-weight: 600;
  }
  .a-h2 {
    color: #F0ECD6;
    font-size: 20px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    letter-spacing: -0.04em;
    line-height: 1.1;
    margin-bottom: 12px;
  }
  .a-annotation {
    color: #9E9A88;
    font-size: 11.5px;
    line-height: 1.7;
    margin-bottom: 18px;
    border-left: 2px solid rgba(212,144,32,0.45);
    padding-left: 12px;
  }
  .a-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1px;
    background: rgba(255,255,255,0.05);
    margin-bottom: 20px;
    border: 1px solid rgba(212,144,32,0.1);
  }
  .a-metric {
    background: #141210;
    padding: 10px 10px 8px;
  }
  .a-metric-key {
    font-size: 9px;
    color: #5A5648;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: block;
    margin-bottom: 4px;
  }
  .a-metric-val {
    font-size: 15px;
    font-weight: 600;
    color: #D49020;
    font-family: 'Space Grotesk', sans-serif;
    display: block;
  }
  .a-btn {
    display: inline-block;
    background: #D49020;
    color: #0F0D0B;
    padding: 10px 20px;
    border: none;
    font-weight: 700;
    font-size: 11px;
    cursor: pointer;
    letter-spacing: 0.06em;
    font-family: 'Space Grotesk', sans-serif;
    text-transform: uppercase;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .a-sig {
    margin-top: 14px;
    font-size: 9.5px;
    color: #5A5648;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .a-sig span {
    color: #39FF14;
    margin-right: 6px;
  }
</style>
<div class="a-wrap">
  <div class="a-score">// distinctiveness: 91 â€” grade A</div>
  <h2 class="a-h2">The noise floor<br>just dropped.</h2>
  <p class="a-annotation">AI UIs converge on defaults. This one was built<br>against them. Deliberately.</p>
  <div class="a-metrics">
    <div class="a-metric">
      <span class="a-metric-key">ClichÃ©s</span>
      <span class="a-metric-val">0</span>
    </div>
    <div class="a-metric">
      <span class="a-metric-key">Revisions</span>
      <span class="a-metric-val">1Ã—</span>
    </div>
    <div class="a-metric">
      <span class="a-metric-key">Score</span>
      <span class="a-metric-val">91</span>
    </div>
  </div>
  <button class="a-btn">Analyze brief_</button>
  <div class="a-sig"><span>â–ˆ</span> signal active â€” verve v1.0</div>
</div>`;

export function BeforeAfterHero({ standalone = false }: { standalone?: boolean }) {
  // Start at 42% â€” before is deliberately cramped, after dominates
  const [dividerPos, setDividerPos] = useState(42);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePos = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDividerPos(Math.max(15, Math.min(80, ((clientX - rect.left) / rect.width) * 100)));
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => { updatePos(e.clientX); };
    const onUp = () => setIsDragging(false);
    const onTouch = (e: TouchEvent) => { updatePos(e.touches[0].clientX); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  return (
    <div className={`${styles.comparisonRoot} ${standalone ? styles.standalone : ""}`}>

      {/* Fixed labels â€” each anchored to its own side, not following divider */}
      <div className={styles.labelRow} aria-hidden="true">
        <span className={styles.labelBefore}>Base LLM</span>
        <span className={styles.labelAfter}>Verve Output</span>
      </div>

      {/* Main comparison viewport */}
      <div
        className={styles.viewport}
        ref={containerRef}
        role="group"
        aria-label="Drag to compare generic AI output versus Verve output"
      >
        {/* BEFORE â€” generic, faded */}
        <div className={styles.beforePanel}>
          <div className={styles.genericWatermark} aria-hidden="true">GENERIC</div>
          <div className={styles.chromeBar}>
            <div className={styles.chromeDots}>
              <span style={{ background: "#FF5F57" }} />
              <span style={{ background: "#FEBC2E" }} />
              <span style={{ background: "#28C840" }} />
            </div>
            <div className={styles.chromeAddr}>localhost:3000</div>
          </div>
          <div className={`${styles.previewArea} ${styles.beforeBg} noise-state`}>
            <div dangerouslySetInnerHTML={{ __html: BEFORE_HTML }} />
          </div>
        </div>

        {/* AFTER â€” dominant, clipped from divider position */}
        <div
          className={styles.afterPanel}
          style={{ clipPath: `inset(0 0 0 ${dividerPos}%)` }}
        >
          <div
            className={styles.chromeBar}
            style={{ background: "#0F0D0B", borderBottom: "1px solid rgba(212,144,32,0.15)" }}
          >
            <div className={styles.chromeDots}>
              <span style={{ background: "#2A2218" }} />
              <span style={{ background: "#2A2218" }} />
              <span style={{ background: "#D49020", boxShadow: "0 0 6px rgba(212,144,32,0.5)" }} />
            </div>
            <div className={styles.chromeAddr} style={{ color: "#D49020", opacity: 0.8 }}>
              verve:calibrated/0xD490
            </div>
          </div>
          <div className={`${styles.previewArea} ${styles.afterBg}`}>
            <div dangerouslySetInnerHTML={{ __html: AFTER_HTML }} />
          </div>
        </div>

        {/* Draggable divider */}
        <div
          className={`${styles.divider} ${!hasInteracted ? styles.dividerPulse : ""}`}
          style={{ left: `${dividerPos}%` }}
          onMouseDown={() => { setIsDragging(true); setHasInteracted(true); }}
          onTouchStart={() => { setIsDragging(true); setHasInteracted(true); }}
          role="slider"
          aria-label="Comparison divider â€” drag left or right"
          aria-valuemin={15}
          aria-valuemax={80}
          aria-valuenow={Math.round(dividerPos)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { setDividerPos((p) => Math.max(15, p - 5)); setHasInteracted(true); }
            if (e.key === "ArrowRight") { setDividerPos((p) => Math.min(80, p + 5)); setHasInteracted(true); }
          }}
        >
          <div className={styles.dividerHandle} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M5 8H11M5 8L7 6M5 8L7 10M11 8L9 6M11 8L9 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          {!hasInteracted && (
            <div className={styles.dragHint} aria-hidden="true">drag</div>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className={styles.caption}>
        <span>Same brief.</span>
        <span className="muted-text">Â·</span>
        <span className="muted-text">Drag to reveal.</span>
        <span className="muted-text">Â·</span>
        <span className="muted-text">0 blocklist violations in Verve output.</span>
      </div>
    </div>
  );
}
