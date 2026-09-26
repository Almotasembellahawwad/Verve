import { expect, test } from "@playwright/test";
import { analyzeBriefLocally } from "../../lib/engine/brief-analyzer";
import { generateDirectionBoard, createDirectionCheckpoint } from "../../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../../lib/adapters/storage/static-content-repositories";

test("direction sketches expose six structures and preserve manual and recommended choice", async ({ page }, testInfo) => {
  const brief = "A Cairo print studio needs buyers to compare notebook specifications and request a wholesale order.";
  const board = await generateDirectionBoard({
    llm: { async complete() { throw new Error("offline UI fixture"); } },
    analysis: analyzeBriefLocally(brief), framework: "html", mode: "fast",
    referenceRepository: new StaticReferenceLibraryRepository(),
  });
  const requests: unknown[] = [];
  await page.addInitScript(() => localStorage.setItem("verve_anthropic_api_key", "test-key-not-sent-to-a-provider"));
  await page.route("**/api/directions/stream", (route) => route.fulfill({
    contentType: "text/event-stream",
    body: `event: directions:complete\ndata: ${JSON.stringify({ board, checkpoint: createDirectionCheckpoint(board) })}\n\n`,
  }));
  await page.route("**/api/generate/stream", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "text/event-stream", body: 'event: error\ndata: {"message":"Fixture generation stopped"}\n\n' });
  });
  await page.goto("/create");
  await page.getByLabel("Design brief").fill(brief);
  await page.getByRole("button", { name: "Explore 6 directions" }).click();
  const section = page.getByRole("region", { name: "Choose the experience before Verve writes code." });
  await expect(section.getByRole("img")).toHaveCount(6);
  expect(new Set(await section.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-experience")))).size).toBe(6);
  const other = board.portfolio.candidates.find((candidate) => candidate.id !== board.diversity.recommendedDirectionId)!;
  const manual = section.locator(`input[value="${other.id}"]`);
  await manual.check();
  await expect(manual).toBeChecked();
  await section.getByRole("button", { name: "Use Verve's most novel" }).click();
  await expect(section.locator(`input[value="${board.diversity.recommendedDirectionId}"]`)).toBeChecked();
  await manual.check();
  await section.screenshot({ path: testInfo.outputPath("direction-board.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Generate Fast result" }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ selectedDirectionId: other.id, directionCheckpoint: { inputHash: board.inputHash } });
});
