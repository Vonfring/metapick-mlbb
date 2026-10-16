import { defineConfig, devices } from "@playwright/test";

// Smoke tests against a production build that reads the seed files:
//   DATA_SOURCE=seed pnpm build && pnpm test:e2e
// Requests to other hosts never leave the browser (e2e/fixtures.ts), so the
// tests do not depend on the network.

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // CI retries a failed test once and keeps that run's trace in test-results/.
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { DATA_SOURCE: "seed" },
    timeout: 60_000,
  },
});
