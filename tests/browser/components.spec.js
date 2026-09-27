import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.getByRole("button", { name: "Components", exact: true }).click();
}
test("search, favorite, preview source and insert component with undo", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Search components", { exact: true }).fill("terminal");
  await expect(page.locator(".component-results article")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Favorite Terminal heading", exact: true })
    .click();
  await page
    .getByLabel("Library view", { exact: true })
    .selectOption("favorites");
  await expect(page.locator(".component-results article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Preview Terminal heading", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("My work");
  await page
    .getByRole("button", { name: "Render preview", exact: true })
    .click();
  await expect(page.locator(".component-preview")).toContainText("My work");
  await page
    .getByRole("button", { name: "Insert component", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/## \$ My work/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).not.toHaveValue(/## \$ My work/);
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("recent");
  await expect(page.locator(".component-results article")).toHaveCount(1);
});
test("saved snippet preserves source across reload and mobile dialog remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.getByText("Save My Snippet", { exact: true }).click();
  await page.getByLabel("Snippet name", { exact: true }).fill("My raw snippet");
  const source = "# Mine\n\n{{untouched}} <script>example</script>";
  await page.getByLabel("Snippet Markdown", { exact: true }).fill(source);
  await page.getByRole("button", { name: "Save snippet locally" }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("saved");
  await page
    .getByRole("button", { name: "Preview My raw snippet", exact: true })
    .click();
  await expect(
    page.getByLabel("Component Markdown", { exact: true }),
  ).toHaveValue(source);
  await page
    .getByRole("button", { name: "Render preview", exact: true })
    .click();
  await expect(page.locator(".component-preview script")).toHaveCount(0);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("saved");
  await expect(page.locator(".component-results article")).toHaveCount(1);
});
