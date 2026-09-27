import {
  plain,
  normalizeComponent,
  componentSource,
} from "../components-library/model.js";
import { validateComponents } from "../components-library/storage.js";
import {
  validateCollection,
  validateCollections,
  collectionMarkdown,
} from "../badges/collections.js";
import { safeUrl } from "../markdown/url-safety.js";
import { serializeBlock } from "../markdown/serialize.js";
export const PACK_LIMIT = 10_000_000;
export function validatePack(raw) {
  if (typeof raw === "string" && raw.length > PACK_LIMIT)
    throw Error("Snippet packs are limited to 10 MB.");
  let v;
  try {
    v = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw Error("Could not read snippet pack JSON.");
  }
  if (typeof raw === "string" && raw.length > PACK_LIMIT)
    throw Error("Snippet packs are limited to 10 MB.");
  if (!v || v.version !== 1 || v.type !== "readme-studio-snippet-pack")
    throw Error("Expected a version-1 README Studio snippet pack.");
  const name = plain(v.name, 120).trim();
  if (!name) throw Error("Name the snippet pack.");
  if (
    !Array.isArray(v.snippets) ||
    v.snippets.length > 500 ||
    !Array.isArray(v.badgeCollections ?? []) ||
    (v.badgeCollections || []).length > 500
  )
    throw Error("Packs support up to 500 snippets and 500 badge collections.");
  const homepage = safeUrl(v.homepage || "");
  if (v.homepage && (!homepage || !/^https?:\/\//.test(homepage)))
    throw Error("Pack homepage needs an HTTP(S) URL.");
  return {
    version: 1,
    type: "readme-studio-snippet-pack",
    name,
    description: plain(v.description ?? "", 2000),
    author: plain(v.author ?? "", 120),
    homepage,
    license: plain(v.license ?? "", 300),
    snippets: v.snippets.map(normalizeComponent),
    badgeCollections: (v.badgeCollections || []).map((c) => {
      plain(c.name, 120);
      return validateCollection(c, { preserveId: true });
    }),
  };
}
export function exportPack(metadata, snippets = [], badgeCollections = []) {
  return validatePack({
    ...metadata,
    version: 1,
    type: "readme-studio-snippet-pack",
    snippets,
    badgeCollections,
  });
}
export function packChoices(data, draft) {
  const library = validateComponents(data.componentLibrary);
  return [
    ...library.snippets.map((c) => ({
      key: `snippet:${c.id}`,
      name: c.name,
      kind: c.kind,
      component: c,
    })),
    ...validateCollections(data.badgeCollections).items.map((c) => ({
      key: `badge:${c.id}`,
      name: c.name,
      kind: "badge collection",
      collection: c,
    })),
    ...(draft?.blocks || []).map((b, i) => ({
      key: `block:${b.id}`,
      name: `Draft section ${i + 1}: ${b.settings.name || b.settings.title || b.type}`,
      kind:
        b.type === "projects"
          ? "project snippet"
          : b.type === "widget" || b.type === "picture"
            ? "widget"
            : "layout/snippet",
      component: normalizeComponent({
        version: 1,
        id: crypto.randomUUID(),
        name: `Draft section ${i + 1} (${b.type})`,
        category:
          b.type === "projects"
            ? "Projects"
            : b.type === "widget"
              ? "Widgets"
              : "Layout",
        description:
          "Copied from a draft; relative assets may need repository context.",
        kind: "custom",
        template: serializeBlock(b),
        fields: [],
        tags: [b.type],
      }),
    })),
  ];
}
export const choiceMarkdown = (choice) =>
  choice.collection
    ? collectionMarkdown(choice.collection)
    : componentSource(choice.component);
const matches = (items, item) =>
  items.filter(
    (v) => v.id === item.id || v.name.toLowerCase() === item.name.toLowerCase(),
  );
export function packCollisions(data, pack) {
  const library = validateComponents(data.componentLibrary),
    collections = validateCollections(data.badgeCollections);
  return [
    ...pack.snippets.map((v) => ({
      name: v.name,
      kind: "snippet",
      matches: matches(library.snippets, v).map((x) => x.name),
    })),
    ...pack.badgeCollections.map((v) => ({
      name: v.name,
      kind: "badge collection",
      matches: matches(collections.items, v).map((x) => x.name),
    })),
  ].filter((v) => v.matches.length);
}
function mergeItems(items, incoming, mode) {
  const next = structuredClone(items);
  for (const raw of incoming) {
    const item = structuredClone(raw),
      conflicts = matches(next, item);
    if (conflicts.length && mode === "skip") continue;
    if (conflicts.length && mode === "replace") {
      if (conflicts.length > 1)
        throw Error(
          `“${item.name}” matches different IDs/names. Choose Keep both or Skip to avoid ambiguous replacement.`,
        );
      const at = next.findIndex((v) => v.id === conflicts[0].id);
      item.id = conflicts[0].id;
      next[at] = item;
    } else {
      if (conflicts.length || item.id.startsWith("builtin:"))
        item.id = crypto.randomUUID();
      const base = item.name;
      let n = 2;
      while (next.some((v) => v.name.toLowerCase() === item.name.toLowerCase()))
        item.name = `${base.slice(0, 108)} (${n++})`;
      next.push(item);
    }
  }
  return next;
}
export function importPack(data, input, mode = "keep") {
  if (!["keep", "replace", "skip"].includes(mode))
    throw Error("Choose Keep both, Replace or Skip.");
  const pack = validatePack(input),
    library = validateComponents(data.componentLibrary),
    collections = validateCollections(data.badgeCollections);
  return {
    componentLibrary: validateComponents({
      ...library,
      snippets: mergeItems(library.snippets, pack.snippets, mode),
    }),
    badgeCollections: validateCollections({
      version: 1,
      items: mergeItems(collections.items, pack.badgeCollections, mode),
    }),
  };
}
