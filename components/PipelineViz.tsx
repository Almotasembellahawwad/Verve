"use client";

import { useState } from "react";
import styles from "./PipelineViz.module.css";

const JOURNEY = [
  { id: "01", actor: "YOU", title: "Give it intent", short: "Brief", question: "What should this project make someone understand, feel, and do?", decision: "Speak or write the brief in Arabic or English. Correct the transcript and attach the brand material you actually own.", artifact: "EDITABLE BRIEF", signal: "Your words remain the source of truth." },
  { id: "02", actor: "VERVE", title: "Find the position", short: "Thesis", question: "What visual direction belongs to this subject—and what would make it generic?", decision: "Verve maps the audience job, category gravity, archetype, forbidden conventions, and one signature element before asking a model to code.", artifact: "DESIGN THESIS", signal: "A reason to look this way, not a style preset." },
  { id: "03", actor: "AI + VERVE", title: "Build the system", short: "Generate", question: "How should the thesis become a runnable project?", decision: "Fast uses two core model calls for velocity. Studio adds bounded critique and repair when the project deserves deeper scrutiny.", artifact: "MULTI-FILE PROJECT", signal: "Next.js, React, or native HTML—not a stranded code block." },
  { id: "04", actor: "VERVE", title: "Run the evidence", short: "Verify", question: "Does the delivered result actually work?", decision: "The project is rendered where safe, checked for broken imports, interaction contracts, responsive overflow, accessibility, content risk, and export readiness.", artifact: "LIVE RECEIPT", signal: "Visible failures stay visible. Recovery stays possible." },
  { id: "05", actor: "YOU + AI", title: "Develop until it is yours", short: "Iterate", question: "What still does not feel right to you?", decision: "Ask for a change. The model stages a multi-file proposal. See it live, inspect the difference, accept or reject, then ask again.", artifact: "HUMAN-GATED PATCH", signal: "The AI never overwrites the accepted project on its own." },
  { id: "06", actor: "YOU", title: "Accept and ship", short: "Deliver", question: "Is this the version you are willing to own?", decision: "Restore earlier decisions, export the complete ZIP, or continue the loop. Shipping is a human decision—not a model stopping condition.", artifact: "PROJECT + HISTORY", signal: "Source, configuration, revisions, and evidence leave together." },
] as const;

export function PipelineViz() {
  const [active, setActive] = useState(0);
  const stage = JOURNEY[active];
  return (
    <div className={styles.journey}>
      <nav className={styles.steps} aria-label="Verve project journey">
        {JOURNEY.map((item, index) => <button type="button" key={item.id} aria-current={active === index ? "step" : undefined} onClick={() => setActive(index)}>
          <span>{item.id}</span><div><b>{item.short}</b><small>{item.actor}</small></div><i aria-hidden="true">{active === index ? "●" : "○"}</i>
        </button>)}
      </nav>
      <section className={styles.stage} key={stage.id} aria-live="polite">
        <div className={styles.stageMeta}><span>STAGE {stage.id} / 06</span><b>{stage.actor}</b></div>
        <h3>{stage.title}</h3>
        <blockquote>{stage.question}</blockquote>
        <p>{stage.decision}</p>
        <div className={styles.artifact}><span>{stage.artifact}</span><strong>{stage.signal}</strong><i aria-hidden="true">V/{stage.id}</i></div>
      </section>
      <div className={styles.flow} aria-label="Journey summary">{JOURNEY.map((item, index) => <button type="button" onClick={() => setActive(index)} data-active={active === index || undefined} key={item.id}><span>{item.id}</span><b>{item.short}</b></button>)}</div>
    </div>
  );
}
