"use client";

import { useState } from "react";
import styles from "./page.module.css";
import GeneratePanel from "@/components/GeneratePanel";
import CritiquePanel from "@/components/CritiquePanel";
import ComparePanel from "@/components/ComparePanel";
import { BeforeAfterHero } from "@/components/BeforeAfterHero";
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

      {/* HERO â€” Signature element: live before/after transformation */}
      <section className={styles.hero} id="hero">
        <div className={styles.heroLabel}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className="muted-text">signal active â€” v1.0.0</span>
        </div>

        <h1 className={styles.heroHeading}>
          Every AI website<br />
          <span className={styles.heroStrike}>looks the same.</span><br />
          <span className="signal-text">Yours won&apos;t.</span>
        </h1>

        <p className={styles.heroBody}>
          Verve is a design taste layer that sits between any LLM and its code output.
          Six mechanical steps interrupt the regression-to-the-mean that makes AI UIs
          indistinguishable. No prompting tricks. No style guides. Structural interference.
        </p>

        <div className={styles.heroCta}>
          <a href="#workspace" className={styles.ctaPrimary} id="cta-try">
            Try it free
          </a>
          <a
            href="https://github.com/mohasbks/Verve"
            className={styles.ctaSecondary}
            target="_blank"
            rel="noopener noreferrer"
            id="cta-github"
          >
            <GitHubIcon />
            View source
          </a>
        </div>

        {/* Signature Element: Live before/after */}
        <BeforeAfterHero />
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.pipeline} id="how-it-works">
        <div className="container">
          <div className={styles.sectionLabel}>
            <span className="muted-text">{"// how it works"}</span>
          </div>
          <h2 className={styles.sectionHeading}>
            Six steps between your brief and something{" "}
            <span className="amber-text">impossible to mistake</span>.
          </h2>
          <PipelineViz />
        </div>
      </section>

      {/* WORKSPACE â€” Generate + Critique */}
      <section className={styles.workspace} id="workspace">
        <div className="container">
          <div className={styles.sectionLabel}>
            <span className="muted-text">{"// workspace"}</span>
          </div>
          <h2 className={styles.sectionHeading}>
            Generate or critique.{" "}
            <span className="signal-text">No signup required.</span>
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

          <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
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
            This list drives steps 2 and 4 of the pipeline. It&apos;s open-source,
            versioned by date, and accepts community PRs. The blocklist is the engine
            â€” not a style guide.
          </p>
          <ClicheList />
        </div>
      </section>

      {/* STATS SECTION */}
      <section className={styles.statsSection} aria-label="Project statistics">
        <div className="container">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>20</span>
              <span className={styles.statLabel}>clichÃ©s blocked</span>
              <span className={styles.statMeta}>color Â· type Â· layout Â· motion Â· copy</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>30</span>
              <span className={styles.statLabel}>reference designs</span>
              <span className={styles.statMeta}>grounding the plan generator</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>6</span>
              <span className={styles.statLabel}>pipeline steps</span>
              <span className={styles.statMeta}>brief â†’ code in one call</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>MIT</span>
              <span className={styles.statLabel}>license</span>
              <span className={styles.statMeta}>fork it, extend it, ship it</span>
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
                MIT License Â· Built to be forked, extended, improved.
              </p>
            </div>
            <nav className={styles.footerNav} aria-label="Footer navigation">
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>Explore</span>
                <a href="#how-it-works">How it works</a>
                <a href="/showcase">Showcase</a>
                <a href="#blocklist">ClichÃ© blocklist</a>
                <a href="/docs">Docs â†—</a>
              </div>
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>Contribute</span>
                <a href="https://github.com/mohasbks/Verve/blob/main/docs/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Add a clichÃ©</a>
                <a href="https://github.com/mohasbks/Verve/blob/main/docs/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Add a reference</a>
                <a href="https://github.com/mohasbks/Verve/issues" target="_blank" rel="noopener noreferrer">Open an issue</a>
                <a href="https://github.com/mohasbks/Verve/blob/main/docs/ROADMAP.md" target="_blank" rel="noopener noreferrer">Roadmap</a>
              </div>
              <div className={styles.footerNavCol}>
                <span className={styles.footerNavLabel}>API</span>
                <a href="/api/cliches" target="_blank" rel="noopener noreferrer">GET /api/cliches</a>
                <a href="/api/library" target="_blank" rel="noopener noreferrer">GET /api/library</a>
                <a href="https://github.com/mohasbks/Verve/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener noreferrer">Architecture</a>
                <a href="https://github.com/mohasbks/Verve" target="_blank" rel="noopener noreferrer">GitHub â†—</a>
              </div>
            </nav>
          </div>
          <div className={styles.footerBase}>
            <span className="muted-text">Â© 2026 Verve. MIT License.</span>
            <span className="muted-text">
              <span className="signal-text">â–ˆ</span> signal active
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
