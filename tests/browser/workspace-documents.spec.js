import { test, expect } from "@playwright/test";
const current = (page) =>
  page.evaluate(() => document.querySelector("app-shell").store.draft.markdown);
async function start(page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
}
test("documents retain independent targets, undo and source through switching and reload at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await start(page);
  await page.evaluate(() =>
    document.querySelector("app-shell").store.raw("# Profile"),
  );
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  const panel = page.locator("workspace-documents");
  await panel.getByLabel("Document repository").fill("example/example");
  await panel.getByLabel("Document branch").fill("main");
  await panel.getByRole("button", { name: "Save document settings" }).click();
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await panel
    .getByRole("button", { name: "New document", exact: true })
    .click();
  await page.evaluate(() =>
    document.querySelector("app-shell").store.raw("# Game"),
  );
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await panel.getByLabel("Document group").selectOption("repository");
  await panel.getByLabel("Document repository").fill("example/game");
  await panel.getByLabel("Document branch").fill("develop");
  await panel.getByLabel("Document README path").fill("docs/README.md");
  await panel.getByRole("button", { name: "Save document settings" }).click();
  const ids = await page.evaluate(() =>
    document.querySelector("app-shell").data.drafts.map((d) => d.id),
  );
  await page.evaluate(() =>
    document.querySelector("app-shell").store.raw("# Game edited"),
  );
  await page.getByLabel("Current draft").selectOption(ids[0]);
  expect(await current(page)).toBe("# Profile");
  await page.evaluate(() =>
    document.querySelector("app-shell").store.raw("# Profile edited"),
  );
  await page.getByLabel("Current draft").selectOption(ids[1]);
  await page.locator('[data-pane="markdown"]').click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await current(page)).toBe("# Game");
  await page.getByLabel("Current draft").selectOption(ids[0]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await current(page)).toBe("# Profile");
  await page.getByLabel("Current draft").selectOption(ids[1]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await current(page)).toBe("# Game edited");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await panel.getByLabel("Find document").fill("example/example");
  await panel.locator("[data-document]").focus();
  await page.keyboard.press("Enter");
  expect(await current(page)).toBe("# Profile");
  await expect(page.getByLabel("Current draft")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  expect(await current(page)).toBe("# Profile");
  await page.getByLabel("Current draft").selectOption(ids[1]);
  expect(await current(page)).toBe("# Game edited");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(panel.getByLabel("Document repository")).toHaveValue(
    "example/game",
  );
  await expect(panel.getByLabel("Document branch")).toHaveValue("develop");
  await expect(panel.getByLabel("Document README path")).toHaveValue(
    "docs/README.md",
  );
});

test("audit opening reuses local work and Health analyzes only the selected document", async ({
  page,
}) => {
  await start(page);
  const openAudit = (source, builder = false) =>
    page.evaluate(
      ({ source, builder }) => {
        document.querySelector("app-shell").dispatchEvent(
          new CustomEvent("audit-improve", {
            detail: {
              repo: {
                full_name: "example/game",
                name: "game",
                default_branch: "main",
              },
              readme: { source, path: "README.md", sha: "a".repeat(40) },
              builder,
            },
          }),
        );
      },
      { source, builder },
    );
  await openAudit("# Imported");
  await page.evaluate(() =>
    document
      .querySelector("app-shell")
      .store.raw("# Local edits\n\n<script>alert(1)</script>"),
  );
  const ids = await page.evaluate(() =>
    document.querySelector("app-shell").data.drafts.map((d) => d.id),
  );
  await page.getByLabel("Current draft").selectOption(ids[0]);
  await openAudit("# Changed remotely", true);
  expect(await current(page)).toContain("# Local edits");
  expect(
    await page.evaluate(
      () => document.querySelector("app-shell").data.drafts.length,
    ),
  ).toBe(2);
  await page
    .getByRole("button", { name: "README Health", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("readme-health").evaluate((el) => el.analyzedSource),
    )
    .toBe("# Local edits\n\n<script>alert(1)</script>");
  await page.getByLabel("Current draft").selectOption(ids[0]);
  const profile = await current(page);
  await expect
    .poll(() =>
      page.locator("readme-health").evaluate((el) => el.analyzedSource),
    )
    .toBe(profile);
  await expect(page.locator("readme-health")).not.toContainText(
    "Analyzing README…",
  );
});
