"use client";

import { useId, useMemo, useState } from "react";
import { buildHtmlPreviewDocument } from "@/lib/project/html-preview";
import type { GeneratedProject } from "@/lib/project/types";
import styles from "./DemoLiveCanvas.module.css";

type Viewport = "mobile" | "desktop";

export default function DemoLiveCanvas({ project }: { project: GeneratedProject }) {
  const probeId = useId();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const document = useMemo(() => buildHtmlPreviewDocument(project, `story-${probeId}`), [probeId, project]);

  return (
    <section className={styles.canvas} aria-label={`${project.name} live experience`}>
      <header>
        <div><span>LIVE EXPERIENCE</span><b>{project.name}</b></div>
        <div className={styles.controls} role="group" aria-label="Preview size">
          <button type="button" data-active={viewport === "desktop" || undefined} onClick={() => setViewport("desktop")}>Desktop / 1440</button>
          <button type="button" data-active={viewport === "mobile" || undefined} onClick={() => setViewport("mobile")}>Mobile / 390</button>
        </div>
      </header>
      <div className={styles.stage} data-viewport={viewport}>
        <iframe title={`${project.name} story preview`} sandbox="allow-scripts" srcDoc={document} />
      </div>
      <footer><span>RUNNING NATIVE HTML</span><span>INTERACTIONS ENABLED · ISOLATED FRAME</span></footer>
    </section>
  );
}
