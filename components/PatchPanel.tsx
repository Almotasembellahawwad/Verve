"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import styles from "./PatchPanel.module.css";
import type { Provider } from "@/lib/llm-adapter/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = {
  role:    "user" | "bot";
  text:    string;
  status?: "success" | "error" | "info";
};

type PatchPanelProps = {
  currentCode: string;
  framework:   string;
  designPlan?: string; // Compact JSON summary to give the AI context
  brief?:      string;
  provider:    Provider;
  model:       string;
  apiKey:      string;
  onCodePatched: (newCode: string) => void;
};

// ─── Hint Chips — quick-access common edit requests ──────────────────────────
const HINTS = [
  "Make the hero headline larger",
  "Change the CTA button color",
  "Add a testimonials section",
  "Make the spacing more luxurious",
  "Darken the background color",
  "Add a sticky navigation bar",
  "Make it fully responsive for mobile",
];

// ─────────────────────────────────────────────────────────────────────────────

export default function PatchPanel({
  currentCode,
  framework,
  designPlan,
  brief,
  provider,
  model,
  apiKey,
  onCodePatched,
}: PatchPanelProps) {
  const [messages, setMessages]       = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Code is ready for editing. Describe any change and I'll apply it instantly — no pipeline re-run needed.",
      status: "info",
    },
  ]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const historyRef                    = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const sendPatch = async (instruction: string) => {
    if (!instruction.trim() || loading) return;

    addMessage({ role: "user", text: instruction });
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/patch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCode,
          instruction,
          designPlan: designPlan ?? "",
          brief:      brief ?? "",
          framework,
          provider,
          model,
          apiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        addMessage({
          role:   "bot",
          text:   `⚠ ${data.error ?? "Edit failed. Please try again."}`,
          status: "error",
        });
        return;
      }

      onCodePatched(data.code);
      addMessage({
        role:   "bot",
        text:   `✓ Applied: "${instruction.slice(0, 60)}${instruction.length > 60 ? "…" : ""}"`,
        status: "success",
      });

    } catch {
      addMessage({
        role:   "bot",
        text:   "⚠ Network error. Check your connection and try again.",
        status: "error",
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPatch(input);
    }
  };

  return (
    <div className={styles.patchPanel}>
      {/* Header */}
      <div className={styles.patchHeader}>
        <div className={styles.patchTitle}>
          <span className={styles.patchTitleDot} aria-hidden="true" />
          Refine &amp; Edit
        </div>
        <button
          className={styles.patchClear}
          onClick={() =>
            setMessages([{
              role:   "bot",
              text:   "Chat cleared. Describe your next edit.",
              status: "info",
            }])
          }
          title="Clear chat history"
          type="button"
        >
          Clear
        </button>
      </div>

      {/* Chat History */}
      <div className={styles.chatHistory} ref={historyRef} aria-live="polite">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={[
              styles.chatBubble,
              msg.role === "user" ? styles.bubbleUser : styles.bubbleBot,
              msg.status === "success" ? styles.bubbleSuccess : "",
              msg.status === "error"   ? styles.bubbleError   : "",
            ].join(" ")}
          >
            <div className={`${styles.bubbleAvatar} ${msg.role === "user" ? styles.avatarUser : styles.avatarBot}`}>
              {msg.role === "user" ? "U" : "V"}
            </div>
            <div className={styles.bubbleText}>{msg.text}</div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className={`${styles.chatBubble} ${styles.bubbleBot}`}>
            <div className={`${styles.bubbleAvatar} ${styles.avatarBot}`}>V</div>
            <div className={styles.bubbleText}>
              <span className={styles.patchSpinner} />
            </div>
          </div>
        )}
      </div>

      {/* Hint Chips — shown only when chat has ≤ 2 messages */}
      {messages.length <= 2 && (
        <div className={styles.hintChips}>
          {HINTS.map((hint) => (
            <button
              key={hint}
              className={styles.hintChip}
              onClick={() => sendPatch(hint)}
              disabled={loading}
              type="button"
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className={styles.patchInputRow}>
        <textarea
          ref={inputRef}
          className={styles.patchInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your edit… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={loading}
          aria-label="Edit instruction"
        />
        <button
          className={styles.patchSendBtn}
          onClick={() => sendPatch(input)}
          disabled={!input.trim() || loading}
          aria-label="Apply edit"
          type="button"
        >
          {loading ? <span className={styles.patchSpinner} /> : "→"}
        </button>
      </div>

      <div className={styles.costBadge}>
        ~$0.03–0.05 per edit · 1 API call · no pipeline re-run
      </div>
    </div>
  );
}
