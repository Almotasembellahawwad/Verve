import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DemoLiveCanvas from "@/components/DemoLiveCanvas";
import { SignalNav } from "@/components/SignalNav";
import { EXAMPLE_STORIES } from "@/lib/demo/example-stories";
import { PUBLIC_DEMOS, type PublicDemoId } from "@/lib/demo/public-demo-gallery";
import OpenInEditorButton from "./OpenInEditorButton";
import styles from "./example.module.css";

export function generateStaticParams() {
  return PUBLIC_DEMOS.map((demo) => ({ slug: demo.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const demo = PUBLIC_DEMOS.find((item) => item.id === slug);
  return demo ? { title: `${demo.title} — Verve Example`, description: demo.description } : {};
}

export default async function ExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const demo = PUBLIC_DEMOS.find((item) => item.id === slug);
  if (!demo) notFound();
  const story = EXAMPLE_STORIES[demo.id];

  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.header}>
        <Link href="/examples">← All examples</Link>
        <span>{demo.index} / {demo.category}</span>
        <h1>{demo.title}</h1>
        <blockquote>{story.opening}</blockquote>
      </header>

      <section className={styles.live} aria-labelledby="live-title">
        <div><span>LIVE RESULT</span><h2 id="live-title">Experience it before<br />you inspect it.</h2><p>Scroll, resize, and use the actual project. The explanation comes after the result.</p></div>
        <DemoLiveCanvas project={demo.result.project} />
      </section>

      <section className={styles.decision} aria-labelledby="decision-title">
        <article><span>THE BRIEF</span><h2 id="decision-title">What the project needed to do</h2><p>“{demo.brief}”</p><small>{story.audienceMoment}</small></article>
        <article><span>CATEGORY DEFAULT</span><h2>What Verve refused</h2><p>{story.categoryDefault}</p><ul>{demo.result.distinctivenessReport.clichesAvoided.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article><span>THE DECISION</span><h2>{demo.result.plan.signatureElement.name}</h2><p>{story.decision}</p><small>{demo.result.plan.signatureElement.justification}</small></article>
      </section>

      <details className={styles.evidence}>
        <summary><div><span>PROJECT EVIDENCE</span><strong>Open design and engineering checks</strong></div><b>+</b></summary>
        <div className={styles.evidenceBody}>
          <dl>
            <div><dt>{demo.result.distinctivenessReport.score}</dt><dd>Distinctiveness</dd></div>
            <div><dt>{demo.result.engineeringResult.compositeScore}</dt><dd>Engineering</dd></div>
            <div><dt>{demo.result.restraintResult.restraintScore}</dt><dd>Restraint</dd></div>
            <div><dt>{demo.result.project.validation.score}</dt><dd>Validation</dd></div>
          </dl>
          <div><span>VISUAL SYSTEM</span><p>{demo.result.plan.layoutConcept}</p><p>{demo.result.plan.typePairing.display} + {demo.result.plan.typePairing.body}</p><div className={styles.palette}>{demo.result.plan.colorPalette.slice(0, 4).map((color) => <i key={color.hex} style={{ background: color.hex }} title={`${color.name} · ${color.role}`} />)}</div></div>
        </div>
      </details>

      <section className={styles.continue}><div><span>CONTINUE / YOUR DIRECTION</span><h2>The example is a starting point.</h2><p>Open it in the editor, ask for a change, preview the proposal, and decide what becomes part of the project.</p></div><OpenInEditorButton demoId={demo.id as PublicDemoId} className={styles.editButton} /></section>
    </main>
  );
}
