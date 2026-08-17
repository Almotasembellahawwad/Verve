"use client";
// components/HistoryDrawer.tsx
// Design History — slide-in drawer showing all past generations

import { useEffect, useState } from "react";
import styles from "./HistoryDrawer.module.css";
import { getHistory, deleteHistoryEntry, clearHistory, type HistoryEntry } from "@/lib/history";

type Props = {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
};

export default function HistoryDrawer({ open, onClose, onRestore }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  // Stable timestamp for timeAgo — updates every minute so labels refresh
  const [now, setNow] = useState(() => Date.now());

  // Sync entries from localStorage when drawer opens (external system read)
  useEffect(() => {
    if (open) { setEntries(getHistory()); } // eslint-disable-line react-hooks/set-state-in-effect
  }, [open]);

  // Update 'now' every minute so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteHistoryEntry(id);
    refresh();
  };

  const handleClear = () => {
    if (confirm("Clear all design history? This cannot be undone.")) {
      clearHistory();
      refresh();
    }
  };

  const gradeColor = (grade: string) => {
    const map: Record<string, string> = { S: "#A78BFA", A: "#34D399", B: "#FBBF24", C: "#F97316", D: "#FF5050" };
    return map[grade] ?? "rgba(255,255,255,0.4)";
  };

  const refresh = () => setEntries(getHistory());

  const timeAgo = (ts: number) => {
    const diff = now - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0)  return `${d}d ago`;
    if (h > 0)  return `${h}h ago`;
    if (m > 0)  return `${m}m ago`;
    return "just now";
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`${styles.drawer} ${open ? styles.open : ""}`}
        aria-label="Design history"
        role="complementary"
        id="history-drawer"
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>History</h2>
            <span className={styles.subtitle}>{entries.length} / 20 saved</span>
          </div>
          <div className={styles.headerActions}>
            {entries.length > 0 && (
              <button className={styles.clearBtn} onClick={handleClear} title="Clear all history">
                Clear all
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close history">
              ×
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◱</div>
            <p>No designs saved yet.<br />Generate one to see it here.</p>
          </div>
        ) : (
          <ul className={styles.list} role="list">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={styles.item}
                onClick={() => onRestore(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onRestore(entry)}
                aria-label={`Restore: ${entry.brief.slice(0, 60)}`}
              >
                {/* Grade badge */}
                <div
                  className={styles.grade}
                  style={{ color: gradeColor(entry.grade) }}
                  aria-label={`Grade ${entry.grade}`}
                >
                  {entry.grade}
                </div>

                <div className={styles.content}>
                  <div className={styles.brief} title={entry.brief}>
                    {entry.brief.slice(0, 80)}{entry.brief.length > 80 ? "…" : ""}
                  </div>

                  {/* Palette swatches */}
                  <div className={styles.palette} aria-label="Color palette">
                    {entry.palette.slice(0, 5).map((c) => (
                      <span
                        key={c.hex}
                        className={styles.swatch}
                        style={{ background: c.hex }}
                        title={`${c.name} ${c.hex}`}
                      />
                    ))}
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.score} style={{ color: gradeColor(entry.grade) }}>
                      {entry.score}/100
                    </span>
                    {entry.archetype !== "unknown" && (
                      <span className={styles.archetype}>{entry.archetype}</span>
                    )}
                    {entry.normanLevels && (
                      <span className={styles.normanMini} title={`V:${entry.normanLevels.visceral} B:${entry.normanLevels.behavioral} R:${entry.normanLevels.reflective}`}>
                        ◐ {entry.normanLevels.behavioral}
                      </span>
                    )}
                    <span className={styles.time}>{timeAgo(entry.timestamp)}</span>
                  </div>
                </div>

                <button
                  className={styles.deleteBtn}
                  onClick={(e) => handleDelete(e, entry.id)}
                  aria-label="Delete this history entry"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
