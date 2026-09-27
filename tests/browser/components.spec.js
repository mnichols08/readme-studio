import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.getByRole("button", { name: "Components", exact: true }).click();
}
test("search, favorite, preview source and insert component with undo", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Search components", { exact: true }).fill("terminal");
  await expect(page.locator(".component-results article")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Favorite Terminal heading", exact: true })
    .click();
  await page
    .getByLabel("Library view", { exact: true })
    .selectOption("favorites");
  await expect(page.locator(".component-results article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Preview Terminal heading", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("My work");
  await page
    .getByRole("button", { name: "Render preview", exact: true })
    .click();
  await expect(page.locator(".component-preview")).toContainText("My work");
  await page
    .getByRole("button", { name: "Insert component", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/## \$ My work/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).not.toHaveValue(/## \$ My work/);
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("recent");
  await expect(page.locator(".component-results article")).toHaveCount(1);
});
test("saved snippet preserves source across reload and mobile dialog remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.getByText("Save My Snippet", { exact: true }).click();
  await page.getByLabel("Snippet name", { exact: true }).fill("My raw snippet");
  const source = "# Mine\n\n{{untouched}} <script>example</script>";
  await page.getByLabel("Snippet Markdown", { exact: true }).fill(source);
  await page.getByRole("button", { name: "Save snippet locally" }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("saved");
  await page
    .getByRole("button", { name: "Preview My raw snippet", exact: true })
    .click();
  await expect(
    page.getByLabel("Component Markdown", { exact: true }),
  ).toHaveValue(source);
  await page
    .getByRole("button", { name: "Render preview", exact: true })
    .click();
  await expect(page.locator(".component-preview script")).toHaveCount(0);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByLabel("Library view", { exact: true }).selectOption("saved");
  await expect(page.locator(".component-results article")).toHaveCount(1);
});

test("Widget Hub generates typing URLs without requests while typing and inserts a picture embed", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Widget Hub", exact: true }).click();
  await page
    .getByRole("button", { name: "Configure Typing SVG", exact: true })
    .click();
  let requests = 0;
  await page.route("https://readme-typing-svg.demolab.com/**", (r) => {
    requests++;
    return r.abort();
  });
  await page
    .getByLabel("Typing lines", { exact: true })
    .fill("Hello + Rust\nSnow 雪");
  await page
    .getByRole("button", { name: "Generate typing URL", exact: true })
    .click();
  await expect(page.getByLabel("Image URL", { exact: true })).toHaveValue(
    /lines=Hello/,
  );
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Favorite widget", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Favorite widget", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Load remote preview", exact: true })
    .click();
  await expect(page.locator(".widget-status")).toContainText(
    "Remote image failed",
  );
  await page
    .getByLabel("Dark image URL", { exact: true })
    .fill("https://example.com/dark.svg");
  await page.getByLabel("Alignment", { exact: true }).selectOption("center");
  await page
    .getByRole("button", { name: "Insert widget", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/<picture>/);
});
test("Metrics helper stays usable offline with attribution, copy fallback and no integration", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Widget Hub", exact: true }).click();
  await page
    .getByRole("button", { name: "Configure GitHub Metrics", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "GitHub Metrics", exact: true }),
  ).toHaveAttribute("href", "https://github.com/lowlighter/metrics");
  await page
    .getByLabel("Image URL", { exact: true })
    .fill("https://example.com/metrics.svg");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Load remote preview", exact: true })
    .click();
  await expect(page.locator(".widget-status")).toContainText("Offline");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Copy widget Markdown", exact: true })
    .click();
  await expect(
    page.getByLabel("Widget Markdown", { exact: true }),
  ).toBeFocused();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Insert widget", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("snippet packs preview, import examples, keep collisions, export and import in a fresh workspace", async ({
  page,
  browser,
}) => {
  await start(page);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Snippet packs", exact: true })
    .click();
  await page.getByLabel("Example pack", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Review example pack", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import Terminal Kit", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByLabel("Collision policy", { exact: true }),
  ).toHaveValue("keep");
  await expect(
    page.getByLabel("Pack item Markdown", { exact: true }),
  ).toHaveValue(/whoami/);
  await page
    .getByRole("button", { name: "Import reviewed pack", exact: true })
    .click();
  await expect(page.locator(".pack-status")).toContainText("imported locally");
  await page.getByLabel("Example pack", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Review example pack", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import reviewed pack", exact: true })
    .click();
  await page.getByLabel("Pack name", { exact: true }).fill("My Terminal Kit");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download all reusable snippets backup",
      exact: true,
    })
    .click();
  const file = await download;
  const fs = await import("node:fs/promises");
  const json = await fs.readFile(await file.path(), "utf8");
  expect(JSON.parse(json).snippets).toHaveLength(6);
  await page.keyboard.press("Escape");
  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await start(fresh);
  await fresh.keyboard.press("Escape");
  await fresh
    .getByRole("button", { name: "Snippet packs", exact: true })
    .click();
  await fresh.getByLabel("Snippet pack JSON", { exact: true }).fill(json);
  await fresh
    .getByRole("button", { name: "Review snippet pack", exact: true })
    .click();
  await fresh
    .getByRole("button", { name: "Import reviewed pack", exact: true })
    .click();
  await fresh.keyboard.press("Escape");
  await fresh.getByRole("button", { name: "Components", exact: true }).click();
  await fresh.getByLabel("Library view", { exact: true }).selectOption("saved");
  await expect(fresh.locator(".component-results article")).toHaveCount(6);
  await freshContext.close();
});
test("malicious pack metadata and storage failure leave reusable state unchanged", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Snippet packs", exact: true })
    .click();
  await page.getByLabel("Snippet pack JSON", { exact: true }).fill(
    JSON.stringify({
      version: 1,
      type: "readme-studio-snippet-pack",
      name: "<img src=x onerror=alert(1)>",
      snippets: [],
    }),
  );
  await page
    .getByRole("button", { name: "Review snippet pack", exact: true })
    .click();
  await expect(page.locator(".pack-status")).toContainText("plain text");
  await expect(page.locator(".pack-review img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review example pack", exact: true })
    .click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Import reviewed pack", exact: true })
    .click();
  await expect(page.locator(".pack-status")).toContainText(
    "Could not import pack",
  );
  expect(
    await page
      .locator("app-shell")
      .evaluate((el) => el.data.componentLibrary?.snippets.length || 0),
  ).toBe(0);
});
