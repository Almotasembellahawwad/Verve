"use client";

import { useState, useEffect, useRef } from "react";
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
    name: "Context Field",
    description: "Sources assets, scans 21 cliché families, and maps the competitive field in parallel before choosing a visual direction.",
    module: "Assets + Blocklist + Field",
  },
  {
    id: "02.5",
    name: "Brand Archetype",
    description: "Resolves the emotional job and archetype constraints locally in Fast mode or through a dedicated Studio review.",
    module: "brand-archetype-resolver.ts",
  },
  {
    id: "02.6",
    name: "Motion Language",
    description: "Derives easing, duration, and reduced-motion behavior from the archetype instead of adding generic float-and-fade animation.",
    module: "animation-language.ts",
  },
  {
    id: "03",
    name: "Plan + Adversarial Review",
    description: "Builds the token system and one signature element. Fast runs a local preflight; Studio asks whether a generic prompt could have produced the plan and loops failed plans back.",
    module: "PlanGenerator + Critique",
  },
  {
    id: "04",
    name: "Contrast Enforcement",
    description: "Tests every intended text/background pairing and makes one stable palette correction where WCAG AA would otherwise fail.",
    module: "contrast-fixer.ts",
  },
  {
    id: "05",
    name: "Code Generation",
    description: "Implements the approved thesis as responsive Next.js, React, or HTML using only verified assets and explicit interaction rules.",
    module: "code-generator.ts",
  },
  {
    id: "05.5",
    name: "Syntax + Repair",
    description: "Parses the final TSX with TypeScript and checks the entry contract. Studio can spend one bounded repair call; Fast reports unresolved risks without hiding them.",
    module: "code-quality-loop.ts",
  },
  {
    id: "06",
    name: "Dual Score",
    description: "Scores the delivered code—not the brief—across Norman’s three design levels and a separate engineering quality axis.",
    module: "Scorer + Engineering",
  },
  {
    id: "07",
    name: "Project Assembly",
    description: "Builds the complete stack scaffold, resolves package imports, writes configuration and README files, computes readiness, and prepares the live sandbox and ZIP.",
    module: "project-builder.ts",
  },
];

export function PipelineViz() {
  const [activeStep, setActiveStep] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered sequential activation of pipeline steps
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && activeStep < 0) {
          // Start cascading activation when pipeline enters view
          let step = 0;
          const interval = setInterval(() => {
            setActiveStep(step);
            step++;
            if (step >= STEPS.length) clearInterval(interval);
          }, 180);
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeStep]);

  return (
    <div className={styles.pipeline} ref={containerRef}>
      {STEPS.map((step, i) => (
        <div
          key={step.id}
          className={`${styles.step} ${i <= activeStep ? styles.stepActive : ""}`}
          style={{ transitionDelay: `${i * 60}ms` }}
          onMouseEnter={() => setActiveStep(Math.max(activeStep, i))}
        >
          <div className={styles.stepLeft}>
            <div className={`${styles.stepId} ${i <= activeStep ? styles.stepIdActive : ""}`}>
              {i <= activeStep ? (
                <span className={styles.stepIdNum}>{step.id}</span>
              ) : (
                <span className={styles.stepIdNum}>{step.id}</span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={styles.connector} aria-hidden="true">
                {/* Glowing progress fill — amber travels down as steps activate */}
                <div className={styles.connectorLine}>
                  <div
                    className={`${styles.connectorFill} ${i < activeStep ? styles.connectorFillActive : ""}`}
                  />
                </div>
                <div className={`${styles.connectorArrow} ${i < activeStep ? styles.connectorArrowActive : ""}`}>↓</div>
              </div>
            )}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <h3 className={styles.stepName}>{step.name}</h3>
              <code className={`${styles.stepModule} ${i <= activeStep ? styles.stepModuleActive : ""}`}>
                {step.module}
              </code>
            </div>
            <p className={styles.stepDesc}>{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
