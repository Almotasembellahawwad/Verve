import type { Metadata } from "next";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "Live project editor — Verve",
  description: "Edit Verve projects with live preview, deterministic diagnostics, autosave, snapshots, and export.",
};

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const project = (await searchParams).project;
  return <EditorClient initialProjectId={typeof project === "string" ? project : null} />;
}
