import { expect, test } from "@playwright/test";
import { analyzeBriefLocally } from "../../lib/engine/brief-analyzer";
import { generateDirectionBoard, createDirectionCheckpoint } from "../../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../../lib/adapters/storage/static-content-repositories";

test("content-aware studies expose six structures and preserve manual and recommended choice", async ({ page }, testInfo) => {
  const brief = 'A Cairo print studio has 5 product lines. "Riso Notebook — A5, 80 pages, 120gsm recycled paper, EGP 450." Buyers compare paper weight, binding type, batch size and price. Explicitly avoid beige palettes.';
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
  expect(new Set(await section.getByTestId("direction-study").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-experience")))).size).toBe(6);
  // Host card metadata must not overwrite the candidate's actual text colors.
  expect(await section.getByTestId("direction-study").first().locator("dd").first().evaluate((element) => {
    const stage = element.closest('[data-testid="direction-study"]')!;
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(stage).getPropertyValue("--study-ink");
    stage.append(probe);
    const matches = getComputedStyle(element).color === getComputedStyle(probe).color;
    probe.remove();
    return matches;
  })).toBe(true);
  const other = board.portfolio.candidates.find((candidate) => candidate.id !== board.diversity.recommendedDirectionId)!;
  const manual = section.locator(`input[value="${other.id}"]`);
  await manual.check();
  const inspect = manual.locator("../..").getByRole("button", { name: /^Inspect study:/ });
  await inspect.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Riso Notebook");
  await expect(dialog).toContainText("120gsm recycled paper");
  await expect(dialog).toContainText("4 product lines lack verified");
  await expect(dialog).toContainText("not a final-site preview");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(inspect).toBeFocused();
  await expect(manual).toBeChecked();
  const selectedCardTypeface = await manual.locator("..").locator("strong").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(selectedCardTypeface).toBe(other.identity.displayTypeface);
  const selectedFamily = other.identity.displayTypeface.match(/^"([^"]+)"/)?.[1];
  if (selectedFamily) {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate((family) => document.fonts.check(`24px "${family}"`, "Direction"), selectedFamily)).toBe(true);
  }
  await section.getByRole("button", { name: "Use Verve's most novel" }).click();
  await expect(section.locator(`input[value="${board.diversity.recommendedDirectionId}"]`)).toBeChecked();
  await manual.check();
  await section.screenshot({ path: testInfo.outputPath("direction-board.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Generate Fast result" }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ selectedDirectionId: other.id, directionCheckpoint: { inputHash: board.inputHash } });
});

test("study interactions inspect real records without changing the chosen direction or claiming task completion", async ({ page }, testInfo) => {
  const brief = 'A Cairo print studio. "Riso Notebook — A5, 80 pages, 120gsm paper, EGP 450." "Thread Notebook — A6, 64 pages, 100gsm paper, EGP 320." Compare paper weight and price. No photography.';
  const board = await generateDirectionBoard({ llm: { async complete() { throw new Error("offline"); } }, analysis: analyzeBriefLocally(brief), framework: "html", mode: "fast", referenceRepository: new StaticReferenceLibraryRepository() });
  await page.addInitScript(() => localStorage.setItem("verve_anthropic_api_key", "offline-test"));
  await page.route("**/api/directions/stream", (route) => route.fulfill({ contentType: "text/event-stream", body: `event: directions:complete\ndata: ${JSON.stringify({ board, checkpoint: createDirectionCheckpoint(board) })}\n\n` }));
  await page.goto("/create");
  await page.getByLabel("Design brief").fill(brief);
  await page.getByRole("button", { name: "Explore 6 directions" }).click();
  const section = page.getByRole("region", { name: "Choose the experience before Verve writes code." });
  const selected = board.diversity.recommendedDirectionId;
  for (const candidate of board.portfolio.candidates) {
    await section.locator(`input[value="${candidate.id}"]`).locator("../..").getByRole("button", { name: /^Inspect study:/ }).click();
    const dialog = page.getByRole("dialog");
    const study = dialog.getByTestId("direction-study");
    await expect(study.locator("img")).toHaveCount(0);
    const second = study.getByRole("button", { name: /Thread Notebook/ });
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-pressed", "true");
    if (candidate.descriptors.experienceModel === "live-canvas") {
      await study.getByRole("button", { name: "Reveal full specification" }).click();
      await expect(study).toContainText("EGP 320");
    } else await expect(study.locator('[aria-live="polite"]')).toContainText("EGP 320");
    await dialog.screenshot({ path: testInfo.outputPath(`${candidate.descriptors.experienceModel}-study.png`) });
    await page.keyboard.press("Escape");
    await expect(section.locator(`input[value="${selected}"]`)).toBeChecked();
  }
  const candidate = board.portfolio.candidates.find((entry) => entry.id !== selected)!;
  await section.locator(`input[value="${candidate.id}"]`).locator("../..").getByRole("button", { name: /^Inspect study:/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Choose this direction" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(section.locator(`input[value="${candidate.id}"]`)).toBeChecked();
});
