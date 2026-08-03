import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verve — Every AI website looks the same. Yours won't.",
  description:
    "Verve is an open-source design taste layer that forces non-generic, context-specific UI design instead of the median AI aesthetic. Six-step pipeline: brief analysis, cliché blocking, plan generation, adversarial critique, code output, distinctiveness scoring.",
  keywords: ["AI design", "UI generation", "design system", "LLM", "anti-cliché", "Verve"],
  authors: [{ name: "Verve Project" }],
  openGraph: {
    title: "Verve — Every AI website looks the same. Yours won't.",
    description: "An open-source design taste layer for AI-generated UIs.",
    type: "website",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
