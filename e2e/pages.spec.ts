import AxeBuilder from "@axe-core/playwright";
import { expect, gotoInTheme, test } from "./fixtures";

const pages = [
  ["/", "Know the counter before you play."],
  ["/app", "Who are you facing?"],
  ["/tier-list", "Tier list"],
  ["/statistics", "Hero statistics"],
  ["/heroes", "Heroes"],
  ["/heroes/fanny", "Fanny"],
  ["/items", "Items"],
  ["/emblems", "Emblems"],
  ["/counter-pick?enemies=fanny,ling", "Counter pick"],
  ["/matchup?hero=khufra&vs=fanny", "Matchup"],
  [
    "/team-composition?team=khufra,valentina,claude,fredrinn,joy",
    "Team composition",
  ],
  ["/draft", "Draft master"],
  ["/about", "About the data"],
] as const;

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    for (const [path, heading] of pages) {
      test(`${path} renders and passes axe`, async ({ page }) => {
        await gotoInTheme(page, path, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
        await expect(
          page
            .locator("footer")
            .getByText("Not affiliated with or endorsed by Moonton."),
        ).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map(
            (v) => `${v.id}: ${v.nodes.length} × ${v.help}`,
          ),
        ).toEqual([]);
      });
    }
  });
}

test("leaving the welcome page brings back the app's colors", async ({
  page,
}) => {
  // Next.js keeps the welcome page in the document after navigating away,
  // hidden, so its dark page color must not stay behind.
  await gotoInTheme(page, "/", "light");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(10, 16, 23)",
  );
  await page.getByRole("link", { name: "Open the app" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Who are you facing?" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(238, 242, 242)",
  );
});

test("an unknown hero shows the not-found page", async ({ page }) => {
  // The first visit streams the not-found page with status 200 (the shell
  // for unknown heroes is sent before the lookup); later visits get a 404.
  await page.goto("/heroes/not-a-hero");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This page does not exist",
  );
});
