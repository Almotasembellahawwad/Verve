import type { Metadata } from "next";
import CreateClient from "./CreateClient";

export const metadata: Metadata = {
  title: "Create a web project — Verve",
  description: "Describe a brief, generate a runnable project, inspect it live, and continue refining it in the Verve editor.",
};

export default function CreatePage() {
  return <CreateClient />;
}
