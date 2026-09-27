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
test("review GitHub project import, refresh manual fields and confirm duplicates", async ({
  page,
}) => {
  await start(page);
  let description = "Repository description";
  await page.route("https://api.github.com/repos/owner/tool", (r) =>
    r.fulfill({
      json: {
        name: "tool",
        full_name: "owner/tool",
        description,
        homepage: "https://example.com",
        language: "Rust",
        topics: ["rust"],
        archived: true,
        stargazers_count: 8,
        forks_count: 1,
      },
    }),
  );
  const source = await page
    .getByRole("textbox", { name: "Markdown editor", exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Import GitHub projects", exact: true })
    .click();
  await page.getByLabel("Repository (owner/repository)").fill("owner/tool");
  await page
    .getByRole("button", { name: "Look up repository", exact: true })
    .click();
  await expect(page.locator(".project-import-review")).toContainText(
    "Stars: 8",
  );
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(source);
  await page.getByLabel("Apply status", { exact: true }).check();
  await page.getByLabel("Apply technologies", { exact: true }).check();
  await page.getByRole("button", { name: "Apply reviewed projects" }).click();
  const entry = page.locator(".project-entry").last();
  await expect(entry.getByLabel("Live demo URL", { exact: true })).toHaveValue(
    "https://example.com",
  );
  await expect(entry.getByLabel("Project status", { exact: true })).toHaveValue(
    "Archived",
  );
  await entry
    .getByLabel("Description — What does the project do?")
    .fill("My authored explanation");
  description = "Updated upstream";
  await entry
    .getByRole("button", { name: "Refresh from GitHub", exact: true })
    .click();
  await expect(page.locator(".project-import-review")).toContainText(
    "Updated upstream",
  );
  await page.getByRole("button", { name: "Apply reviewed projects" }).click();
  await expect(
    page
      .locator(".project-entry")
      .last()
      .getByLabel("Description — What does the project do?"),
  ).toHaveValue("My authored explanation");
  await page
    .getByRole("button", { name: "Import GitHub projects", exact: true })
    .click();
  await page.getByLabel("Repository (owner/repository)").fill("owner/tool");
  await page
    .getByRole("button", { name: "Look up repository", exact: true })
    .click();
  await expect(page.locator(".project-import-review")).toContainText(
    "already included",
  );
  await page.getByRole("button", { name: "Apply reviewed projects" }).click();
  await expect(page.locator(".project-fetch-status")).toContainText(
    "Confirm the duplicate",
  );
  await page.getByLabel("I confirm adding a duplicate repository").check();
  await page.getByRole("button", { name: "Apply reviewed projects" }).click();
  await page
    .getByRole("button", { name: "Save showcase", exact: true })
    .click();
});
test("multi-repo selector keeps successful imports on partial failure", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    document.querySelector("project-studio").availableRepositories = [
      {
        full_name: "owner/good",
        description: "Useful",
        language: "Rust",
        archived: false,
        fork: false,
        updated_at: "2026-01-01",
      },
      {
        full_name: "owner/missing",
        description: "Unavailable",
        language: "Rust",
        archived: false,
        fork: false,
        updated_at: "2025-01-01",
      },
    ];
  });
  await page.route("https://api.github.com/repos/owner/**", (r) =>
    r.request().url().endsWith("missing")
      ? r.fulfill({ status: 404, json: { message: "Not Found" } })
      : r.fulfill({
          json: {
            name: "good",
            full_name: "owner/good",
            description: "Useful",
            language: "Rust",
          },
        }),
  );
  await page
    .getByRole("button", { name: "Import GitHub projects", exact: true })
    .click();
  await page
    .getByLabel("Repository language", { exact: true })
    .selectOption("Rust");
  await page.locator("[data-repo-choice]").first().check();
  await page.locator("[data-repo-choice]").last().check();
  await page
    .getByRole("button", { name: "Review selected repositories" })
    .click();
  await expect(page.locator(".project-fetch-status")).toContainText(
    "2 repositories requested · 1 ready for review · 1 unavailable",
  );
  await page.getByRole("button", { name: "Apply reviewed projects" }).click();
  await expect(page.locator(".project-status")).toContainText(
    "1 applied · 1 unavailable",
  );
});
