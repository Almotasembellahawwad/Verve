import { expect, test } from "@playwright/test";

test("the demo workbench gives a laptop-width preview its own full row", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/demos");

  await expect(page.locator("[data-demo='architecture'] [data-demo-visual]")).toBeVisible();
  await expect(page.locator("[data-demo='cairo'] [data-demo-visual]")).toBeVisible();
  await expect(page.locator("[data-demo='carbon'] [data-demo-visual]")).toBeVisible();

  const iframe = page.locator("iframe[title$='live preview']");
  await iframe.scrollIntoViewIfNeeded();
  await expect(iframe).toBeVisible();
  await expect.poll(async () => (await iframe.boundingBox())?.width ?? 0).toBeGreaterThan(900);
  const architectureFrame = page.frameLocator("iframe[title$='live preview']");
  const titleBox = await architectureFrame.locator(".hero h1").boundingBox();
  const noteBox = await architectureFrame.locator(".hero-note").boundingBox();
  expect(titleBox && noteBox && titleBox.x + titleBox.width <= noteBox.x + 1).toBeTruthy();
  await iframe.screenshot({ path: testInfo.outputPath("architecture-laptop.png") });

  await page.locator("[data-demo='cairo']").click();
  await expect(page.frameLocator("iframe[title$='live preview']").locator(".sun")).toHaveCSS("display", "grid");
  await iframe.screenshot({ path: testInfo.outputPath("cairo-laptop.png") });

  await page.locator("[data-demo='carbon']").click();
  const carbonFrame = page.frameLocator("iframe[title$='live preview']");
  await expect(carbonFrame.locator("table")).toHaveCount(1);
  await expect(carbonFrame.locator(".reading")).toHaveCSS("position", "static");
  await iframe.screenshot({ path: testInfo.outputPath("carbon-laptop.png") });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
