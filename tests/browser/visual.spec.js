import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
async function start(page) {
  await page.route("https://**/*", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"/>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
}
test("theme preview, apply, undo, and themed badge defaults", async ({
  page,
}) => {
  await start(page);
  const editor = page.getByRole("textbox", {
    name: "Markdown editor",
    exact: true,
  });
  const before = await editor.inputValue();
  await page.getByRole("button", { name: "Visual theme", exact: true }).click();
  await page
    .getByLabel("Built-in theme", { exact: true })
    .selectOption("workshop");
  await expect(editor).toHaveValue(before);
  await expect(page.locator(".theme-sample")).toContainText("Selected work");
  await page
    .getByRole("button", { name: "Apply visual theme", exact: true })
    .click();
  await expect(editor).toHaveValue(/✦/);
  await page.getByRole("button", { name: "Badge Studio", exact: true }).click();
  await expect(page.locator('[data-badge-field="color"]')).toHaveValue(
    "a84612",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveValue(before);
});
test("theme controls fit mobile and invalid colors cannot apply", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.getByRole("button", { name: "Visual theme", exact: true }).click();
  await page.getByLabel("accent hex", { exact: true }).fill("bad color");
  await expect(
    page.getByRole("button", { name: "Apply visual theme", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("accent hex", { exact: true }).fill("123456");
  await expect(
    page.getByRole("button", { name: "Apply visual theme", exact: true }),
  ).toBeEnabled();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("local theme-aware banners download safe SVG and insert portable markup", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Banner Builder", exact: true })
    .click();
  await page.locator('[data-banner="name"]').fill("Ada 雪");
  await page.locator('[data-banner="title"]').fill("Systems developer");
  await page
    .getByRole("button", { name: "Suggest alt from name and title" })
    .click();
  await page
    .getByLabel("Banner style", { exact: true })
    .selectOption("constellation");
  await expect(page.locator("[data-banner-svg]")).toHaveValue(/Ada 雪/);
  await page
    .getByLabel("Banner preview mode", { exact: true })
    .selectOption("dark");
  await page
    .getByLabel("Banner preview width", { exact: true })
    .selectOption("320px");
  expect(
    await page
      .locator(".banner-preview")
      .evaluate((e) => e.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(320);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download banner-dark.svg", exact: true })
    .click();
  const asset = await download;
  expect(asset.suggestedFilename()).toBe("banner-dark.svg");
  const svg = await readFile(await asset.path(), "utf8");
  expect(svg).toContain("Ada 雪");
  expect(svg).not.toContain("<script");
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
    .getByRole("button", { name: "Copy SVG source", exact: true })
    .click();
  await expect(page.locator("[data-banner-svg]")).toBeFocused();
  await page
    .getByRole("button", { name: "Insert banner markup", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown editor", exact: true }),
  ).toHaveValue(/assets\/banner-light.svg/);
  await page
    .getByRole("button", { name: "Banner Builder", exact: true })
    .click();
  await expect(page.locator('[data-banner="name"]')).toHaveValue("Ada 雪");
});

test("section style overrides survive theme changes while Custom Markdown stays exact", async ({
  page,
}) => {
  await start(page);
  const custom = await page
    .locator("app-shell")
    .evaluate((el) => el.store.draft.blocks.filter((b) => b.type === "custom"));
  await page
    .getByRole("button", { name: "Section style", exact: true })
    .click();
  await page
    .getByLabel("Heading style", { exact: true })
    .selectOption("centered");
  await page.getByLabel("Divider style", { exact: true }).selectOption("dots");
  await page
    .getByLabel("Section preview width", { exact: true })
    .selectOption("320px");
  await expect(page.locator(".section-style-preview h1")).toHaveAttribute(
    "align",
    "center",
  );
  await page
    .getByRole("button", { name: "Save section style", exact: true })
    .click();
  await page.getByRole("button", { name: "Visual theme", exact: true }).click();
  await page.getByLabel("Built-in theme", { exact: true }).selectOption("nord");
  await page
    .getByRole("button", { name: "Apply visual theme", exact: true })
    .click();
  expect(
    await page
      .locator("app-shell")
      .evaluate((el) =>
        el.store.draft.blocks.filter((b) => b.type === "custom"),
      ),
  ).toEqual(custom);
  await page
    .getByRole("button", { name: "Section style", exact: true })
    .click();
  await expect(page.getByLabel("Heading style", { exact: true })).toHaveValue(
    "centered",
  );
  await expect(page.getByLabel("Divider style", { exact: true })).toHaveValue(
    "dots",
  );
});
test("callout, code, details and columns are available through the builder", async ({
  page,
}) => {
  await start(page);
  for (const [name, field, value] of [
    ["Callout", "Callout text", "Remember to test"],
    ["Collapsible Details", "Details Markdown", "Extra details"],
    ["Code Sample", "Code source", 'console.log("safe");'],
    ["Two Columns", "Left text", "Left column"],
  ]) {
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page
      .locator(".library-grid")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await page
      .locator("builder-form")
      .getByLabel(field, { exact: true })
      .fill(value);
    if (name === "Code Sample")
      await page.locator('[data-path="collapsed"]').check();
    await page
      .locator("builder-form")
      .getByRole("button", { name: "Add to README", exact: true })
      .click();
  }
  const source = page.getByRole("textbox", {
    name: "Markdown editor",
    exact: true,
  });
  await expect(source).toHaveValue(/> \[!NOTE\]/);
  await expect(source).toHaveValue(/<details>/);
  await expect(source).toHaveValue(/console.log/);
  await expect(source).toHaveValue(/Left column/);
});

test("app color toggle synchronizes preview and picture sources without changing Markdown", async ({
  page,
}) => {
  await start(page);
  const editor = page.getByRole("textbox", {
    name: "Markdown editor",
    exact: true,
  });
  const source =
    '<picture><source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.svg"><img src="https://example.com/light.svg" alt="Theme"></picture>';
  await editor.fill(source);
  const appToggle = page.getByRole("button", {
    name: "Toggle color theme",
    exact: true,
  });
  const previewToggle = page.getByRole("button", {
    name: "Toggle preview color theme",
    exact: true,
  });
  await previewToggle.click();
  await appToggle.click();
  await expect(page.locator(".preview-paper")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(page.locator("github-preview source")).toHaveAttribute(
    "media",
    "all",
  );
  await appToggle.click();
  await expect(page.locator(".preview-paper")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await expect(page.locator("github-preview source")).toHaveAttribute(
    "media",
    "not all",
  );
  await appToggle.click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".preview-paper")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(page.locator("github-preview source")).toHaveAttribute(
    "media",
    "all",
  );
  await expect(editor).toHaveValue(source);
  await previewToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".preview-paper")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await expect(editor).toHaveValue(source);
});

test("saved visual themes can be managed, imported and backed up without touching source", async ({
  page,
}) => {
  await start(page);
  const editor = page.getByRole("textbox", {
    name: "Markdown editor",
    exact: true,
  });
  const source = await editor.inputValue();
  await page
    .getByRole("button", { name: "Visual presets", exact: true })
    .click();
  await page.getByLabel("Preset name", { exact: true }).fill("My palette");
  await page
    .getByRole("button", { name: "Save current theme", exact: true })
    .click();
  const select = page.getByLabel("Saved preset", { exact: true });
  await select.selectOption({ label: "themes: My palette" });
  await page
    .getByRole("button", { name: "Duplicate preset", exact: true })
    .click();
  await expect(select.locator("option")).toHaveCount(3);
  await select.selectOption({ label: "themes: My palette (2)" });
  await page.getByLabel("Preset name", { exact: true }).fill("Renamed");
  await page
    .getByRole("button", { name: "Rename preset", exact: true })
    .click();
  await select.selectOption({ label: "themes: Renamed" });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export preset", exact: true })
    .click();
  const file = await download;
  const exported = await readFile(await file.path(), "utf8");
  expect(JSON.parse(exported).type).toBe("readme-studio-theme");
  await page
    .getByText("Import themes and visual presets", { exact: true })
    .click();
  await page.getByLabel("Visual preset JSON", { exact: true }).fill(exported);
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Append reviewed presets", exact: true })
    .click();
  await expect(select.locator("option")).toHaveCount(4);
  await select.selectOption({ label: "themes: Renamed (2)" });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete preset", exact: true })
    .click();
  await expect(select.locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(editor).toHaveValue(source);
  await page.reload();
  await page
    .getByRole("button", { name: "Visual presets", exact: true })
    .click();
  await expect(select.locator("option")).toHaveCount(3);
  const library = await page
    .locator("app-shell")
    .evaluate((el) => el.data.visualLibrary);
  expect(library.themes.map((t) => t.name)).toEqual(["My palette", "Renamed"]);
});

test("visual gallery is keyboard usable at mobile width and applies reviewed presets offline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Visual presets", exact: true })
    .click();
  const review = page.getByRole("button", {
    name: "Review Workshop theme",
    exact: true,
  });
  await review.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Apply Workshop", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByLabel("Preset apply mode", { exact: true }),
  ).toHaveValue("derived");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Apply reviewed preset", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page
      .locator("app-shell")
      .evaluate((el) => el.store.draft.metadata.visualTheme.id),
  ).toBe("workshop");
  await page
    .getByRole("button", { name: "Visual presets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save visual bundle", exact: true })
    .click();
  await expect(
    page.getByLabel("Saved preset", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Visual presets", exact: true }),
  ).toBeFocused();
});

test("visual library save failure is visible and leaves the saved library intact", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Visual presets", exact: true })
    .click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Save current theme", exact: true })
    .click();
  await expect(page.locator(".visual-library-status")).toContainText(
    /save|storage|quota/i,
  );
  await expect(
    page.getByLabel("Saved preset", { exact: true }).locator("option"),
  ).toHaveCount(1);
});
