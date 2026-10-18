import { defineConfig } from "@playwright/test";

const baseURL = `http://127.0.0.1:${process.env.PORT ?? "4173"}`;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: { baseURL, browserName: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/serve.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
