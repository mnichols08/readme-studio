import { test, expect } from "@playwright/test";

test("repository templates are accessible from Create and produce editable local sections at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page
    .getByRole("button", { name: "Repository README", exact: true })
    .click();
  await expect(page.getByLabel("Repository template")).toBeFocused();
  await expect(
    page.getByLabel("Repository template").locator("option"),
  ).toHaveCount(12);
  await page.getByLabel("Repository template").selectOption("rust-crate");
  await page.getByLabel("Repository name", { exact: true }).fill("my-crate");
  await page.getByLabel("Repository description").fill("A small parser.");
  await page.getByLabel("Features", { exact: true }).uncheck();
  await page.getByText("Review generated Markdown", { exact: true }).click();
  await expect(page.getByLabel("Generated repository README")).toContainText(
    "",
  );
  expect(
    await page.getByLabel("Generated repository README").inputValue(),
  ).toContain("## Minimum Rust version");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Create repository README" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const draft = await page.evaluate(
    () => document.querySelector("app-shell").store.draft,
  );
  expect(draft.markdown).toContain("# my-crate");
  expect(draft.markdown).not.toContain("## Features");
  expect(draft.metadata.repositoryReadme.templateId).toBe("rust-crate");
  expect(draft.blocks.length).toBeGreaterThan(2);
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-mobile",
    "build",
  );
});

test("Queue Improve README opens the suggested template with reviewed context and preserves original source", async ({
  page,
}) => {
  const source = "\ufeff# My Game\r\n\r\nMy existing notes.\r\n";
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill(
      route.request().url().includes("/users/")
        ? {
            json: [
              {
                name: "my-game",
                full_name: "example/my-game",
                description: "Local puzzle game",
                homepage: "https://example.org",
                language: "Rust",
                topics: ["game"],
                default_branch: "main",
                pushed_at: new Date().toISOString(),
              },
            ],
          }
        : {
            json: {
              path: "README.md",
              sha: "a".repeat(40),
              encoding: "base64",
              size: Buffer.byteLength(source),
              content: Buffer.from(source).toString("base64"),
            },
          },
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page
    .getByRole("button", { name: "README Attention Queue", exact: true })
    .click();
  await page.getByLabel("GitHub username", { exact: true }).fill("example");
  await page
    .getByRole("button", { name: "Load repositories", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-count]")).toContainText(
    "1 included",
  );
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete",
  );
  await page
    .getByRole("button", { name: "Improve README", exact: true })
    .click();
  await expect(page.getByLabel("Repository template")).toHaveValue("game");
  await expect(page.getByLabel("Repository name", { exact: true })).toHaveValue(
    "my-game",
  );
  await expect(page.getByLabel("Repository description")).toHaveValue(
    "Local puzzle game",
  );
  await expect(
    page.getByLabel("Primary language", { exact: true }),
  ).toHaveValue("Rust");
  await expect(page.getByLabel("Repository topics")).toHaveValue("game");
  await page.getByLabel("Repository homepage").fill("");
  await page.getByLabel("Gameplay", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Create repository README" }).click();
  const draft = await page.evaluate(
    () => document.querySelector("app-shell").store.draft,
  );
  expect(draft.blocks[0].settings.markdown).toBe(source);
  expect(draft.markdown.startsWith(source)).toBe(true);
  expect(draft.markdown).toContain("## Controls");
  expect(draft.markdown).not.toContain("https://example.org");
  expect(draft.metadata.repositoryReadme.reviewed.projectType).toBe("game");
  expect(draft.metadata.repositoryReadme.reviewed.homepage).toBe("");
});
