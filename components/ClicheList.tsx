"use client";

import { useState, useRef } from "react";
import styles from "./ClicheList.module.css";

type ClicheEntry = {
  id: string;
  category: string;
  pattern: string;
  description: string;
  example_values: string[];
  severity: string;
  date_observed: string;
  tags: string[];
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const CATEGORIES = ["all", "color", "typography", "layout", "motion", "copy"];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  color: "Color",
  typography: "Type",
  layout: "Layout",
  motion: "Motion",
  copy: "Copy",
};

import { useEffect } from "react";

export function ClicheList() {
  const [cliches, setCliches] = useState<ClicheEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  // Microscope Lens: track which card is focused
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/cliches")
      .then((r) => r.json())
      .then((d) => {
        const sorted = [...(d.cliches as ClicheEntry[])].sort(
          (a, b) =>
            (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 2) -
            (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 2)
        );
        setCliches(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === "all"
      ? cliches.length
      : cliches.filter((c) => c.category === cat).length;
    return acc;
  }, {});

  const filtered = filter === "all" ? cliches : cliches.filter((c) => c.category === filter);

  // Microscope Lens: 150ms delay before activating to avoid accidental triggers
  const handleCardEnter = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setFocusedId(id), 150);
  };

  const handleCardLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setFocusedId(null), 100);
  };

  return (
    <div className={styles.wrapper}>
      {/* Filter bar with count badges */}
      <div className={styles.filterBar} role="tablist" aria-label="Filter clichÃ©s by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            className={`${styles.filterBtn} ${filter === cat ? styles.filterActive : ""}`}
            onClick={() => setFilter(cat)}
            aria-selected={filter === cat}
            id={`filter-${cat}`}
          >
            {CATEGORY_LABELS[cat]}
            {!loading && counts[cat] > 0 && (
              <span className={styles.filterCount}>{counts[cat]}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className="cursor-blink">loading blocklist</span>
        </div>
      ) : (
        <div
          className={`${styles.grid} ${focusedId ? styles.gridDimmed : ""}`}
          role="tabpanel"
          aria-labelledby={`filter-${filter}`}
        >
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`${styles.card} ${focusedId === c.id ? styles.cardFocused : ""} ${focusedId && focusedId !== c.id ? styles.cardDimmed : ""}`}
              onMouseEnter={() => handleCardEnter(c.id)}
              onMouseLeave={handleCardLeave}
              onFocus={() => handleCardEnter(c.id)}
              onBlur={handleCardLeave}
            >
              <div className={styles.cardHeader}>
                <span className={`${styles.severity} ${styles[`sev-${c.severity}`]}`}>
                  {c.severity}
                </span>
                <span className={styles.category}>{c.category}</span>
                <span className={styles.id}>{c.id}</span>
              </div>
              <h3 className={styles.pattern}>{c.pattern}</h3>
              <p className={styles.description}>{c.description}</p>
              <div className={styles.examples}>
                {c.example_values.slice(0, 3).map((v) => (
                  <code key={v} className={styles.example}>
                    {v}
                  </code>
                ))}
              </div>
              <div className={styles.tags}>
                {c.tags.map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.contribute}>
        <p className="muted-text">
          Missing a pattern? The blocklist grows with community PRs.
        </p>
        <a
          href="https://github.com/mohasbks/Verve/blob/main/docs/CONTRIBUTING.md"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.contributeLink}
        >
          Add a clichÃ© pattern â†’
        </a>
      </div>
    </div>
  );
}
