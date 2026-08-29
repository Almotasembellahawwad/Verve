"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiKeyModal } from "./ApiKeyModal";
import { DEFAULT_MODEL, PROVIDER_MODELS } from "@/lib/llm-adapter/types";
import type { Provider } from "@/lib/ports/llm";
import {
  ProjectPatchProposalSchema,
  applyProjectPatchProposal,
  projectPatchContext,
  type AppliedProjectPatch,
  type ProjectPatchProposal,
} from "@/lib/project/ai-patch";
import type { EditorIteration } from "@/lib/ports/editor-projects";
import type { GeneratedProject } from "@/lib/project/types";
import { getLocalApiKey, LOCAL_KEYS_CHANGED_EVENT } from "@/lib/client/key-storage";
import styles from "./AiDevelopmentPanel.module.css";

type PatchMode = "fast" | "studio";

export type AiStudioProposal = AppliedProjectPatch & {
  id: string;
  proposal: ProjectPatchProposal;
  instruction: string;
  provider: Provider;
  model: string;
  mode: PatchMode;
  callCount: number;
  createdAt: number;
};

type Props = {
  project: GeneratedProject;
  iterations?: EditorIteration[];
  onPreview: (proposal: AiStudioProposal | null) => void;
  onAccept: (proposal: AiStudioProposal) => Promise<void>;
  onReject: (proposal: AiStudioProposal) => Promise<void>;
};

const PROMPTS = [
  "Make the hero more distinctive without adding decorative noise",
  "Improve the mobile hierarchy and spacing",
  "Turn this section into a clearer product story",
  "Audit accessibility and repair the important issues",
];

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: "The project or instruction exceeded the safe AI Studio contract.",
  NO_API_KEY: "The provider rejected this API key. Open Keys and verify it.",
  RATE_LIMITED: "This browser has sent several edits. Wait briefly, then retry.",
  RATE_LIMIT_UNAVAILABLE: "The request gate is temporarily unavailable. Your project is unchanged.",
  CONCURRENT_LIMIT: "Another edit is still running. Wait for it to finish.",
  TIMEOUT: "The model did not finish in time. Try Fast mode or a smaller request.",
  PROVIDER_ERROR: "The selected model could not produce a usable patch.",
};

function safeKey(provider: Provider): string {
  try { return getLocalApiKey(provider); } catch { return ""; }
}

export default function AiDevelopmentPanel({ project, iterations = [], onPreview, onAccept, onReject }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODEL.openai);
  const [mode, setMode] = useState<PatchMode>("fast");
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<AiStudioProposal | null>(null);
  const [status, setStatus] = useState<"idle" | "thinking" | "accepting" | "rejecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const apiKey = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(LOCAL_KEYS_CHANGED_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(LOCAL_KEYS_CHANGED_EVENT, onChange);
      };
    },
    () => safeKey(provider),
    () => ""
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  const changeProvider = (next: Provider) => {
    setProvider(next);
    setModel(DEFAULT_MODEL[next]);
    setError(null);
  };

  const requestPatch = async (nextInstruction = instruction) => {
    const normalized = nextInstruction.trim();
    if (normalized.length < 3 || status !== "idle") return;
    if (!apiKey) {
      setError(`Add a ${provider} API key before asking the model to edit.`);
      setKeysOpen(true);
      return;
    }

    const sourceProject = proposal?.project ?? project;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("thinking");
    setError(null);
    setInstruction("");
    try {
      const response = await fetch("/api/editor/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          project: projectPatchContext(sourceProject),
          instruction: normalized,
          mode,
          provider,
          model,
          apiKey,
        }),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || typeof data.error === "string") {
        const code = typeof data.error === "string" ? data.error : "PROVIDER_ERROR";
        throw new Error(ERROR_MESSAGES[code] ?? `AI Studio could not stage this edit (${code}).`);
      }
      const parsed = ProjectPatchProposalSchema.parse(data.proposal);
      const applied = applyProjectPatchProposal(sourceProject, parsed);
      const staged: AiStudioProposal = {
        id: crypto.randomUUID(),
        ...applied,
        proposal: parsed,
        instruction: normalized,
        provider,
        model,
        mode,
        callCount: typeof data.callCount === "number" ? data.callCount : mode === "studio" ? 2 : 1,
        createdAt: Date.now(),
      };
      setProposal(staged);
      onPreview(staged);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        setError("Edit cancelled. The current project was not changed.");
      } else {
        setError(requestError instanceof Error ? requestError.message : "AI Studio could not stage this edit.");
      }
    } finally {
      controllerRef.current = null;
      setStatus("idle");
      inputRef.current?.focus();
    }
  };

  const cancel = () => controllerRef.current?.abort();

  const accept = async () => {
    if (!proposal || status !== "idle") return;
    setStatus("accepting");
    setError(null);
    try {
      await onAccept(proposal);
      setProposal(null);
      onPreview(null);
    } catch {
      setError("The proposal passed review but could not be saved locally. Export the project before closing this tab.");
    } finally {
      setStatus("idle");
    }
  };

  const reject = async () => {
    if (!proposal || status !== "idle") return;
    setStatus("rejecting");
    try {
      await onReject(proposal);
      setProposal(null);
      onPreview(null);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <section className={styles.studio} aria-labelledby="ai-studio-title">
      <header className={styles.header}>
        <div>
          <span>01 / AI DEVELOPMENT LOOP</span>
          <h2 id="ai-studio-title">Ask. Inspect. <em>Decide.</em></h2>
          <p>The model stages a multi-file proposal. Verve renders and validates it before you choose what becomes part of the project.</p>
        </div>
        <div className={styles.safetyReceipt}>
          <b>HUMAN ACCEPTANCE REQUIRED</b>
          <span>Nothing is overwritten by an AI response.</span>
        </div>
      </header>

      <div className={styles.deck}>
        <div className={styles.composer}>
          <div className={styles.providerRow}>
            <label><span>Provider</span><select value={provider} onChange={(event) => changeProvider(event.target.value as Provider)}>
              <option value="openai">OpenAI</option><option value="anthropic">Claude</option><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option>
            </select></label>
            <label><span>Model</span><select value={model} onChange={(event) => setModel(event.target.value)}>
              {PROVIDER_MODELS[provider].map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
            </select></label>
            <button type="button" className={apiKey ? styles.keyReady : styles.keyMissing} onClick={() => setKeysOpen(true)}>
              {apiKey ? "KEY READY" : "ADD KEY"}
            </button>
          </div>

          <div className={styles.modeSwitch} role="radiogroup" aria-label="AI edit mode">
            <button type="button" role="radio" aria-checked={mode === "fast"} data-active={mode === "fast" || undefined} onClick={() => setMode("fast")}>
              <b>Fast</b><span>1 targeted model call</span>
            </button>
            <button type="button" role="radio" aria-checked={mode === "studio"} data-active={mode === "studio" || undefined} onClick={() => setMode("studio")}>
              <b>Studio</b><span>Plan + implementation · 2 bounded calls</span>
            </button>
          </div>

          <label className={styles.promptLabel}>
            <span>{proposal ? "Revise the staged proposal" : "What should change?"}</span>
            <textarea
              ref={inputRef}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void requestPatch();
                }
              }}
              placeholder="Example: Make the opening feel more architectural, keep the existing content, and repair the mobile hierarchy."
              maxLength={3000}
              rows={5}
              disabled={status !== "idle"}
            />
          </label>
          <div className={styles.submitRow}>
            {status === "thinking" ? <button type="button" className={styles.cancel} onClick={cancel}>Cancel request</button> : (
              <button type="button" className={styles.submit} onClick={() => void requestPatch()} disabled={instruction.trim().length < 3 || status !== "idle"}>
                {proposal ? "Stage a revision →" : "Stage AI proposal →"}
              </button>
            )}
            <small>{status === "thinking" ? `${mode === "fast" ? "Applying a targeted edit" : "Planning, then implementing"}…` : "Ctrl/⌘ + Enter to send"}</small>
          </div>
          {!proposal && status === "idle" && <div className={styles.chips}>{PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => { setInstruction(prompt); inputRef.current?.focus(); }}>{prompt}</button>)}</div>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <aside className={styles.review} data-has-proposal={Boolean(proposal) || undefined}>
          {proposal ? (
            <>
              <div className={styles.reviewState}><span>STAGED / NOT APPLIED</span><b>{proposal.mode.toUpperCase()} · {proposal.callCount} CALL{proposal.callCount > 1 ? "S" : ""}</b></div>
              <h3>{proposal.proposal.summary}</h3>
              <p>{proposal.proposal.rationale}</p>
              <div className={styles.fileChanges}>
                {proposal.files.map((file) => <div key={file.path}>
                  <strong>{file.path}</strong><span><i>+{file.addedLines}</i><em>−{file.removedLines}</em>{file.created ? "NEW" : "MODIFIED"}</span><small>{file.reason}</small>
                </div>)}
              </div>
              <div className={styles.gate} data-status={proposal.project.validation.status}>
                <span>DETERMINISTIC GATE</span>
                <b>{proposal.project.validation.score}/100 · {proposal.project.validation.failed} failed · {proposal.project.validation.warnings} warnings</b>
              </div>
              <div className={styles.decisionRow}>
                <button type="button" className={styles.accept} onClick={() => void accept()} disabled={status !== "idle"}>{status === "accepting" ? "Saving…" : "Accept proposal"}</button>
                <button type="button" className={styles.reject} onClick={() => void reject()} disabled={status !== "idle"}>{status === "rejecting" ? "Rejecting…" : "Reject"}</button>
              </div>
            </>
          ) : (
            <div className={styles.emptyReview}>
              <span>PROPOSAL BAY / EMPTY</span>
              <strong>The accepted project remains untouched.</strong>
              <p>Your next request will appear here as a reviewable set of changed files while the live workbench shows the proposed result.</p>
            </div>
          )}
        </aside>

        <aside className={styles.iterations}>
          <span>RECENT DECISIONS / {iterations.length}</span>
          {iterations.slice(0, 6).map((item) => <div key={item.id} data-status={item.status}>
            <b>{item.status.toUpperCase()}</b><strong>{item.summary}</strong><small>{item.mode} · {item.provider} · {new Date(item.createdAt).toLocaleString()}</small>
          </div>)}
          {iterations.length === 0 && <p>Accepted and rejected AI proposals will become an inspectable local trail here.</p>}
        </aside>
      </div>

      <ApiKeyModal isOpen={keysOpen} onClose={() => setKeysOpen(false)} onSave={() => undefined} />
    </section>
  );
}
