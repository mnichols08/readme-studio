import { html } from "../markdown/serialize.js";
import {
  commandGroups,
  commands,
  searchWorkspace,
  activityEntry,
  validateActivity,
} from "./commands.js";
import { widgetRegistry as widgets } from "../widgets/registry.js";

export function installWorkspace(app) {
  const actions = app.querySelector(".header-actions");
  actions.innerHTML =
    '<button data-action="command-palette">Search workspace <kbd>Ctrl K</kbd></button>';
  const tools = document.createElement("nav");
  tools.className = "workspace-tools";
  tools.setAttribute("aria-label", "Workspace tools");
  tools.innerHTML = Object.entries(commandGroups)
    .map(
      ([group, items]) =>
        `<details data-tool-group="${group}" ${app.data.settings.closedGroups?.includes(group) ? "" : "open"}><summary>${group}</summary><div>${items
          .filter(([id]) => !["drafts", "profile", "backup-all"].includes(id))
          .map(([id, name]) => `<button data-action="${id}">${name}</button>`)
          .join("")}</div></details>`,
    )
    .join("");
  app.querySelector(".app-header").after(tools);
  tools.querySelectorAll("details").forEach((d) =>
    d.addEventListener("toggle", () => {
      app.data.settings.closedGroups = [
        ...tools.querySelectorAll("details:not([open])"),
      ].map((e) => e.dataset.toolGroup);
      app.save();
    }),
  );
  app.openCommandPalette = () => {
    if (app.dialog.open) {
      app.closeDialog();
      if (app.dialog.open) return;
    }
    const draft = app.store.draft;
    const items = [
      ...commands,
      ...draft.blocks.map((b) => ({
        id: b.id,
        name: b.section?.title || b.settings.name || b.settings.title || b.type,
        category: "Sections",
        kind: "section",
      })),
      ...(app.data.badgeCollections?.items || []).map((c) => ({
        ...c,
        category: "Badge collections",
        kind: "collection",
      })),
      ...(app.data.componentLibrary?.snippets || []).map((c) => ({
        ...c,
        component: c,
        category: "Snippets",
        kind: "snippet",
      })),
      ...widgets.map((w) => ({ ...w, category: "Widgets", kind: "widget" })),
      ...draft.blocks
        .filter((b) => b.type === "projects")
        .flatMap((b) =>
          (b.settings.items || b.settings.projects || []).map((p) => ({
            id: b.id,
            name: p.name || p.title || "Project",
            category: "Projects",
            kind: "section",
          })),
        ),
    ];
    app.modal(
      '<h1>Search workspace</h1><label>Search commands and content<input type="search" data-search autocomplete="off"></label><p class="hint">Commands open their normal review flow. Enter chooses the first result; Tab explores results.</p><p data-search-count role="status"></p><div data-search-results></div>',
    );
    const input = app.querySelector("[data-search]"),
      results = app.querySelector("[data-search-results]");
    let found = [];
    const choose = (i) => {
      const item = found[i];
      if (!item) return;
      app.closeDialog();
      if (item.kind === "command") app.action(item.id);
      else if (item.kind === "section") {
        app.mobile("build");
        app.blockAction("edit", item.id);
        app.afterDialogFocus =
          app.content.querySelector("input,textarea,select") ||
          app.content.querySelector("button");
        app.afterDialogFocus?.focus();
      } else if (item.kind === "collection") {
        app.openCollections();
        const editor = app.querySelector("badge-collection-editor");
        editor.selected = item.id;
        editor.draw();
      } else if (item.kind === "widget") {
        app.openWidgets();
        app.querySelector("widget-hub").open(item.id);
      } else {
        app.openComponents();
        app.querySelector("component-library").open(item.component);
      }
    };
    const render = () => {
      found = searchWorkspace(items, input.value);
      results.innerHTML = found
        .map(
          (c, i) =>
            `<button class="wide" data-result="${i}">${html(c.name)} <small>${html(c.category)}</small></button>`,
        )
        .join("");
      app.querySelector("[data-search-count]").textContent = found.length
        ? `${found.length} results shown (maximum 50).`
        : "No matches. Try a section name or a tool such as badges.";
    };
    input.oninput = render;
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        choose(0);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        results.querySelector("button")?.focus();
      }
    };
    results.onclick = (e) => {
      const b = e.target.closest("[data-result]");
      if (b) choose(Number(b.dataset.result));
    };
    render();
  };
  app.workspaceAction = (action) => {
    if (action === "command-palette") {
      app.openCommandPalette();
      return true;
    }
    if (action === "show-preview" || action === "show-health") {
      app.mobile(action === "show-preview" ? "preview" : "health");
      return true;
    }
    if (action === "activity") {
      const events = validateActivity(app.data.activity).reverse();
      app.modal(
        `<h1>Local activity</h1><p>Recent tool openings on this browser only. No document content, account data or network analytics.</p>${events.length ? `<ol>${events.map((e) => `<li>${html(commands.find((c) => c.id === e.action).name)} — ${html(new Date(e.time).toLocaleString())}</li>`).join("")}</ol>` : "<p>No activity yet. Open a tool to get started.</p>"}<button data-clear-activity>Clear activity</button>`,
      );
      app.querySelector("[data-clear-activity]").onclick = () => {
        app.data.activity = [];
        app.save();
        app.workspaceAction("activity");
      };
      return true;
    }
    if (action === "settings") {
      app.modal(
        `<h1>Workspace settings</h1><fieldset><legend>Editor</legend><label>Editor font size<select data-setting="editorFont"><option value="13">Small</option><option value="15">Medium</option><option value="18">Large</option></select></label></fieldset><fieldset><legend>Preview</legend><label>Default preview width<select data-setting="preview"><option value="1012">Desktop</option><option value="760">Narrow</option><option value="640">Tablet</option><option value="375">Mobile</option></select></label></fieldset><fieldset><legend>Accessibility</legend><label class="check"><input type="checkbox" data-setting="reduceMotion">Reduce motion</label><p>System reduced-motion preferences are also respected. Escape closes dialogs; Shift+Tab leaves the editor.</p></fieldset><fieldset><legend>GitHub</legend><p>Connection is optional. Publishing always requires a separate review.</p><button data-action="publish-github">Open publishing</button></fieldset><fieldset><legend>Storage</legend><button data-action="backup-all">Download all drafts backup</button><button data-action="restore">Restore backup</button></fieldset><details><summary>Advanced</summary><p>Analysis runs locally. Download a backup before clearing browser data.</p><a href="https://github.com/mnichols08/readme-studio/blob/main/docs/contributing.md" target="_blank" rel="noopener noreferrer">Contributor documentation</a></details>`,
      );
      app.querySelectorAll("[data-setting]").forEach((e) => {
        const key = e.dataset.setting;
        if (e.type === "checkbox") e.checked = !!app.data.settings[key];
        else e.value = String(app.data.settings[key] || 15);
        e.onchange = () => {
          app.data.settings[key] = e.type === "checkbox" ? e.checked : e.value;
          app.applySettings();
          app.save();
        };
      });
      return true;
    }
    const event = activityEntry(action);
    if (event) {
      app.data.activity = validateActivity([
        ...(app.data.activity || []),
        event,
      ]);
      app.save();
    }
    return false;
  };
}
