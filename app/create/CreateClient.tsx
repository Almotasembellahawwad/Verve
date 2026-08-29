"use client";

import { useState } from "react";
import ComparePanel from "@/components/ComparePanel";
import CritiquePanel from "@/components/CritiquePanel";
import GeneratePanel from "@/components/GeneratePanel";
import { SignalNav } from "@/components/SignalNav";
import styles from "./create.module.css";

type CreateTool = "generate" | "critique" | "compare";

const TOOL_COPY: Record<CreateTool, { eyebrow: string; title: string; body: string }> = {
  generate: { eyebrow: "CREATE / NEW PROJECT", title: "What are you building?", body: "Start with the intent. Verve will turn it into a runnable project you can inspect and refine." },
  critique: { eyebrow: "REVIEW / EXISTING SITE", title: "What should be stronger?", body: "Review an existing page against Verve’s design and engineering contracts." },
  compare: { eyebrow: "COMPARE / TWO DIRECTIONS", title: "Which direction deserves to continue?", body: "Compare two implementations under one explicit evaluation frame." },
};

export default function CreateClient() {
  const [tool, setTool] = useState<CreateTool>("generate");
  const copy = TOOL_COPY[tool];

  return (
    <main className={styles.page}>
      <SignalNav />
      <header className={styles.header}>
        <div><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.body}</p></div>
        {tool !== "generate" && <button type="button" onClick={() => setTool("generate")}>← Back to create</button>}
      </header>

      <section className={styles.workspace} aria-label={`${tool} workspace`}>
        {tool === "generate" && <GeneratePanel />}
        {tool === "critique" && <CritiquePanel />}
        {tool === "compare" && <ComparePanel />}
      </section>

      {tool === "generate" && (
        <aside className={styles.otherTools} aria-labelledby="other-tools-title">
          <div><span>ALREADY HAVE A DIRECTION?</span><h2 id="other-tools-title">Use Verve as a reviewer.</h2></div>
          <button type="button" onClick={() => { setTool("critique"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><strong>Review an existing site</strong><span>Find visual and engineering weaknesses →</span></button>
          <button type="button" onClick={() => { setTool("compare"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><strong>Compare two directions</strong><span>Choose what deserves to continue →</span></button>
        </aside>
      )}
    </main>
  );
}
