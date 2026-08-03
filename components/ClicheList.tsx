"use client";

import { useState, useEffect } from "react";
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

export function ClicheList() {
  const [cliches, setCliches] = useState<ClicheEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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

  const filtered = filter === "all" ? cliches : cliches.filter((c) => c.category === filter);

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterBar} role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${filter === cat ? styles.filterActive : ""}`}
            onClick={() => setFilter(cat)}
            aria-pressed={filter === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className="cursor-blink">loading blocklist</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((c) => (
            <div key={c.id} className={`${styles.card} ${styles[`severity-${c.severity}`]}`}>
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
          href="https://github.com/verve-project/verve/blob/main/docs/CONTRIBUTING.md"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.contributeLink}
        >
          Add a cliché pattern →
        </a>
      </div>
    </div>
  );
}
