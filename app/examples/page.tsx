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
        <span>CREATIVE ENGINE V3 / FROZEN RESULTS</span>
        <h1>Six briefs.<br /><em>No shared silhouette.</em></h1>
        <p>These are the actual runnable projects, not abstract card art. Open one to use it first, then inspect its direction, fingerprint, references, assets, and test receipt.</p>
      </header>
      <section className={styles.grid} aria-label="Verve examples">
        {PUBLIC_DEMOS.map((demo) => {
          const story = EXAMPLE_STORIES[demo.id];
          return (
            <Link href={`/examples/${demo.id}`} className={styles.card} data-example={demo.id} key={demo.id}>
              <DemoThumbnail project={demo.result.project} />
              <span>{demo.index} / {demo.category}</span>
              <h2>{demo.title}</h2>
              <p>{story.opening}</p>
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
