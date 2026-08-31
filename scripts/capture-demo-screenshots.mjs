import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const demoIds = ["architecture", "cairo", "carbon", "learning", "fashion", "civic"];
const outputDirectory = resolve(process.cwd(), "public", "demo-assets", "screenshots");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });

try {
  for (const demoId of demoIds) {
    const sourcePage = await context.newPage();
    await sourcePage.goto(`${baseUrl}/examples/${demoId}`, { waitUntil: "domcontentloaded" });
    const sourceDocument = await sourcePage.locator("iframe").first().getAttribute("srcdoc");
    await sourcePage.close();
    if (!sourceDocument) throw new Error(`No runnable preview document found for ${demoId}.`);

    const capturePage = await context.newPage();
    const withAssetBase = sourceDocument.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}/">`);
    await capturePage.setContent(withAssetBase, { waitUntil: "load" });
    await capturePage.evaluate(() => document.fonts.ready);
    await capturePage.waitForTimeout(300);
    await capturePage.screenshot({
      path: resolve(outputDirectory, `${demoId}.jpg`),
      type: "jpeg",
      quality: 88,
      fullPage: false,
    });
    await capturePage.close();
  }
} finally {
  await browser.close();
}
