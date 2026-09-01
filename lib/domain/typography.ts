export const TYPOGRAPHY_CONTRACT_VERSION = 1 as const;

export type TypographyScript = "latin" | "arabic" | "mixed";
export type TypographyRole = "display" | "body" | "mono";

export type TypographyFontFile = {
  id: string;
  family: string;
  packageName: string;
  packagePath: string;
  outputFileName: string;
  subset: "latin" | "arabic";
  weight: string;
  style: "normal" | "italic";
  unicodeRange: string;
  attribution: string;
  sourceUrl: string;
  license: "OFL-1.1";
};

export type TypographyAssignment = {
  role: TypographyRole;
  family: string;
  stack: string;
  weights: number[];
  styles: Array<"normal" | "italic">;
  fileIds: string[];
  rationale: string;
};

export type TypographyContract = {
  version: typeof TYPOGRAPHY_CONTRACT_VERSION;
  profileId: string;
  script: TypographyScript;
  display: TypographyAssignment;
  body: TypographyAssignment;
  mono?: TypographyAssignment;
  files: TypographyFontFile[];
  fallbackPolicy: string;
  forbiddenPrimaryFonts: string[];
  rationale: string;
};

export type TypographyDeliveryFile = {
  id: string;
  family: string;
  projectPath: string;
  mediaType: "font/woff2";
  byteLength: number;
  sha256: string;
  attribution: string;
  sourceUrl: string;
  license: "OFL-1.1";
};

export type TypographyDeliveryReceipt = {
  version: 1;
  status: "ready" | "failed";
  profileId: string;
  script: TypographyScript;
  files: TypographyDeliveryFile[];
  warnings: string[];
};
