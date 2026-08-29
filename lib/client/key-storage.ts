import type { Provider } from "@/lib/llm-adapter/types";

export type LocalKeyProvider = Provider | "pexels";

export const LOCAL_KEYS_CHANGED_EVENT = "verve:api-key-saved";

export function localApiKeyStorageKey(provider: LocalKeyProvider): string {
  return `verve_${provider}_api_key`;
}

export function getLocalApiKey(provider: LocalKeyProvider): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(localApiKeyStorageKey(provider)) ?? ""; } catch { return ""; }
}

export function setLocalApiKey(provider: LocalKeyProvider, value: string): void {
  if (typeof window === "undefined") return;
  const normalized = value.trim();
  try {
    if (normalized) window.localStorage.setItem(localApiKeyStorageKey(provider), normalized);
    else window.localStorage.removeItem(localApiKeyStorageKey(provider));
  } catch { /* Private or sandboxed contexts can keep using in-memory UI state. */ }
  window.dispatchEvent(new CustomEvent(LOCAL_KEYS_CHANGED_EVENT, { detail: { provider } }));
}

export function hasAnyLocalApiKey(): boolean {
  return (["anthropic", "openai", "gemini", "openrouter", "pexels"] as LocalKeyProvider[])
    .some((provider) => Boolean(getLocalApiKey(provider)));
}

export function clearLocalApiKeys(): void {
  if (typeof window === "undefined") return;
  try {
    (["anthropic", "openai", "gemini", "openrouter", "pexels"] as LocalKeyProvider[])
      .forEach((provider) => window.localStorage.removeItem(localApiKeyStorageKey(provider)));
  } catch { /* No persisted keys are available to clear. */ }
  window.dispatchEvent(new CustomEvent(LOCAL_KEYS_CHANGED_EVENT));
}
