"use client";
// components/OnboardingModal.tsx
// First-run onboarding — shown once via localStorage flag
// 3 slides explaining Verve's core value propositions
// Dismissible with "Start designing" button

import { useEffect, useState } from "react";
import styles from "./OnboardingModal.module.css";

const SEEN_KEY = "verve_onboarding_seen_v2";

const SLIDES = [
  {
    id: 1,
    icon: "◈",
    iconColor: "var(--brand)",
    title: "Verve is a design intelligence pipeline",
    body: "It exposes 9 observable stages — archetype analysis, competitive field mapping, adversarial critique, contrast enforcement, syntax repair, and dual scoring — around the code generation step.",
    subtext: "Not a template generator. A system that thinks before it designs.",
  },
  {
    id: 2,
    icon: "⚑",
    iconColor: "var(--brand)",
    title: "Generic defaults are the enemy",
    body: "The pipeline maintains 21 curated cliché families with 67 concrete detection signals, plus a competitive-field dataset of dominant industry patterns.",
    subtext: "Every design is measured against what the field already does — then forced to differentiate.",
  },
  {
    id: 3,
    icon: "▶",
    iconColor: "var(--brand)",
    title: "Write a specific brief. Get a distinctive design.",
    body: "The quality of the output is proportional to the specificity of the input. Generic brief → generic plan (and the critique loop will flag it). Specific brief → archetype-matched, competitively-aware design.",
    subtext: "Use the sample briefs to see the difference. Start with 'Interior Design' or 'Motion Portfolio'.",
  },
];

export default function OnboardingModal() {
  const [visible,     setVisible]     = useState(false);
  const [slide,       setSlide]       = useState(0);
  const [exiting,     setExiting]     = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash immediately on page load
    const t = setTimeout(() => {
      if (!localStorage.getItem(SEEN_KEY)) {
        setVisible(true);
      }
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setExiting(true);
    localStorage.setItem(SEEN_KEY, "1");
    setTimeout(() => setVisible(false), 300);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (slide > 0) setSlide((s) => s - 1);
  };

  if (!visible) return null;

  const current = SLIDES[slide];

  return (
    <div
      className={`${styles.overlay} ${exiting ? styles.exiting : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Verve introduction"
    >
      <div className={styles.backdrop} onClick={dismiss} />

      <div className={styles.modal}>
        {/* Progress dots */}
        <div className={styles.dots} aria-label="Slide progress">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              className={`${styles.dot} ${i === slide ? styles.dotActive : ""}`}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === slide}
            />
          ))}
        </div>

        {/* Content */}
        <div className={styles.content} key={slide}>
          <div className={styles.icon} style={{ color: current.iconColor }}>
            {current.icon}
          </div>
          <h2 className={styles.title}>{current.title}</h2>
          <p className={styles.body}>{current.body}</p>
          <p className={styles.subtext}>{current.subtext}</p>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {slide > 0 ? (
            <button className={styles.prevBtn} onClick={prev}>
              ← Back
            </button>
          ) : (
            <button className={styles.skipBtn} onClick={dismiss}>
              Skip
            </button>
          )}

          <button
            className={styles.nextBtn}
            onClick={next}
            id={slide === SLIDES.length - 1 ? "onboarding-start" : `onboarding-next-${slide}`}
          >
            {slide === SLIDES.length - 1 ? "Start designing →" : "Next →"}
          </button>
        </div>

        {/* Slide counter */}
        <div className={styles.counter} aria-hidden="true">
          {slide + 1} / {SLIDES.length}
        </div>
      </div>
    </div>
  );
}
