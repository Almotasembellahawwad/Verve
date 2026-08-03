"use client";

import styles from "./PipelineViz.module.css";

const STEPS = [
  {
    id: "01",
    name: "Brief Analyzer",
    description: "Extracts subject, audience, primary job, tone, and industry. Forces specificity before anything visual is considered.",
    module: "brief-analyzer.ts",
  },
  {
    id: "02",
    name: "Cliché Blocklist",
    description: "Checks brief and existing code against 20+ known AI-design tells. Injects a blocklist into every downstream prompt.",
    module: "blocklist-filter.ts",
  },
  {
    id: "03",
    name: "Design Plan",
    description: "Generates a full token system: 4-6 colors derived from subject matter, type pairing with justification, layout concept, and exactly ONE signature element.",
    module: "plan-generator.ts",
  },
  {
    id: "04",
    name: "Adversarial Critique",
    description: "A second, isolated LLM call asks: 'Would a generic prompt produce this same plan?' If it flags >3 elements as defaults, the plan is rejected and regenerated. Capped at 2 cycles.",
    module: "critique-loop.ts",
  },
  {
    id: "05",
    name: "Code Generation",
    description: "Only after the plan passes critique: full component code. Responsive, accessible, prefers-reduced-motion aware. No stubs.",
    module: "code-generator.ts",
  },
  {
    id: "06",
    name: "Distinctiveness Score",
    description: "Outputs a 0-100 score with grade, critique transcript, what was avoided, what remains — surfaced to you, not hidden.",
    module: "scorer.ts",
  },
];

export function PipelineViz() {
  return (
    <div className={styles.pipeline}>
      {STEPS.map((step, i) => (
        <div key={step.id} className={styles.step}>
          <div className={styles.stepLeft}>
            <div className={styles.stepId}>{step.id}</div>
            {i < STEPS.length - 1 && (
              <div className={styles.connector} aria-hidden="true">
                <div className={styles.connectorLine} />
                <div className={styles.connectorArrow}>↓</div>
              </div>
            )}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <h3 className={styles.stepName}>{step.name}</h3>
              <code className={styles.stepModule}>{step.module}</code>
            </div>
            <p className={styles.stepDesc}>{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
