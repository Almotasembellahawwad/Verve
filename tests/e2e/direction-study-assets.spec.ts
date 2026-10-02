import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runDirectionExplorationUseCase } from "../../lib/application/run-direction-exploration-use-case";
import { DirectionRequestSchema } from "../../lib/api/generation-request";
import { directionCheckpointMatches } from "../../lib/engine/direction-board";
import { directionBrandContext } from "../../lib/project/brand-kit";
import { StaticReferenceLibraryRepository } from "../../lib/adapters/storage/static-content-repositories";

test("Arabic studies use local assets and both bundled fonts; changed asset metadata invalidates the board", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Explicitly checks all three viewport widths.");
  const brief = 'استوديو طباعة في القاهرة يعرض منتجين. "دفتر ريزو — A5، 80 صفحات، EGP 450". "دفتر خيط — A6، 64 صفحات، EGP 320". المهمة مقارنة الورق والسعر قبل الطلب.';
  let directionCalls = 0;
  let lastHash = "";
  await page.addInitScript(() => localStorage.setItem("verve_anthropic_api_key", "offline-test"));
  await page.route("**/api/directions/stream", async (route) => {
    const input = DirectionRequestSchema.parse(route.request().postDataJSON());
    expect(input.ownedAssets).toHaveLength(1);
    expect(Object.hasOwn(input.ownedAssets[0], "content")).toBe(false);
    const result = await runDirectionExplorationUseCase(input, { referenceLibraryRepository: new StaticReferenceLibraryRepository(), llm: { async complete() { directionCalls++; throw new Error("offline fixture"); } } });
    expect(directionCheckpointMatches(result.checkpoint, { brief: input.brief, framework: input.framework, mode: input.mode, brandContext: directionBrandContext(input.brandProfile, input.ownedAssets) })).toBe(true);
    if (lastHash) expect(result.board.inputHash).not.toBe(lastHash);
    lastHash = result.board.inputHash;
    return route.fulfill({ contentType: "text/event-stream", body: `event: directions:complete\ndata: ${JSON.stringify(result)}\n\n` });
  });
  const remoteImages: string[] = [];
  page.on("request", (request) => { if (request.resourceType() === "image" && !request.url().startsWith("http://127.0.0.1")) remoteImages.push(request.url()); });
  await page.goto("/create");
  await page.getByLabel("Design brief").fill(brief);
  await page.getByText("Project options", { exact: true }).click();
  await page.getByText("Brand kit + owned media", { exact: true }).click();
  // Existing licensed fixture used as a simulated owned upload, not a provider output.
  await page.locator('input[type="file"]').setInputFiles({ name: "owned-paper.webp", mimeType: "image/webp", buffer: readFileSync(join(process.cwd(), "public/demo-assets/reframe-retention-study.webp")) });
  await page.getByRole("button", { name: "Explore 6 directions" }).click();
  const section = page.getByRole("region", { name: "Choose the experience before Verve writes code." });
  await expect(section.getByTestId("direction-study")).toHaveCount(6);
  await expect(section.getByTestId("direction-study").first()).toHaveAttribute("dir", "rtl");
  const inspect = section.getByRole("button", { name: /^Inspect study:/ }).first();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await inspect.click();
    const dialog = page.getByRole("dialog");
    const study = dialog.getByTestId("direction-study");
    await expect(study.locator("img")).toHaveCount(1);
    expect(await study.locator("img").evaluate((image) => (image as HTMLImageElement).src.startsWith("data:image/webp;base64,"))).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    // fonts.check alone passes for a nonexistent family; require real loaded faces.
    for (const target of [study.locator("h4"), study.locator("dd").first()]) {
      expect(await target.evaluate((element) => {
        const family = getComputedStyle(element).fontFamily.split(",")[0].trim().replace(/["']/g, "");
        return [...document.fonts].some((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded");
      })).toBe(true);
    }
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath(`arabic-owned-${width}.png`) });
    await page.keyboard.press("Escape");
  }
  expect(directionCalls).toBe(1);
  expect(remoteImages).toEqual([]);
  await page.getByLabel("Alt / model direction").fill("صورة خامة الورق المعتمدة");
  await expect(section).not.toBeVisible();
  await page.getByRole("button", { name: "Explore 6 directions" }).click();
  await expect(section.getByTestId("direction-study")).toHaveCount(6);
  expect(directionCalls).toBe(2);
});
