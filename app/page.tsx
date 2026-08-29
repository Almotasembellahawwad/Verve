"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import GeneratePanel from "@/components/GeneratePanel";
import CritiquePanel from "@/components/CritiquePanel";
import ComparePanel from "@/components/ComparePanel";
import { PipelineViz } from "@/components/PipelineViz";
import { ClicheList } from "@/components/ClicheList";
import { SignalNav } from "@/components/SignalNav";
import OnboardingModal from "@/components/OnboardingModal";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"generate" | "critique" | "compare">("generate");

  return (
    <main className={styles.main}>
      <SignalNav />
      <OnboardingModal />

      {/* HERO — Signature element: editorial calibration trace */}
      <section className={styles.hero} id="hero">
        <div className={styles.calibrationRail} aria-hidden="true">
          <span>V</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
        </div>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.heroLabel}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>Project intelligence engine / build 02.1</span>
            </div>

            <h1 className={styles.heroHeading}>
              <span className={styles.heroSans}>Do not stop at</span>
              <span className={styles.heroSerif}>the first answer.</span>
              <span className={styles.heroSerifItalic}>Develop the system.</span>
            </h1>

            <p className={styles.heroBody}>
              Begin with a brief, receive a runnable multi-file project, then keep directing
              the AI. Every change is staged, rendered, checked, and left for you to accept or
              reject until the result reaches your standard.
            </p>

            <div className={styles.heroCta}>
              <a href="#workspace" className={styles.ctaPrimary} id="cta-try">
                Start with a brief <span aria-hidden="true">↘</span>
              </a>
              <a
                href="https://github.com/Almotasembellahawwad/Verve"
                className={styles.ctaSecondary}
                target="_blank"
                rel="noopener noreferrer"
                id="cta-github"
              >
                <GitHubIcon />
                Inspect the source
              </a>
            </div>

            <div className={styles.proofStrip} aria-label="Verve facts">
              <span><b>03</b> stack profiles</span>
              <span><b>02</b> generation modes</span>
              <span><b>LIVE</b> proposal preview</span>
              <span><b>HUMAN</b> acceptance gate</span>
            </div>
          </div>

          <aside className={styles.tasteCard} aria-label="Live taste diagnostic example">
            <div className={styles.tasteCardTop}>
              <span>VERVE / ITERATION RECEIPT</span>
              <span className={styles.liveTag}><i /> LIVE</span>
            </div>
            <div className={styles.tasteScoreRow}>
              <span className={styles.tasteScore}>05</span>
              <div>
                <span className={styles.scoreLabel}>ACCEPTED REVISION</span>
                <strong>The user chose this state</strong>
              </div>
            </div>
            <div className={styles.traceRows}>
              <div><span>AI overwrite</span><del>allowed</del><b>blocked</b></div>
              <div><span>Changed files</span><em>3 inspected</em></div>
              <div><span>Live proposal</span><em>verified</em></div>
              <div><span>Rollback point</span><em>captured</em></div>
            </div>
            <p className={styles.redNote}>“The model proposes. The user decides.”</p>
            <span className={styles.cardIndex} aria-hidden="true">V/01</span>
          </aside>
        </div>

        <div className={styles.thesisBand} aria-label="The Verve method">
          <div className={styles.thesisIntro}>
            <span className={styles.thesisEyebrow}>THE VERVE METHOD</span>
            <p>From an unfinished thought to a project you can direct, inspect, revise, accept, and ship.</p>
          </div>
          <ol className={styles.thesisSteps}>
            <li>
              <span>01</span>
              <div><strong>Speak the intent</strong><small>Dictate in Arabic or English, then correct the structured brief.</small></div>
            </li>
            <li>
              <span>02</span>
              <div><strong>Generate the system</strong><small>Fast drafts or Studio critique, under one project contract.</small></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>Run the evidence</strong><small>Preview the result, inspect files, and expose risks before they hide in export.</small></div>
            </li>
            <li>
              <span>04</span>
              <div><strong>Develop with AI</strong><small>Stage, compare, accept or reject, and repeat until the project is yours.</small></div>
            </li>
          </ol>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.pipeline} id="how-it-works">
        <div className="container">
          <div className={styles.sectionLabel}>
            <span className="muted-text">{"// how it works"}</span>
          </div>
          <h2 className={styles.sectionHeading}>
            Generation is the beginning. The journey ends only when{" "}
            <span className="amber-text">you accept the result</span>.
          </h2>
          <PipelineViz />
        </div>
      </section>

      {/* DEMO PORTAL — complete results live on their own route */}
      <section className={styles.demoPortal} id="public-demo" aria-labelledby="public-demo-title">
        <div className="container">
          <div className={styles.demoPortalGrid}>
            <span className={styles.demoPortalIndex} aria-hidden="true">03/03</span>
            <div className={styles.demoPortalCopy}>
              <span>THREE COMPLETE PROJECT STORIES</span>
              <h2 id="public-demo-title">Do not browse thumbnails.<br /><em>Enter the design decision.</em></h2>
              <p>Follow each brief through category gravity, refusal, visual thesis, signature moment, live project, engineering receipt, and its next AI iteration.</p>
            </div>
            <Link href="/demos" className={styles.demoPortalLink} id="open-demo-gallery">
              <span>Enter the case stories</span>
              <small>03 WORLDS · LIVE PROJECTS · NO API KEY</small>
              <b aria-hidden="true">↗</b>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.editorPortal} aria-labelledby="editor-portal-title">
        <div className={styles.editorPortalRail}><span>AI STUDIO</span><i /><b>∞</b></div>
        <div className={styles.editorPortalCopy}>
          <span>THE ACCEPTANCE LOOP</span>
          <h2 id="editor-portal-title">The first generation<br />is only <em>revision zero.</em></h2>
          <p>Ask an AI model to change the hierarchy, rewrite a section, repair mobile behavior, or push the visual thesis further. Verve stages the changed files and renders the proposal before the accepted project moves.</p>
          <Link href="/editor">Open AI Development Studio <b>↗</b></Link>
        </div>
        <div className={styles.editorLoop} aria-label="AI development loop">
          <div><span>01</span><strong>ASK</strong><small>Describe the change in your words.</small></div>
          <div><span>02</span><strong>PREVIEW</strong><small>Run the proposed project live.</small></div>
          <div><span>03</span><strong>DECIDE</strong><small>Accept, reject, or revise again.</small></div>
          <i aria-hidden="true">↺</i>
        </div>
      </section>

      {/* WORKSPACE — Generate + Critique */}
      <section className={styles.workspace} id="workspace">
        <div className="container">
          <div className={styles.sectionLabel}>
            <span className="muted-text">{"// workspace"}</span>
          </div>
          <h2 className={styles.sectionHeading}>
            Generate, run, inspect, and export.{" "}
            <span className="signal-text">No account required.</span>
          </h2>

          <div className={styles.tabBar} role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "generate"}
              className={`${styles.tab} ${activeTab === "generate" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("generate")}
              id="tab-generate"
            >
              <TerminalIcon />
              Generate
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "critique"}
              className={`${styles.tab} ${activeTab === "critique" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("critique")}
              id="tab-critique"
            >
              <ScanIcon />
              Critique
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "compare"}
              className={`${styles.tab} ${activeTab === "compare" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("compare")}
              id="tab-compare"
            >
              <CompareIcon />
              Compare
              <span className={styles.tabBadge}>new</span>
            </button>
          </div>

          <div role="tabpanel" aria-labelledby={`tab-${activeTab}`} className={styles.tabContent}>
            {activeTab === "generate" && <GeneratePanel />}
            {activeTab === "critique" && <CritiquePanel />}
            {activeTab === "compare"  && <ComparePanel />}
          </div>
        </div>
      </section>

      {/* CLICHÉ BLOCKLIST — Public + transparent */}
      <section className={styles.clicheSection} id="blocklist">
        <div className="container">
          <div className={styles.sectionLabel}>
            <span className="muted-text">{"// cliché blocklist — public, versioned, community-maintained"}</span>
          </div>
          <h2 className={styles.sectionHeading}>
            What Verve is{" "}
            <span className={styles.forbidden}>forbidden</span>{" "}
            from producing.
          </h2>
          <p className={styles.sectionBody}>
            This public, versioned list helps Verve recognize category gravity before a model
            turns it into another familiar interface. It is one transparent constraint—not a
            hidden style preset.
          </p>
          <details className={styles.blocklistDetails}>
            <summary><span>Open the public blocklist</span><b>21 families · 67 signals · versioned</b><i>+</i></summary>
            <ClicheList />
          </details>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className={styles.statsSection} aria-label="Project statistics">
        <div className="container">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>03</span>
              <span className={styles.statLabel}>project stacks</span>
              <span className={styles.statMeta}>Next.js 16 · React 19 + Vite · HTML</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>02</span>
              <span className={styles.statLabel}>execution modes</span>
              <span className={styles.statMeta}>Fast for velocity · Studio for scrutiny</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>LIVE</span>
              <span className={styles.statLabel}>sandbox preview</span>
              <span className={styles.statMeta}>files · editor · responsive viewport · console</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>ZIP</span>
              <span className={styles.statLabel}>complete export</span>
              <span className={styles.statMeta}>source · configs · dependencies · project README</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <span className={styles.footerLogo}>Verve</span>
              <p className={styles.footerTagline}>
                An open-source design taste layer.
              </p>
              <p className={styles.footerMeta}>
                MIT License · Built to be forked, extended, improved.
              </p>
            </div>
            <nav className={styles.footerNav} aria-label="Footer navigation">
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>Explore</span>
                <a href="#how-it-works">How it works</a>
                <a href="/showcase">Showcase</a>
                <a href="#blocklist">Cliché blocklist</a>
                <a href="/docs">Docs ↗</a>
              </div>
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>Contribute</span>
                <a href="https://github.com/Almotasembellahawwad/Verve/blob/main/docs/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Add a cliché</a>
                <a href="https://github.com/Almotasembellahawwad/Verve/blob/main/docs/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Add a reference</a>
                <a href="https://github.com/Almotasembellahawwad/Verve/issues" target="_blank" rel="noopener noreferrer">Open an issue</a>
                <a href="https://github.com/Almotasembellahawwad/Verve/blob/main/docs/ROADMAP.md" target="_blank" rel="noopener noreferrer">Roadmap</a>
              </div>
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>API</span>
                <a href="/api/cliches" target="_blank" rel="noopener noreferrer">GET /api/cliches</a>
                <a href="/api/library" target="_blank" rel="noopener noreferrer">GET /api/library</a>
                <a href="https://github.com/Almotasembellahawwad/Verve/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener noreferrer">Architecture</a>
                <a href="https://github.com/Almotasembellahawwad/Verve" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
              </div>
            </nav>
          </div>
          <div className={styles.footerBase}>
            <span className="muted-text">© 2026 Verve. MIT License.</span>
            <span className="muted-text">
              <span className="signal-text">{"█"}</span> signal active
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.625-5.48 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="8" height="18" rx="1" />
      <rect x="13" y="3" width="8" height="18" rx="1" />
    </svg>
  );
}
