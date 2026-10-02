"use client";

import { useEffect, useId, useRef } from "react";
import type { DesignDirectionCandidate } from "@/lib/domain/design-direction";
import type { LocalOwnedAsset } from "@/lib/project/brand-kit";
import { directionStudyLabel, type DirectionStudy } from "@/lib/engine/direction-study";
import DirectionStudyView from "./DirectionStudy";
import styles from "./DirectionStudyDialog.module.css";

export default function DirectionStudyDialog({ candidate, study, assets, disabled, onClose, onChoose }: {
  candidate: DesignDirectionCandidate; study: DirectionStudy; assets: LocalOwnedAsset[]; disabled: boolean;
  onClose: () => void; onChoose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  const ar = study.context.locale === "ar";
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-title`} onClose={onClose} onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }}>
    <div className={styles.shell}>
      <header className={styles.header}><div><span>ART-DIRECTION STUDY / {candidate.descriptors.experienceModel}</span><h3 id={`${id}-title`}>{directionStudyLabel(candidate)}</h3></div><button type="button" onClick={() => ref.current?.close()} aria-label="Close direction study" autoFocus>Close ×</button></header>
      <p className={styles.disclosure}>{ar ? "هذه دراسة محلية لمحتوى البريف والهوية والبنية، لا معاينة للموقع النهائي. التفاعلات للفحص فقط؛ لم يحدث حجز أو إرسال أو شراء." : "A local study of brief content, identity and structure, not a final-site preview. Interactions inspect supplied material only; no booking, submission or purchase occurs."}</p>
      <div className={styles.body}>
        <DirectionStudyView candidate={candidate} study={study} assets={assets} interactive />
        <aside className={styles.thesis}><h4>{ar ? "فرضية الاتجاه" : "Direction thesis"}</h4><details><summary>Full concept</summary><p>{candidate.concept}</p></details><dl>
          <div><dt>Focal material</dt><dd dir="auto">{study.context.heading}</dd></div>
          <div><dt>Spatial rhythm</dt><dd>{candidate.dimensions.spatialRhythm}</dd></div>
          <div><dt>Type contrast</dt><dd>{candidate.dimensions.typographyRole}</dd></div>
          <div><dt>Image language</dt><dd>{candidate.dimensions.mediaStrategy}</dd></div>
          <div><dt>State mechanism</dt><dd>{candidate.dimensions.signatureMechanism}</dd></div>
        </dl>
          <p>Media: {study.media}. {study.media === "available" ? "Only user-supplied raster bytes are shown; no factual record association is inferred." : "No stock search or generated photography is performed at this stage."}</p>
          <p>{study.context.entries.length} source {study.context.entries[0]?.kind === "record" ? "records" : "excerpts"} shown. Declared totals do not create missing records.</p>
          {study.warnings.length > 0 && <div className={styles.warnings}><h4>{ar ? "ما يحتاج استكمالًا" : "Needs completion"}</h4><ul>{study.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
          <p className={styles.limit}>The schematic layout is not a generation template, a measured quality score, or evidence of final visual fidelity.</p>
        </aside>
      </div>
      <footer className={styles.footer}><span>6 lightweight studies → 1 generated project</span><button type="button" disabled={disabled} onClick={onChoose}>Choose this direction</button></footer>
    </div>
  </dialog>;
}
