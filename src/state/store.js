import { createBlock, serializeBlocks } from "../markdown/serialize.js";
import { uniformContext } from "../markdown/source-context.js";
export const HISTORY_LIMIT = 80;
export const HISTORY_BYTES = 8_000_000;
export class Store extends EventTarget {
  constructor(draft) {
    super();
    this.draft = draft;
    this.past = [];
    this.future = [];
    this.historySizes = new WeakMap();
  }
  checkpoint() {
    this.past.push(structuredClone(this.draft));
    this.future = [];
    this.trimHistory();
  }
  historySize(draft) {
    if (!this.historySizes.has(draft))
      this.historySizes.set(draft, JSON.stringify(draft).length * 2);
    return this.historySizes.get(draft);
  }
  trimHistory() {
    let bytes = 0;
    for (let i = this.past.length - 1; i >= 0; i--) {
      bytes += this.historySize(this.past[i]);
      if (bytes > HISTORY_BYTES || this.past.length - i > HISTORY_LIMIT) {
        this.past.splice(0, i + 1);
        break;
      }
    }
    for (let i = this.future.length - 1; i >= 0; i--) {
      bytes += this.historySize(this.future[i]);
      if (bytes > HISTORY_BYTES || this.future.length - i > HISTORY_LIMIT) {
        this.future.splice(0, i + 1);
        break;
      }
    }
  }
  emit(source) {
    this.draft.updated = Date.now();
    this.dispatchEvent(new CustomEvent("change", { detail: source }));
  }
  raw(markdown) {
    if (markdown === this.draft.markdown) return;
    this.checkpoint();
    const sourceContext = uniformContext(this.draft);
    const current =
      this.draft.blocks.length === 1 && this.draft.blocks[0].type === "custom"
        ? this.draft.blocks[0]
        : null;
    this.draft.markdown = markdown;
    this.draft.blocks = [
      current
        ? { ...current, settings: { markdown }, sourceContext }
        : { ...createBlock("custom", { markdown }), sourceContext },
    ];
    this.emit("raw");
  }
  blocks(blocks, metadata = this.draft.metadata) {
    this.checkpoint();
    this.draft.blocks = blocks;
    this.draft.metadata = metadata;
    this.draft.markdown = serializeBlocks(blocks);
    this.emit("blocks");
  }
  undo() {
    if (!this.past.length) return;
    this.future.push(structuredClone(this.draft));
    this.draft = this.past.pop();
    this.trimHistory();
    this.emit("history");
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(structuredClone(this.draft));
    this.draft = this.future.pop();
    this.trimHistory();
    this.emit("history");
  }
}
