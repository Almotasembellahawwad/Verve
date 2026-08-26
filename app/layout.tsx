import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verve — Every AI website looks the same. Yours won't.",
  description:
    "Verve is an open-source design taste layer that turns a brief into distinctive, validated interface code through nine observable design stages.",
  keywords: ["AI design", "UI generation", "design system", "LLM UI", "anti-cliché", "Verve", "design taste", "Claude API", "Next.js design tool"],
  authors: [{ name: "Almotasembellahawwad", url: "https://github.com/Almotasembellahawwad" }],
  openGraph: {
    title: "Verve — Every AI website looks the same. Yours won't.",
    description: "An open-source taste engine for distinctive, validated UI output from multiple LLM providers.",
    type: "website",
    url: "https://github.com/Almotasembellahawwad/Verve",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verve — Every AI website looks the same. Yours won't.",
    description: "Open-source design pipeline that rejects clichés, validates code, and scores distinctiveness.",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
