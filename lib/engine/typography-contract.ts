import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";
import type { GeneratedCode } from "./code-generator";
import type { ProjectFramework } from "../project/types";
import {
  TYPOGRAPHY_CONTRACT_VERSION,
  type TypographyAssignment,
  type TypographyContract,
  type TypographyDeliveryReceipt,
  type TypographyFontFile,
  type TypographyScript,
} from "../domain/typography";

const LATIN_RANGE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const ARABIC_RANGE = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC4,U+10EFC-10EFF,U+1EE00-1EE03,U+1EE05-1EE1F,U+1EE21-1EE22,U+1EE24,U+1EE27,U+1EE29-1EE32,U+1EE34-1EE37,U+1EE39,U+1EE3B,U+1EE42,U+1EE47,U+1EE49,U+1EE4B,U+1EE4D-1EE4F,U+1EE51-1EE52,U+1EE54,U+1EE57,U+1EE59,U+1EE5B,U+1EE5D,U+1EE5F,U+1EE61-1EE62,U+1EE64,U+1EE67-1EE6A,U+1EE6C-1EE72,U+1EE74-1EE77,U+1EE79-1EE7C,U+1EE7E,U+1EE80-1EE89,U+1EE8B-1EE9B,U+1EEA1-1EEA3,U+1EEA5-1EEA9,U+1EEAB-1EEBB,U+1EEF0-1EEF1";

type FontDefinition = {
  id: string;
  family: string;
  packageName: string;
  files: Array<{ packagePath: string; subset: "latin" | "arabic"; weight: string; style?: "normal" | "italic" }>;
  weights: number[];
  styles: Array<"normal" | "italic">;
  fallback: string;
  attribution: string;
  sourceUrl: string;
};

const FONTS: Record<string, FontDefinition> = {
  manrope: {
    id: "manrope",
    family: "Manrope Variable",
    packageName: "@fontsource-variable/manrope",
    files: [{ packagePath: "files/manrope-latin-wght-normal.woff2", subset: "latin", weight: "200 800" }],
    weights: [400, 500, 600, 700, 800],
    styles: ["normal"],
    fallback: '"Segoe UI", Arial, sans-serif',
    attribution: "Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)",
    sourceUrl: "https://github.com/sharanda/manrope",
  },
  instrument: {
    id: "instrument-serif",
    family: "Instrument Serif",
    packageName: "@fontsource/instrument-serif",
    files: [
      { packagePath: "files/instrument-serif-latin-400-normal.woff2", subset: "latin", weight: "400" },
      { packagePath: "files/instrument-serif-latin-400-italic.woff2", subset: "latin", weight: "400", style: "italic" },
    ],
    weights: [400],
    styles: ["normal", "italic"],
    fallback: 'Georgia, "Times New Roman", serif',
    attribution: "Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif)",
    sourceUrl: "https://github.com/Instrument/instrument-serif",
  },
  newsreader: {
    id: "newsreader",
    family: "Newsreader Variable",
    packageName: "@fontsource-variable/newsreader",
    files: [{ packagePath: "files/newsreader-latin-wght-normal.woff2", subset: "latin", weight: "200 800" }],
    weights: [300, 400, 500, 600, 700, 800],
    styles: ["normal"],
    fallback: 'Georgia, "Times New Roman", serif',
    attribution: "Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader)",
    sourceUrl: "https://github.com/productiontype/Newsreader",
  },
  fraunces: {
    id: "fraunces",
    family: "Fraunces Variable",
    packageName: "@fontsource-variable/fraunces",
    files: [{ packagePath: "files/fraunces-latin-wght-normal.woff2", subset: "latin", weight: "100 900" }],
    weights: [300, 400, 500, 600, 700, 800, 900],
    styles: ["normal"],
    fallback: 'Georgia, "Times New Roman", serif',
    attribution: "Copyright 2020 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces)",
    sourceUrl: "https://github.com/undercasetype/Fraunces",
  },
  bricolage: {
    id: "bricolage-grotesque",
    family: "Bricolage Grotesque Variable",
    packageName: "@fontsource-variable/bricolage-grotesque",
    files: [{ packagePath: "files/bricolage-grotesque-latin-wght-normal.woff2", subset: "latin", weight: "200 800" }],
    weights: [300, 400, 500, 600, 700, 800],
    styles: ["normal"],
    fallback: '"Arial Narrow", "Segoe UI", sans-serif',
    attribution: "Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)",
    sourceUrl: "https://github.com/ateliertriay/bricolage",
  },
  plexMono: {
    id: "ibm-plex-mono",
    family: "IBM Plex Mono",
    packageName: "@fontsource/ibm-plex-mono",
    files: [
      { packagePath: "files/ibm-plex-mono-latin-400-normal.woff2", subset: "latin", weight: "400" },
      { packagePath: "files/ibm-plex-mono-latin-500-normal.woff2", subset: "latin", weight: "500" },
    ],
    weights: [400, 500],
    styles: ["normal"],
    fallback: 'Consolas, "Liberation Mono", monospace',
    attribution: "Copyright IBM Corp. 2017. IBM Plex is licensed under the SIL Open Font License 1.1.",
    sourceUrl: "https://github.com/IBM/plex",
  },
  readex: {
    id: "readex-pro",
    family: "Readex Pro Variable",
    packageName: "@fontsource-variable/readex-pro",
    files: [
      { packagePath: "files/readex-pro-arabic-wght-normal.woff2", subset: "arabic", weight: "160 700" },
      { packagePath: "files/readex-pro-latin-wght-normal.woff2", subset: "latin", weight: "160 700" },
    ],
    weights: [300, 400, 500, 600, 700],
    styles: ["normal"],
    fallback: 'Tahoma, Arial, sans-serif',
    attribution: "Copyright 2019 The Readex Pro Project Authors (https://github.com/ThomasJockin/readexpro)",
    sourceUrl: "https://github.com/ThomasJockin/readexpro",
  },
  notoKufi: {
    id: "noto-kufi-arabic",
    family: "Noto Kufi Arabic Variable",
    packageName: "@fontsource-variable/noto-kufi-arabic",
    files: [
      { packagePath: "files/noto-kufi-arabic-arabic-wght-normal.woff2", subset: "arabic", weight: "100 900" },
      { packagePath: "files/noto-kufi-arabic-latin-wght-normal.woff2", subset: "latin", weight: "100 900" },
    ],
    weights: [300, 400, 500, 600, 700, 800, 900],
    styles: ["normal"],
    fallback: 'Tahoma, Arial, sans-serif',
    attribution: "Copyright 2019-2022 Google LLC. All Rights Reserved.",
    sourceUrl: "https://github.com/notofonts/arabic",
  },
  notoSansArabic: {
    id: "noto-sans-arabic",
    family: "Noto Sans Arabic Variable",
    packageName: "@fontsource-variable/noto-sans-arabic",
    files: [
      { packagePath: "files/noto-sans-arabic-arabic-wght-normal.woff2", subset: "arabic", weight: "100 900" },
      { packagePath: "files/noto-sans-arabic-latin-wght-normal.woff2", subset: "latin", weight: "100 900" },
    ],
    weights: [300, 400, 500, 600, 700, 800],
    styles: ["normal"],
    fallback: 'Tahoma, Arial, sans-serif',
    attribution: "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)",
    sourceUrl: "https://github.com/notofonts/arabic",
  },
};

type TypographyProfile = {
  id: string;
  display: keyof typeof FONTS;
  body: keyof typeof FONTS;
  mono?: keyof typeof FONTS;
  rationale: string;
};

const LATIN_PROFILES: TypographyProfile[] = [
  { id: "civic-editorial", display: "newsreader", body: "manrope", rationale: "An evidence-led serif carries consequential headings while a compact humanist sans keeps tasks and disclosures lucid." },
  { id: "material-character", display: "fraunces", body: "manrope", rationale: "A variable material serif gives objects and processes character without sacrificing the precision of the reading layer." },
  { id: "kinetic-grotesk", display: "bricolage", body: "manrope", rationale: "An optically flexible grotesk gives interactive or collection-led work a distinct voice while the body remains calm." },
  { id: "operational-mono", display: "plexMono", body: "manrope", mono: "plexMono", rationale: "A measured mono display exposes operational structure; the body remains efficient and readable." },
  { id: "quiet-humanist", display: "manrope", body: "manrope", rationale: "One variable humanist family carries a restrained interface through scale, weight, and spacing rather than a generic system fallback." },
  { id: "documentary-contrast", display: "instrument", body: "manrope", rationale: "A sharply drawn documentary serif creates a deliberate voice contrast while the task layer remains neutral and compact." },
];

const ARABIC_PROFILES: TypographyProfile[] = [
  { id: "arabic-civic", display: "notoKufi", body: "notoSansArabic", rationale: "A locally bundled Kufi display establishes authority while Noto Sans Arabic preserves long-form clarity across Arabic and Latin text." },
  { id: "arabic-operational", display: "notoKufi", body: "readex", rationale: "A Kufi display and Readex body make dense comparisons and bilingual task labels compact without falling back to a platform font." },
];

function detectScript(value: string): TypographyScript {
  const hasArabic = /[\u0600-\u06ff]/.test(value);
  const hasLatin = /[A-Za-z]/.test(value);
  if (hasArabic && hasLatin) return "mixed";
  return hasArabic ? "arabic" : "latin";
}

function stableIndex(value: string, length: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function chooseProfile(analysis: BriefAnalysis, plan: DesignPlan, script: TypographyScript): TypographyProfile {
  const selectedId = plan.directionPortfolio?.selectedDirectionId ?? "";
  const haystack = `${analysis.industry} ${analysis.tone} ${analysis.rawBrief} ${plan.typePairing.display} ${plan.typePairing.rationale}`.toLowerCase();
  if (script !== "latin") {
    return /data|technical|developer|analytics|workbench|operations|مقارن|بيانات|تقني/.test(haystack)
      ? ARABIC_PROFILES[1]
      : ARABIC_PROFILES[0];
  }
  if (/ibm plex|mono|data|technical|developer|analytics|engineering|workbench|operations/.test(haystack)) return LATIN_PROFILES[3];
  if (/fraunces|material|print|letterpress|paper|fashion|food|restaurant|beauty|tactile/.test(haystack)) return LATIN_PROFILES[1];
  if (/bricolage|playful|laboratory|collection|experimental|kinetic|interactive/.test(haystack)) return LATIN_PROFILES[2];
  if (/instrument|documentary|archive|cultural/.test(haystack)) return LATIN_PROFILES[5];
  if (/newsreader|georgia|serif|law|legal|civic|trust|discreet|narrative|editorial/.test(haystack)) return LATIN_PROFILES[0];
  if (/manrope variable/.test(haystack)) return LATIN_PROFILES[4];
  return LATIN_PROFILES[stableIndex(`${analysis.rawBrief}\u0000${selectedId}`, LATIN_PROFILES.length)];
}

function fontFiles(font: FontDefinition): TypographyFontFile[] {
  return font.files.map((entry) => ({
    id: `${font.id}-${entry.subset}-${entry.weight.replace(/\s+/g, "-")}-${entry.style ?? "normal"}`,
    family: font.family,
    packageName: font.packageName,
    packagePath: entry.packagePath,
    outputFileName: entry.packagePath.split("/").at(-1) ?? `${font.id}.woff2`,
    subset: entry.subset,
    weight: entry.weight,
    style: entry.style ?? "normal",
    unicodeRange: entry.subset === "arabic" ? ARABIC_RANGE : LATIN_RANGE,
    attribution: font.attribution,
    sourceUrl: font.sourceUrl,
    license: "OFL-1.1",
  }));
}

function assignment(role: TypographyAssignment["role"], font: FontDefinition, rationale: string): TypographyAssignment {
  return {
    role,
    family: font.family,
    stack: `"${font.family}", ${font.fallback}`,
    weights: [...font.weights],
    styles: [...font.styles],
    fileIds: fontFiles(font).map((file) => file.id),
    rationale,
  };
}

export function buildTypographyContract(analysis: BriefAnalysis, plan: DesignPlan): TypographyContract {
  const script = detectScript(analysis.rawBrief);
  const profile = chooseProfile(analysis, plan, script);
  const display = FONTS[profile.display];
  const body = FONTS[profile.body];
  const mono = profile.mono ? FONTS[profile.mono] : undefined;
  const uniqueFonts = [...new Set([display, body, mono].filter((font): font is FontDefinition => Boolean(font)))];
  const files = uniqueFonts.flatMap(fontFiles);
  return {
    version: TYPOGRAPHY_CONTRACT_VERSION,
    profileId: profile.id,
    script,
    display: assignment("display", display, "Use for primary headings and the selected direction's dominant typographic voice."),
    body: assignment("body", body, "Use for paragraphs, controls, labels, and evidence-bearing content."),
    ...(mono ? { mono: assignment("mono", mono, "Use only for measurements, code-like records, or operational metadata.") } : {}),
    files,
    fallbackPolicy: "The named bundled family is primary. Platform fonts are fallback metrics only and must never become the unexplained design choice.",
    forbiddenPrimaryFonts: ["Arial", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Geneva", "Trebuchet MS"],
    rationale: profile.rationale,
  };
}

export function applyTypographyContract(plan: DesignPlan, contract: TypographyContract): DesignPlan {
  return {
    ...plan,
    typePairing: {
      display: contract.display.stack,
      body: contract.body.stack,
      rationale: `${contract.rationale} Profile: ${contract.profileId}; script coverage: ${contract.script}.`,
    },
  };
}

function publicFontUrl(framework: ProjectFramework, fileName: string): string {
  return framework === "html" ? `./assets/fonts/${fileName}` : `/assets/fonts/${fileName}`;
}

export function typographyCss(contract: TypographyContract, framework: ProjectFramework): string {
  const faces = contract.files.map((file) => `@font-face {
  font-family: "${file.family}";
  font-style: ${file.style};
  font-display: swap;
  font-weight: ${file.weight};
  src: url("${publicFontUrl(framework, file.outputFileName)}") format("woff2");
  unicode-range: ${file.unicodeRange};
}`).join("\n\n");
  return `${faces}

:root {
  --verve-font-display: ${contract.display.stack};
  --verve-font-body: ${contract.body.stack};${contract.mono ? `\n  --verve-font-mono: ${contract.mono.stack};` : ""}
}

body, button, input, textarea, select {
  font-family: var(--verve-font-body);
}

h1, h2, h3, h4, h5, h6, [data-verve-display] {
  font-family: var(--verve-font-display);
}${contract.mono ? `

code, pre, kbd, samp, [data-verve-mono] {
  font-family: var(--verve-font-mono);
}` : ""}
}`;
}

export function formatTypographyForCodegen(contract: TypographyContract, framework: ProjectFramework): string {
  return `=== BUNDLED TYPOGRAPHY CONTRACT v${contract.version} ===
Profile: ${contract.profileId}; script: ${contract.script}
Display: ${contract.display.stack}; allowed weights: ${contract.display.weights.join(", ")}
Body: ${contract.body.stack}; allowed weights: ${contract.body.weights.join(", ")}
${contract.mono ? `Mono: ${contract.mono.stack}; allowed weights: ${contract.mono.weights.join(", ")}\n` : ""}The project assembler supplies the exact local WOFF2 files and this CSS contract. Use --verve-font-display and --verve-font-body as the primary families. Do not replace them with Georgia, Times New Roman, Verdana, Arial, or another platform font. Do not add a runtime font import.

${typographyCss(contract, framework)}`;
}

export function formatTypographyReceipt(contract: TypographyContract, receipt: TypographyDeliveryReceipt): string {
  const assignments = [contract.display, contract.body, contract.mono].filter((item): item is TypographyAssignment => Boolean(item));
  const files = receipt.files.length
    ? receipt.files.map((file) => `- **${file.family}** — \`${file.projectPath}\`; ${file.byteLength} bytes; SHA-256 \`${file.sha256}\`; ${file.license}; ${file.attribution}; source: ${file.sourceUrl}`).join("\n")
    : "- No font binary was delivered.";
  return `## Typography contract

- Version: ${contract.version}
- Profile: ${contract.profileId}
- Script coverage: ${contract.script}
- Status: ${receipt.status}
- Rationale: ${contract.rationale}
- Fallback policy: ${contract.fallbackPolicy}

### Assignments

${assignments.map((item) => `- ${item.role}: ${item.stack}; weights ${item.weights.join(", ")}; ${item.rationale}`).join("\n")}

### Bundled font files

${files}

- Full OFL license text and copyright notices are included in \`FONT-LICENSES.md\`.
${receipt.warnings.length ? `\n### Typography delivery warnings\n\n${receipt.warnings.map((warning) => `- ${warning}`).join("\n")}` : ""}`;
}

export function typographyContractFamilies(contract: TypographyContract): string[] {
  return [...new Set([contract.display.family, contract.body.family, contract.mono?.family].filter((family): family is string => Boolean(family)))];
}

export function generatedTypographyUsesContract(generated: GeneratedCode, contract: TypographyContract): boolean {
  const source = [generated.code, ...(generated.files ?? []).map((file) => file.content)].join("\n");
  const normalized = source.toLowerCase();
  return normalized.includes("var(--verve-font-display)")
    || normalized.includes("var(--verve-font-body)")
    || typographyContractFamilies(contract).some((family) => normalized.includes(family.toLowerCase()));
}
