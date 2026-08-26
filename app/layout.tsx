import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verve — Speak a brief. Ship a complete project.",
  description:
    "Verve turns spoken or written briefs into distinctive, runnable multi-file web projects with live sandbox previews, Fast and Studio modes, and recoverable AI pipelines.",
  keywords: ["AI website builder", "project generator", "Next.js generator", "React generator", "voice brief", "live code preview", "Verve", "OpenRouter"],
  authors: [{ name: "Almotasembellahawwad", url: "https://github.com/Almotasembellahawwad" }],
  openGraph: {
    title: "Verve — Speak a brief. Ship a complete project.",
    description: "An open-source project intelligence engine with live previews, multi-file output, and recoverable generation.",
    type: "website",
    url: "https://github.com/Almotasembellahawwad/Verve",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verve — Speak a brief. Ship a complete project.",
    description: "Open-source AI project generation with Fast and Studio modes, live sandbox preview, and ZIP export.",
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
