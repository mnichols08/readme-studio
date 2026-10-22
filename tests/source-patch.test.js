// Golden cases for source-preserving raw edits (#77, ADR epic63-01/02).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  changedRange,
  patchBlocks,
  moveBlock,
  readDetachments,
  isRestorable,
  detachmentNotice,
  DETACHMENT_LIMIT,
} from "../src/markdown/source-patch.js";
import { documentSegments } from "../src/markdown/source-context.js";
import {
  createBlock,
  serializeBlock,
  serializeBlocks,
} from "../src/markdown/serialize.js";
import { splitDraft } from "../src/state/import-plan.js";
import { newDraft, validateDraft } from "../src/state/drafts.js";
import { Store } from "../src/state/store.js";
import { generatedRegistry } from "../src/generated/registry.js";
import { createProject, inspectProject } from "../src/studio-projects/model.js";

const fixture = (name) =>
  readFileSync(`tests/fixtures/round-trip/${name}`, "utf8");
const FIXTURES = [
  "crlf.md",
  "mixed-eol.md",
  "bom.md",
  "no-final-newline.md",
  "trailing-whitespace.md",
  "fences.md",
  "html.md",
];
const custom = (markdown) =>
  newDraft("Doc", [createBlock("custom", { markdown })]);
const split = (markdown, levels = [1, 2]) => {
  const d = custom(markdown);
  return { ...d, blocks: splitDraft(d, levels) };
};
const apply = (source, { start, end, text }) =>
  source.slice(0, start) + text + source.slice(end);
const typed = () => {
  const blocks = [
    createBlock("hero", { name: "Ada", subtitle: "Builds things." }),
    createBlock("stack", { items: [{ name: "JavaScript" }], style: "text" }),
    {
      ...createBlock("component", {
        name: "Banner",
        markdown: '<p align="center">Banner</p>',
      }),
    },
    {
      ...createBlock("custom", { markdown: "## Repositories\n\n- demo" }),
      githubGenerated: {
        version: 1,
        repositories: ["example-user/demo"],
        options: { action: "summary" },
        generatedValue: "## Repositories\n\n- demo",
      },
    },
    createBlock("custom", { markdown: "Closing note." }),
  ];
  return newDraft("Typed", blocks);
};
const at = (draft, index) => documentSegments(draft)[index];

// Runs one golden case through Store.raw and checks the shared invariants:
// exact bytes, untouched Blocks deep-equal, and an exact Undo snapshot.
function golden(draft, edit, touchedIds = null) {
  const before = structuredClone(draft);
  const store = new Store(structuredClone(draft));
  const next = apply(before.markdown, edit);
  const result = store.raw(next);
  expect(store.draft.markdown).toBe(next);
  expect(serializeBlocks(store.draft.blocks)).toBe(next);
  if (next !== before.markdown) {
    expect(store.past.at(-1)).toEqual(before);
    expect(result.fallback).toBe(false);
  }
  const range = changedRange(before.markdown, next);
  const touched =
    touchedIds ||
    (range
      ? documentSegments(before)
          .map((s, i) => ({ s, b: before.blocks[i] }))
          .filter(
            ({ s }) =>
              (s.end > range.start && s.start < range.end) ||
              (range.start === range.end &&
                s.start <= range.start &&
                range.start <= s.end),
          )
          .map(({ b }) => b.id)
      : []);
  for (const block of before.blocks.filter((b) => !touched.includes(b.id))) {
    const kept = store.draft.blocks.find((b) => b.id === block.id);
    expect(kept, `untouched ${block.id} kept`).toBeTruthy();
    const { separator: _a, ...rest } = kept;
    const { separator: _b, ...orig } = block;
    expect(rest).toEqual(orig);
  }
  store.undo();
  expect({ ...store.draft, updated: 0 }).toEqual({ ...before, updated: 0 });
  return { store, result, next };
}

describe("changedRange", () => {
  it("returns null for equal text and the minimal range otherwise", () => {
    expect(changedRange("same", "same")).toBe(null);
    expect(changedRange("abc", "abXc")).toEqual({
      start: 2,
      end: 2,
      text: "X",
    });
    expect(changedRange("abc", "")).toEqual({ start: 0, end: 3, text: "" });
    expect(changedRange("", "new")).toEqual({ start: 0, end: 0, text: "new" });
  });
  it("never splits a CRLF pair or a surrogate pair", () => {
    expect(changedRange("a\r\nb", "a\rx\nb")).toEqual({
      start: 1,
      end: 3,
      text: "\rx\n",
    });
    expect(changedRange("a\r\nb", "a\rb")).toEqual({
      start: 1,
      end: 3,
      text: "\r",
    });
    expect(changedRange("a\nb", "a\r\nb")).toEqual({
      start: 1,
      end: 2,
      text: "\r\n",
    });
    const r = changedRange("x😀y", "x😁y");
    expect(r).toEqual({ start: 1, end: 3, text: "😁" });
  });
  it("satisfies the range identity for random edits", () => {
    const pieces = ["a", "\r\n", "\n", "😀", " ", "#"];
    let seed = 7;
    const rand = (n) => (((seed = (seed * 48271) % 2147483647) % n) + n) % n;
    for (let k = 0; k < 300; k++) {
      const make = () =>
        Array.from(
          { length: rand(12) },
          () => pieces[rand(pieces.length)],
        ).join("");
      const a = make(),
        b = make();
      const r = changedRange(a, b);
      if (a === b) expect(r).toBe(null);
      else {
        expect(a.slice(0, r.start) + r.text + a.slice(r.end), `seed ${k}`).toBe(
          b,
        );
        expect(a[r.start - 1] === "\r" && a[r.start] === "\n").toBe(false);
      }
    }
  });
});

describe("golden fixtures keep untouched Blocks byte for byte", () => {
  it.each(FIXTURES)("%s: offset 0, EOF and mid-section edits", (name) => {
    const source = fixture(name);
    for (const levels of [[1], [1, 2], [1, 2, 3]]) {
      const draft = split(source, levels);
      expect(draft.markdown).toBe(source);
      golden(draft, { start: 0, end: 0, text: "Lead " });
      golden(draft, {
        start: source.length,
        end: source.length,
        text: "\nTail",
      });
      const mid = Math.floor(source.length / 2);
      golden(draft, { start: mid, end: mid + 1, text: "Z" });
    }
  });
  it("keeps BOM, CRLF, tabs and hard breaks outside the Edited scope", () => {
    for (const name of FIXTURES) {
      const source = fixture(name),
        draft = split(source);
      const last = draft.blocks.length - 1;
      const seg = at(draft, last);
      const { next, store } = golden(draft, {
        start: seg.end - 1,
        end: seg.end - 1,
        text: "!",
      });
      expect(next.slice(0, seg.start)).toBe(source.slice(0, seg.start));
      expect(store.draft.blocks.length).toBe(draft.blocks.length);
    }
  });
  it("an edit inside a CRLF pair stays exact and touches one section", () => {
    const source = fixture("crlf.md"),
      draft = split(source);
    const k = source.indexOf("\r\n", source.indexOf("## Usage")) + 1;
    const { store } = golden(draft, { start: k, end: k, text: "x" });
    const after = store.draft;
    store.redo();
    expect(store.draft.markdown).toBe(
      source.slice(0, k) + "x" + source.slice(k),
    );
    expect(store.draft.blocks.map((b) => b.id)).toEqual(
      draft.blocks.map((b) => b.id),
    );
    expect(after).toBeTruthy();
  });
  it("a no-op raw edit records nothing", () => {
    const store = new Store(split(fixture("html.md")));
    expect(store.raw(store.draft.markdown)).toBeUndefined();
    expect(store.past).toHaveLength(0);
  });
  it("editing a split section keeps its ID, section and source context", () => {
    const draft = split(fixture("fences.md"));
    const seg = at(draft, 1);
    const { store, result } = golden(draft, {
      start: seg.contentStart + 2,
      end: seg.contentStart + 3,
      text: "q",
    });
    store.redo();
    expect(store.draft.blocks[1].id).toBe(draft.blocks[1].id);
    expect(store.draft.blocks[1].section).toEqual(draft.blocks[1].section);
    expect(result.detachments).toEqual([]);
  });
});

describe("Owned blocks and Detachment records", () => {
  it("typing between two builder blocks detaches nothing", () => {
    const draft = typed();
    const seam = at(draft, 1);
    const pos = seam.start + 1;
    const { result, store } = golden(draft, {
      start: pos,
      end: pos,
      text: "Hello",
    });
    expect(result.detachments).toEqual([]);
    store.redo();
    expect(store.draft.blocks).toHaveLength(draft.blocks.length + 1);
    expect(store.draft.blocks[1].type).toBe("custom");
    expect(store.draft.metadata.detachments).toBeUndefined();
    // Whitespace typed into a Seam changes only that Seam.
    const blank = golden(draft, { start: pos, end: pos, text: "\n" });
    expect(blank.result.blocks).toHaveLength(draft.blocks.length);
    expect(blank.result.blocks[1].separator).toBe("\n\n\n");
  });
  it("an edit inside one builder block makes a Restorable record", () => {
    const draft = typed();
    const seg = at(draft, 1);
    const k = seg.source.indexOf("JavaScript") + seg.start;
    const { result } = golden(draft, { start: k, end: k + 4, text: "Type" }, [
      draft.blocks[1].id,
    ]);
    const [record] = result.detachments;
    expect(record).toMatchObject({
      version: 1,
      previousBlockIds: [draft.blocks[1].id],
      labels: ["Tech Stack"],
      kinds: ["builder"],
      previous: draft.blocks[1],
    });
    expect(record.blockId).not.toBe(draft.blocks[1].id);
    expect(result.blocks[1].id).toBe(record.blockId);
    expect(result.blocks[1].type).toBe("custom");
    expect(isRestorable(record)).toBe(true);
    expect(Date.parse(record.at)).not.toBeNaN();
    expect(readDetachments(result.metadata)).toEqual([record]);
    expect(detachmentNotice(result)).toBe(
      "Raw edit detached: Tech Stack (builder). Undo restores visual ownership.",
    );
    expect(result.blocks.map(serializeBlock).join("")).not.toContain("version");
  });
  it("typing at the end of a builder block's text edits that block", () => {
    const draft = typed();
    const seg = at(draft, 1);
    const { result } = golden(
      draft,
      { start: seg.end, end: seg.end, text: ", Rust" },
      [draft.blocks[1].id],
    );
    expect(result.blocks).toHaveLength(draft.blocks.length);
    expect(result.detachments[0].previousBlockIds).toEqual([
      draft.blocks[1].id,
    ]);
    expect(serializeBlock(result.blocks[1])).toContain("JavaScript, Rust");
    // Typing at the start of the next block's text edits that block instead.
    const next = at(draft, 2);
    const start = golden(
      draft,
      { start: next.contentStart, end: next.contentStart, text: "X" },
      [draft.blocks[2].id],
    );
    expect(start.result.detachments[0].kinds).toEqual(["component"]);
  });
  it("an edit inside a component keeps the record Restorable", () => {
    const draft = typed();
    const seg = at(draft, 2);
    const { result } = golden(
      draft,
      { start: seg.contentStart + 3, end: seg.contentStart + 3, text: " " },
      [draft.blocks[2].id],
    );
    expect(result.detachments[0].kinds).toEqual(["component"]);
    expect(result.detachments[0].labels).toEqual(["Banner"]);
    expect(isRestorable(result.detachments[0])).toBe(true);
  });
  it("an edit spanning two Owned blocks merges them without being Restorable", () => {
    const draft = typed();
    const a = at(draft, 0),
      b = at(draft, 1);
    const { result } = golden(
      draft,
      { start: a.end - 3, end: b.contentStart + 4, text: "--" },
      [draft.blocks[0].id, draft.blocks[1].id],
    );
    expect(result.blocks).toHaveLength(draft.blocks.length - 1);
    const [record] = result.detachments;
    expect(record.previousBlockIds).toEqual([
      draft.blocks[0].id,
      draft.blocks[1].id,
    ]);
    expect(record.kinds).toEqual(["builder", "builder"]);
    expect(record.previous).toBe(null);
    expect(isRestorable(record)).toBe(false);
    expect(result.blocks[0].section).toBeUndefined();
  });
  it("detaches only the touched generated section", () => {
    const draft = typed();
    draft.blocks.push({
      ...createBlock("custom", { markdown: "## Other\n\n- tool" }),
      githubGenerated: {
        version: 1,
        repositories: ["example-user/tool"],
        options: { action: "summary" },
        generatedValue: "## Other\n\n- tool",
      },
    });
    draft.markdown = serializeBlocks(draft.blocks);
    const seg = at(draft, 3);
    const { result } = golden(
      draft,
      { start: seg.end - 1, end: seg.end, text: "x" },
      [draft.blocks[3].id],
    );
    expect(result.detachments[0].kinds).toEqual(["generated"]);
    expect(result.metadata.detachedGenerated.map((u) => u.id)).toEqual([
      `repository:${draft.blocks[3].id}`,
    ]);
    const units = generatedRegistry({ ...draft, ...result });
    expect(
      units.find((u) => u.id === `repository:${draft.blocks[5].id}`).ownership,
    ).toBe("generated");
    expect(isRestorable(result.detachments[0])).toBe(false);
  });
  it("drops bannerReference only when the banner block is touched", () => {
    const draft = typed();
    draft.metadata.bannerReference = {
      blockId: draft.blocks[4].id,
      source: "Closing note.",
    };
    const seg = at(draft, 1);
    const elsewhere = golden(draft, {
      start: seg.contentStart + 1,
      end: seg.contentStart + 2,
      text: "!",
    });
    expect(elsewhere.result.metadata.bannerReference).toEqual(
      draft.metadata.bannerReference,
    );
    const banner = at(draft, 4);
    const touched = golden(
      draft,
      { start: banner.end - 1, end: banner.end, text: "!" },
      [draft.blocks[4].id],
    );
    expect(touched.result.metadata.bannerReference).toBeUndefined();
    expect(touched.result.detachments[0].kinds).toEqual(["banner"]);
  });
  it("deleting a whole block leaves no empty block and no record", () => {
    const draft = typed();
    const seg = at(draft, 1);
    const { result } = golden(
      draft,
      { start: seg.start, end: seg.end, text: "" },
      [draft.blocks[1].id],
    );
    expect(result.blocks.map((b) => b.id)).toEqual(
      draft.blocks.filter((_, i) => i !== 1).map((b) => b.id),
    );
    expect(result.detachments).toEqual([]);
  });
  it("an empty document or emptied document makes no records", () => {
    const empty = newDraft("Empty");
    const first = golden(empty, { start: 0, end: 0, text: "Hello" });
    expect(first.result.blocks).toHaveLength(1);
    expect(first.result.detachments).toEqual([]);
    const draft = typed();
    const cleared = golden(
      draft,
      {
        start: 0,
        end: draft.markdown.length,
        text: "",
      },
      draft.blocks.map((b) => b.id),
    );
    expect(cleared.result.blocks).toEqual([]);
    expect(cleared.result.detachments).toEqual([]);
  });
  it("keeps the 20 newest records", () => {
    const draft = typed();
    draft.metadata.detachments = Array.from(
      { length: DETACHMENT_LIMIT },
      (_, i) => ({ version: 1, id: `old-${i}`, blockId: "gone" }),
    );
    const seg = at(draft, 0);
    const { result } = golden(draft, {
      start: seg.contentStart + 2,
      end: seg.contentStart + 3,
      text: "B",
    });
    expect(result.metadata.detachments).toHaveLength(DETACHMENT_LIMIT);
    expect(result.metadata.detachments[0].id).toBe("old-1");
    expect(result.metadata.detachments.at(-1)).toEqual(result.detachments[0]);
    // Malformed entries are ignored by readers but never rewritten.
    expect(readDetachments(result.metadata)).toEqual(result.detachments);
  });
  it("never blocks raw editing when a block cannot be serialized", () => {
    const draft = typed();
    draft.blocks[0] = createBlock("doc-overview", { version: 99 });
    const store = new Store(draft);
    const result = store.raw("Replaced");
    expect(result.fallback).toBe(true);
    expect(store.draft.markdown).toBe("Replaced");
    expect(serializeBlocks(store.draft.blocks)).toBe("Replaced");
  });
  it("falls back to one Custom Markdown block with a non-Restorable record", () => {
    const draft = typed();
    draft.markdown += "drift"; // blocks no longer reproduce the Source
    const result = patchBlocks(draft, draft.markdown + "!");
    expect(result.fallback).toBe(true);
    expect(serializeBlocks(result.blocks)).toBe(draft.markdown + "!");
    expect(result.blocks).toHaveLength(1);
    expect(result.detachments).toHaveLength(1);
    expect(isRestorable(result.detachments[0])).toBe(false);
    expect(detachmentNotice(result)).toBe(
      "All sections became Custom Markdown; Undo restores them.",
    );
    expect(
      detachmentNotice({ ...result, detachments: [], previousCount: 1 }),
    ).toBe("");
  });
});

describe("Seams belong to positions", () => {
  it("moving the last split section up never glues it to the next heading", () => {
    const source = fixture("no-final-newline.md");
    const draft = split(source);
    const last = draft.blocks.length - 1;
    const moved = moveBlock(draft.blocks, last, "up");
    expect(serializeBlocks(moved)).toBe(
      "## Last\n\nThe file ends without a line break.\n\n# No final newline\n\nIntro.\n\n",
    );
    const { separator: _s, ...first } = moved[1];
    const { separator: _t, ...original } = draft.blocks[0];
    expect(first).toEqual(original);
    // Moving it back keeps the position's blank-line Seam: still nothing glued.
    expect(serializeBlocks(moveBlock(moved, 0, "down"))).toBe(
      "# No final newline\n\nIntro.\n\n\n\n## Last\n\nThe file ends without a line break.",
    );
    // Before Epic 02 the swapped empty separators glued "break.# No final".
    expect(serializeBlocks(moved)).not.toContain("break.#");
  });
  it("keeps other Seams' bytes when moving and removing", () => {
    const draft = split(fixture("crlf.md"));
    const moved = moveBlock(draft.blocks, 1, "down");
    expect(moved.map((b) => b.separator)).toEqual(
      draft.blocks.map((b) => b.separator),
    );
    const removed = moveBlock(draft.blocks, 1, "remove");
    const seg = at(draft, 1);
    expect(serializeBlocks(removed)).toBe(
      draft.markdown.slice(0, seg.start) + draft.markdown.slice(seg.end),
    );
    const typedDraft = typed();
    expect(serializeBlocks(moveBlock(typedDraft.blocks, 0, "down"))).toBe(
      [1, 0, 2, 3, 4]
        .map((i) => serializeBlock(typedDraft.blocks[i]))
        .join("\n\n"),
    );
  });
});

describe("Detachment records travel with the document", () => {
  const detached = () => {
    const draft = typed();
    const seg = at(draft, 1);
    const store = new Store(draft);
    store.raw(
      apply(draft.markdown, {
        start: seg.contentStart + 3,
        end: seg.contentStart + 4,
        text: "!",
      }),
    );
    return store.draft;
  };
  it("remaps blockId when IDs are regenerated and drops orphaned records", () => {
    const d = detached();
    const record = d.metadata.detachments[0];
    d.metadata.detachments.push(
      { ...record, id: "orphan", blockId: "missing" },
      "malformed",
    );
    const copy = validateDraft(JSON.parse(JSON.stringify(d)));
    const index = d.blocks.findIndex((b) => b.id === record.blockId);
    expect(copy.metadata.detachments).toHaveLength(2);
    expect(copy.metadata.detachments[0].blockId).toBe(copy.blocks[index].id);
    expect(copy.metadata.detachments[0].blockId).not.toBe(record.blockId);
    expect(copy.metadata.detachments[1]).toBe("malformed");
    const kept = validateDraft(JSON.parse(JSON.stringify(d)), {
      preserveBlockIds: true,
    });
    expect(kept.metadata.detachments[0]).toEqual(record);
  });
  it("rides along in Studio projects and never appears in Markdown", () => {
    const d = detached();
    const project = createProject(d);
    expect(project.document.markdown).toBe(d.markdown);
    expect(project.document.markdown).not.toContain("previousBlockIds");
    const opened = inspectProject(JSON.stringify(project)).draft;
    expect(opened.metadata.detachments).toEqual(d.metadata.detachments);
  });
});

describe("seeded single-range edits", () => {
  it("stay exact, keep untouched Blocks and never fall back", () => {
    const pieces = ["x", " ", "\n", "\r\n", "## H\n", "😀", "<b>", ""];
    const layouts = [
      typed(),
      ...FIXTURES.map((name) => split(fixture(name), [1, 2, 3])),
    ];
    for (let seed = 1; seed <= 200; seed++) {
      let state = seed;
      const rand = (n) => {
        state = (state * 48271) % 2147483647;
        return state % n;
      };
      const draft = layouts[seed % layouts.length];
      const length = draft.markdown.length;
      let start = rand(length + 1),
        end = Math.min(length, start + rand(40));
      // Keep the requested range on whole CRLF and surrogate pairs.
      const pair = (i) =>
        (draft.markdown[i - 1] === "\r" && draft.markdown[i] === "\n") ||
        /[\udc00-\udfff]/.test(draft.markdown[i] || "");
      if (pair(start)) start--;
      if (pair(end)) end++;
      const text = Array.from(
        { length: rand(3) },
        () => pieces[rand(pieces.length)],
      ).join("");
      const touched = documentSegments(draft)
        .map((s, i) => ({ s, id: draft.blocks[i].id }))
        .filter(({ s }) => s.end >= start - 65 && s.start <= end + 1)
        .map(({ id }) => id);
      try {
        golden(draft, { start, end, text }, touched);
      } catch (error) {
        error.message = `seed ${seed}: ${error.message}`;
        throw error;
      }
    }
  });
});
