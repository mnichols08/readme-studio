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
test("save, export, import and reuse a collection with keyboard row controls", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Search logos").fill("React");
  await page
    .locator(".logo-results")
    .getByRole("button", { name: "React", exact: true })
    .click();
  await page
    .getByLabel("New collection name", { exact: true })
    .fill("Frontend");
  await page
    .getByRole("button", { name: "Save badge to collection", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(page.getByLabel("Collection name", { exact: true })).toHaveValue(
    "Frontend",
  );
  await page
    .getByRole("button", { name: "Duplicate badge 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Move up 2", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export collection", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("Frontend.collection.json");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("readme-studio:v1")).badgeCollections
        .items[0],
  );
  await page.getByLabel("Import collection JSON").setInputFiles({
    name: "collection.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(page.getByLabel("Collection name", { exact: true })).toHaveValue(
    "Frontend (2)",
  );
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await page.getByLabel("Collection preview width").selectOption("320");
  await page
    .getByRole("button", { name: "Insert collection into README", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/<img src="https:\/\/img.shields.io/);
  await page.reload();
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await expect(page.locator(".collection-list button")).toHaveCount(2);
});
test("configure dynamic workflow and scoped npm helpers without typing requests", async ({
  page,
}) => {
  await start(page);
  await page
    .getByText("Dynamic badge helpers", { exact: true })
    .first()
    .click();
  await page
    .getByLabel("Badge helper", { exact: true })
    .selectOption("github-workflow");
  await page
    .getByLabel("GitHub repository (owner/repository)")
    .fill("owner/repo");
  await page.getByLabel("Workflow file or name").fill("ci.yml");
  await page.getByLabel("Branch (optional)").fill("feature/badges");
  await page
    .getByRole("button", { name: "Generate dynamic badge", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated Markdown", { exact: true }),
  ).toHaveValue(/github\/actions\/workflow\/status\/owner\/repo\/ci.yml/);
  await page
    .getByLabel("Link URL", { exact: true })
    .fill("https://example.com/actions");
  await expect(
    page.getByLabel("Generated Markdown", { exact: true }),
  ).toHaveValue(/example.com\/actions/);
  await page
    .getByText("Dynamic badge helpers", { exact: true })
    .first()
    .click();
  await page.getByLabel("Search badge helpers").fill("npm");
  await page
    .getByLabel("Badge helper", { exact: true })
    .selectOption("npm-version");
  await page.getByLabel("npm package name").fill("@scope/package");
  await page
    .getByRole("button", { name: "Generate dynamic badge", exact: true })
    .click();
  await expect(
    page.getByLabel("Final Shields URL", { exact: true }),
  ).toHaveValue(/npm\/v\/%40scope\/package/);
});
