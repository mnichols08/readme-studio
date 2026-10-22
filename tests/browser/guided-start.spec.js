import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const guide = (page) =>
  page.evaluate(() => document.querySelector("app-shell").data.guide);
const stored = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("readme-studio:v1") || "null"),
  );
const dialog = (page) => page.getByRole("dialog");
const goal = (page, name) =>
  dialog(page).getByRole("button", { name, exact: true });
// Guided start itself never contacts GitHub; record anything that tries.
function watchGitHub(page) {
  const requests = [];
  page.on("request", (r) => {
    if (/github\.com|githubusercontent\.com/.test(r.url()))
      requests.push(r.url());
  });
  return requests;
}

test("first run asks for a Goal, keeps every Start path and states where work is kept", async ({
  page,
}) => {
  const requests = watchGitHub(page);
  await page.goto("/");
  await expect(dialog(page)).toHaveAccessibleName(
    "What do you want to do first?",
  );
  await expect(
    dialog(page).getByRole("heading", {
      level: 1,
      name: "What do you want to do first?",
    }),
  ).toBeVisible();
  const goals = dialog(page).getByRole("list", { name: "Goals" });
  await expect(goals.getByRole("button")).toHaveCount(3);
  await expect(goal(page, "Write my profile README")).toBeFocused();
  await expect(
    goal(page, "Write my profile README"),
  ).toHaveAccessibleDescription(
    "Introduce yourself on your GitHub profile page.",
  );
  await expect(
    goal(page, "Write a repository README"),
  ).toHaveAccessibleDescription(/install it and how to use it/);
  await expect(
    goal(page, "Audit my repository READMEs"),
  ).toHaveAccessibleDescription(/Needs a GitHub connection/);
  // Earlier Start paths keep their names (one renamed: imports take files too).
  const paths = dialog(page).getByRole("region", {
    name: "Other ways to start",
  });
  for (const name of [
    "Start from a template",
    "Autofill from GitHub",
    "Import existing README",
    "Open Studio project",
    "Start blank",
    "Explore the sample profile",
  ])
    await expect(paths.getByRole("button", { name })).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Import GitHub README" }),
  ).toHaveCount(0);
  const locality = dialog(page).getByRole("region", {
    name: "Where your work is kept",
  });
  await expect(locality).toContainText("saved only in this browser");
  await expect(locality).toContainText("not encrypted");
  await expect(locality).toContainText("download a backup");
  await expect(locality).toContainText(
    "GitHub is contacted only when you choose import, autofill or audit",
  );
  await expect(locality).toContainText("not uploaded for analysis");
  await expect(locality).toContainText(
    "Nothing is published without its own review.",
  );
  await expect(
    locality.getByRole("link", { name: "Privacy details" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/mnichols08/readme-studio/blob/main/docs/privacy.md",
  );
  await expect(locality).not.toContainText("temporary workspace");
  // Nothing is chosen until the author picks a Goal.
  expect((await guide(page)).goal).toBeNull();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(requests).toEqual([]);
});

test("keyboard Goal choice moves to its step, Back restores focus and the Goal is saved", async ({
  page,
}) => {
  const requests = watchGitHub(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(goal(page, "Write my profile README")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(goal(page, "Write a repository README")).toBeFocused();
  await page.keyboard.press("Enter");
  const heading = dialog(page).getByRole("heading", {
    level: 1,
    name: "Start a repository README",
  });
  await expect(heading).toBeFocused();
  await expect(dialog(page)).toHaveAccessibleName("Start a repository README");
  for (const name of [
    "Build a repository README",
    "Import existing README",
    "Start a blank repository README",
  ])
    await expect(
      dialog(page).getByRole("button", { name, exact: true }),
    ).toBeVisible();
  expect(await guide(page)).toEqual({
    version: 1,
    goal: "repository",
    nextSteps: true,
  });
  expect((await stored(page)).guide.goal).toBe("repository");
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await expect(goal(page, "Write a repository README")).toBeFocused();
  await expect(goal(page, "Write a repository README")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(goal(page, "Write my profile README")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    dialog(page).getByRole("heading", { name: "Start your profile README" }),
  ).toBeFocused();
  expect((await stored(page)).guide.goal).toBe("profile");
  // A Goal never changes a document.
  const before = await page.evaluate(() =>
    document.querySelector("app-shell").data.drafts.map((d) => d.markdown),
  );
  expect(before).toHaveLength(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(
    await page.evaluate(() =>
      document.querySelector("app-shell").data.drafts.map((d) => d.markdown),
    ),
  ).toEqual(before);
  // A saved workspace never reopens Guided start by itself.
  await page.reload();
  await expect(page.getByLabel("Current draft")).toBeVisible();
  await expect(dialog(page)).toBeHidden();
  // Reopening marks the saved Goal and focuses it.
  await page.getByRole("button", { name: "Search workspace" }).click();
  await page.getByLabel("Search commands and content").fill("guided start");
  await page.keyboard.press("Enter");
  await expect(goal(page, "Write my profile README")).toBeFocused();
  await expect(goal(page, "Write my profile README")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    goal(page, "Write my profile README"),
  ).toHaveAccessibleDescription(/Your current goal/);
  await expect(goal(page, "Audit my repository READMEs")).not.toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Search workspace" }),
  ).toBeFocused();
  expect(requests).toEqual([]);
});

test("each Goal step opens the existing flow or a blank document of its kind", async ({
  page,
}) => {
  await page.route("https://api.github.com/**", (r) => r.abort());
  await page.goto("/");
  await goal(page, "Write my profile README").click();
  await dialog(page)
    .getByRole("button", { name: "Start a blank profile README" })
    .click();
  await expect(dialog(page)).toBeHidden();
  let active = await page.evaluate(() => {
    const app = document.querySelector("app-shell");
    return { draft: app.store.draft, count: app.data.drafts.length };
  });
  expect(active.count).toBe(2);
  expect(active.draft.name).toBe("Profile README");
  expect(active.draft.markdown).toBe("");
  expect(active.draft.metadata.workspaceDocument).toEqual({
    version: 1,
    kind: "profile",
    target: null,
  });
  await expect(
    page.getByLabel("Current draft").locator("optgroup[label=Profile] option"),
  ).toHaveCount(2);

  const reopen = async (name) => {
    if (await dialog(page).isVisible()) {
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
    }
    await page.locator('.workspace-tools [data-action="guided-start"]').click();
    await goal(page, name).click();
  };
  await reopen("Write a repository README");
  await dialog(page)
    .getByRole("button", { name: "Start a blank repository README" })
    .click();
  active = await page.evaluate(
    () => document.querySelector("app-shell").store.draft,
  );
  expect(active.name).toBe("Repository README");
  expect(active.metadata.workspaceDocument).toEqual({
    version: 1,
    kind: "repository",
    target: null,
  });
  await expect(
    page
      .getByLabel("Current draft")
      .locator("optgroup[label=Repositories] option"),
  ).toHaveCount(1);

  await reopen("Write a repository README");
  await dialog(page)
    .getByRole("button", { name: "Import existing README" })
    .click();
  await expect(
    dialog(page).getByRole("heading", { name: "Import README" }),
  ).toBeVisible();
  await reopen("Write a repository README");
  await dialog(page)
    .getByRole("button", { name: "Build a repository README" })
    .click();
  await expect(
    dialog(page).getByRole("heading", { name: "Repository README builder" }),
  ).toBeVisible();
  await reopen("Write my profile README");
  await dialog(page)
    .getByRole("button", { name: "Autofill from GitHub" })
    .click();
  await expect(page.getByLabel("GitHub username or profile URL")).toBeFocused();
  await reopen("Write my profile README");
  await dialog(page)
    .getByRole("button", { name: "Start from a profile template" })
    .click();
  await expect(
    dialog(page).getByRole("heading", { name: "Choose your structure." }),
  ).toBeVisible();
  await reopen("Audit my repository READMEs");
  await expect(
    dialog(page).getByRole("heading", {
      name: "Audit your repository READMEs",
    }),
  ).toBeFocused();
  await expect(
    dialog(page).getByRole("button", { name: "Import existing README" }),
  ).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Open README audit" }).click();
  await expect(page.getByLabel("GitHub username")).toBeFocused();
  // Opening tools from Guided start changed no document.
  expect(
    await page.evaluate(() =>
      document.querySelector("app-shell").data.drafts.map((d) => d.markdown),
    ),
  ).toEqual([expect.stringContaining("#"), "", ""]);
  expect((await guide(page)).goal).toBe("audit");
});

test("offline, the audit stays focusable but unavailable and offers local ways to begin", async ({
  page,
  context,
}) => {
  const requests = watchGitHub(page);
  await page.goto("/");
  await context.setOffline(true);
  await goal(page, "Audit my repository READMEs").click();
  const audit = dialog(page).getByRole("button", {
    name: "Open README audit",
  });
  await expect(audit).toHaveAttribute("aria-disabled", "true");
  await expect(audit).toHaveAccessibleDescription(/You are offline/);
  await audit.focus();
  await expect(audit).toBeFocused();
  await page.keyboard.press("Enter");
  // Playwright refuses to click an aria-disabled button; a pointer still can.
  await audit.click({ force: true });
  await expect(
    dialog(page).getByRole("heading", {
      name: "Audit your repository READMEs",
    }),
  ).toBeVisible();
  await expect(page.locator("repository-audit")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    dialog(page).getByRole("button", { name: "Import existing README" }),
  ).toBeFocused();
  await dialog(page)
    .getByRole("button", { name: "Start a blank repository README" })
    .click();
  await expect(dialog(page)).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        document.querySelector("app-shell").store.draft.metadata
          .workspaceDocument.kind,
    ),
  ).toBe("repository");
  await context.setOffline(false);
  await page.locator('.workspace-tools [data-action="guided-start"]').click();
  await goal(page, "Audit my repository READMEs").click();
  await expect(
    dialog(page).getByRole("button", { name: "Open README audit" }),
  ).not.toHaveAttribute("aria-disabled");
  expect(requests).toEqual([]);
});

test("blocked storage says the workspace is temporary and the Goal stays in memory", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  await page.goto("/");
  const locality = dialog(page).getByRole("region", {
    name: "Where your work is kept",
  });
  await expect(locality).toContainText("temporary workspace");
  await expect(locality).not.toContainText("saved only in this browser");
  await goal(page, "Write my profile README").click();
  expect((await guide(page)).goal).toBe("profile");
  await page.keyboard.press("Escape");
  await expect(page.locator(".save-status")).toHaveText(
    "Temporary workspace · export to keep work",
  );
});

test("the Goal is in all-drafts backups but never in README, draft JSON or project exports", async ({
  page,
}) => {
  await page.goto("/");
  await goal(page, "Write a repository README").click();
  await page.keyboard.press("Escape");
  const text = async (trigger) => {
    const download = page.waitForEvent("download");
    await trigger();
    return readFileSync(await (await download).path(), "utf8");
  };
  await page.getByRole("button", { name: "Manage drafts" }).click();
  const backup = JSON.parse(
    await text(() =>
      dialog(page)
        .getByRole("button", { name: "Download all drafts backup" })
        .click(),
    ),
  );
  await page.keyboard.press("Escape");
  expect(backup.guide).toEqual({
    version: 1,
    goal: "repository",
    nextSteps: true,
  });
  const readme = await text(() =>
    page.locator('.workspace-tools [data-action="download"]').click(),
  );
  expect(readme).toBe(
    await page.evaluate(
      () => document.querySelector("app-shell").store.draft.markdown,
    ),
  );
  expect(readme).not.toContain('"guide"');
  await page.getByRole("button", { name: "Manage drafts" }).click();
  const draft = await text(() =>
    page.getByRole("button", { name: "Download draft backup" }).click(),
  );
  expect(draft).not.toContain('"guide"');
  await page.keyboard.press("Escape");
  await page.locator('.workspace-tools [data-action="save-project"]').click();
  await dialog(page)
    .getByLabel("Include reusable libraries", { exact: false })
    .check();
  const project = await text(() =>
    dialog(page)
      .getByRole("button", { name: "Download Studio project" })
      .click(),
  );
  expect(JSON.parse(project).schemaVersion).toBe(1);
  expect(project).not.toContain('"guide"');
  expect(project).not.toContain('"nextSteps"');
});
