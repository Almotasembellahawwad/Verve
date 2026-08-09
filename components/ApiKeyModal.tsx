"use client";

import { useState, useEffect } from "react";
import styles from "./ApiKeyModal.module.css";
import type { Provider } from "@/lib/llm-adapter/types";
import { PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";

const getKey = (p: Provider | "pexels") => `verve_${p}_api_key`;
const ANTHROPIC_KEY = "verve_anthropic_api_key";

type AnyProvider = Provider | "pexels";

const PROVIDERS: { id: AnyProvider; label: string; icon: string; color: string }[] = [
  { id: "anthropic", label: "Claude",  icon: "◆", color: "#D49020" },
  { id: "openai",    label: "GPT",     icon: "◎", color: "#74B87E" },
  { id: "gemini",    label: "Gemini",  icon: "✦", color: "#6B9FE4" },
  { id: "pexels",    label: "Pexels",  icon: "▣", color: "#05A081" },
];

// ── Hook used by SignalNav ────────────────────────────────────────────────────
export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem(ANTHROPIC_KEY) ?? "";
    setApiKeyState(stored);
  }, []);

  const saveApiKey = (key: string, provider: AnyProvider = "anthropic") => {
    if (key) {
      localStorage.setItem(getKey(provider), key);
      if (provider === "anthropic") localStorage.setItem(ANTHROPIC_KEY, key);
    } else {
      localStorage.removeItem(getKey(provider));
      if (provider === "anthropic") localStorage.removeItem(ANTHROPIC_KEY);
    }
    const anyKey = PROVIDERS.some((p) => !!localStorage.getItem(getKey(p.id)));
    setApiKeyState(anyKey ? key : "");
    window.dispatchEvent(new CustomEvent("verve:api-key-saved"));
  };

  return { apiKey, saveApiKey };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider?: AnyProvider) => void;
  currentKey?: string;
};

export function ApiKeyModal({ isOpen, onClose, onSave, currentKey }: Props) {
  const [activeProvider, setActiveProvider] = useState<AnyProvider>("anthropic");
  const [values, setValues] = useState<Record<AnyProvider, string>>({
    anthropic: "",
    openai: "",
    gemini: "",
    pexels: "",
  });
  const [visible, setVisible] = useState(false);

  // Load stored keys when modal opens
  useEffect(() => {
    if (isOpen) {
      setValues({
        anthropic: localStorage.getItem(ANTHROPIC_KEY) ?? "",
        openai:    localStorage.getItem(getKey("openai")) ?? "",
        gemini:    localStorage.getItem(getKey("gemini")) ?? "",
        pexels:    localStorage.getItem(getKey("pexels")) ?? "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentValue = values[activeProvider];
  const info = activeProvider === "pexels"
    ? { label: "Pexels API Key", placeholder: "Key from pexels.com/api", docsUrl: "https://www.pexels.com/api/" }
    : PROVIDER_KEY_LABELS[activeProvider as Provider];
  const providerConfig = PROVIDERS.find((p) => p.id === activeProvider)!;

  const handleSave = () => {
    // Save all non-empty keys at once
    PROVIDERS.forEach((p) => {
      const v = values[p.id];
      if (v) {
        localStorage.setItem(getKey(p.id), v);
        if (p.id === "anthropic") localStorage.setItem(ANTHROPIC_KEY, v);
      }
    });
    // Primary save = active provider
    onSave(currentValue.trim(), activeProvider);
    onClose();
  };

  const handleRemove = () => {
    PROVIDERS.forEach((p) => {
      localStorage.removeItem(getKey(p.id));
    });
    localStorage.removeItem(ANTHROPIC_KEY);
    onSave("", activeProvider);
    onClose();
  };

  const maskedKey = (val: string) => {
    if (!val) return "";
    return `${val.slice(0, 8)}...${val.slice(-4)}`;
  };

  const hasAnyKey = PROVIDERS.some((p) => !!values[p.id]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apikey-modal-title"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon} aria-hidden="true">⚙</div>
          <h2 id="apikey-modal-title" className={styles.title}>
            Configure AI Provider
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Provider tabs */}
          <div className={styles.providerTabs} role="tablist" aria-label="Select provider">
            {PROVIDERS.map((p) => {
              const hasKey = !!values[p.id];
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={activeProvider === p.id}
                  className={`${styles.providerTab} ${activeProvider === p.id ? styles.providerTabActive : ""}`}
                  onClick={() => { setActiveProvider(p.id); setVisible(false); }}
                  style={activeProvider === p.id ? { "--provider-color": p.color } as React.CSSProperties : undefined}
                >
                  <span className={styles.providerIcon} aria-hidden="true">{p.icon}</span>
                  {p.label}
                  {hasKey && <span className={styles.keyDot} aria-label="Key configured" />}
                </button>
              );
            })}
          </div>

          {/* Provider explanation */}
          <p className={styles.explanation}>
            Your key is stored only in your browser&apos;s <code>localStorage</code> and sent
            directly with each request — never logged or persisted server-side.
          </p>

          <div className={styles.howToGet}>
            <span className={styles.howToIcon} aria-hidden="true">↗</span>
            <a
              href={info.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.howToLink}
            >
              Get your {providerConfig.label} API key →
            </a>
          </div>

          {/* Key input */}
          <div className={styles.inputGroup}>
            <label htmlFor="api-key-input" className={styles.label}>
              {info.label}
            </label>
            <div className={styles.inputRow}>
              <input
                id="api-key-input"
                type={visible ? "text" : "password"}
                className={styles.input}
                value={currentValue}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [activeProvider]: e.target.value }))
                }
                placeholder={info.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.visibilityBtn}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide API key" : "Show API key"}
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>
            {currentValue && !visible && (
              <p className={styles.maskedPreview}>{maskedKey(currentValue)}</p>
            )}
          </div>

          {/* Keys summary */}
          {hasAnyKey && (
            <div className={styles.keysSummary}>
              {PROVIDERS.map((p) => values[p.id] ? (
                <span key={p.id} className={styles.keyBadge}>
                  <span aria-hidden="true">{p.icon}</span> {p.label} ✓
                </span>
              ) : null)}
            </div>
          )}

          <div className={styles.securityNote}>
            <span aria-hidden="true">🔒</span>
            Keys are stored per-provider in <code>localStorage</code>. Remove all below.
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {hasAnyKey && (
            <button className={styles.removeBtn} onClick={handleRemove} type="button">
              Remove all keys
            </button>
          )}
          <div className={styles.actionsSpacer} />
          <button className={styles.cancelBtn} onClick={onClose} type="button">Cancel</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!currentValue.trim()}
            type="button"
          >
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}
