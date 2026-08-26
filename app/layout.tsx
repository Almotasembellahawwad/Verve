import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: "Verve — Speak a brief. Ship a complete project.",
  description: SITE_DESCRIPTION,
  keywords: ["AI website builder", "project generator", "Next.js generator", "React generator", "voice brief", "live code preview", "Verve", "OpenRouter"],
  authors: [{ name: "Almotasembellahawwad", url: "https://github.com/Almotasembellahawwad" }],
  creator: "Almotasembellahawwad",
  publisher: SITE_NAME,
  category: "developer tools",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Verve — Speak a brief. Ship a complete project.",
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Verve — Speak a brief. Ship a complete project.",
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  codeRepository: REPOSITORY_URL,
  description: SITE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: ["Multi-file project generation", "Native HTML preview", "React sandbox preview", "Recoverable AI pipeline", "Local browser API key storage", "ZIP export"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
