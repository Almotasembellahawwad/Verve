import type { Metadata } from "next";
import DemosClient from "./DemosClient";

export const metadata: Metadata = {
  title: "Live project gallery — Verve",
  description: "Run, inspect, edit, and export three complete Verve projects without an account or API key.",
};

export default function DemosPage() {
  return <DemosClient />;
}
