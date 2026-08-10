"use client";

import { useState, useEffect } from "react";
import styles from "./ApiKeyModal.module.css";
import type { Provider } from "@/lib/llm-adapter/types";
import { PROVIDER_KEY_LABELS } from "@/lib/llm-adapter/types";

const getKey = (p: Provider | "pexels") => `verve_${p}_api_key`;
const ANTHROPIC_KEY = "verve_anthropic_api_key";

type AnyProvider = Provider | "pexels";

const PROVIDERS: { id: AnyProvider; label: string; description: string; color: string; keyPrefix: string }[] = [
  { id: "anthropic",   label: "Anthropic / Claude",    description: "Claude Sonnet, Opus, Haiku",        color: "#D49020", keyPrefix: "sk-ant-" },
  { id: "openai",      label: "OpenAI / GPT",           description: "GPT-5.6 Terra, Sol, Luna",          color: "#74B87E", keyPrefix: "sk-"     },
  { id: "gemini",      label: "Google / Gemini",         description: "Gemini 2.5 Pro & Flash",            color: "#6B9FE4", keyPrefix: "AIza"    },
  { id: "openrouter",  label: "OpenRouter",              description: "Free models: Gemma, GPT OSS, Llama", color: "#9A6FF0", keyPrefix: "sk-or-"  },
  { id: "pexels",      label: "Pexels",                  description: "Contextual photography",             color: "#05A081", keyPrefix: ""        },
];

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

export function ApiKeyModal({ isOpen, onClose, onSave }: Props) {
  const [activeProvider, setActiveProvider] = useState<AnyProvider>("anthropic");
  const [values, setValues] = useState<Record<AnyProvider, string>>({
    anthropic: "", openai: "", gemini: "", openrouter: "", pexels: "",
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues({
        anthropic:   localStorage.getItem(ANTHROPIC_KEY) ?? "",
        openai:      localStorage.getItem(getKey("openai")) ?? "",
        gemini:      localStorage.getItem(getKey("gemini")) ?? "",
        openrouter:  localStorage.getItem(getKey("openrouter")) ?? "",
        pexels:      localStorage.getItem(getKey("pexels")) ?? "",
      });
    }
  }, [isOpen]);

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
      if (v) {
        localStorage.setItem(getKey(p.id), v);
        if (p.id === "anthropic") localStorage.setItem(ANTHROPIC_KEY, v);
      }
    });
    onSave(currentValue.trim(), activeProvider);
    onClose();
  };

  const handleRemove = () => {
    PROVIDERS.forEach((p) => { localStorage.removeItem(getKey(p.id)); });
    localStorage.removeItem(ANTHROPIC_KEY);
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
      <div className={styles.modal}>

        {/* ---- Header ---- */}
        <div className={styles.header}>
          <div>
            <h2 id="apikey-modal-title" className={styles.title}>API Keys</h2>
            <p className={styles.titleSub}>Stored locally in your browser only. Never sent to Verve servers.</p>
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
                  style={isActive ? { "--c": p.color } as React.CSSProperties : undefined}
                >
                  <div className={styles.providerInfo}>
                    <span className={styles.providerLabel}>{p.label}</span>
                    <span className={styles.providerDesc}>{p.description}</span>
                  </div>
                  <div className={styles.providerStatus}>
                    {hasKey
                      ? <span className={styles.statusSet} style={{ color: p.color }}>&#10003; set</span>
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
            <div className={styles.keyPanelHeader} style={{ borderColor: `${providerConfig.color}30` }}>
              <span className={styles.keyPanelName} style={{ color: providerConfig.color }}>
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
                <strong>Free models included:</strong> Gemma 4 31B, GPT OSS 20B, Llama 3.3 70B, Mistral Small 3.2.
                No billing required for free tier models. Rate limits apply (20 req/min on free tier).
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
              Keys are stored in <code>localStorage</code> and sent directly to the provider with each request.
              Verve never logs or proxies them.
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
