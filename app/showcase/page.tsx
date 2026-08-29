import type { Metadata } from "next";
import ShowcaseClient from "./ShowcaseClient";

export const metadata: Metadata = {
  title: "Evidence Showcase — Verve",
  description: "See the category gravity, Verve intervention, design decision, runnable result, and engineering receipt behind three public projects.",
};

export default function ShowcasePage() {
  return <ShowcaseClient />;
}
