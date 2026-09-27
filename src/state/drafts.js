import { createBlock, serializeBlocks } from "../markdown/serialize.js";
import { validateWorkspace, recoverWorkspace } from "./workspace-backup.js";
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
  if (raw === null) return null;
  try {
    return validateWorkspace(JSON.parse(raw), { preserveIds: true });
  } catch (cause) {
    const error = new Error(
      "Saved workspace could not be read. The original storage is untouched. Download recovery data or restore a backup.",
    );
    error.raw = raw;
    error.recovered = recoverWorkspace(raw);
    error.cause = cause;
    throw error;
  }
}
export function saveDrafts(data, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: 1 }));
}
