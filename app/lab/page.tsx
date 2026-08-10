// app/lab/page.tsx
// Prompt Engineering Lab — power user interface
// View and understand each pipeline stage's system prompts,
// blocklist configuration, and critique thresholds.

import { Metadata } from "next";
import LabClient from "./LabClient";

export const metadata: Metadata = {
  title: "Prompt Lab — Verve",
  description: "Inspect and understand Verve's pipeline: system prompts, blocklist, critique thresholds, and Module configurations.",
};

export default function LabPage() {
  return <LabClient />;
}
