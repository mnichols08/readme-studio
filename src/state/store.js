import { createBlock, serializeBlocks } from "../markdown/serialize.js";
export class Store extends EventTarget {
  constructor(draft) {
    super();
    this.draft = draft;
    this.past = [];
    this.future = [];
  }
  checkpoint() {
    this.past.push(structuredClone(this.draft));
    if (this.past.length > 80) this.past.shift();
    this.future = [];
  }
  emit(source) {
    this.draft.updated = Date.now();
    this.dispatchEvent(new CustomEvent("change", { detail: source }));
  }
  raw(markdown) {
    if (markdown === this.draft.markdown) return;
    this.checkpoint();
    const current =
      this.draft.blocks.length === 1 && this.draft.blocks[0].type === "custom"
        ? this.draft.blocks[0]
        : null;
    this.draft.markdown = markdown;
    this.draft.blocks = [
      current
        ? { ...current, settings: { markdown } }
        : createBlock("custom", { markdown }),
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
    this.emit("history");
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(structuredClone(this.draft));
    this.draft = this.future.pop();
    this.emit("history");
  }
}
