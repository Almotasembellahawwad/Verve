"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import GeneratePanel from "@/components/GeneratePanel";
import CritiquePanel from "@/components/CritiquePanel";
import ComparePanel from "@/components/ComparePanel";
import { PipelineViz } from "@/components/PipelineViz";
import { ClicheList } from "@/components/ClicheList";
import { SignalNav } from "@/components/SignalNav";
import OnboardingModal from "@/components/OnboardingModal";
import { PUBLIC_DEMOS, type PublicDemoId } from "@/lib/demo/public-demo-gallery";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"generate" | "critique" | "compare">("generate");
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const openPublicDemo = (demoId: PublicDemoId) => {
    setActiveTab("generate");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("verve:open-public-demo", { detail: { demoId } }));
    }, 0);
  };

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
              <span>Project intelligence engine / build 02.0</span>
            </div>

            <h1 className={styles.heroHeading}>
              <span className={styles.heroSans}>A site is not</span>
              <span className={styles.heroSerif}>a block of code.</span>
              <span className={styles.heroSerifItalic}>Ship the system.</span>
            </h1>

            <p className={styles.heroBody}>
              Speak or write a brief. Verve turns it into a runnable, multi-file project,
              previews HTML and React live, inspects complete Next.js output safely, and
              preserves a recovery draft when a provider stops halfway.
            </p>

            <div className={styles.heroCta}>
              <a href="#workspace" className={styles.ctaPrimary} id="cta-try">
                Open the workbench <span aria-hidden="true">↘</span>
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
              <span><b>LIVE</b> sandbox preview</span>
              <span><b>LOCAL</b> key storage</span>
            </div>
          </div>

          <aside className={styles.tasteCard} aria-label="Live taste diagnostic example">
            <div className={styles.tasteCardTop}>
              <span>VERVE / PROJECT RECEIPT</span>
              <span className={styles.liveTag}><i /> LIVE</span>
            </div>
            <div className={styles.tasteScoreRow}>
              <span className={styles.tasteScore}>09</span>
              <div>
                <span className={styles.scoreLabel}>PROJECT FILES</span>
                <strong>Runnable system delivered</strong>
              </div>
            </div>
            <div className={styles.traceRows}>
              <div><span>Single code blob</span><del>accepted</del><b>rejected</b></div>
              <div><span>Build configuration</span><em>included</em></div>
              <div><span>Runtime preview</span><em>sandboxed</em></div>
              <div><span>Provider recovery</span><em>armed</em></div>
            </div>
            <p className={styles.redNote}>“If it cannot run, it is not finished.”</p>
            <span className={styles.cardIndex} aria-hidden="true">V/01</span>
          </aside>
        </div>

        <div className={styles.thesisBand} aria-label="The Verve method">
          <div className={styles.thesisIntro}>
            <span className={styles.thesisEyebrow}>THE VERVE METHOD</span>
            <p>From an unfinished thought to a project you can inspect, run, download, and continue.</p>
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
              <div><strong>Run the evidence</strong><small>Inspect files, preview breakpoints, review risks, and export the ZIP.</small></div>
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
            Two execution paths. One contract: a project that is{" "}
            <span className="amber-text">visible, recoverable, and yours</span>.
          </h2>
          <PipelineViz />
        </div>
      </section>

      {/* PUBLIC DEMO — zero-key proof before the workbench */}
      <section className={styles.demoSection} id="public-demo" aria-labelledby="public-demo-title">
        <div className="container">
          <div className={styles.demoFrame}>
            <div className={styles.demoIndex} aria-hidden="true">
              <span>00</span>
              <i />
              <small>PUBLIC PROOF</small>
            </div>
            <div className={styles.demoCopy}>
              <span className={styles.demoEyebrow}>THREE INDUSTRIES · ZERO MODEL CALLS · COMPLETE PROJECT FILES</span>
              <h2 id="public-demo-title">One project can be a template.<br /><em>Three prove a system.</em></h2>
              <p>
                Compare three complete visual theses: adaptive-reuse architecture, Arabic hospitality,
                and carbon operations. Every project is editable, runnable, inspected, and exportable.
              </p>
            </div>
            <dl className={styles.demoMetrics} aria-label="Public demo capabilities">
              <div><dt>03</dt><dd>distinct projects</dd></div>
              <div><dt>12</dt><dd>editable files</dd></div>
              <div><dt>00</dt><dd>provider calls</dd></div>
            </dl>
            <div className={styles.demoChooser} aria-label="Choose a public demo project">
              {PUBLIC_DEMOS.map((demo, index) => (
                <button
                  type="button"
                  className={styles.demoChoice}
                  onClick={() => openPublicDemo(demo.id)}
                  id={index === 0 ? "open-public-demo" : `open-public-demo-${demo.id}`}
                  disabled={!clientReady}
                  key={demo.id}
                >
                  <span className={styles.demoChoiceIndex}>{demo.index}</span>
                  <span className={styles.demoChoiceCopy}>
                    <small>{demo.category}</small>
                    <b>{demo.title}</b>
                    <em>{demo.description}</em>
                  </span>
                  <span className={styles.demoChoiceArrow} aria-hidden="true">↘</span>
                </button>
              ))}
            </div>
          </div>
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
            This list drives steps 2 and 4 of the pipeline. It&apos;s open-source,
            versioned by date, and accepts community PRs. The blocklist is the engine
            — not a style guide.
          </p>
          <ClicheList />
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
