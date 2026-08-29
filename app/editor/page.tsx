import type { Metadata } from "next";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "AI Development Studio — Verve",
  description: "Develop Verve projects through staged AI edits, live preview, deterministic diagnostics, human acceptance, local history, and export.",
};

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const project = (await searchParams).project;
  return <EditorClient initialProjectId={typeof project === "string" ? project : null} />;
}
