import { expect, test } from "./fixtures";

test("theme choice is applied and survives a reload", async ({
  page,
  isMobile,
}) => {
  await page.goto("/about");
  if (isMobile) await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("counter pick ranks heroes against the enemies typed in", async ({
  page,
}) => {
  await page.goto("/counter-pick");
  const search = page.getByPlaceholder("Search enemy heroes");
  await search.fill("fanny");
  await search.press("Enter");
  await expect(page).toHaveURL(/enemies=fanny/);
  const results = page.locator("main ol > li");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThanOrEqual(5);
  await page
    .getByRole("button", { name: "Remove Fanny from the enemy team" })
    .click();
  await expect(page.getByText("Add an enemy hero to start")).toBeVisible();
});

test("team composition suggests heroes and swaps", async ({ page }) => {
  await page.goto("/team-composition?team=khufra,valentina,claude,fredrinn");
  await expect(
    page.getByRole("heading", { name: "Heroes that fill the gaps" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Add .+ to your team$/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Swaps that help" }),
  ).toBeVisible();
});

test("a full Mythic draft can be played from the suggestions", async ({
  page,
}) => {
  await page.goto("/draft");
  await expect(page.getByText("Your turn: ban 1 of 3")).toBeVisible();
  for (let step = 0; step < 20; step++) {
    await page
      .locator("main ol > li")
      .getByRole("button", { name: /^(Ban|Pick) / })
      .first()
      .click();
  }
  await expect(page.getByText("Draft complete")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/turn: pick 1 of 1/)).toBeVisible();
});

test("mobile navigation reaches every section", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The bottom bar only shows on phones.");
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Draft" })
    .click();
  await expect(page).toHaveURL(/\/draft$/);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("link", { name: /Team composition/ }).click();
  await expect(page).toHaveURL(/\/team-composition$/);
});
