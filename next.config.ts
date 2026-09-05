import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https://*.codesandbox.io https://codesandbox.io",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ["@anthropic-ai/sdk", "colorthief", "typescript"],
  // Font files are opened at request time and copied into generated projects.
  // Reflective Node resolution deliberately avoids Turbopack turning a
  // WOFF2 path into a numeric module id, so the deployment trace needs to keep
  // the allowlisted binary packages beside the server routes.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
      "./node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
      "./node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2",
      "./node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
      "./node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2",
      "./node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
      "./node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      "./node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      "./node_modules/@fontsource-variable/readex-pro/files/readex-pro-arabic-wght-normal.woff2",
      "./node_modules/@fontsource-variable/readex-pro/files/readex-pro-latin-wght-normal.woff2",
      "./node_modules/@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2",
      "./node_modules/@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-latin-wght-normal.woff2",
      "./node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
      "./node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-latin-wght-normal.woff2",
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    }];
  },
};

export default nextConfig;
