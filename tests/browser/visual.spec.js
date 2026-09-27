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
