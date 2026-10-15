import { test as base, expect } from "@playwright/test";

/**
 * Every test blocks requests to other hosts and fails on errors the page
 * throws or logs, apart from images that could not load (they are blocked).
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/Failed to load resource/.test(text)) return;
        errors.push(text);
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
  page: import("@playwright/test").Page,
  path: string,
  theme: "light" | "dark",
) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("metapick-theme", value);
  }, theme);
  await page.goto(path);
}
