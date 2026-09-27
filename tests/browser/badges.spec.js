import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20" />',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.getByRole("button", { name: "Badge Studio", exact: true }).click();
}
test("build a React pair and insert without overwriting the selected source", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Search logos").fill("react");
  await page
    .locator(".logo-results")
    .getByRole("button", { name: "React", exact: true })
    .click();
  await page.getByLabel("Light / dark badge pair").check();
  await expect(
    page.getByLabel("Generated Markdown", { exact: true }),
  ).toHaveValue(/<picture>/);
  const original = await page
    .getByRole("textbox", { name: "Markdown editor", exact: true })
    .inputValue();
  await page
    .locator("badge-studio")
    .getByRole("button", { name: "Add to README", exact: true })
    .click();
  const output = await page
    .getByRole("textbox", { name: "Markdown editor", exact: true })
    .inputValue();
  expect(output).toContain(original);
  expect(output).toContain("<picture>");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(original);
});
test("invalid link is explained and mobile studio fits", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("javascript:alert(1)");
  await expect(page.locator(".badge-status")).toContainText("safe");
  await expect(page.locator("[data-insert-badge]")).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Badge Studio", exact: true }),
  ).toBeFocused();
});
