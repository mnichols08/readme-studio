import { test, expect } from "@playwright/test";
async function open(page, type) {
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.locator(`[data-block-type="${type}"]`).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
});
test("installation and testing sections remain editable and support undo", async ({
  page,
}) => {
  await open(page, "doc-installation");
  await page
    .getByLabel("Section heading", { exact: true })
    .fill("Install locally");
  await page.getByLabel("Package manager", { exact: true }).fill("pnpm");
  await page
    .getByLabel("Install command", { exact: true })
    .fill("pnpm add actual-package");
  await page
    .getByLabel("Prerequisites", { exact: true })
    .fill("Confirm your runtime version first.");
  await page
    .getByRole("button", { name: "Add to README", exact: true })
    .click();
  await page
    .locator(".block-open")
    .filter({ hasText: "Install locally" })
    .click();
  await expect(page.getByLabel("Install command", { exact: true })).toHaveValue(
    "pnpm add actual-package",
  );
  await page
    .getByLabel("Additional notes", { exact: true })
    .fill("Use your own registry if required.");
  await page.getByRole("button", { name: "Save section", exact: true }).click();
  await open(page, "doc-testing");
  await page.getByLabel("Test commands").fill("npm test");
  await page.getByLabel("Test types (one per line)").fill("Unit\nBrowser");
  await page.getByLabel("Coverage notes").fill("Measured locally.");
  await page
    .getByRole("button", { name: "Add to README", exact: true })
    .click();
  const source = await page.evaluate(
    () => document.querySelector("app-shell").store.draft.markdown,
  );
  expect(source).toContain("```sh\nnpm test\n```");
  expect(source).toContain("- Unit\n- Browser");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).not.toContain("### Test commands");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).toBe(source);
});
test("environment rows support keyboard ordering and placeholder guidance at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, "doc-environment");
  await expect(page.locator("builder-form")).toContainText(
    "Never paste real secrets here",
  );
  await page.getByRole("button", { name: "Add environment variable" }).click();
  await page.getByLabel("Variable name", { exact: true }).fill("API_TOKEN");
  await page.getByLabel("Required", { exact: true }).check();
  await page
    .getByLabel("Variable description", { exact: true })
    .fill("Token for local development");
  await page
    .getByLabel("Example placeholder (never a real secret)")
    .fill("YOUR_API_TOKEN");
  await page.getByRole("button", { name: "Add environment variable" }).click();
  await page.getByLabel("Variable name", { exact: true }).nth(1).fill("PORT");
  await page
    .getByLabel("Example placeholder (never a real secret)")
    .nth(1)
    .fill("3000");
  await page.getByRole("button", { name: "Move entry 2 up" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByLabel("Variable name", { exact: true }).first(),
  ).toHaveValue("PORT");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "Add to README", exact: true })
    .click();
  const source = await page.evaluate(
    () => document.querySelector("app-shell").store.draft.markdown,
  );
  expect(source.indexOf("| PORT |")).toBeLessThan(
    source.indexOf("| API\\_TOKEN |"),
  );
  expect(source).toContain("Keep real secrets outside version control");
  await page
    .locator(".block-open")
    .filter({ hasText: "Environment Variables" })
    .click();
  await page
    .getByRole("button", { name: "Remove entry", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Variable name", { exact: true })).toHaveCount(
    1,
  );
});
