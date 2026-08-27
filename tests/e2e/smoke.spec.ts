import { expect, test } from "@playwright/test";

test("the public workbench promise renders without browser errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.setItem("verve_anthropic_api_key", "sk-ant-hydration-test"));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Verve/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A site is not");
  await expect(page.getByRole("link", { name: /Open the workbench/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter the live gallery/i })).toHaveAttribute("href", "/demos");
  if ((page.viewportSize()?.width ?? 1280) <= 768) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: /Change API key/ })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "AI key configured" })).toBeVisible();
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
        return { selector: element.id ? `#${element.id}` : element.tagName.toLowerCase() + (typeof element.className === "string" && element.className ? `.${element.className.split(/\s+/)[0]}` : ""), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      })
      .filter((element) => element.right > viewport + 1)
      .slice(0, 8);
    const scrollContainers = [document.documentElement, document.body, ...document.body.querySelectorAll("*")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({ selector: element === document.documentElement ? "html" : element === document.body ? "body" : element.id ? `#${element.id}` : element.tagName.toLowerCase() + (typeof element.className === "string" && element.className ? `.${element.className.split(/\s+/)[0]}` : ""), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX }))
      .slice(0, 12);
    return { viewport, document: document.documentElement.scrollWidth, offenders, scrollContainers };
  });
  expect(dimensions.document, `document width ${dimensions.document}px exceeds ${dimensions.viewport}px; offenders: ${JSON.stringify(dimensions.offenders)}; scroll containers: ${JSON.stringify(dimensions.scrollContainers)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("Verve public surfaces obey their own readable-type floor", async ({ page }) => {
  for (const path of ["/", "/demos", "/lab", "/showcase"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const tinyText = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0
          && (element.textContent ?? "").trim().length > 0
          && Number.parseFloat(style.fontSize) < 10;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: (element.textContent ?? "").trim().slice(0, 60),
        fontSize: getComputedStyle(element).fontSize,
      })));
    expect(tinyText, `${path} renders text below Verve's 10px floor`).toEqual([]);
  }
});

test("security headers protect the public surface", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["content-security-policy"]).toContain("https://fonts.googleapis.com");
  expect(response.headers()["content-security-policy"]).toContain("https://cdn.fontshare.com");
});

test("public discovery files point to Verve's canonical deployment", async ({ request }) => {
  const [robots, sitemap, manifest, socialImage] = await Promise.all([
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/manifest.webmanifest"),
    request.get("/opengraph-image"),
  ]);

  for (const response of [robots, sitemap, manifest, socialImage]) {
    expect(response.ok()).toBeTruthy();
  }

  expect(await robots.text()).toContain("https://verve-dev.vercel.app/sitemap.xml");
  expect(await sitemap.text()).toContain("https://verve-dev.vercel.app/lab");
  expect(await sitemap.text()).toContain("https://verve-dev.vercel.app/demos");
  expect((await manifest.json()).start_url).toBe("/");
  expect(socialImage.headers()["content-type"]).toContain("image/png");
});

test("the separate demo gallery opens three editable native HTML projects", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    if (window === window.top) {
      window.localStorage.setItem("verve_onboarding_seen_v2", "1");
    }
  });
  await page.goto("/demos", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /Three briefs/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reframe/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Maeda Cairo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ledgerline/ })).toBeVisible();

  await expect(page.getByRole("heading", { name: "reframe-london-adaptive-reuse" })).toBeVisible();
  await expect(page.getByText("Native HTML preview · zero package downloads")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Edit index.html" })).toBeEditable();

  const preview = page.frameLocator('iframe[title="reframe-london-adaptive-reuse live preview"]');
  await expect(preview.getByRole("heading", { name: /The building already knows/ })).toBeVisible();
  await expect(page.getByText("Static validation and the rendered result both passed.")).toBeVisible();

  await page.locator("#select-demo-cairo").click();
  await expect(page.getByRole("heading", { name: "maeda-cairo-public-demo" })).toBeVisible();

  await page.locator("#select-demo-carbon").click();
  await expect(page.getByRole("heading", { name: "ledgerline-carbon-operations" })).toBeVisible();
});

test("the mobile hamburger is a keyboard-safe navigation drawer", async ({ page }) => {
  await page.addInitScript(() => {
    if (window === window.top) window.localStorage.setItem("verve_onboarding_seen_v2", "1");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hamburger = page.getByRole("button", { name: "Open menu" });
  const mobile = (page.viewportSize()?.width ?? 1280) <= 768;
  if (!mobile) {
    await expect(hamburger).toBeHidden();
    return;
  }

  await expect(hamburger).toBeVisible();
  await hamburger.click();
  const drawer = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("link", { name: "01 / Process" })).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "02 / Live demos" }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/demos$/);
  await expect(page.getByRole("heading", { name: /Three briefs/ })).toBeVisible();
});
