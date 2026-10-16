import { test as base, expect, type Page } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../src/components/theme/theme-constants";

// A transparent 1 × 1 PNG served in place of images from other hosts.
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Every test keeps to localhost: images from other hosts (hero portraits on
 * the official CDN) get a blank stand-in, anything else is blocked. A test
 * fails on any error the page throws or logs, apart from the 404 a
 * not-found page reports for itself.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      await page.route(/^https?:\/\/(?!localhost)/, (route) =>
        route.request().resourceType() === "image"
          ? route.fulfill({ contentType: "image/png", body: BLANK_PNG })
          : route.abort(),
      );
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        // A cached not-found page arrives as a 404, which Chrome logs.
        const pageItself = message.location().url === page.url();
        if (pageItself && message.text().startsWith("Failed to load resource"))
          return;
        errors.push(message.text());
      });
      await use(errors);
      expect(errors, "errors in the browser console").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens a page in a theme without clicking the toggle. */
export async function gotoInTheme(
  page: Page,
  path: string,
  theme: "light" | "dark",
) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_STORAGE_KEY, theme] as const,
  );
  await page.goto(path);
}
