import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { TypographyContract, TypographyDeliveryReceipt } from "../domain/typography";
import type { ProjectFile, ProjectFramework } from "../project/types";
import { typographyCss } from "./typography-contract";

const require = createRequire(import.meta.url);
const MAX_TYPOGRAPHY_BYTES = 500_000;
const OFL_1_1_TEXT = `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the copyright statement(s).

"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or substituting -- in part or in whole -- any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.

5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.`;

export type TypographyDelivery = {
  receipt: TypographyDeliveryReceipt;
  files: ProjectFile[];
  css: string;
  licenseFile?: ProjectFile;
};

export type TypographyFileLoader = (packageName: string, packagePath: string) => Promise<Buffer>;

function resolveFontFile(packageName: string, packagePath: string): string {
  const key = `${packageName}/${packagePath}`;
  switch (key) {
    case "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2");
    case "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2": return require.resolve("@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2");
    case "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2": return require.resolve("@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2");
    case "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2");
    case "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2");
    case "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2");
    case "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2": return require.resolve("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2");
    case "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2": return require.resolve("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2");
    case "@fontsource-variable/readex-pro/files/readex-pro-arabic-wght-normal.woff2": return require.resolve("@fontsource-variable/readex-pro/files/readex-pro-arabic-wght-normal.woff2");
    case "@fontsource-variable/readex-pro/files/readex-pro-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/readex-pro/files/readex-pro-latin-wght-normal.woff2");
    case "@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2": return require.resolve("@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-arabic-wght-normal.woff2");
    case "@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/noto-kufi-arabic/files/noto-kufi-arabic-latin-wght-normal.woff2");
    case "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2": return require.resolve("@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2");
    case "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-latin-wght-normal.woff2": return require.resolve("@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-latin-wght-normal.woff2");
    default: throw new Error(`Typography package file is not allowlisted: ${key}`);
  }
}

async function defaultLoader(packageName: string, packagePath: string): Promise<Buffer> {
  return readFile(resolveFontFile(packageName, packagePath));
}

function projectFontPath(framework: ProjectFramework, fileName: string): string {
  return framework === "html" ? `assets/fonts/${fileName}` : `public/assets/fonts/${fileName}`;
}

export async function deliverTypographyContract(
  contract: TypographyContract,
  framework: ProjectFramework,
  loader: TypographyFileLoader = defaultLoader
): Promise<TypographyDelivery> {
  const files: ProjectFile[] = [];
  const delivered: TypographyDeliveryReceipt["files"] = [];
  const warnings: string[] = [];
  let totalBytes = 0;

  for (const font of contract.files) {
    try {
      const bytes = await loader(font.packageName, font.packagePath);
      if (totalBytes + bytes.byteLength > MAX_TYPOGRAPHY_BYTES) {
        warnings.push(`BLOCKING: Typography bundle exceeds the ${MAX_TYPOGRAPHY_BYTES}-byte project budget.`);
        break;
      }
      totalBytes += bytes.byteLength;
      const projectPath = projectFontPath(framework, font.outputFileName);
      files.push({ path: projectPath, content: bytes.toString("base64"), encoding: "base64", mediaType: "font/woff2", language: "binary", role: "asset" });
      delivered.push({
        id: font.id,
        family: font.family,
        projectPath,
        mediaType: "font/woff2",
        byteLength: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        attribution: font.attribution,
        sourceUrl: font.sourceUrl,
        license: font.license,
      });
    } catch (error) {
      warnings.push(`BLOCKING: Typography asset ${font.id} could not be bundled: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let licenseFile: ProjectFile | undefined;
  try {
    const notices = [...new Map(contract.files.map((font) => [font.packageName, font.attribution])).entries()]
      .map(([packageName, attribution]) => `- **${packageName}** — ${attribution}`)
      .join("\n");
    licenseFile = {
      path: "FONT-LICENSES.md",
      content: `# Bundled font licenses\n\n## Copyright notices\n\n${notices}\n\n## SIL Open Font License 1.1\n\n${OFL_1_1_TEXT}\n`,
      encoding: "utf8",
      language: "markdown",
      role: "documentation",
    };
  } catch (error) {
    warnings.push(`BLOCKING: Bundled font license text could not be assembled: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    receipt: {
      version: 1,
      status: warnings.length === 0 && delivered.length === contract.files.length ? "ready" : "failed",
      profileId: contract.profileId,
      script: contract.script,
      files: delivered,
      warnings,
    },
    files,
    css: typographyCss(contract, framework),
    ...(licenseFile ? { licenseFile } : {}),
  };
}
