export const commandGroups = {
  Create: [
    ["templates", "Templates"],
    ["repository-readme", "Repository README"],
    ["import", "Import"],
    ["projects", "Project Studio"],
    ["badges", "Badge Studio"],
    ["collections", "Collections"],
    ["components", "Components"],
    ["widgets", "Widget Hub"],
  ],
  Design: [
    ["visual-theme", "Visual theme"],
    ["banner", "Banner Builder"],
    ["section-style", "Section style"],
    ["visual-presets", "Visual presets"],
  ],
  Review: [
    ["show-preview", "Preview README"],
    ["show-health", "README Health"],
    ["compatibility", "Compatibility Lab"],
    ["refactors", "Safe refactors"],
  ],
  GitHub: [
    ["profile", "Autofill from GitHub"],
    ["repositories", "Repositories"],
    ["repository-audit", "README audit"],
    ["readme-attention", "README Attention Queue"],
    ["intelligence", "Profile Intelligence"],
    ["repository-health", "Check links"],
    ["refresh-github", "Refresh GitHub data"],
    ["publish-github", "Publish to GitHub"],
    ["workflows", "Workflows"],
  ],
  Save: [
    ["save-project", "Save Studio project"],
    ["open-project", "Open Studio project"],
    ["drafts", "Manage drafts"],
    ["copy", "Copy Markdown"],
    ["download", "Export README"],
    ["backup-all", "Download all drafts backup"],
    ["snippet-packs", "Snippet packs"],
    ["settings", "Settings"],
    ["activity", "Local activity"],
  ],
};
export const commands = Object.entries(commandGroups).flatMap(
  ([category, items]) =>
    items.map(([id, name]) => ({ id, name, category, kind: "command" })),
);
export function searchWorkspace(items, query, limit = 50) {
  const terms = String(query)
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return items
    .map((item, index) => ({
      item,
      index,
      text: `${item.name} ${item.category || ""} ${item.tags?.join(" ") || ""}`.toLocaleLowerCase(),
    }))
    .filter(({ text }) => terms.every((t) => text.includes(t)))
    .sort(
      (a, b) =>
        Number(b.item.name.toLocaleLowerCase().startsWith(terms.join(" "))) -
          Number(a.item.name.toLocaleLowerCase().startsWith(terms.join(" "))) ||
        a.index - b.index,
    )
    .slice(0, limit)
    .map(({ item }) => item);
}
export function activityEntry(action, time = Date.now()) {
  const command = commands.find((c) => c.id === action);
  return command ? { action: command.id, time } : null;
}
export function validateActivity(value) {
  return (Array.isArray(value) ? value : [])
    .filter(
      (e) =>
        e && commands.some((c) => c.id === e.action) && Number.isFinite(e.time),
    )
    .slice(-50)
    .map((e) => ({ action: e.action, time: e.time }));
}
