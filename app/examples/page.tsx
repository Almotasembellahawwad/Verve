import type { Metadata } from "next";
import Link from "next/link";
import { SignalNav } from "@/components/SignalNav";
import { PUBLIC_DEMOS } from "@/lib/demo/public-demo-gallery";
import { EXAMPLE_STORIES } from "@/lib/demo/example-stories";
import styles from "./examples.module.css";

export const metadata: Metadata = {
  title: "Examples — Verve",
  description: "Explore three runnable projects and the design decision that makes each one distinct.",
};

export default function ExamplesPage() {
  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.hero}>
        <span>EXAMPLES / RUNNABLE PROJECTS</span>
        <h1>Three briefs.<br /><em>Three clear decisions.</em></h1>
        <p>Choose one project. Experience the result first, then inspect the brief, the category default, and the decision that changed its direction.</p>
      </header>
      <section className={styles.grid} aria-label="Verve examples">
        {PUBLIC_DEMOS.map((demo) => {
          const story = EXAMPLE_STORIES[demo.id];
          return (
            <Link href={`/examples/${demo.id}`} className={styles.card} data-example={demo.id} key={demo.id}>
              <div className={styles.visual} aria-hidden="true"><i /><i /><i /></div>
              <span>{demo.index} / {demo.category}</span>
              <h2>{demo.title}</h2>
              <p>{story.opening}</p>
              <b>Open example →</b>
            </Link>
          );
        })}
      </section>
      <section className={styles.next}><div><span>YOUR PROJECT / NEXT</span><h2>Have a different brief?</h2></div><Link href="/create">Start creating →</Link></section>
    </main>
  );
}
