import { test, expect } from "@playwright/test";
export async function start(page) {
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
  await page
    .getByRole("button", { name: "Project Studio", exact: true })
    .click();
}
test("manual project, role, highlights, tech, badges, save and undo", async ({
  page,
}) => {
  await start(page);
  const source = await page
    .getByRole("textbox", { name: "Markdown editor", exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const entry = page.locator(".project-entry").last();
  await entry.getByLabel("Project name", { exact: true }).fill("Useful CLI");
  await entry
    .getByLabel("Role — What did you personally contribute?")
    .fill("Testing Lead");
  await entry
    .getByLabel("Description — What does the project do?")
    .fill("Validates deployment configurations.");
  await entry
    .getByLabel("Repository URL", { exact: true })
    .fill("https://github.com/owner/cli");
  await entry
    .getByRole("button", { name: "Add engineering highlight" })
    .click();
  await entry.getByLabel("Highlight title", { exact: true }).fill("Testing");
  await entry
    .getByLabel("Highlight description", { exact: true })
    .fill("Exercised failure paths with integration tests.");
  await entry.getByLabel("Search or enter technology").fill("Rust");
  await entry
    .locator(".project-tech-results")
    .getByRole("button", { name: "Rust", exact: true })
    .click();
  await expect(page.locator(".project-preview")).toContainText("Testing Lead");
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(source);
  await page
    .getByRole("button", { name: "Save showcase", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/Useful CLI/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(source);
});
test("project reorder, duplication, and mobile dialog remain operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const entry = page.locator(".project-entry").last();
  await entry
    .getByLabel("Project name", { exact: true })
    .fill("Mobile project");
  const count = await page.locator(".project-entry").count();
  await entry
    .getByRole("button", { name: `Move project up ${count}`, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator(".project-entry")
      .nth(count - 2)
      .locator("summary"),
  ).toBeFocused();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Save showcase", exact: true })
    .click();
});
