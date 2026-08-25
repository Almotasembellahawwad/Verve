/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes */
import type { Metadata } from "next";
import styles from "./showcase.module.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Showcase — Verve | See the difference",
  description:
    "Real before/after examples. The same brief, once through a generic LLM, once through the Verve pipeline. Side by side.",
};

export default function ShowcasePage() {
  return (
    <main className={styles.page}>
      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <nav className={styles.topNav}>
        <Link href="/" className={styles.backLink}>← Verve</Link>
        <span className={styles.topNavLabel}>{"// showcase"}</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLabel}>
          <span className={styles.dot} aria-hidden="true" />
          <span>3 real briefs. 3 generic outputs. 3 Verve outputs.</span>
        </div>
        <h1 className={styles.heading}>
          We built both sides<br />
          <span className={styles.headingAccent}>ourselves.</span>
        </h1>
        <p className={styles.subheading}>
          No cherry-picking. Same brief — once sent as a plain prompt to an LLM,
          once run through the 9-stage Verve pipeline. The left is what you get by default.
          The right is what Verve guarantees you&apos;ll get instead.
        </p>
        <div className={styles.legend}>
          <span className={styles.legendBadge} data-side="basic">
            <span className={styles.legendDot} data-side="basic" />
            Basic LLM
          </span>
          <span className={styles.legendArrow}>→</span>
          <span className={styles.legendBadge} data-side="verve">
            <span className={styles.legendDot} data-side="verve" />
            With Verve
          </span>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          EXAMPLE 1 — Carbon Accounting SaaS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className={styles.example} id="example-1">
        <div className={styles.exampleHeader}>
          <span className={styles.exampleNum}>01</span>
          <div>
            <div className={styles.exampleBriefLabel}>Brief</div>
            <p className={styles.exampleBrief}>
              &ldquo;A landing page for a carbon accounting SaaS targeting manufacturing
              CFOs. Must communicate precision and regulatory credibility — not environmentalism.&rdquo;
            </p>
          </div>
        </div>

        <div className={styles.compareGrid}>
          {/* ── LEFT: Basic LLM ────────────────────────────────────────── */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="basic">
              <span className={styles.sideDot} data-side="basic" />
              Basic LLM Output
            </div>
            <div className={styles.annotations}>
              <span className={styles.annotation} data-index="1">blue-purple gradient</span>
              <span className={styles.annotation} data-index="2">rocket emoji</span>
              <span className={styles.annotation} data-index="3">Inter 800 — too heavy</span>
              <span className={styles.annotation} data-index="4">soft shadow cards</span>
            </div>
            {/* MOCKUP: Generic AI output */}
            <div className={styles.mockup} data-side="basic">
              <div className="bsc-nav">
                <span className="bsc-logo">🌱 EcoTrack Pro</span>
                <div className="bsc-links">Features · Pricing · Demo</div>
                <div className="bsc-cta-nav">Start Free Trial</div>
              </div>
              <div className="bsc-hero">
                <div className="bsc-badge">🚀 Now with AI-powered insights</div>
                <h2 className="bsc-headline">Reduce Your Carbon Footprint.<br />Track Every Emission.</h2>
                <p className="bsc-sub">The all-in-one platform to measure, manage and reduce your company&apos;s carbon emissions with real-time analytics and AI-powered recommendations.</p>
                <div className="bsc-btns">
                  <span className="bsc-btn-primary">Get Started Free</span>
                  <span className="bsc-btn-secondary">Watch Demo ▶</span>
                </div>
              </div>
              <div className="bsc-features">
                {[
                  { icon: "📊", title: "Real-time Analytics", desc: "Monitor emissions 24/7" },
                  { icon: "🔒", title: "Enterprise Security", desc: "SOC2 compliant" },
                  { icon: "⚡", title: "Fast Onboarding", desc: "Set up in minutes" },
                  { icon: "🤝", title: "Team Collaboration", desc: "Work together seamlessly" },
                ].map((f) => (
                  <div key={f.title} className="bsc-card">
                    <div className="bsc-card-icon">{f.icon}</div>
                    <div className="bsc-card-title">{f.title}</div>
                    <div className="bsc-card-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
              <div className={styles.clicheOverlay}>
                <span className={styles.clicheItem}>① blue-purple gradient</span>
                <span className={styles.clicheItem}>② emoji CTAs</span>
                <span className={styles.clicheItem}>③ "all-in-one platform"</span>
                <span className={styles.clicheItem}>④ soft shadow cards</span>
              </div>
            </div>
            <div className={styles.sideScore} data-side="basic">
              <span className={styles.grade}>D</span>
              <span className={styles.scoreNum}>24/100</span>
              <span className={styles.scoreMeta}>4 clichés detected</span>
            </div>
          </div>

          {/* VS */}
          <div className={styles.vs}><span>vs</span></div>

          {/* ── RIGHT: Verve ───────────────────────────────────────────── */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="verve">
              <span className={styles.sideDot} data-side="verve" />
              Verve Pipeline Output
            </div>
            <div className={styles.annotations}>
              <span className={styles.annotation} data-verve="1">Copper Oxide palette</span>
              <span className={styles.annotation} data-verve="2">DM Mono data type</span>
              <span className={styles.annotation} data-verve="3">Audit Trail Striping</span>
              <span className={styles.annotation} data-verve="4">regulatory language</span>
            </div>
            {/* MOCKUP: Verve output */}
            <div className={styles.mockup} data-side="verve">
              <div className="vrv1-nav">
                <span className="vrv1-logo">CARBONLEDGER</span>
                <div className="vrv1-links">
                  <span>Framework</span><span>Compliance</span><span>API</span>
                </div>
                <div className="vrv1-cta-nav">Request Access</div>
              </div>
              <div className="vrv1-hero">
                <div className="vrv1-label">// GHG Protocol Scope 1–3 · CSRD Compliant · ISO 14064</div>
                <h2 className="vrv1-headline">Audit-grade<br /><span className="vrv1-accent">emission records</span><br />for the boardroom.</h2>
                <p className="vrv1-sub">
                  Not a dashboard. A ledger. Every gram attributed, every source
                  traceable, every report sign-off ready.
                </p>
                <div className="vrv1-btns">
                  <span className="vrv1-btn-primary">Schedule audit walkthrough</span>
                  <span className="vrv1-btn-secondary">View compliance framework →</span>
                </div>
              </div>
              <div className="vrv1-audit">
                <div className="vrv1-audit-header">
                  <span className="vrv1-audit-title">EMISSION LEDGER — FY2025 Q3</span>
                  <span className="vrv1-audit-status">● VERIFIED</span>
                </div>
                {[
                  { scope: "Scope 1", val: "1,240 tCO₂e", status: "COMPLIANT", delta: "−12%" },
                  { scope: "Scope 2", val: "4,108 tCO₂e", status: "COMPLIANT", delta: "−8%" },
                  { scope: "Scope 3", val: "18,902 tCO₂e", status: "REVIEW",    delta: "+3%" },
                ].map((row) => (
                  <div key={row.scope} className="vrv1-row">
                    <span className="vrv1-scope">{row.scope}</span>
                    <span className="vrv1-val">{row.val}</span>
                    <span className={`vrv1-status vrv1-status-${row.status.toLowerCase()}`}>{row.status}</span>
                    <span className="vrv1-delta">{row.delta}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.sideScore} data-side="verve">
              <span className={styles.grade}>A</span>
              <span className={styles.scoreNum}>91/100</span>
              <span className={styles.scoreMeta}>Signature: Audit Trail Striping</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          EXAMPLE 2 — Motion Designer Portfolio
      ═══════════════════════════════════════════════════════════════════ */}
      <section className={styles.example} id="example-2">
        <div className={styles.exampleHeader}>
          <span className={styles.exampleNum}>02</span>
          <div>
            <div className={styles.exampleBriefLabel}>Brief</div>
            <p className={styles.exampleBrief}>
              &ldquo;Portfolio site for a senior motion designer at a major studio. Work includes title sequences and brand films. Wants to feel different from typical creative portfolios.&rdquo;
            </p>
          </div>
        </div>

        <div className={styles.compareGrid}>
          {/* LEFT: Basic LLM */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="basic">
              <span className={styles.sideDot} data-side="basic" />Basic LLM Output
            </div>
            <div className={styles.mockup} data-side="basic">
              <div className="bsc2-nav">
                <span className="bsc2-logo">✨ Alex Chen</span>
                <div className="bsc2-links">Work · About · Contact</div>
              </div>
              <div className="bsc2-hero">
                <p className="bsc2-tag">Motion Designer & Creative Director</p>
                <h2 className="bsc2-headline">Bringing Stories<br />to Life</h2>
                <p className="bsc2-sub">I create stunning motion graphics and visual effects that captivate audiences and elevate brands.</p>
                <span className="bsc2-btn">View My Work</span>
              </div>
              <div className="bsc2-grid">
                {["Project 1", "Project 2", "Project 3", "Project 4"].map((p) => (
                  <div key={p} className="bsc2-card">
                    <div className="bsc2-thumb" />
                    <div className="bsc2-card-label">{p}</div>
                  </div>
                ))}
              </div>
              <div className={styles.clicheOverlay}>
                <span className={styles.clicheItem}>① "Bringing stories to life"</span>
                <span className={styles.clicheItem}>② sparkle emoji</span>
                <span className={styles.clicheItem}>③ generic 4-card grid</span>
                <span className={styles.clicheItem}>④ Inter + black</span>
              </div>
            </div>
            <div className={styles.sideScore} data-side="basic">
              <span className={styles.grade}>D</span>
              <span className={styles.scoreNum}>18/100</span>
              <span className={styles.scoreMeta}>4 clichés detected</span>
            </div>
          </div>

          <div className={styles.vs}><span>vs</span></div>

          {/* RIGHT: Verve */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="verve">
              <span className={styles.sideDot} data-side="verve" />Verve Pipeline Output
            </div>
            <div className={styles.mockup} data-side="verve">
              <div className="vrv2-nav">
                <span className="vrv2-logo">A.CHEN</span>
                <div className="vrv2-links">
                  <span>Index</span><span>Archive</span><span>Process</span>
                </div>
                <span className="vrv2-fps">24fps</span>
              </div>
              <div className="vrv2-hero">
                <div className="vrv2-frame">
                  <div className="vrv2-frameline" />
                  <div className="vrv2-filmno">FILM № 001</div>
                </div>
                <h2 className="vrv2-headline">Motion is<br />a <em className="vrv2-em">language</em><br />not a tool.</h2>
                <div className="vrv2-meta">
                  <span>Title Sequences</span>
                  <span>·</span>
                  <span>Brand Films</span>
                  <span>·</span>
                  <span>18 years</span>
                </div>
              </div>
              <div className="vrv2-films">
                {[
                  { no: "F-001", title: "MARVEL TITLE SEQ", year: "2024", dur: "02:14" },
                  { no: "F-002", title: "NIKE BRAND FILM",   year: "2024", dur: "01:30" },
                  { no: "F-003", title: "HBO MAX IDENT",     year: "2023", dur: "00:15" },
                ].map((f) => (
                  <div key={f.no} className="vrv2-film-row">
                    <span className="vrv2-film-no">{f.no}</span>
                    <span className="vrv2-film-title">{f.title}</span>
                    <span className="vrv2-film-year">{f.year}</span>
                    <span className="vrv2-film-dur">{f.dur}</span>
                    <span className="vrv2-play">▶</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.sideScore} data-side="verve">
              <span className={styles.grade}>S</span>
              <span className={styles.scoreNum}>96/100</span>
              <span className={styles.scoreMeta}>Signature: Film Frame Index Grid</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          EXAMPLE 3 — Developer API Tool
      ═══════════════════════════════════════════════════════════════════ */}
      <section className={styles.example} id="example-3">
        <div className={styles.exampleHeader}>
          <span className={styles.exampleNum}>03</span>
          <div>
            <div className={styles.exampleBriefLabel}>Brief</div>
            <p className={styles.exampleBrief}>
              &ldquo;Landing page for a REST API testing and monitoring tool for senior backend engineers. No fluff — they hate marketing language.&rdquo;
            </p>
          </div>
        </div>

        <div className={styles.compareGrid}>
          {/* LEFT: Basic LLM */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="basic">
              <span className={styles.sideDot} data-side="basic" />Basic LLM Output
            </div>
            <div className={styles.mockup} data-side="basic">
              <div className="bsc3-nav">
                <span className="bsc3-logo">⚡ APIForge</span>
                <div className="bsc3-links">Docs · Pricing · Blog</div>
                <div className="bsc3-cta-nav">Sign Up Free</div>
              </div>
              <div className="bsc3-hero">
                <div className="bsc3-badge">🔥 Trusted by 10,000+ developers</div>
                <h2 className="bsc3-headline">Test APIs<br />Faster Than Ever</h2>
                <p className="bsc3-sub">The most powerful API testing platform that helps developers build, test, and monitor APIs with ease.</p>
                <div className="bsc3-btns">
                  <span className="bsc3-btn-p">Start for Free</span>
                  <span className="bsc3-btn-s">View Docs</span>
                </div>
              </div>
              <div className="bsc3-cards">
                {[
                  { icon: "⚡", t: "Lightning Fast", d: "Test in milliseconds" },
                  { icon: "🔒", t: "Secure", d: "Enterprise-grade security" },
                  { icon: "📊", t: "Analytics", d: "Powerful insights" },
                ].map((c) => (
                  <div key={c.t} className="bsc3-card">
                    <span className="bsc3-ci">{c.icon}</span>
                    <b className="bsc3-ct">{c.t}</b>
                    <p className="bsc3-cd">{c.d}</p>
                  </div>
                ))}
              </div>
              <div className={styles.clicheOverlay}>
                <span className={styles.clicheItem}>① "10,000+ developers"</span>
                <span className={styles.clicheItem}>② "Faster Than Ever"</span>
                <span className={styles.clicheItem}>③ fire + lightning emojis</span>
                <span className={styles.clicheItem}>④ "most powerful platform"</span>
              </div>
            </div>
            <div className={styles.sideScore} data-side="basic">
              <span className={styles.grade}>D</span>
              <span className={styles.scoreNum}>11/100</span>
              <span className={styles.scoreMeta}>4 clichés detected</span>
            </div>
          </div>

          <div className={styles.vs}><span>vs</span></div>

          {/* RIGHT: Verve */}
          <div className={styles.side}>
            <div className={styles.sideBadge} data-side="verve">
              <span className={styles.sideDot} data-side="verve" />Verve Pipeline Output
            </div>
            <div className={styles.mockup} data-side="verve">
              <div className="vrv3-nav">
                <span className="vrv3-logo">probe<span className="vrv3-dot">.</span></span>
                <div className="vrv3-links">
                  <span>docs</span><span>status</span><span>changelog</span>
                </div>
                <div className="vrv3-nav-pill">v2.4.1</div>
              </div>
              <div className="vrv3-hero">
                <div className="vrv3-terminal">
                  <div className="vrv3-tbar">
                    <span className="vrv3-tbtn vrv3-tbtn-r" /><span className="vrv3-tbtn vrv3-tbtn-y" /><span className="vrv3-tbtn vrv3-tbtn-g" />
                    <span className="vrv3-ttitle">probe — curl</span>
                  </div>
                  <div className="vrv3-tcode">
                    <span className="vrv3-comment"># send a request</span><br />
                    <span className="vrv3-key">curl</span> <span className="vrv3-str">https://api.yourservice.com/v2/users</span> \<br />
                    &nbsp;&nbsp;<span className="vrv3-flag">-H</span> <span className="vrv3-str">&quot;Authorization: Bearer $TOKEN&quot;</span> \<br />
                    &nbsp;&nbsp;<span className="vrv3-flag">| probe intercept</span><br />
                    <br />
                    <span className="vrv3-status-ok">200 OK</span> <span className="vrv3-time">↳ 43ms · 1.2kb</span><br />
                    <span className="vrv3-arrow">›</span> <span className="vrv3-comment">latency p99: 67ms · no anomalies</span>
                  </div>
                </div>
                <h2 className="vrv3-headline">HTTP is simple.<br /><span className="vrv3-accent">Debugging isn&apos;t.</span></h2>
                <p className="vrv3-sub">Intercept, inspect, replay. Works in your existing workflow — no browser extension, no GUI required.</p>
                <div className="vrv3-stats">
                  <span><b>43μs</b> overhead</span>
                  <span><b>zero</b> config</span>
                  <span><b>BSD-3</b> license</span>
                </div>
              </div>
            </div>
            <div className={styles.sideScore} data-side="verve">
              <span className={styles.grade}>A</span>
              <span className={styles.scoreNum}>89/100</span>
              <span className={styles.scoreMeta}>Signature: Status Code Hierarchy</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className={styles.cta}>
        <p className={styles.ctaText}>Your brief is next.</p>
        <Link href="/#workspace" className={styles.ctaBtn}>Try the pipeline →</Link>
      </section>
    </main>
  );
}
