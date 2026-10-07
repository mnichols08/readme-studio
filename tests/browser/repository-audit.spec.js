import { test, expect } from "@playwright/test";
const source =
  "\ufeff# Audit café\r\n\r\nThis repository contains a practical notes application with accessible controls and useful local exports for people working offline without sending their content to a remote service.\r\n";
const metadata = (name, extra = {}) => ({
  name,
  full_name: `example/${name}`,
  owner: { login: "example" },
  default_branch: "main",
  language: "Rust",
  pushed_at: "2026-09-27T00:00:00Z",
  updated_at: "2026-09-28T00:00:00Z",
  ...extra,
});
const file = (text = source) => ({
  path: "README.md",
  sha: "a".repeat(40),
  size: Buffer.byteLength(text),
  encoding: "base64",
  content: Buffer.from(text).toString("base64"),
});
async function open(page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.getByRole("button", { name: "README audit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Repository README audit" }),
  ).toBeVisible();
  await expect(page.locator("readme-attention-queue")).not.toBeVisible();
  await page.getByLabel("GitHub username", { exact: true }).fill("example");
  await page
    .getByRole("button", { name: "Load repositories", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.route("https://img.shields.io/**", (route) => route.abort());
});

test("selected audit distinguishes states, reuses cache and improves exact source in a new draft", async ({
  page,
}) => {
  let reads = 0;
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/users/"))
      return route.fulfill({
        json: [
          metadata("notes"),
          metadata("missing"),
          metadata("tiny"),
          metadata("archived", { archived: true }),
          metadata("fork", { fork: true }),
        ],
      });
    reads++;
    return route.fulfill(
      url.includes("/missing/")
        ? { status: 404, json: {} }
        : { json: file(url.includes("/tiny/") ? "# Tiny\nTODO" : source) },
    );
  });
  await open(page);
  await expect(page.locator("repository-audit [data-count]")).toHaveText(
    "3 included of 5 loaded · 0 selected",
  );
  expect(reads).toBe(0);
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete: 3 of 3",
  );
  await expect(page.locator("repository-audit")).toContainText(
    "Missing README",
  );
  await expect(page.locator("repository-audit")).toContainText("Stub README");
  await expect(page.locator("repository-audit")).toContainText(
    "Minimal for a Generic Repository",
  );
  if (test.info().project.name === "chromium")
    await page.screenshot({
      path: "docs/screenshots/repository-audit.png",
      fullPage: true,
    });
  expect(reads).toBe(3);
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete: 3 of 3",
  );
  expect(reads).toBe(3);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "README audit", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("repository-audit")).toContainText(
    "Minimal for a Generic Repository",
  );
  const row = page
    .locator("repository-audit tr")
    .filter({ has: page.getByLabel("Select example/notes", { exact: true }) });
  await expect(
    row.getByRole("link", { name: "Open README", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://github.com/example/notes/blob/main/README.md",
  );
  await row.getByRole("button", { name: "Improve README" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.locator("#draft-select option").count()).toBe(2);
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).toBe(source);
  expect(reads).toBe(3);
});

test("archive/fork options and missing README improvement work by keyboard at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill(
      route.request().url().includes("/users/")
        ? {
            json: [
              metadata("old", { archived: true }),
              metadata("fork", { fork: true }),
            ],
          }
        : { status: 404, json: {} },
    ),
  );
  await open(page);
  await page.getByLabel("Include archived repositories").check();
  await page.getByLabel("Include forks", { exact: true }).check();
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete: 2 of 2",
  );
  await expect(page.locator("repository-audit")).toContainText("Archived");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.locator("repository-audit [data-improve]").first().click();
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  ).toBe("");
});

test("100 repositories use bounded rendering and survive partial/rate-limit failures", async ({
  page,
}) => {
  let reads = 0,
    phase = "partial";
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/users/"))
      return route.fulfill({
        json: Array.from({ length: 100 }, (_, i) => metadata(`repo-${i}`)),
        headers: {
          Link: '<https://api.github.com/users/example/repos?page=2>; rel="next"',
        },
      });
    reads++;
    if (phase === "limited")
      return route.fulfill({
        status: 429,
        headers: { "retry-after": "60" },
        json: {},
      });
    return route.fulfill(
      phase === "partial" && url.includes("/repo-7/")
        ? { status: 500, json: {} }
        : { json: file("# Small\n\n" + source) },
    );
  });
  await open(page);
  await expect(page.locator("repository-audit tbody tr")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "100 of 100 checked; 1 not assessed",
    { timeout: 30000 },
  );
  expect(reads).toBe(100);
  await expect(page.locator("repository-audit")).toContainText(
    "GitHub request failed (500)",
  );
  phase = "resume";
  await page.evaluate(() => {
    const resumedTime = Date.now() + 3600000;
    Date.now = () => resumedTime;
  });
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "100 of 100 checked; 0 not assessed",
  );
  expect(reads).toBe(101); // Only the failed row is retried even after source-cache expiry.
  await page
    .locator("repository-audit")
    .getByRole("button", { name: "README Attention Queue", exact: true })
    .click();
  const queue = page.locator("readme-attention-queue");
  await expect(queue.locator("[data-item]")).toHaveCount(25);
  await expect(queue).toContainText("100 matching");
  await queue
    .getByRole("button", { name: "Next queue page", exact: true })
    .click();
  await expect(queue.locator("[data-queue-page]")).toContainText("Page 2 of 4");
  expect(reads).toBe(101);
  await page
    .locator("repository-audit")
    .getByRole("button", { name: "Audit results", exact: true })
    .click();
  await page.getByRole("button", { name: "Next results", exact: true }).click();
  await expect(page.locator("repository-audit [data-page]")).toContainText(
    "Page 2 of 4",
  );
  phase = "limited";
  await page.getByLabel("Fetch fresh README content").check();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit paused",
  );
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "rate limit reached",
  );
  expect(reads).toBeLessThanOrEqual(104);
});

test("closing cancels pending work; offline failures do not become missing READMEs", async ({
  page,
}) => {
  let reads = 0;
  await page.route("https://api.github.com/**", async (route) => {
    if (route.request().url().includes("/users/"))
      return route.fulfill({
        json: Array.from({ length: 10 }, (_, i) => metadata(`r${i}`)),
      });
    reads++;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.abort().catch(() => {});
  });
  await open(page);
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.waitForTimeout(600);
  expect(reads).toBeLessThanOrEqual(3);
  await page.getByRole("button", { name: "README audit", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.getByLabel("Select example/r0", { exact: true }).check();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "1 not assessed",
  );
  await expect(page.locator("repository-audit tbody")).not.toContainText(
    "Missing README",
  );
});

test("analysis falls back if Worker creation fails", async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw Error("Worker unavailable");
      }
    };
  });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/users/")
        ? [metadata("fallback", { topics: ["game"] })]
        : file(),
    }),
  );
  await open(page);
  await page
    .getByRole("button", { name: "Select all filtered repositories" })
    .click();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete: 1 of 1",
  );
  await expect(page.locator("repository-audit")).toContainText(
    "Minimal for a Game",
  );
});

test("project type overrides update cached evidence, retain keyboard focus and reset explicitly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  let reads = 0;
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/users/")) {
      const owner = url.includes("/another/") ? "another" : "example";
      return route.fulfill({
        json: [
          metadata("tool", {
            topics: ["cli"],
            full_name: `${owner}/tool`,
            owner: { login: owner },
          }),
        ],
      });
    }
    reads++;
    return route.fulfill({ json: file() });
  });
  await open(page);
  const type = page.getByLabel("Project type for example/tool", {
    exact: true,
  });
  await expect(type.locator("option")).toHaveCount(15);
  await expect(page.locator("repository-audit")).toContainText(
    "Suggested type: CLI",
  );
  await expect(page.locator("repository-audit")).toContainText(
    "Repository topic “cli”",
  );
  await type.selectOption("experiment");
  await page.getByLabel("Select example/tool", { exact: true }).check();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit")).toContainText(
    "Basic for an Experiment",
  );
  expect(reads).toBe(1);
  await type.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(type).toHaveValue("web-app");
  await expect(type).toBeFocused();
  await expect(page.locator("repository-audit")).toContainText(
    "Minimal for a Web App",
  );
  await expect(page.locator("repository-audit")).toContainText(
    "Deployment: not detected. Commonly useful for this project type.",
  );
  await expect(page.locator("repository-audit")).toContainText(
    "Suggested type: CLI",
  );
  expect(reads).toBe(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  // Leave the native select popup before dismissing the containing dialog.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "README audit", exact: true }).click();
  await expect(type).toHaveValue("web-app");
  await page.getByLabel("Fetch fresh README content").check();
  await page
    .getByRole("button", { name: "Audit selected", exact: true })
    .click();
  await expect(page.locator("repository-audit [data-status]")).toContainText(
    "Audit complete: 1 of 1",
  );
  await expect(type).toHaveValue("web-app");
  expect(reads).toBe(2);
  await type.selectOption("auto");
  await expect(page.locator("repository-audit")).toContainText(
    "Minimal for a CLI",
  );
  expect(reads).toBe(2);
  await type.selectOption("experiment");
  await page.getByLabel("GitHub username", { exact: true }).fill("another");
  await page
    .getByRole("button", { name: "Load repositories", exact: true })
    .click();
  await expect(
    page.getByLabel("Project type for another/tool", { exact: true }),
  ).toHaveValue("auto");
  expect(
    await page
      .locator("repository-audit")
      .evaluate((el) => el.state.typeOverrides.size),
  ).toBe(0);
});
