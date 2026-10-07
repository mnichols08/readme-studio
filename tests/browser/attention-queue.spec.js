import { test, expect } from "@playwright/test";
const prose =
  "This project explores several practical ways to render a small game while keeping controls accessible and preserving local progress for players on different devices.";
const basic =
  prose +
  "\n\n## Controls\n\nPress the arrow keys to move around the world and discover hidden objects.\n\n## Gameplay\n\nCollect items and complete the stages to unlock more of the world.";
const repo = (name, extra = {}) => ({
  name,
  full_name: `example/${name}`,
  owner: { login: "example" },
  default_branch: "main",
  topics: ["game"],
  language: "Rust",
  pushed_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  ...extra,
});
const file = (source, sha = "a".repeat(40)) => ({
  path: "README.md",
  sha,
  size: Buffer.byteLength(source),
  encoding: "base64",
  content: Buffer.from(source).toString("base64"),
});
async function audit(page, first = true) {
  if (first) {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Explore the sample profile" })
      .click();
  }
  await page
    .getByRole("button", { name: "README Attention Queue", exact: true })
    .click();
  await expect(
    page.locator("repository-audit [data-audit-results]"),
  ).not.toBeVisible();
  await expect(page.locator("readme-attention-queue")).toBeVisible();
  await page.getByLabel("GitHub username", { exact: true }).fill("example");
  await page
    .getByRole("button", { name: "Load repositories", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-count]")).toContainText(
    "loaded",
  );
}
async function scan(page) {
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete",
  );
}
test.beforeEach(async ({ page }) => {
  await page.route("https://img.shields.io/**", (route) => route.abort());
});

test("attention tiers, combined filters and next/source actions work at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  let reads = 0;
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/users/"))
      return route.fulfill({
        json: [
          repo("game", {
            stargazers_count: 5,
            homepage: "https://example.org",
          }),
          repo("missing"),
          repo("basic"),
          repo("archive", { archived: true, language: "Python" }),
          repo("old", { pushed_at: "2020-01-01T00:00:00Z" }),
        ],
      });
    reads++;
    return route.fulfill(
      url.includes("/missing/")
        ? { status: 404, json: {} }
        : { json: file(url.includes("/basic/") ? basic : prose) },
    );
  });
  await audit(page);
  const queue = page.locator("readme-attention-queue");
  await expect(queue).toBeVisible();
  await page.getByLabel("Include archived repositories").check();
  await scan(page);
  await expect(queue.locator("[data-item]")).toHaveCount(4);
  await expect(queue.locator("[data-item]").first()).toContainText(
    "example/missing",
  );
  await expect(queue).toContainText("High attention");
  await expect(queue).toContainText("Medium attention");
  await expect(queue).toContainText("Low attention");
  await expect(queue).toContainText(
    "Game controls not detected. Commonly useful for this project type.",
  );
  await queue
    .getByLabel("Attention priority", { exact: true })
    .selectOption("high");
  await queue
    .getByLabel("Active only (pushed within 30 days)", { exact: true })
    .check();
  await queue
    .getByLabel("Queue language", { exact: true })
    .selectOption("Rust");
  await queue
    .getByLabel("Queue project type", { exact: true })
    .selectOption("game");
  await queue.getByLabel("Minimum stars", { exact: true }).fill("5");
  await queue.getByLabel("Minimum stars", { exact: true }).press("Tab");
  await queue.getByLabel("Pushed recently", { exact: true }).selectOption("30");
  await expect(queue.locator("[data-item]")).toHaveCount(1);
  await expect(queue.locator("[data-item]")).toContainText("example/game");
  await queue.getByLabel("Missing only", { exact: true }).check();
  await expect(queue.locator("[data-item]")).toHaveCount(0);
  await queue.getByRole("button", { name: "Reset queue filters" }).click();
  await queue
    .getByLabel("Archived repositories", { exact: true })
    .selectOption("only");
  await expect(queue.locator("[data-item]")).toHaveCount(1);
  await expect(queue.locator("[data-item]")).toContainText("example/archive");
  expect(reads).toBe(5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await queue.getByRole("button", { name: "Reset queue filters" }).click();
  await queue
    .getByRole("button", { name: "Improve next", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".batch-bar")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).toBe("");
  await page
    .getByRole("button", { name: "README Attention Queue", exact: true })
    .click();
  await queue
    .locator("[data-item]")
    .filter({
      has: page.getByRole("heading", { name: "example/game", exact: true }),
    })
    .getByRole("button", { name: "Open in Studio" })
    .click();
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).toBe(prose);
  expect(reads).toBe(5);
});

test("intentionally minimal survives reload, returns after changed README, and deferred items can be restored", async ({
  page,
}) => {
  let sha = "a".repeat(40);
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/users/")
        ? [repo("small")]
        : file(prose + (sha.startsWith("b") ? " Updated." : ""), sha),
    }),
  );
  await audit(page);
  await scan(page);
  const queue = page.locator("readme-attention-queue");
  await queue
    .getByRole("button", { name: "Mark intentionally minimal", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(queue.locator("[data-item]")).toHaveCount(0);
  await expect(
    queue.getByRole("heading", { name: "README Attention Queue", exact: true }),
  ).toBeFocused();
  await page.reload();
  await audit(page, false);
  await scan(page);
  await expect(queue.locator("[data-item]")).toHaveCount(0);
  await queue
    .getByLabel("Queue visibility", { exact: true })
    .selectOption("only");
  await expect(queue).toContainText(
    "Intentionally minimal for this README revision",
  );
  await queue.getByLabel("Queue visibility", { exact: true }).selectOption("");
  sha = "b".repeat(40);
  await page.getByLabel("Fetch fresh README content").check();
  await scan(page);
  await expect(queue.locator("[data-item]")).toHaveCount(1);
  await queue
    .getByRole("button", { name: "Ignore for now", exact: true })
    .click();
  await expect(queue.locator("[data-item]")).toHaveCount(0);
  await queue
    .getByLabel("Queue visibility", { exact: true })
    .selectOption("only");
  await expect(queue).toContainText("Ignored until");
  await queue
    .getByRole("button", { name: "Return to queue", exact: true })
    .click();
  await queue.getByLabel("Queue visibility", { exact: true }).selectOption("");
  await expect(queue.locator("[data-item]")).toHaveCount(1);
  // A manual Experiment override makes this short substantive README appropriate.
  await page
    .locator("repository-audit")
    .getByRole("button", { name: "Audit results", exact: true })
    .click();
  await expect(queue).not.toBeVisible();
  await page
    .getByLabel("Project type for example/small", { exact: true })
    .selectOption("experiment");
  await page
    .locator("repository-audit")
    .getByRole("button", { name: "README Attention Queue", exact: true })
    .click();
  await expect(queue.locator("[data-item]")).toHaveCount(0);
  await expect(queue).toContainText("1 without current attention signals");
});

test("damaged and unwritable attention storage stays visible and does not lose drafts or falsely suppress items", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("readme-studio:attention:v1", "damaged"),
  );
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/users/")
        ? [repo("small")]
        : file(prose),
    }),
  );
  await audit(page);
  await scan(page);
  const queue = page.locator("readme-attention-queue");
  await expect(queue).toContainText("Original storage is untouched");
  await expect(
    queue.getByRole("button", {
      name: "Mark intentionally minimal",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("readme-studio:attention:v1"),
    ),
  ).toBe("damaged");
  const download = page.waitForEvent("download");
  await queue
    .getByRole("button", { name: "Download attention recovery data" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "readme-attention-recovery.json",
  );
  await queue
    .getByRole("button", { name: "Reset attention settings", exact: true })
    .click();
  await expect(queue).toContainText("Confirm discarding");
  await queue
    .getByLabel("I want to discard only damaged attention settings")
    .check();
  await queue
    .getByRole("button", { name: "Reset attention settings", exact: true })
    .click();
  await expect(
    queue.getByRole("button", {
      name: "Mark intentionally minimal",
      exact: true,
    }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "readme-studio:attention:v1")
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await queue
    .getByRole("button", { name: "Ignore for now", exact: true })
    .click();
  await expect(queue).toContainText("Your decision was not applied");
  await expect(queue.locator("[data-item]")).toHaveCount(1);
});
