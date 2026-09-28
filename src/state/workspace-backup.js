import {
  validateComponents,
  mergeComponents,
  recoverComponents,
} from "../components-library/storage.js";
import {
  validateVisualLibrary,
  mergeVisualLibraries,
  recoverVisualLibrary,
} from "../themes/visual-library.js";
import {
  validateCollections,
  recoverCollections,
} from "../badges/collections.js";
import { validateDraft } from "./drafts.js";
import { validateActivity } from "../workspace/commands.js";
export const BACKUP_LIMIT = 50_000_000;
export const workspaceSettings = (s = {}) => ({
  pane: ["build", "markdown", "preview", "health"].includes(s?.pane)
    ? s.pane
    : "build",
  collapsed: s?.collapsed === true,
  editorFont: ["13", "15", "18"].includes(String(s?.editorFont))
    ? String(s.editorFont)
    : "13",
  reduceMotion: s?.reduceMotion === true,
  closedGroups: Array.isArray(s?.closedGroups)
    ? [
        ...new Set(
          s.closedGroups.filter((g) =>
            ["Create", "Design", "Review", "GitHub", "Save"].includes(g),
          ),
        ),
      ]
    : [],
  theme: s?.theme === "dark" ? "dark" : "light",
  preview: ["1012", "760", "640", "375"].includes(String(s?.preview))
    ? String(s.preview)
    : "1012",
  ...(["dark", "light"].includes(s?.previewTheme)
    ? { previewTheme: s.previewTheme }
    : {}),
});
export function uniqueName(name, existing) {
  const names = new Set(existing.map((d) => d.name));
  const base = name.trim() || "Untitled";
  let result = base,
    i = 2;
  while (names.has(result)) result = `${base} (${i++})`;
  return result;
}
export function validateWorkspace(data, { preserveIds = false } = {}) {
  if (!data || data.version !== 1)
    throw new Error(
      "Unsupported workspace backup version. Use the original app version to export its drafts.",
    );
  if (
    !Array.isArray(data.drafts) ||
    !data.drafts.length ||
    data.drafts.length > 500
  )
    throw new Error("Workspace backup must contain between 1 and 500 drafts.");
  const ids = new Set(),
    drafts = [];
  let active;
  for (const original of data.drafts) {
    const d = validateDraft(original, { preserveBlockIds: preserveIds });
    d.name = uniqueName(d.name, drafts);
    if (
      preserveIds &&
      typeof original.id === "string" &&
      original.id &&
      !ids.has(original.id)
    )
      d.id = original.id;
    ids.add(d.id);
    drafts.push(d);
    if (!active && original.id === data.active) active = d.id;
  }
  return {
    version: 1,
    drafts,
    active: active || drafts[0].id,
    settings: workspaceSettings(data.settings),
    activity: validateActivity(data.activity),
    badgeCollections: validateCollections(data.badgeCollections),
    visualLibrary: validateVisualLibrary(data.visualLibrary),
    componentLibrary: validateComponents(data.componentLibrary),
    ...(typeof data.createdAt === "string"
      ? { createdAt: data.createdAt }
      : {}),
  };
}
export function createBackup(data) {
  return { ...data, version: 1, createdAt: new Date().toISOString() };
}
export function restoreWorkspace(current, backup, mode) {
  const incoming = validateWorkspace(backup);
  if (mode === "replace") return incoming;
  if (mode !== "merge") throw new Error("Choose replace or merge.");
  const drafts = structuredClone(current.drafts);
  for (const d of incoming.drafts) {
    d.name = uniqueName(d.name, drafts);
    drafts.push(d);
  }
  if (drafts.length > 500)
    throw new Error(
      "Merged workspace exceeds the 500 draft limit. Export smaller backups first.",
    );
  return {
    ...current,
    drafts,
    componentLibrary: mergeComponents(
      current.componentLibrary,
      incoming.componentLibrary,
    ),
    visualLibrary: mergeVisualLibraries(
      current.visualLibrary,
      incoming.visualLibrary,
    ),
    badgeCollections: validateCollections({
      version: 1,
      items: [
        ...(current.badgeCollections?.items || []),
        ...incoming.badgeCollections.items,
      ],
    }),
  };
}
export function recoverWorkspace(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.drafts)) return null;
    const drafts = [];
    for (const d of data.drafts) {
      try {
        drafts.push(
          validateDraft({
            ...d,
            name: typeof d?.name === "string" ? d.name : "Recovered draft",
          }),
        );
      } catch {
        /* Keep unreadable originals in the recovery download. */
      }
    }
    return drafts.length
      ? validateWorkspace({
          ...data,
          drafts,
          badgeCollections: recoverCollections(data.badgeCollections),
          visualLibrary: recoverVisualLibrary(data.visualLibrary),
          componentLibrary: recoverComponents(data.componentLibrary),
        })
      : null;
  } catch {
    return null;
  }
}
