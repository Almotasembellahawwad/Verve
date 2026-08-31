import type { Metadata } from "next";
import Link from "next/link";
import { DemoThumbnail } from "@/components/DemoThumbnail";
import { PublicDemoFingerprintCollector } from "@/components/PublicDemoFingerprintCollector";
import { SignalNav } from "@/components/SignalNav";
import { PUBLIC_DEMOS } from "@/lib/demo/public-demo-gallery";
import { EXAMPLE_STORIES } from "@/lib/demo/example-stories";
import styles from "./examples.module.css";

export const metadata: Metadata = {
  title: "Examples — Verve",
  description: "Explore six runnable projects distributed across different visual and structural directions.",
};

export default function ExamplesPage() {
  return (
    <main className={styles.page}>
      <SignalNav />
      <PublicDemoFingerprintCollector />
      <header className={styles.hero}>
        <div><span>CREATIVE ENGINE V3 / FROZEN RESULTS</span><b>6 runnable projects · 6 experience models</b></div>
        <h1>Six different ways<br />a website can <em>behave.</em></h1>
        <p>Each example starts with a category default, changes the organizing idea, and ends in a different audience action. Use the real project first; the generation receipt comes second.</p>
      </header>
      <section className={styles.storyMethod} aria-label="How to read the examples">
        <article><span>01 / EXPECTATION</span><strong>What would the category normally produce?</strong></article>
        <article><span>02 / TURN</span><strong>Which domain idea reorganizes the experience?</strong></article>
        <article><span>03 / CONSEQUENCE</span><strong>What can the audience understand or do now?</strong></article>
      </section>
      <section className={styles.grid} aria-label="Verve examples">
        {PUBLIC_DEMOS.map((demo, index) => {
          const story = EXAMPLE_STORIES[demo.id];
          return (
            <Link href={`/examples/${demo.id}`} className={styles.card} data-example={demo.id} key={demo.id}>
              <DemoThumbnail project={demo.result.project} screenshotPath={`/demo-assets/screenshots/${demo.id}.jpg`} eager={index < 2} />
              <div className={styles.cardMeta}><span>{demo.index} / {demo.category}</span><i>{demo.receipt.direction.experienceModel}</i></div>
              <h2>{demo.title}</h2>
              <p>{story.opening}</p>
              <div className={styles.storyArc}>
                <div><span>EXPECTED</span><p>{story.categoryDefault}</p></div>
                <div><span>THE TURN</span><p>{story.decision}</p></div>
                <div><span>OUTCOME</span><p>{story.audienceMoment}</p></div>
              </div>
              <small>{demo.proof} · DISTANCE {demo.receipt.nearestExampleDistance.toFixed(2)}</small>
              <b>Open example →</b>
            </Link>
          );
        })}
      </section>
      <section className={styles.next}><div><span>YOUR PROJECT / NEXT</span><h2>Have a different brief?</h2></div><Link href="/create">Start creating →</Link></section>
    </main>
  );
}
