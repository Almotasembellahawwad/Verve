"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import styles from "./ApiKeyModal.module.css";
import type { Provider } from "@/lib/llm-adapter/types";
import { PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";
import {
  clearLocalApiKeys,
  getLocalApiKey,
  hasAnyLocalApiKey,
  LOCAL_KEYS_CHANGED_EVENT,
  setLocalApiKey,
  type LocalKeyProvider,
} from "@/lib/client/key-storage";

type AnyProvider = LocalKeyProvider;

const PROVIDERS: { id: AnyProvider; label: string; description: string; keyPrefix: string }[] = [
  { id: "anthropic",  label: "Anthropic / Claude", description: "Claude Sonnet, Opus, Haiku",    keyPrefix: "sk-ant-" },
  { id: "openai",     label: "OpenAI / GPT",       description: "GPT-5.6 Terra, Sol, Luna",      keyPrefix: "sk-" },
  { id: "gemini",     label: "Google / Gemini",    description: "Gemini 3.7, 3.5 & Pro Preview", keyPrefix: "AIza" },
  { id: "openrouter", label: "OpenRouter",         description: "Automatic free-model router",   keyPrefix: "sk-or-" },
  { id: "pexels",     label: "Pexels",             description: "Contextual photography",        keyPrefix: "" },
];

export function useApiKey() {
  const apiKey = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(LOCAL_KEYS_CHANGED_EVENT, onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(LOCAL_KEYS_CHANGED_EVENT, onStoreChange);
      };
    },
    () => hasAnyLocalApiKey() ? "configured" : "",
    () => ""
  );

  const saveApiKey = (key: string, provider: AnyProvider = "anthropic") => {
    if (key) {
      setLocalApiKey(provider, key);
    } else {
      setLocalApiKey(provider, "");
    }
  };

  return { apiKey, saveApiKey };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider?: AnyProvider) => void;
  currentKey?: string;
};

export function ApiKeyModal({ isOpen, onClose, onSave }: Props) {
  const [activeProvider, setActiveProvider] = useState<AnyProvider>("anthropic");
  const [values, setValues] = useState<Record<AnyProvider, string>>({
    anthropic: "", openai: "", gemini: "", openrouter: "", pexels: "",
  });
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValues({ // eslint-disable-line react-hooks/set-state-in-effect
        anthropic: getLocalApiKey("anthropic"),
        openai: getLocalApiKey("openai"),
        gemini: getLocalApiKey("gemini"),
        openrouter: getLocalApiKey("openrouter"),
        pexels: getLocalApiKey("pexels"),
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentValue = values[activeProvider];
  const providerConfig = PROVIDERS.find((p) => p.id === activeProvider)!;
  const info = activeProvider === "pexels"
    ? { label: "Pexels API Key", placeholder: "Your key from pexels.com/api", docsUrl: "https://www.pexels.com/api/" }
    : PROVIDER_KEY_LABELS[activeProvider as Provider];

  const hasAnyKey = PROVIDERS.some((p) => !!values[p.id]);

  const handleSave = () => {
    PROVIDERS.forEach((p) => {
      const v = values[p.id];
      setLocalApiKey(p.id, v);
    });
    onSave(currentValue.trim(), activeProvider);
    onClose();
  };

  const handleRemove = () => {
    clearLocalApiKeys();
    onSave("", activeProvider);
    onClose();
  };

  const masked = (val: string) => val ? `${val.slice(0, 8)}...${val.slice(-4)}` : "";

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apikey-modal-title"
    >
      <div className={styles.modal} ref={modalRef}>

        {/* ---- Header ---- */}
        <div className={styles.header}>
          <div>
            <h2 id="apikey-modal-title" className={styles.title}>API Keys</h2>
            <p className={styles.titleSub}>Stored in your browser. Sent per-request to your chosen provider — never logged or stored server-side.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&#215;</button>
        </div>

        <div className={styles.body}>

          {/* ---- Provider list (left column) ---- */}
          <div className={styles.providerList} role="tablist" aria-label="Select provider">
            {PROVIDERS.map((p) => {
              const hasKey = !!values[p.id];
              const isActive = activeProvider === p.id;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.providerRow} ${isActive ? styles.providerRowActive : ""}`}
                  onClick={() => { setActiveProvider(p.id); setVisible(false); }}
                >
                  <div className={styles.providerInfo}>
                    <span className={styles.providerLabel}>{p.label}</span>
                    <span className={styles.providerDesc}>{p.description}</span>
                  </div>
                  <div className={styles.providerStatus}>
                    {hasKey
                      ? <span className={styles.statusSet}>&#10003; set</span>
                      : <span className={styles.statusEmpty}>not set</span>
                    }
                  </div>
                </button>
              );
            })}
          </div>

          {/* ---- Key input (right column) ---- */}
          <div className={styles.keyPanel}>

            {/* Provider header */}
            <div className={styles.keyPanelHeader}>
              <span className={styles.keyPanelName}>
                {providerConfig.label}
              </span>
              <a
                href={info.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.getKeyLink}
              >
                Get key &#8599;
              </a>
            </div>

            {/* OpenRouter note */}
            {activeProvider === "openrouter" && (
              <div className={styles.openrouterNote}>
                <strong>Experimental free routing:</strong> Verve uses local brief analysis, structured output, and
                gateway fallback so a weak first model does not waste the run. Free-model availability and daily
                limits are still controlled by OpenRouter and are not suitable for guaranteed production traffic.
                Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>openrouter.ai/keys</a>.
              </div>
            )}

            {/* Pexels note */}
            {activeProvider === "pexels" && (
              <div className={styles.pexelsNote}>
                <strong>What this enables:</strong> the pipeline sources real photography specific to your brief subject
                (not generic stock). Without it, image slots are left as placeholders.
                Free tier: 200 requests/hour.
              </div>
            )}

            {/* Input */}
            <label htmlFor="api-key-input" className={styles.keyLabel}>{info.label}</label>
            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                id="api-key-input"
                type={visible ? "text" : "password"}
                className={styles.input}
                value={currentValue}
                onChange={(e) => setValues((prev) => ({ ...prev, [activeProvider]: e.target.value }))}
                placeholder={info.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.visibilityBtn}
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide" : "Show"}
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>
            {currentValue && !visible && (
              <p className={styles.maskedPreview}>{masked(currentValue)}</p>
            )}
            {providerConfig.keyPrefix && currentValue && !currentValue.startsWith(providerConfig.keyPrefix) && (
              <p className={styles.keyWarning}>
                Expected prefix: <code>{providerConfig.keyPrefix}</code>
              </p>
            )}

            {/* Security note */}
            <p className={styles.securityNote}>
              Keys are stored in <code>localStorage</code> and sent with each generation request to your chosen LLM provider.
              They pass through the Verve server for that request only — never logged, stored, or shared.
            </p>
          </div>
        </div>

        {/* ---- Actions ---- */}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
