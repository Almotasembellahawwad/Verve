"use client";

import Link from "next/link";
import { useState } from "react";
import NativeHtmlWorkbench from "@/components/NativeHtmlWorkbench";
import { SignalNav } from "@/components/SignalNav";
import { DEFAULT_PUBLIC_DEMO_ID, PUBLIC_DEMOS, type PublicDemoId } from "@/lib/demo/public-demo-gallery";
import styles from "./demos.module.css";

export default function DemosClient() {
  const [selectedId, setSelectedId] = useState<PublicDemoId>(DEFAULT_PUBLIC_DEMO_ID);
  const selected = PUBLIC_DEMOS.find((demo) => demo.id === selectedId) ?? PUBLIC_DEMOS[0];

  const selectDemo = (demoId: PublicDemoId) => {
    setSelectedId(demoId);
    window.setTimeout(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("demo-result")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }, 0);
  };

  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.hero}>
        <div className={styles.rail} aria-hidden="true"><span>V</span><i /><span>03</span></div>
        <div className={styles.heroMeta}><span>PUBLIC EVIDENCE ROOM / V0.4</span><span>NO ACCOUNT · NO MODEL CALL</span></div>
        <h1>Three briefs.<br /><em>Three complete systems.</em></h1>
        <p>These are not screenshots. Choose a project, inspect its files, run it at three breakpoints, edit the source, read Render Gate, and export the ZIP.</p>
      </header>

      <section className={styles.chooser} aria-labelledby="choose-demo-title">
        <div className={styles.chooserHeading}>
          <span>01 / SELECT THE EVIDENCE</span>
          <h2 id="choose-demo-title">Different industries.<br />No shared template.</h2>
        </div>
        <div className={styles.demoGrid}>
          {PUBLIC_DEMOS.map((demo) => {
            const active = demo.id === selected.id;
            return (
              <button
                type="button"
                className={styles.demoCard}
                data-active={active || undefined}
                aria-pressed={active}
                onClick={() => selectDemo(demo.id)}
                id={`select-demo-${demo.id}`}
                key={demo.id}
              >
                <span className={styles.cardIndex}>{demo.index}</span>
                <small>{demo.category}</small>
                <strong>{demo.title}</strong>
                <p>{demo.description}</p>
                <b aria-hidden="true">{active ? "SELECTED" : "OPEN ↘"}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.result} id="demo-result" aria-labelledby="selected-demo-title">
        <header className={styles.resultHeader}>
          <div className={styles.resultTitle}>
            <span>02 / LIVE RESULT · {selected.category}</span>
            <h2 id="selected-demo-title">{selected.title}</h2>
            <p>{selected.result.plan.layoutConcept}</p>
          </div>
          <dl className={styles.resultMetrics}>
            <div><dt>{selected.result.distinctivenessReport.score}</dt><dd>Design / 100</dd></div>
            <div><dt>{selected.result.engineeringResult.compositeScore}</dt><dd>Engineering / 100</dd></div>
            <div><dt>{selected.result.project.files.length}</dt><dd>Editable files</dd></div>
          </dl>
          <div className={styles.signature}>
            <small>Signature element</small>
            <strong>{selected.result.plan.signatureElement.name}</strong>
            <p>{selected.result.plan.signatureElement.justification}</p>
          </div>
        </header>
        <NativeHtmlWorkbench key={selected.id} project={selected.result.project} />
      </section>

      <footer className={styles.footer}>
        <p>Want a fourth proof? Generate your own brief in the workbench.</p>
        <Link href="/#workspace">Open Verve workbench <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
