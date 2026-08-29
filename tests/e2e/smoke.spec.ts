import { expect, test, type Page } from "@playwright/test";

async function openArchitectureInEditor(page: Page) {
  await page.goto("/examples/architecture", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Edit this project/i }).click();
  await expect(page).toHaveURL(/\/editor\?(project|demo)=/, { timeout: 15_000 });
  await expect(page.getByRole("combobox", { name: "Project" })).toContainText("reframe-london-adaptive-reuse");
}

test("the homepage explains one clear path without browser errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (window === window.top) window.localStorage.setItem("verve_anthropic_api_key", "sk-ant-hydration-test");
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Verve/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("From a brief to a website");
  await expect(page.getByRole("link", { name: /Start creating/i })).toHaveAttribute("href", "/create");
  await expect(page.getByRole("link", { name: /See an example/i })).toHaveAttribute("href", "/examples");
  if ((page.viewportSize()?.width ?? 1280) <= 768) {
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveCount(1);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation menu" }).getByRole("button", { name: "Provider settings", exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveCount(6);
    await expect(page.getByRole("button", { name: /API key configured/ })).toBeVisible();
  }
  expect(runtimeErrors).toEqual([]);
});

test("the homepage does not overflow its rendered viewport", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const dimensions = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [...document.body.querySelectorAll("*")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: element.id ? `#${element.id}` : element.tagName.toLowerCase(), right: Math.round(rect.right) };
      })
      .filter((element) => element.right > viewport + 1)
      .slice(0, 8);
    return { viewport, document: document.documentElement.scrollWidth, offenders };
  });
  expect(dimensions.document, `overflow: ${JSON.stringify(dimensions.offenders)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("Create reveals advanced choices only when requested", async ({ page }) => {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "What are you building?" })).toBeVisible();
  await expect(page.getByLabel("Design brief")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Fast/ })).toBeHidden();
  await expect(page.getByText("AI provider", { exact: true })).toBeHidden();

  await page.getByText("Project options", { exact: true }).click();
  const fast = page.getByRole("radio", { name: /Fast/ });
  const studio = page.getByRole("radio", { name: /Studio/ });
  await expect(fast).toBeChecked();
  await studio.check();
  await expect(page.getByRole("button", { name: "Run Studio pipeline" })).toBeVisible();

  await page.getByText("Provider settings", { exact: true }).click();
  await expect(page.getByText("AI provider", { exact: true })).toBeVisible();
});

test("the brand kit accepts owned media without uploading it during setup", async ({ page }) => {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.getByText("Project options", { exact: true }).click();
  await page.getByText("Brand kit + owned media", { exact: true }).click();
  const brandName = page.getByLabel("Brand name");
  const fileInput = page.locator('input[type="file"]');
  await expect(brandName).toBeEnabled();
  await brandName.fill("Verve Test Identity");
  await fileInput.setInputFiles({
    name: "test-mark.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#14213d"/></svg>'),
  });
  await expect(page.getByText("1/4 local assets")).toBeVisible();
  await expect(page.getByText("test-mark.svg", { exact: true })).toBeVisible();
});

test("examples replace the duplicate demo and evidence galleries", async ({ page, request }) => {
  await page.goto("/examples", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Three briefs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reframe/ })).toHaveAttribute("href", "/examples/architecture");
  await expect(page.getByRole("link", { name: /Maeda Cairo/ })).toHaveAttribute("href", "/examples/cairo");
  await expect(page.getByRole("link", { name: /Ledgerline/ })).toHaveAttribute("href", "/examples/carbon");

  await page.goto("/examples/architecture", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Reframe", exact: true })).toBeVisible();
  await expect(page.frameLocator('iframe[title="reframe-london-adaptive-reuse story preview"]').getByRole("heading", { name: /The building already knows/ })).toBeVisible();
  await expect(page.getByText("Open design and engineering checks")).toBeVisible();

  expect((await request.get("/demos")).url()).toMatch(/\/examples$/);
  expect((await request.get("/showcase")).url()).toMatch(/\/examples$/);
});

test("the editor starts calm, then previews code edits and restores them", async ({ page }) => {
  await page.goto("/editor", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "What would you like to develop?" })).toBeVisible();

  await openArchitectureInEditor(page);
  await page.getByRole("button", { name: "Code", exact: true }).click();
  const editor = page.getByLabel("Edit index.html");
  await expect(editor).toBeVisible();
  const proof = "Editor persistence proof";
  await editor.fill(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Editor proof</title></head><body><main><h1>${proof}</h1></main></body></html>`);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title$="live preview"]').getByRole("heading", { name: proof })).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.getByLabel("Edit index.html")).toHaveValue(new RegExp(proof));
  const menu = page.locator("details").filter({ hasText: "Capture revision" });
  await menu.locator("summary").click();
  await menu.getByRole("button", { name: "Capture revision" }).click();
  await expect(menu.getByText("Revision 1", { exact: true })).toBeVisible();
});

test("AI changes stay staged until human acceptance", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("verve_openai_api_key", "sk-test-editor-key"));
  await page.route("**/api/editor/patch", async (route) => {
    const request = route.request().postDataJSON() as { project: { files: Array<{ path: string; content: string }> } };
    const html = request.project.files.find((file) => file.path === "index.html")!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        proposal: {
          summary: "Make the opening explicitly iterative",
          rationale: "The requested proof belongs in the existing hero heading.",
          changes: [{ path: "index.html", content: html.content.replace("The building", "The AI proposal"), reason: "Stages a visible hero change." }],
        },
        callCount: 1,
      }),
    });
  });

  await openArchitectureInEditor(page);
  await page.getByLabel("What should change?").fill("Make the opening explicitly iterative");
  await page.getByRole("button", { name: "Stage AI proposal" }).click();
  await expect(page.getByText("STAGED / NOT APPLIED")).toBeVisible();
  await expect(page.frameLocator('iframe[title$="live preview"]').getByRole("heading", { name: /The AI proposal already knows/ })).toBeVisible();
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(page.getByText(/AI proposal accepted/)).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.frameLocator('iframe[title$="live preview"]').getByRole("heading", { name: /The AI proposal already knows/ })).toBeVisible();
});

test("Verve public surfaces obey their readable-type floor", async ({ page }) => {
  for (const path of ["/", "/create", "/examples", "/examples/architecture", "/editor"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const tinyText = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
          && (element.textContent ?? "").trim().length > 0 && Number.parseFloat(style.fontSize) < 10;
      })
      .slice(0, 12)
      .map((element) => ({ tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 60), fontSize: getComputedStyle(element).fontSize })));
    expect(tinyText, `${path} renders text below Verve's 10px floor`).toEqual([]);
  }
});

test("security headers protect the public surface", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("public discovery files expose the simplified information architecture", async ({ request }) => {
  const [robots, sitemap, manifest, socialImage] = await Promise.all([
    request.get("/robots.txt"), request.get("/sitemap.xml"), request.get("/manifest.webmanifest"), request.get("/opengraph-image"),
  ]);
  for (const response of [robots, sitemap, manifest, socialImage]) expect(response.ok()).toBeTruthy();
  const map = await sitemap.text();
  expect(await robots.text()).toContain("https://verve-dev.vercel.app/sitemap.xml");
  expect(map).toContain("https://verve-dev.vercel.app/create");
  expect(map).toContain("https://verve-dev.vercel.app/examples/architecture");
  expect(map).not.toContain("/demos");
  expect(map).not.toContain("/showcase");
  expect((await manifest.json()).start_url).toBe("/");
  expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("the mobile navigation is keyboard-safe and uses plain labels", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hamburger = page.getByRole("button", { name: "Open menu" });
  const mobile = (page.viewportSize()?.width ?? 1280) <= 768;
  if (!mobile) {
    await expect(hamburger).toBeHidden();
    return;
  }
  await hamburger.click();
  const drawer = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Create", exact: true })).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(hamburger).toBeFocused();
  await hamburger.click();
  await drawer.getByRole("link", { name: "Examples", exact: true }).click();
  await expect(page).toHaveURL(/\/examples$/);
  await expect(page.getByRole("heading", { name: /Three briefs/ })).toBeVisible();
});
