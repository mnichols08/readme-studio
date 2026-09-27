import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"/>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
}
test("theme preview, apply, undo, and themed badge defaults", async ({
  page,
}) => {
  await start(page);
  const editor = page.getByRole("textbox", {
    name: "Markdown editor",
    exact: true,
  });
  const before = await editor.inputValue();
  await page.getByRole("button", { name: "Visual theme", exact: true }).click();
  await page
    .getByLabel("Built-in theme", { exact: true })
    .selectOption("workshop");
  await expect(editor).toHaveValue(before);
  await expect(page.locator(".theme-sample")).toContainText("Selected work");
  await page
    .getByRole("button", { name: "Apply visual theme", exact: true })
    .click();
  await expect(editor).toHaveValue(/✦/);
  await page.getByRole("button", { name: "Badge Studio", exact: true }).click();
  await expect(page.locator('[data-badge-field="color"]')).toHaveValue(
    "a84612",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveValue(before);
});
test("theme controls fit mobile and invalid colors cannot apply", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.getByRole("button", { name: "Visual theme", exact: true }).click();
  await page.getByLabel("accent hex", { exact: true }).fill("bad color");
  await expect(
    page.getByRole("button", { name: "Apply visual theme", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("accent hex", { exact: true }).fill("123456");
  await expect(
    page.getByRole("button", { name: "Apply visual theme", exact: true }),
  ).toBeEnabled();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
});
