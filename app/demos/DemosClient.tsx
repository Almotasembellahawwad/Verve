"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DemoLiveCanvas from "@/components/DemoLiveCanvas";
import NativeHtmlWorkbench from "@/components/NativeHtmlWorkbench";
import { SignalNav } from "@/components/SignalNav";
import { DEFAULT_PUBLIC_DEMO_ID, PUBLIC_DEMOS, type PublicDemoId } from "@/lib/demo/public-demo-gallery";
import { launchProjectEditor } from "@/lib/client/editor-workspace";
import styles from "./demos.module.css";

const DEMO_STORIES = {
  architecture: {
    opening: "What if an architecture practice began with what must remain—not what it wants to add?",
    categoryDefault: "The category usually opens with immaculate renders, prestige language, and a grid of finished objects. It makes the architect look accomplished, but hides how decisions are made.",
    turn: "Verve reframed the practice around evidence. Coordinates, retention registers, material constraints, and a survey-first method turn adaptive reuse into an intellectual position.",
    audienceMoment: "A developer arrives expecting a portfolio. They leave understanding how Reframe decides whether a building should change at all.",
  },
  cairo: {
    opening: "What if a restaurant identity felt like a place before a single photograph arrived?",
    categoryDefault: "Hospitality templates depend on full-bleed food photography, fashionable serif type, and a reservation button floating above generic promises.",
    turn: "Verve made the menu, provenance, Arabic reading order, and one solar table-mark the visual system. Photography can deepen the world later without being asked to invent it.",
    audienceMoment: "A guest moves from atmosphere to dishes to story to visit details in the same rhythm they would discover the restaurant itself.",
  },
  carbon: {
    opening: "What if carbon software looked accountable before it looked sustainable?",
    categoryDefault: "Climate SaaS repeatedly reaches for leaf icons, green gradients, optimistic impact claims, and dashboard cards detached from the source of each number.",
    turn: "Verve centered an exception ledger: source, owner, status, and weekly action share one operational surface. Acid color marks state—not virtue.",
    audienceMoment: "A manufacturing operator sees where a number came from, who owns the exception, and what must happen next before reading any marketing claim.",
  },
} as const;

export default function DemosClient() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<PublicDemoId>(DEFAULT_PUBLIC_DEMO_ID);
  const selected = PUBLIC_DEMOS.find((demo) => demo.id === selectedId) ?? PUBLIC_DEMOS[0];
  const story = DEMO_STORIES[selected.id];

  const selectDemo = (demoId: PublicDemoId) => {
    setSelectedId(demoId);
    window.setTimeout(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("demo-result")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }, 0);
  };

  const develop = () => void launchProjectEditor(selected.result.project, "demo").then((href) => router.push(href));

  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.hero}>
        <div className={styles.rail} aria-hidden="true"><span>V</span><i /><span>03</span></div>
        <div className={styles.heroMeta}><span>PUBLIC STORY ROOM / V0.8</span><span>NO ACCOUNT · LIVE PROJECTS</span></div>
        <h1>Three briefs.<br /><em>Enter three different worlds.</em></h1>
        <p>Each project starts with a category convention, rejects it for a reason, builds one visual thesis, and ends as a working site you can explore and continue developing with AI.</p>
      </header>

      <section className={styles.chooser} aria-labelledby="choose-demo-title">
        <div className={styles.chooserHeading}>
          <span>01 / CHOOSE A STORY</span>
          <h2 id="choose-demo-title">Different industries.<br />No shared template.</h2>
        </div>
        <div className={styles.demoGrid}>
          {PUBLIC_DEMOS.map((demo) => {
            const active = demo.id === selected.id;
            return (
              <button type="button" className={styles.demoCard} data-active={active || undefined} data-demo={demo.id} aria-pressed={active} onClick={() => selectDemo(demo.id)} id={`select-demo-${demo.id}`} key={demo.id}>
                <span className={styles.cardIndex}>{demo.index}</span>
                <span className={styles.cardVisual} data-demo-visual aria-hidden="true"><i /><i /><i /></span>
                <small>{demo.category}</small><strong>{demo.title}</strong><p>{demo.description}</p>
                <em className={styles.proofLabel}>{demo.proof}</em><b aria-hidden="true">{active ? "READING" : "ENTER ↘"}</b>
              </button>
            );
          })}
        </div>
      </section>

      <article className={styles.story} id="demo-result" aria-labelledby="selected-demo-title">
        <header className={styles.storyOpening} data-demo={selected.id}>
          <div className={styles.storyIdentity}><span>02 / CASE STORY · {selected.category}</span><h2 id="selected-demo-title">{selected.title}</h2></div>
          <blockquote>{story.opening}</blockquote>
          <div className={styles.storyArchetype}><small>Emotional job</small><p>{selected.result.archetype.emotionalJob}</p><span>{selected.result.archetype.name} / {selected.result.archetype.secondaryId}</span></div>
        </header>

        <section className={styles.storyChapter}>
          <div className={styles.chapterIndex}><span>01</span><b>THE BRIEF</b></div>
          <p className={styles.briefQuote}>“{selected.brief}”</p>
          <aside><small>Audience transformation</small><p>{story.audienceMoment}</p></aside>
        </section>

        <section className={`${styles.storyChapter} ${styles.refusalChapter}`}>
          <div className={styles.chapterIndex}><span>02</span><b>THE REFUSAL</b></div>
          <div><h3>First, reject the costume.</h3><p>{story.categoryDefault}</p></div>
          <ul>{selected.result.distinctivenessReport.clichesAvoided.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section className={`${styles.storyChapter} ${styles.thesisChapter}`}>
          <div className={styles.chapterIndex}><span>03</span><b>THE DESIGN THESIS</b></div>
          <div><h3>{selected.result.plan.layoutConcept}</h3><p>{story.turn}</p></div>
          <div className={styles.systemReceipt}>
            <small>VISUAL SYSTEM</small>
            <div className={styles.palette}>{selected.result.plan.colorPalette.slice(0, 4).map((color) => <span key={color.hex} style={{ background: color.hex }} title={`${color.name} · ${color.role}`} />)}</div>
            <dl><div><dt>Display</dt><dd>{selected.result.plan.typePairing.display}</dd></div><div><dt>Body</dt><dd>{selected.result.plan.typePairing.body}</dd></div></dl>
          </div>
        </section>

        <section className={styles.signatureStory}>
          <span>04 / THE SIGNATURE MOMENT</span><h3>{selected.result.plan.signatureElement.name}</h3>
          <p>{selected.result.plan.signatureElement.description}</p><blockquote>{selected.result.plan.signatureElement.justification}</blockquote>
        </section>

        <section className={styles.experience}>
          <div className={styles.experienceHeading}><span>05 / EXPERIENCE THE RESULT</span><p>Do not judge a project from a thumbnail. Scroll it, resize it, use its interaction, then inspect the evidence.</p></div>
          <DemoLiveCanvas key={`canvas-${selected.id}`} project={selected.result.project} />
        </section>

        <section className={styles.evidenceStory}>
          <div><span>06 / THE RECEIPT</span><h3>A visual position.<br />With engineering underneath.</h3></div>
          <dl>
            <div><dt>{selected.result.distinctivenessReport.score}</dt><dd>Distinctiveness</dd></div>
            <div><dt>{selected.result.engineeringResult.compositeScore}</dt><dd>Engineering</dd></div>
            <div><dt>{selected.result.restraintResult.restraintScore}</dt><dd>Restraint</dd></div>
            <div><dt>{selected.result.project.validation.score}</dt><dd>Validation</dd></div>
          </dl>
          <div className={styles.developCta}><p>This is not the end state. Tell an AI model what you want changed, inspect its proposal live, and keep going until the project is yours.</p><button type="button" onClick={develop}>Continue in AI Studio <span>↗</span></button></div>
        </section>

        <details className={styles.projectAnatomy}>
          <summary><span>07 / INSPECT THE PROJECT</span><strong>Open every file, diagnostic, and export control</strong><b>+</b></summary>
          <NativeHtmlWorkbench key={`workbench-${selected.id}`} project={selected.result.project} />
        </details>
      </article>

      <footer className={styles.footer}><p>Want a fourth story? Start with your own brief.</p><Link href="/#workspace">Open Verve workbench <span aria-hidden="true">↗</span></Link></footer>
    </main>
  );
}
