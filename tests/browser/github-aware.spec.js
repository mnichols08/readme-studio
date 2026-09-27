import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
  );
  await page.route("https://api.github.com/repos/ada/*", (r) =>
    r.fulfill({
      json: {
        name: r.request().url().split("/").at(-1),
        full_name: "ada/" + r.request().url().split("/").at(-1),
        description: "A public project",
        language: "JavaScript",
        topics: ["react", "pwa"],
        homepage: "https://example.com",
        stargazers_count: 5,
        default_branch: "main",
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
}
test("repository lookup, multi-select, reviewed insertion, ownership and undo", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Repositories", exact: true }).click();
  for (const name of ["one", "two"]) {
    await page.getByLabel("Repository owner/name").fill("ada/" + name);
    await page
      .getByRole("button", { name: "Look up public repository", exact: true })
      .click();
    await expect(
      page.locator("repository-authoring [role=status]"),
    ).toContainText("Repository loaded");
  }
  await expect(page.locator("repository-authoring [data-count]")).toContainText(
    "2 selected",
  );
  await page.getByLabel("Repository list layout").selectOption("table");
  await page.getByRole("button", { name: "Preview selected output" }).click();
  await expect(page.getByLabel("Repository generated Markdown")).toHaveValue(
    /ada\/one/,
  );
  await page.getByRole("button", { name: "Apply reviewed output" }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/Selected Repositories/);
  expect(
    await page
      .locator("app-shell")
      .evaluate(
        (e) => e.store.draft.blocks.at(-1).githubGenerated.repositories,
      ),
  ).toEqual(["ada/one", "ada/two"]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).not.toHaveValue(/Selected Repositories/);
});
test("repository picker fits mobile and cached context stays usable offline", async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator("app-shell").evaluate((e) => {
    e.store.draft.metadata.repositoryContext = [
      {
        fullName: "ada/demo",
        name: "demo",
        owner: "ada",
        language: "Rust",
        topics: [],
        visibility: "public",
      },
    ];
  });
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Repositories", exact: true }).click();
  await page.locator('[data-repo="ada/demo"]').check();
  await page.getByLabel("Authoring action").selectOption("projects");
  await page.getByRole("button", { name: "Preview selected output" }).click();
  await expect(page.getByLabel("Repository generated Markdown")).toHaveValue(
    /demo/,
  );
  expect(
    await page
      .locator("dialog")
      .evaluate((e) => e.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Repositories", exact: true }),
  ).toBeFocused();
});
