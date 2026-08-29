import { expect, test } from "@playwright/test";

test("each example keeps a wide, usable live result at laptop width", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  for (const slug of ["architecture", "cairo", "carbon"] as const) {
    await page.goto(`/examples/${slug}`, { waitUntil: "domcontentloaded" });
    const iframe = page.locator("iframe[title$='story preview']");
    await iframe.scrollIntoViewIfNeeded();
    await expect(iframe).toBeVisible();
    await expect.poll(async () => (await iframe.boundingBox())?.width ?? 0).toBeGreaterThan(1100);
    await iframe.screenshot({ path: testInfo.outputPath(`${slug}-laptop.png`) });
  }

  const carbonFrame = page.frameLocator("iframe[title$='story preview']");
  await expect(carbonFrame.locator("table")).toHaveCount(1);
  await expect(carbonFrame.locator(".reading")).toHaveCSS("position", "static");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
