import type { Metadata } from "next";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "AI Project Editor — Verve",
  description: "Develop Verve projects through staged AI edits, live preview, deterministic diagnostics, human acceptance, local history, and export.",
};

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[]; demo?: string | string[] }>;
}) {
  const params = await searchParams;
  return <EditorClient
    initialProjectId={typeof params.project === "string" ? params.project : null}
    initialDemoId={typeof params.demo === "string" ? params.demo : null}
  />;
}
