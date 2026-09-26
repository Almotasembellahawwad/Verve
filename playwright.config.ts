import { defineConfig, devices } from "@playwright/test";

const port = 4321;
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const productionServer = Boolean(process.env.CI) || process.env.PLAYWRIGHT_PRODUCTION === "1";
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: externalBaseUrl ? undefined : {
    command: `node node_modules/next/dist/bin/next ${productionServer ? "start" : "dev"} --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !productionServer,
    timeout: 120_000,
  },
});
