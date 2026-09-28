import { test, expect } from "@playwright/test";
async function start(page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample profile" })
    .click();
  await page.getByRole("button", { name: "Workflows", exact: true }).click();
  return page.getByRole("dialog");
}
test("generates attributed Constellation, validates fields and downloads YAML offline", async ({
  page,
  context,
}) => {
  const d = await start(page);
  await context.setOffline(true);
  await d.getByLabel("Repository for README embed").fill("octocat/octocat");
  await d.getByLabel(/Workflow may publish/).check();
  await d.getByRole("button", { name: "Generate YAML for review" }).click();
  await expect(d.getByLabel("Generated YAML")).toHaveValue(
    /mnichols08\/constellation@v3.0.0/,
  );
  await expect(d.getByLabel("README embed", { exact: true })).toHaveValue(
    /Made with/,
  );
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "Download YAML", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("constellation.yml");
  await d.getByLabel("Workflow filename").fill("../bad.yml");
  await expect(d.getByLabel("Generated YAML")).not.toBeVisible();
  await d.getByRole("button", { name: "Generate YAML for review" }).click();
  await expect(d.locator("[data-status]")).toContainText("safe-name");
});
test("Snake and Metrics helpers fit mobile and copy fallback stays selectable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(Error("denied")) },
      configurable: true,
    });
  });
  const d = await start(page);
  await d.getByLabel("Workflow helper").selectOption("snake");
  await d.getByLabel("Repository for README embed").fill("octocat/octocat");
  await d.getByLabel(/Workflow may publish/).check();
  await d.getByRole("button", { name: "Generate YAML for review" }).click();
  await expect(d.getByLabel("README embed", { exact: true })).toHaveValue(
    /<picture>/,
  );
  await d.getByRole("button", { name: "Copy YAML" }).click();
  await expect(d.getByLabel("Generated YAML")).toBeFocused();
  await d.getByLabel("Workflow helper").selectOption("metrics");
  await d.getByLabel("Metrics secret NAME").fill("MY_METRICS");
  await d.getByRole("button", { name: "Generate YAML for review" }).click();
  await expect(d.getByLabel("Generated YAML")).toHaveValue(
    /secrets.MY_METRICS/,
  );
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(
    true,
  );
});
test("workflow publishing requires permissions, diff and confirmation; stale remote stops writes", async ({
  page,
}) => {
  let reads = 0,
    writes = 0;
  const sha = "a".repeat(40),
    next = "b".repeat(40);
  await page.route("**/api/publishing/*", async (route) => {
    const op = route.request().url().split("/").at(-1);
    let data = {};
    if (op === "session")
      data = {
        configured: true,
        connected: true,
        csrf: "test",
        identity: { login: "octocat", name: "Octo", avatar: "" },
      };
    if (op === "repositories")
      data = {
        repositories: [
          {
            repository: "octocat/octocat",
            branch: "main",
            visibility: "public",
            writable: true,
            workflowsWritable: true,
          },
        ],
      };
    if (op === "read") {
      reads++;
      data = {
        ...route.request().postDataJSON(),
        content: reads === 1 ? "name: Before" : "name: Concurrent",
        sha: reads === 1 ? sha : next,
        commitSha: sha,
      };
    }
    if (op === "commit") {
      writes++;
      data = { ...route.request().postDataJSON(), commitSha: next, sha: next };
    }
    await route.fulfill({ json: data });
  });
  let d = await start(page);
  await d.getByRole("button", { name: "Generate YAML for review" }).click();
  await d.getByRole("button", { name: "Review workflow publishing" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Target repository").selectOption("octocat/octocat");
  await d.getByRole("button", { name: "Load remote workflow" }).click();
  await expect(d.getByLabel("Prepared YAML")).toHaveValue(/workflow_dispatch/);
  expect(writes).toBe(0);
  await d.getByLabel(/I reviewed this diff/).check();
  await d.getByRole("button", { name: "Confirm and publish workflow" }).click();
  await expect(d.locator("[data-status]")).toContainText(
    "Remote README changed",
  );
  expect(writes).toBe(0);
  await d
    .getByRole("button", {
      name: "Reload workflow baseline and review generated replacement",
    })
    .click();
  await d.getByLabel(/I reviewed this diff/).check();
  await d.getByRole("button", { name: "Confirm and publish workflow" }).click();
  await expect(d.locator("[data-status]")).toContainText("Workflow published");
  expect(writes).toBe(1);
});
