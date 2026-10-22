import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
// Source-preserving raw edits (#77): typing in one section never detaches a
// builder section elsewhere, and a Detachment is announced and visible.
const fixture = readFileSync("tests/fixtures/round-trip/html.md", "utf8");
const editor = (page) =>
  page.getByRole("textbox", { name: "Markdown editor", exact: true });
async function typeAt(page, position, text) {
  await editor(page).evaluate((el, at) => {
    el.focus();
    el.setSelectionRange(at, at);
  }, position);
  await page.keyboard.type(text);
}
test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20" />',
    }),
  );
});
test("raw edits keep untouched builder sections visual and announce detachment", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.locator(".workspace-tools [data-action=import]").click();
  await page.getByRole("button", { name: "Local file", exact: true }).click();
  await page.getByLabel("Import mode", { exact: true }).selectOption("new");
  await page.locator("#file-import").setInputFiles({
    name: "README.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(fixture),
  });
  await page.getByRole("button", { name: "Import as new draft" }).click();
  await expect(editor(page)).toHaveValue(fixture);
  await page
    .getByRole("button", { name: "Split into sections", exact: true })
    .click();
  await page.locator("#apply-split").click();
  const sections = await page.locator(".block-row").count();
  expect(sections).toBeGreaterThan(1);

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".library-grid")
    .getByRole("button", { name: "Divider" })
    .click();
  await page
    .getByRole("button", { name: "Add to README", exact: true })
    .click();
  const built = await editor(page).inputValue();
  expect(built.startsWith(fixture)).toBe(true);
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  const rows = page.locator(".block-row");
  await expect(rows).toHaveCount(sections + 1);
  const divider = rows.last();
  await expect(divider).toContainText("Divider");

  // Type inside a different (Custom Markdown) section.
  const at = built.indexOf("Inline ") + "Inline ".length;
  await typeAt(page, at, "very ");
  const edited = built.slice(0, at) + "very " + built.slice(at);
  await expect(editor(page)).toHaveValue(edited);
  await expect(editor(page)).toBeFocused();
  await expect(rows).toHaveCount(sections + 1);
  await expect(divider).not.toContainText("Detached");
  await expect(page.locator(".toast")).not.toContainText("detached");
  await divider.locator(".block-open").click();
  await expect(page.locator("builder-form")).toBeVisible();
  await page.getByRole("button", { name: "Sections", exact: true }).click();

  // Exported Markdown equals the fixture plus the builder output and the edit.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export README" }).click();
  const file = await (await download).path();
  expect(readFileSync(file, "utf8")).toBe(edited);

  // Typing inside the builder section detaches only that section.
  await typeAt(page, edited.length - 1, "x");
  await expect(page.locator(".toast")).toHaveText(
    "Raw edit detached: Divider (builder). Undo restores visual ownership.",
  );
  await expect(page.locator(".toast")).toHaveAttribute("role", "status");
  await expect(editor(page)).toBeFocused();
  await expect(rows.last()).toContainText("Detached from Divider");
  await expect(rows).toHaveCount(sections + 1);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor(page)).toHaveValue(edited);
  await expect(rows.last()).not.toContainText("Detached");
});
