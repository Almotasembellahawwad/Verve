"use client";

import { useState } from "react";
import {
  buildFeedbackUrl,
  buildResultCardFilename,
  buildResultShareText,
  normalizeResultShareInput,
  type ResultShareInput,
} from "@/lib/share/result-share";
import { SITE_URL } from "@/lib/site";
import styles from "./ResultShareKit.module.css";

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("The browser did not grant clipboard access.");
}

function drawScoreCard(canvas: HTMLCanvasElement, input: ResultShareInput): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  const safe = normalizeResultShareInput(input);

  canvas.width = 1200;
  canvas.height = 630;
  context.fillStyle = "#0b0e0d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(232, 225, 212, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 60) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }

  context.fillStyle = "#f6533d";
  context.fillRect(0, 0, 18, canvas.height);
  context.fillRect(70, 70, 54, 54);
  context.fillStyle = "#0b0e0d";
  context.font = "700 22px Arial, sans-serif";
  context.fillText("V/", 82, 105);

  context.fillStyle = "#e8e1d4";
  context.font = "600 18px ui-monospace, Consolas, monospace";
  context.letterSpacing = "3px";
  context.fillText("VERVE / PROJECT RECEIPT", 150, 103);
  context.letterSpacing = "0px";

  context.fillStyle = "#f6533d";
  context.font = "400 210px Georgia, serif";
  context.fillText(safe.grade, 72, 360);

  context.fillStyle = "#e8e1d4";
  context.font = "700 104px Arial, sans-serif";
  context.fillText(String(safe.score), 300, 300);
  context.fillStyle = "#878d89";
  context.font = "400 30px Arial, sans-serif";
  context.fillText("/100 DISTINCTIVENESS", 480, 298);

  let projectFontSize = 48;
  context.font = `650 ${projectFontSize}px Arial, sans-serif`;
  while (context.measureText(safe.projectName).width > 930 && projectFontSize > 28) {
    projectFontSize -= 2;
    context.font = `650 ${projectFontSize}px Arial, sans-serif`;
  }
  context.fillStyle = "#e8e1d4";
  context.fillText(safe.projectName, 300, 390);

  context.fillStyle = "#878d89";
  context.font = "500 18px ui-monospace, Consolas, monospace";
  const engineering = safe.engineeringScore === undefined ? "ENGINEERING —" : `ENGINEERING ${safe.engineeringScore}/100`;
  context.fillText(`${safe.framework.toUpperCase()}  ·  ${engineering}`, 305, 438);

  context.strokeStyle = "rgba(232, 225, 212, 0.22)";
  context.beginPath(); context.moveTo(72, 500); context.lineTo(1128, 500); context.stroke();
  context.fillStyle = "#e8e1d4";
  context.font = "500 18px ui-monospace, Consolas, monospace";
  context.fillText("GENERATE · RUN · INSPECT · EXPORT", 72, 555);
  context.fillStyle = "#f6533d";
  context.textAlign = "right";
  context.fillText(SITE_URL.replace(/^https?:\/\//, ""), 1128, 555);
  context.textAlign = "left";
}

async function downloadScoreCard(input: ResultShareInput): Promise<void> {
  const canvas = document.createElement("canvas");
  drawScoreCard(canvas, input);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The score card could not be encoded.")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildResultCardFilename(input.projectName);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function ResultShareKit(input: ResultShareInput) {
  const [busy, setBusy] = useState<"share" | "card" | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const share = async () => {
    setBusy("share");
    setNotice(null);
    const text = buildResultShareText(input);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${input.projectName} — Verve score`, text });
        setNotice({ message: "Share sheet opened.", error: false });
      } else {
        await copyText(text);
        setNotice({ message: "Result summary copied. Paste it anywhere you share your work.", error: false });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice({ message: error instanceof Error ? error.message : "Result sharing failed.", error: true });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("card");
    setNotice(null);
    try {
      await downloadScoreCard(input);
      setNotice({ message: "1200 × 630 score card downloaded.", error: false });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Score card download failed.", error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.kit} aria-label="Share this Verve result">
      <div className={styles.copy}>
        <span className={styles.eyebrow}>SHARE / LAUNCH RECEIPT</span>
        <p>Publish the evidence, not your private brief. The card contains only project name, framework, and scores.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={share} disabled={busy !== null}>
          {busy === "share" ? "Opening…" : "Share result"}
        </button>
        <button type="button" className={styles.action} onClick={download} disabled={busy !== null}>
          {busy === "card" ? "Rendering…" : "Download score card"}
        </button>
        <a className={styles.feedback} href={buildFeedbackUrl()} target="_blank" rel="noreferrer">
          Give feedback ↗
        </a>
      </div>
      <p className={styles.notice} data-error={notice?.error || undefined} aria-live="polite">
        {notice?.message ?? ""}
      </p>
    </section>
  );
}
