import { expect, test } from "@playwright/test";

test("the public workbench promise renders without browser errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Verve/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A site is not");
  await expect(page.getByRole("link", { name: /Open the workbench/i })).toBeVisible();
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

test("security headers protect the public surface", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
