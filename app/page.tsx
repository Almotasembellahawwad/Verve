import Link from "next/link";
import DemoLiveCanvas from "@/components/DemoLiveCanvas";
import { SignalNav } from "@/components/SignalNav";
import { PUBLIC_DEMOS } from "@/lib/demo/public-demo-gallery";
import styles from "./page.module.css";

export default function Home() {
  const featured = PUBLIC_DEMOS.find((demo) => demo.id === "carbon") ?? PUBLIC_DEMOS[0];

  return (
    <main className={styles.page}>
      <SignalNav />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>DISTINCTIVE WEB PROJECTS / HUMAN-CONTROLLED AI</span>
          <h1>From a brief to a website<br /><em>worth keeping.</em></h1>
          <p>Verve turns your intent into a runnable project, checks the result, and gives you an AI editor to refine it until it feels like yours.</p>
          <div className={styles.heroActions}>
            <Link href="/create" className={styles.primary}>Start creating <b aria-hidden="true">→</b></Link>
            <Link href="/examples" className={styles.secondary}>See an example</Link>
          </div>
          <div className={styles.trustLine} aria-label="Product facts">
            <span>No account</span><span>Your API key</span><span>Runnable files</span><span>Human approval</span>
          </div>
        </div>

        <aside className={styles.heroReceipt} aria-label="Verve workflow summary">
          <div className={styles.receiptTop}><span>VERVE / PROJECT FLOW</span><i>LIVE</i></div>
          <ol>
            <li><b>01</b><div><strong>Describe</strong><span>Start with the intent, audience, and constraints.</span></div></li>
            <li><b>02</b><div><strong>Generate</strong><span>Receive a complete, runnable project.</span></div></li>
            <li><b>03</b><div><strong>Refine</strong><span>Preview every AI change before accepting it.</span></div></li>
          </ol>
          <p>The model proposes. You decide.</p>
        </aside>
      </section>

      <section className={styles.flow} id="how-it-works" aria-labelledby="flow-title">
        <div className={styles.sectionIntro}>
          <span>HOW IT WORKS</span>
          <h2 id="flow-title">Three clear steps.<br />One project you control.</h2>
        </div>
        <ol className={styles.flowGrid}>
          <li><span>01</span><h3>Describe the goal</h3><p>Write or speak the brief. Add brand material only when it matters.</p></li>
          <li><span>02</span><h3>Run the result</h3><p>Verve builds real files, renders the project, and exposes important checks.</p></li>
          <li><span>03</span><h3>Make it yours</h3><p>Ask the AI editor for changes, inspect the proposal, then accept or reject.</p></li>
        </ol>
      </section>

      <section className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.featuredCopy}>
          <span>ONE LIVE EXAMPLE / {featured.category}</span>
          <h2 id="featured-title">{featured.title}</h2>
          <p>{featured.description}</p>
          <blockquote>“{featured.result.plan.layoutConcept}”</blockquote>
          <Link href={`/examples/${featured.id}`}>See the decision behind it <b aria-hidden="true">→</b></Link>
        </div>
        <div className={styles.featuredCanvas}>
          <DemoLiveCanvas project={featured.result.project} />
        </div>
      </section>

      <section className={styles.difference} aria-labelledby="difference-title">
        <div className={styles.sectionIntro}>
          <span>WHY VERVE</span>
          <h2 id="difference-title">Taste, code, and evidence<br />belong together.</h2>
        </div>
        <div className={styles.contracts}>
          <article><span>01</span><h3>A design thesis</h3><p>Verve resists category defaults and builds one coherent visual position.</p></article>
          <article><span>02</span><h3>A real project</h3><p>You receive editable files, dependencies, preview, validation, and export.</p></article>
          <article><span>03</span><h3>Your final decision</h3><p>AI changes stay staged until you inspect and explicitly accept them.</p></article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <span>YOUR BRIEF / NEXT</span>
        <h2>Start with the idea.<br /><em>Keep the project.</em></h2>
        <Link href="/create">Create a project <b aria-hidden="true">→</b></Link>
      </section>

      <footer className={styles.footer}>
        <div><strong>VERVE</strong><span>Open-source project intelligence.</span></div>
        <nav aria-label="Footer navigation"><Link href="/create">Create</Link><Link href="/examples">Examples</Link><Link href="/editor">Editor</Link><Link href="/docs">Docs</Link></nav>
        <a href="https://github.com/Almotasembellahawwad/Verve" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </footer>
    </main>
  );
}
