"use client";

import { useState, useEffect } from "react";
import styles from "./ApiKeyModal.module.css";

const STORAGE_KEY = "verve_anthropic_api_key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKeyState(stored);
  }, []);

  const saveApiKey = (key: string) => {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setApiKeyState(key);
    // Notify any panels listening for key changes
    window.dispatchEvent(new CustomEvent("verve:api-key-saved"));
  };

  return { apiKey, saveApiKey };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey?: string;
};

export function ApiKeyModal({ isOpen, onClose, onSave, currentKey }: Props) {
  const [value, setValue] = useState(currentKey ?? "");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setValue(currentKey ?? "");
  }, [currentKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(value.trim());
    onClose();
  };

  const maskedKey = value
    ? value.startsWith("sk-ant-")
      ? `sk-ant-...${value.slice(-6)}`
      : `${value.slice(0, 8)}...${value.slice(-4)}`
    : "";

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apikey-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerIcon} aria-hidden="true">⚙</div>
          <h2 id="apikey-modal-title" className={styles.title}>
            Anthropic API Key
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.explanation}>
            Verve runs on your own Anthropic API key. Your key is stored only in your
            browser&apos;s local storage and sent directly to the server with each
            request — it is never logged or persisted server-side.
          </p>

          <div className={styles.howToGet}>
            <span className={styles.howToIcon} aria-hidden="true">↗</span>
            <a
              href="https://console.anthropic.com/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.howToLink}
            >
              Get your API key from console.anthropic.com
            </a>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="api-key-input" className={styles.label}>
              API Key
            </label>
            <div className={styles.inputRow}>
              <input
                id="api-key-input"
                type={visible ? "text" : "password"}
                className={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-ant-api03-..."
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
            {value && !visible && (
              <p className={styles.maskedPreview}>{maskedKey}</p>
            )}
          </div>

          <div className={styles.securityNote}>
            <span aria-hidden="true">🔒</span>
            Your key is stored in{" "}
            <code>localStorage</code> only. Clear it anytime by
            clicking &ldquo;Remove key&rdquo; below.
          </div>
        </div>

        <div className={styles.actions}>
          {currentKey && (
            <button
              className={styles.removeBtn}
              onClick={() => { onSave(""); onClose(); }}
              type="button"
            >
              Remove key
            </button>
          )}
          <div className={styles.actionsSpacer} />
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!value.trim()}
            type="button"
          >
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}
