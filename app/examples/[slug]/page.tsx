import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DemoLiveCanvas from "@/components/DemoLiveCanvas";
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
  const receipt = demo.receipt;

  return (
    <main className={styles.page}>
      <section className={styles.preview} aria-labelledby="result-title">
        <header className={styles.resultBar}>
          <Link href="/examples">VERVE / Gallery</Link>
          <div><span>{demo.index} / {demo.category}</span><h1 id="result-title">{demo.title}</h1></div>
          <OpenInEditorButton demoId={demo.id as PublicDemoId} className={styles.barButton} />
        </header>
        <DemoLiveCanvas project={demo.result.project} immersive />
      </section>

      <details className={styles.drawer}>
        <summary>
          <div><span>BRIEF / DECISIONS / DIVERSITY EVIDENCE</span><strong>Inspect the generation receipt</strong></div>
          <b aria-hidden="true">+</b>
        </summary>
        <div className={styles.drawerBody}>
          <article className={styles.narrative}>
            <span>THE BRIEF</span><h2>{story.opening}</h2><p>“{demo.brief}”</p><small>{story.audienceMoment}</small>
          </article>
          <article className={styles.narrative}>
            <span>THE CHOSEN DIRECTION</span><h2>{demo.result.plan.signatureElement.name}</h2><p>{story.decision}</p><small><b>Anti-reference:</b> {story.categoryDefault}</small>
          </article>
          <section className={styles.receipt} aria-label="Creative Engine receipt">
            <header><span>CREATIVE ENGINE RECEIPT</span><b>{receipt.engineVersion}</b></header>
            <dl>
              <div><dt>Class</dt><dd>{receipt.direction.creativityClass}</dd></div><div><dt>Experience</dt><dd>{receipt.direction.experienceModel}</dd></div>
              <div><dt>Topology</dt><dd>{receipt.direction.topology}</dd></div><div><dt>Opening</dt><dd>{receipt.direction.opening}</dd></div>
              <div><dt>Navigation</dt><dd>{receipt.direction.navigation}</dd></div><div><dt>Nearest distance</dt><dd>{receipt.nearestExampleDistance.toFixed(2)}</dd></div>
            </dl>
            <div className={styles.fingerprint}>
              <div><span>VISUAL FINGERPRINT</span><p>{receipt.fingerprint.occupancy}</p><p>{receipt.fingerprint.colorRhythm}</p></div>
              <div><span>ABSTRACT RETRIEVAL</span><p>Near: {receipt.abstractReferences.near}</p><p>Remote: {receipt.abstractReferences.remote.join(" + ")}</p><p>Avoid: {receipt.abstractReferences.antiReference}</p></div>
            </div>
            <div className={styles.checks}><span>360 / 768 / 1440 verified</span><span>0 critical accessibility issues</span><span>0 horizontal overflow</span><span>{receipt.assets.manifest}</span></div>
            <div className={styles.palette}>{demo.result.plan.colorPalette.slice(0, 4).map((color) => <i key={color.hex} style={{ background: color.hex }} title={`${color.name} · ${color.role}`} />)}</div>
          </section>
        </div>
      </details>

      <section className={styles.continue}>
        <div><span>TAKE IT APART</span><h2>Inspect the real files, then make it yours.</h2><p>The public example is frozen with its engine receipt and asset manifest. Opening it creates an editable local copy.</p></div>
        <OpenInEditorButton demoId={demo.id as PublicDemoId} className={styles.editButton} />
      </section>
    </main>
  );
}
