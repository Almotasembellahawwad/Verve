import { expect, test } from "@playwright/test";
import { PUBLIC_DEMOS } from "../../lib/demo/public-demo-gallery";
import { buildHtmlPreviewDocument } from "../../lib/project/html-preview";

const VIEWPORTS = [360, 768, 1440] as const;

test("all six frozen examples pass the three-width render contract", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is sufficient for the fixed 18-render matrix.");
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  for (const demo of PUBLIC_DEMOS) {
    for (const width of VIEWPORTS) {
      runtimeErrors.length = 0;
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await page.goto("about:blank");
      await page.setContent(buildHtmlPreviewDocument(demo.result.project, `e2e-${demo.id}-${width}`), { waitUntil: "load" });
      await page.waitForTimeout(60);
      const audit = await page.evaluate(() => {
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        const unnamedButtons = [...document.querySelectorAll<HTMLButtonElement>("button")]
          .filter((button) => !(button.textContent ?? "").trim() && !button.getAttribute("aria-label") && !button.title)
          .length;
        return {
          viewport: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          missingAlt: document.querySelectorAll("img:not([alt])").length,
          unnamedButtons,
          duplicates: [...new Set(duplicates)],
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
        };
      });
      expect(audit.documentWidth, `${demo.id} overflows at ${width}px`).toBeLessThanOrEqual(audit.viewport + 1);
      expect(audit.missingAlt, `${demo.id} has an image without alt text`).toBe(0);
      expect(audit.unnamedButtons, `${demo.id} has an unnamed button`).toBe(0);
      expect(audit.duplicates, `${demo.id} has duplicate element ids`).toEqual([]);
      expect(audit.lang, `${demo.id} has no document language`).not.toBe("");
      if (demo.id === "cairo") expect(audit.dir).toBe("rtl");
      expect(runtimeErrors, `${demo.id} raised a runtime error at ${width}px`).toEqual([]);
    }
  }
});
