import { createBlock, serializeBlocks } from "../markdown/serialize.js";
export const STORAGE_KEY = "readme-studio:v1";
export const newDraft = (name, blocks = []) => ({
  id: crypto.randomUUID(),
  name,
  blocks,
  markdown: serializeBlocks(blocks),
  metadata: {},
  updated: Date.now(),
});
export function validateDraft(d) {
  if (!d || typeof d.markdown !== "string" || typeof d.name !== "string")
    throw new Error("Invalid draft file. Expected a README Studio draft.");
  const copy = newDraft(d.name, [
    createBlock("custom", { markdown: d.markdown }),
  ]);
  if (
    Array.isArray(d.blocks) &&
    d.blocks.every(
      (b) =>
        b &&
        typeof b.type === "string" &&
        b.settings &&
        typeof b.settings === "object",
    )
  ) {
    try {
      if (serializeBlocks(d.blocks) === d.markdown)
        copy.blocks = d.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }));
    } catch {
      /* Preserve raw Markdown if blocks are incompatible. */
    }
  }
  copy.markdown = d.markdown;
  copy.metadata =
    d.metadata && typeof d.metadata === "object" ? d.metadata : {};
  return copy;
}
export function readDrafts(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.drafts) || !data.drafts.length)
    throw new Error(
      "Saved drafts could not be read. Export your current work before resetting browser storage.",
    );
  const drafts = data.drafts.map((d) => ({ ...validateDraft(d), id: d.id }));
  return {
    ...data,
    drafts,
    active: drafts.some((d) => d.id === data.active)
      ? data.active
      : drafts[0].id,
  };
}
export function saveDrafts(data, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: 1 }));
}
