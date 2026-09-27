import { test, expect } from "@playwright/test";
const user = {
  login: "octocat",
  name: "Mona Octocat",
  bio: "I build useful things.",
  blog: "https://example.org",
  location: "Earth",
  company: "Example",
  followers: 42,
  following: 3,
  public_repos: 1,
  public_gists: 2,
  created_at: "2011-01-01T00:00:00Z",
};
test.beforeEach(async ({ page }) => {
  await page.route("https://img.shields.io/**", (r) => r.abort());
  await page.route("https://api.github.com/users/**", (r) =>
    r.fulfill({
      json: r.request().url().includes("/repos?")
        ? [
            {
              id: 1,
              name: "useful-tool",
              owner: { login: "octocat" },
              description: "A public project",
              language: "Rust",
              stargazers_count: 17,
              forks_count: 2,
            },
          ]
        : user,
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
});
async function lookup(page, value = "https://github.com/octocat") {
  await page.getByRole("button", { name: "Autofill from GitHub" }).click();
  await page.getByLabel("GitHub username or profile URL").fill(value);
  await page
    .getByRole("button", { name: "Look up profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply to current draft" }),
  ).toBeVisible();
}
test("autofills public profile, optional projects/languages, persists and refreshes without duplicates", async ({
  page,
}) => {
  await lookup(page);
  await page
    .getByLabel("Suggest up to three public projects", { exact: false })
    .check();
  await page
    .getByLabel("Add repository language summary", { exact: false })
    .check();
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  const editor = page.getByLabel("Markdown editor", { exact: true });
  await expect(editor).toHaveValue(/Mona Octocat/);
  await expect(editor).not.toHaveValue(/Your Name/);
  await expect(editor).toHaveValue(/\*\*Followers:\*\* 42/);
  await expect(editor).toHaveValue(/useful-tool/);
  await expect(editor).toHaveValue(/primary language in 1 repository/);
  await expect(page.locator("github-preview")).toContainText("Mona Octocat");
  await expect(page.locator(".save-status")).toHaveText("Saved locally");
  await page.reload();
  await expect(editor).toHaveValue(/Mona Octocat/);
  await lookup(page, "octocat");
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  expect(
    (await editor.inputValue()).match(/## GitHub at a Glance/g),
  ).toHaveLength(1);
});
test("preview does not mutate until applied and undo restores placeholders", async ({
  page,
}) => {
  const editor = page.getByLabel("Markdown editor", { exact: true });
  const original = await editor.inputValue();
  await lookup(page);
  await expect(editor).toHaveValue(original);
  await page.screenshot({
    path: "docs/screenshots/github-autofill.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  await expect(editor).toHaveValue(/Mona Octocat/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveValue(original);
});
test("raw placeholders update while manually written text is preserved", async ({
  page,
}) => {
  const editor = page.getByLabel("Markdown editor", { exact: true });
  await editor.fill(
    "# {{display_name}}\n\nMy exact prose.  \nGitHub: https://github.com/your-name\n",
  );
  await lookup(page, "@octocat");
  for (const name of [
    "Use public bio and profile details",
    "Fill public contact links",
    "Add GitHub stats snapshot",
  ])
    await page.getByLabel(name, { exact: false }).uncheck();
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  await expect(editor).toHaveValue(
    "# Mona Octocat\n\nMy exact prose.  \nGitHub: https://github.com/octocat\n",
  );
});
test("lookup errors and partial repository results remain actionable", async ({
  page,
}) => {
  await page.route("https://api.github.com/users/**", (r) =>
    r.fulfill({ status: 404, json: { message: "Not Found" } }),
  );
  await page.getByRole("button", { name: "Autofill from GitHub" }).click();
  await page.getByLabel("GitHub username or profile URL").fill("missing");
  await page.getByRole("button", { name: "Look up profile" }).click();
  await expect(page.locator(".profile-status")).toContainText("not found");
  await page.route("https://api.github.com/users/**", (r) =>
    r.request().url().includes("/repos?")
      ? r.fulfill({ status: 403, json: {} })
      : r.fulfill({ json: { ...user, name: null, bio: null } }),
  );
  await page.getByLabel("GitHub username or profile URL").fill("octocat");
  await page.getByRole("button", { name: "Look up profile" }).click();
  await expect(page.locator(".profile-status")).toContainText("incomplete");
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  await expect(page.getByLabel("Markdown editor", { exact: true })).toHaveValue(
    /# octocat/,
  );
});
test("mobile profile autofill fits the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await lookup(page);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Apply to current draft" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(page.locator("github-preview h1")).toHaveText("Mona Octocat");
});
