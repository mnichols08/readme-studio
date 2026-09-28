import { test, expect } from "@playwright/test";
const sha = "a".repeat(40),
  next = "b".repeat(40);
async function setup(page, { exists = true, fail = false } = {}) {
  const writes = [];
  let connected = false;
  await page.route("**/api/publishing/*", async (route) => {
    const op = route.request().url().split("/").at(-1);
    let data = {};
    let status = 200;
    if (op === "session")
      data = {
        configured: true,
        connected,
        csrf: "test",
        identity: {
          login: "octocat",
          name: "Octo",
          avatar: "https://avatars.githubusercontent.com/u/1",
        },
      };
    if (op === "connect") data = { code: "ABCD-EFGH" };
    if (op === "poll") {
      connected = true;
      data = { connected: true };
    }
    if (op === "disconnect") connected = false;
    if (op === "repositories")
      data = {
        repositories: [
          {
            repository: "octocat/octocat",
            branch: "main",
            visibility: "public",
            writable: true,
          },
        ],
      };
    if (op === "read")
      data = {
        ...route.request().postDataJSON(),
        content: exists ? "# Old" : "",
        sha: exists ? sha : null,
        commitSha: sha,
      };
    if (op === "commit") {
      writes.push(route.request().postDataJSON());
      if (fail) {
        status = 403;
        data = {
          error:
            "GitHub denied access: branch protection. Download remains available.",
        };
      } else
        data = {
          ...route.request().postDataJSON(),
          sha: next,
          commitSha: next,
        };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  if (await page.locator("[data-pane=markdown]").isVisible())
    await page.locator("[data-pane=markdown]").click();
  await page
    .getByRole("textbox", { name: "Markdown editor", exact: true })
    .fill("# New 🦀");
  await page
    .getByRole("button", { name: "Publish to GitHub", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Connect GitHub", exact: true }).click();
  await expect(d).toContainText("ABCD-EFGH");
  await d.getByRole("button", { name: "Check authorization" }).click();
  await d.getByLabel("Target repository").selectOption("octocat/octocat");
  await d.getByRole("button", { name: "Load remote README" }).click();
  return { d, writes };
}
for (const exists of [true, false])
  test(`explicit review before ${exists ? "updating" : "creating"} README; source stays unchanged`, async ({
    page,
  }) => {
    const { d, writes } = await setup(page, { exists });
    expect(writes).toHaveLength(0);
    await expect(d.getByLabel("Prepared Markdown")).toHaveValue("# New 🦀");
    await d.getByRole("button", { name: "Confirm and publish README" }).click();
    expect(writes).toHaveLength(0);
    await expect(d.locator("[data-status]")).toContainText("confirm");
    await d.getByLabel(/I reviewed this diff/).check();
    await d.getByLabel("Commit message").fill("Personal update");
    await d.getByRole("button", { name: "Confirm and publish README" }).click();
    await expect(d.locator("[data-status]")).toContainText("published");
    expect(writes[0].sha).toBe(exists ? sha : null);
    expect(writes[0].message).toBe("Personal update");
    await expect(
      page.getByRole("textbox", { name: "Markdown editor", exact: true }),
    ).toHaveValue("# New 🦀");
    await d.getByRole("button", { name: "Disconnect GitHub" }).click();
    await expect(
      d.getByRole("button", { name: "Connect GitHub", exact: true }),
    ).toBeEnabled();
  });
test("failed publish preserves review and download at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const { d } = await setup(page, { fail: true });
  await d.getByLabel(/I reviewed this diff/).check();
  await d.getByRole("button", { name: "Confirm and publish README" }).click();
  await expect(d.locator("[data-status]")).toContainText("branch protection");
  await expect(d.getByLabel("Prepared Markdown")).toHaveValue("# New 🦀");
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "Download README fallback" }).click();
  expect((await download).suggestedFilename()).toBe("README.md");
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(
    true,
  );
});
