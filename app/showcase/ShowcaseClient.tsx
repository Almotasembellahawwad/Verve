"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import DemoLiveCanvas from "@/components/DemoLiveCanvas";
import { SignalNav } from "@/components/SignalNav";
import { launchProjectEditor } from "@/lib/client/editor-workspace";
import { PUBLIC_DEMOS } from "@/lib/demo/public-demo-gallery";
import styles from "./showcase.module.css";

const BASELINES = {
  architecture: {
    title: "Portfolio gravity",
    explanation: "A plain prompt tends to prove taste with finished images. The process, uncertainty, and retention decision disappear behind the portfolio grid.",
    patterns: ["Full-bleed render hero", "Awards and project grid", "Prestige-first copy", "No decision method"],
    intervention: "Move proof from image quality to decision quality.",
  },
  cairo: {
    title: "Hospitality gravity",
    explanation: "The default restaurant page borrows atmosphere from photography and repeats a familiar sequence: hero image, story paragraph, menu cards, booking button.",
    patterns: ["Food-photo dependency", "Fashion serif + beige", "Generic reservation CTA", "LTR-first composition"],
    intervention: "Let language, menu provenance, and reading order create the place.",
  },
  carbon: {
    title: "Climate SaaS gravity",
    explanation: "A generic output signals sustainability before it proves operational control. Green visuals and optimistic numbers make the interface feel less accountable.",
    patterns: ["Leaf iconography", "Green gradient", "Four KPI cards", "Untraceable impact claims"],
    intervention: "Put source, owner, status, and action before the marketing claim.",
  },
} as const;

export default function ShowcaseClient() {
  const router = useRouter();
  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.hero}>
        <div className={styles.heroCode} aria-hidden="true"><span>EVIDENCE</span><i /><span>V/08</span></div>
        <div className={styles.heroMeta}><span>COMPARATIVE EVIDENCE / CURATED, RUNNABLE</span><span>3 BRIEFS · 3 CATEGORY GRAVITIES · 3 DECISIONS</span></div>
        <h1>A result is only impressive<br /><em>when you can see the decision.</em></h1>
        <p>Showcase is not a wall of pretty thumbnails. It reconstructs the generic direction each brief pulls toward, identifies Verve’s intervention, and lets you run the resulting project yourself.</p>
      </header>

      <section className={styles.method} aria-labelledby="method-title">
        <div><span>00 / READING CONTRACT</span><h2 id="method-title">Evidence,<br />not theatre.</h2></div>
        <ol>
          <li><b>01</b><strong>Same starting brief</strong><p>The public brief remains visible. Nothing is reverse-engineered from a finished design.</p></li>
          <li><b>02</b><strong>Named category gravity</strong><p>The baseline is a transparent reconstruction of common prompt-only conventions—not a scientific model benchmark.</p></li>
          <li><b>03</b><strong>Runnable Verve side</strong><p>The outcome is a complete project with live interaction, editable files, deterministic checks, and export.</p></li>
        </ol>
      </section>

      {PUBLIC_DEMOS.map((demo, caseIndex) => {
        const baseline = BASELINES[demo.id];
        return (
          <article className={styles.case} data-demo={demo.id} id={`case-${demo.id}`} key={demo.id}>
            <header className={styles.caseHeader}>
              <span>{String(caseIndex + 1).padStart(2, "0")} / {demo.category}</span>
              <h2>{demo.title}</h2>
              <blockquote>“{demo.brief}”</blockquote>
            </header>

            <section className={styles.decisionMap} aria-label={`${demo.title} comparison`}>
              <div className={styles.baseline}>
                <span>WITHOUT A DESIGN THESIS</span><h3>{baseline.title}</h3><p>{baseline.explanation}</p>
                <ul>{baseline.patterns.map((pattern) => <li key={pattern}><i aria-hidden="true" />{pattern}</li>)}</ul>
              </div>
              <div className={styles.intervention}>
                <span>VERVE INTERVENTION</span><b aria-hidden="true">↘</b><blockquote>{baseline.intervention}</blockquote>
                <small>{demo.result.archetype.name} archetype · {Math.round(demo.result.archetype.confidence * 100)}% confidence</small>
              </div>
              <div className={styles.outcome}>
                <span>WITH VERVE</span><h3>{demo.result.plan.signatureElement.name}</h3><p>{demo.result.plan.signatureElement.justification}</p>
                <dl><div><dt>{demo.result.distinctivenessReport.score}</dt><dd>Distinctiveness</dd></div><div><dt>{demo.result.engineeringResult.compositeScore}</dt><dd>Engineering</dd></div></dl>
              </div>
            </section>

            <section className={styles.liveEvidence}>
              <div className={styles.liveHeading}><span>RUN THE EVIDENCE</span><p>{demo.result.plan.layoutConcept}</p></div>
              <DemoLiveCanvas project={demo.result.project} />
            </section>

            <footer className={styles.caseFooter}>
              <div><span>WHAT CHANGED</span><p>{demo.result.distinctivenessReport.critiqueSummary}</p></div>
              <div><span>WHAT STILL NEEDS HUMANS</span><p>{demo.result.distinctivenessReport.recommendations[0]}</p></div>
              <button type="button" onClick={() => void launchProjectEditor(demo.result.project, "demo").then((href) => router.push(href))}>Develop this result with AI <b>↗</b></button>
            </footer>
          </article>
        );
      })}

      <section className={styles.finalCta}><span>YOUR BRIEF / NEXT</span><h2>Do not ask for<br />another landing page.</h2><p>Ask Verve for a position. Then keep directing the AI until the implementation deserves it.</p><Link href="/#workspace">Start with a brief <b>↗</b></Link></section>
    </main>
  );
}
