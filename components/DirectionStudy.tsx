"use client";

import { useId, useState, type CSSProperties } from "react";
import type { DesignDirectionCandidate } from "@/lib/domain/design-direction";
import type { LocalOwnedAsset } from "@/lib/project/brand-kit";
import type { DirectionStudy, StudyEntry } from "@/lib/engine/direction-study";
import styles from "./DirectionStudy.module.css";

type Props = { candidate: DesignDirectionCandidate; study: DirectionStudy; assets: LocalOwnedAsset[]; interactive?: boolean };

/** Six inexpensive, content-bound studies, not six templates for code generation. */
export default function DirectionStudyView({ candidate, study, assets, interactive = false }: Props) {
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const id = useId();
  const { context, colors } = study;
  const { entries, heading, locale } = context;
  const ar = locale === "ar";
  const inspected = entries.find((entry) => entry.id === inspectedId) ?? entries[0];
  const model = candidate.descriptors.experienceModel;
  const image = study.media === "available" ? assets.find((asset) => asset.kind === "image" && asset.mediaType !== "image/svg+xml") : undefined;
  const variables = {
    "--study-surface": colors.surface, "--study-raised": colors.surfaceRaised,
    "--study-ink": colors.textPrimary, "--study-muted": colors.textMuted, "--study-accent": colors.accent,
    "--study-display": candidate.identity.displayTypeface, "--study-body": candidate.identity.bodyTypeface,
  } as CSSProperties;
  const select = (entry: StudyEntry, index: number) => {
    const content = <><span className={styles.ordinal}>{String(index + 1).padStart(2, "0")}</span><span>{entry.kind === "record" ? entry.label : entry.text}</span></>;
    return interactive ? <button type="button" key={entry.id} className={styles.choice} aria-pressed={inspected?.id === entry.id} aria-controls={`${id}-detail`} onClick={() => setInspectedId(entry.id)}>{content}</button>
      : <div key={entry.id} className={styles.choice} data-active={inspected?.id === entry.id}>{content}</div>;
  };
  const title = <h4 className={styles.title}>{heading}</h4>;
  const evidence = inspected && <div className={styles.evidence} id={`${id}-detail`} aria-live={interactive ? "polite" : undefined}>
    <span className={styles.eyebrow}>{inspected.kind === "record" ? ar ? "مواصفات من البريف" : "Specification from brief" : ar ? "النص المصدر" : "Source excerpt"}</span>
    {inspected.kind === "record" && <h5>{inspected.label}</h5>}
    {inspected.attributes.length ? <dl className={styles.specs}>{inspected.attributes.map((attribute, index) => <div key={`${attribute.label}-${index}`}><dt>{attribute.label}</dt><dd dir="auto">{attribute.value}</dd></div>)}</dl> : <p dir="auto">{inspected.text}</p>}
  </div>;
  const media = image && <figure className={styles.media}>
    {/* eslint-disable-next-line @next/next/no-img-element -- approved, browser-local bytes, never a remote hotlink */}
    <img src={`data:${image.mediaType};base64,${image.content}`} alt={image.alt} />
    <figcaption>{ar ? "صورة المستخدم · لم يُحدّد ارتباطها بسجل" : "User-supplied image · record assignment not established"}</figcaption>
  </figure>;
  const labels = context.evidence.comparisonDimensions.map((dimension) => dimension.label).slice(0, 3);
  const columns = labels.length ? labels : [...new Set(entries.flatMap((entry) => entry.attributes.map((attribute) => attribute.label)))].slice(0, 3);

  return <figure className={`${styles.study} ${interactive ? styles.expanded : styles.thumbnail}`} style={variables} dir={ar ? "rtl" : "ltr"} lang={locale} data-testid="direction-study" data-experience={model} data-density={candidate.descriptors.density} data-opening={candidate.descriptors.openingMode} data-motion={candidate.descriptors.motionRole}>
    <div className={styles.stage} role={interactive ? undefined : "img"} aria-label={interactive ? undefined : `${candidate.concept}: content-aware ${model} study; ${heading}`}>
      <div className={styles.masthead}><span>{ar ? "دراسة اتجاه" : "Direction study"}</span><span>{ar ? "محتوى البريف" : "Brief content"}</span></div>
      {model === "narrative-scroll" && <div className={styles.narrative}>
        <div className={styles.storyOpening}>{title}{media}</div>
        <div className={styles.chapter}>{evidence}</div>
        <nav className={styles.choices} aria-label={ar ? "فحص فصول الدراسة" : "Inspect study chapters"}>{entries.map(select)}</nav>
      </div>}
      {model === "spatial-map" && <div className={styles.spatial}>
        {title}<div className={styles.field}>{entries.map(select)}</div>
        <div className={styles.spatialDetail}>{media}{evidence}</div>
        <p className={styles.note}>{ar ? "حقل تخطيط مفاهيمي؛ ليس خريطة جغرافية." : "Conceptual layout field, not geographic coordinates."}</p>
      </div>}
      {model === "task-workbench" && <div className={styles.workbench}>
        <aside className={styles.rail}>{ar ? "المصدر" : "Source"}<span>{ar ? "البريف" : "Brief"}</span></aside>
        <div className={styles.workSurface}>{title}
          <div className={styles.tableScroll}><table><caption>{ar ? "القيم المقدّمة فقط" : "Only supplied values"}</caption><thead><tr><th scope="col">{ar ? "السجل" : "Record"}</th>{columns.length ? columns.map((column) => <th scope="col" key={column}>{column}</th>) : <th scope="col">{ar ? "المصدر" : "Source"}</th>}</tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><th scope="row">{interactive ? <button type="button" onClick={() => setInspectedId(entry.id)} aria-pressed={inspected?.id === entry.id} aria-controls={`${id}-detail`}>{entry.label}</button> : entry.label}</th>{columns.length ? columns.map((column) => <td key={column} dir="auto">{entry.attributes.find((attribute) => attribute.label === column)?.value ?? (ar ? "غير مقدّم" : "Not supplied")}</td>) : <td dir="auto">{entry.text}</td>}</tr>)}</tbody></table></div>
          {evidence}{media}
        </div>
      </div>}
      {model === "guided-conversation" && <div className={styles.guided}>
        <span className={styles.eyebrow}>{ar ? "اقرأ ← اختر ← افحص" : "Read → choose → inspect"}</span>
        {title}<p className={styles.question}>{ar ? "أي معلومة تريد فحصها؟" : "Which information do you need to inspect?"}</p>
        <div className={styles.choices}>{entries.map(select)}</div>{evidence}{media}
      </div>}
      {model === "collection-browser" && <div className={styles.collection}>
        {title}{media}<div className={styles.collectionGrid}>{entries.map((entry, index) => <div key={entry.id} className={styles.object}>{select(entry, index)}<span className={styles.objectDetail} dir="auto">{entry.attributes[0]?.value ?? (ar ? "مقتطف من البريف" : "Source brief excerpt")}</span></div>)}</div>
        <div className={styles.collectionDetail}>{evidence}</div>
      </div>}
      {model === "live-canvas" && <div className={styles.canvas}>
        <span className={styles.eyebrow}>{ar ? "فحص الكائن" : "Object inspection"}</span>{title}
        <div className={styles.domainObject}>{media}{inspected?.attributes.length ? <div className={styles.specimen}>{inspected.attributes.slice(0, detail ? 16 : 2).map((attribute, index) => <div key={index}><span>{attribute.label}</span><strong dir="auto">{attribute.value}</strong></div>)}</div> : evidence}</div>
        {interactive && inspected?.attributes.length ? <button className={styles.reveal} type="button" aria-expanded={detail} onClick={() => setDetail(!detail)}>{detail ? ar ? "اختصار المواصفات" : "Condense specification" : ar ? "إظهار جميع المواصفات" : "Reveal full specification"}</button> : null}
        <div className={styles.choices}>{entries.map(select)}</div>
      </div>}
      {!entries.length && <p className={styles.note}>{ar ? "لا يوجد محتوى مقدّم مناسب لهذه المعاينة." : "No suitable supplied content for this preview."}</p>}
    </div>
    <figcaption className={styles.caption}>{ar ? "دراسة محتوى وبنية · ليست موقعًا مولّدًا" : "Content + composition study · not a generated site"}</figcaption>
  </figure>;
}
