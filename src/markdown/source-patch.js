// Source-preserving raw edits (ADR epic63-01 and epic63-02). A raw edit is
// reduced to its changed ranges (one per place that changed), each mapped onto
// the Blocks' source ranges, and only the Blocks inside that Edited scope are
// replaced. Untouched Blocks keep their
// ID, settings and ownership. Text is never parsed back into settings.
import { createBlock, serializeBlock, serializeBlocks } from "./serialize.js";
import {
  contextForBlock,
  contextKey,
  documentSegments,
  uniformContext,
} from "./source-context.js";
import { detachGenerated, generatedRegistry } from "../generated/registry.js";

export const DETACHMENT_LIMIT = 20;
export const RESTORABLE_BYTES = 32 * 1024;
export const OWNERSHIP_FIELDS = [
  "sharedComponent",
  "githubGenerated",
  "profileAutofill",
  "profileIdentity",
  "profileIntro",
  "profileLinks",
];
const PROFILE_FIELDS = OWNERSHIP_FIELDS.slice(2);
const high = (c) => c >= 0xd800 && c <= 0xdbff;
const low = (c) => c >= 0xdc00 && c <= 0xdfff;

// One changed range such that
// before.slice(0, start) + text + before.slice(end) === after, or null.
// The range never splits a "\r\n" pair or a UTF-16 surrogate pair.
export function changedRange(before, after) {
  if (before === after) return null;
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start))
    start++;
  let suffix = 0;
  while (
    suffix < max - start &&
    before.charCodeAt(before.length - 1 - suffix) ===
      after.charCodeAt(after.length - 1 - suffix)
  )
    suffix++;
  let end = before.length - suffix,
    afterEnd = after.length - suffix;
  for (let moved = true; moved;) {
    moved = false;
    if (
      start > 0 &&
      ((before[start - 1] === "\r" &&
        (before[start] === "\n" || after[start] === "\n")) ||
        high(before.charCodeAt(start - 1)))
    ) {
      start--;
      moved = true;
    }
    if (
      end < before.length &&
      ((before[end] === "\n" &&
        (before[end - 1] === "\r" || after[afterEnd - 1] === "\r")) ||
        low(before.charCodeAt(end)))
    ) {
      end++;
      afterEnd++;
      moved = true;
    }
  }
  return { start, end, text: after.slice(start, afterEnd) };
}

// The ownership kind that drives a Block, or null for a Custom Markdown block.
// Ordered so the strongest owner wins: only builder and component Blocks can
// ever be Restorable.
export function ownershipKind(block, metadata = {}, generatedIds = new Set()) {
  if (metadata?.bannerReference?.blockId === block.id) return "banner";
  if (PROFILE_FIELDS.some((k) => block[k])) return "profile";
  if (block.sharedComponent) return "shared";
  if (block.githubGenerated || generatedIds.has(block.id)) return "generated";
  if (block.type === "component") return "component";
  if (block.type !== "custom") return "builder";
  return null;
}
export const isOwnedBlock = (block, metadata, generatedIds) =>
  ownershipKind(block, metadata, generatedIds) !== null;

export function blockLabel(block) {
  const heading = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(safeSerialize(block))?.[1];
  const type = String(block.type).replace(/^doc-/, "").replace(/-/g, " ");
  const label =
    block.section?.title ||
    (block.type === "component" && block.settings?.name) ||
    heading?.replace(/\\(.)/g, "$1") ||
    block.settings?.title ||
    (block.type === "custom"
      ? "Custom Markdown"
      : type.charAt(0).toUpperCase() + type.slice(1));
  return String(label).slice(0, 80);
}
function safeSerialize(block) {
  try {
    return serializeBlock(block);
  } catch {
    return "";
  }
}

// Valid Detachment records only. Malformed entries are ignored, never rewritten.
export function readDetachments(metadata) {
  return Array.isArray(metadata?.detachments)
    ? metadata.detachments.filter(validDetachment)
    : [];
}
export const validDetachment = (r) =>
  !!r &&
  typeof r === "object" &&
  r.version === 1 &&
  typeof r.id === "string" &&
  typeof r.blockId === "string" &&
  Array.isArray(r.previousBlockIds) &&
  Array.isArray(r.labels) &&
  Array.isArray(r.kinds);
export const isRestorable = (r) =>
  validDetachment(r) &&
  !!r.previous &&
  typeof r.previous === "object" &&
  ["builder", "component"].includes(r.kinds[0]) &&
  r.previousBlockIds.length === 1;
export const detachmentFor = (metadata, blockId) =>
  readDetachments(metadata).findLast((r) => r.blockId === blockId) || null;

// labels and kinds are parallel to previousBlockIds. A record is Restorable
// only when the edit touched exactly one builder or component Block.
export function detachmentRecord(
  blockId,
  previous,
  kinds,
  now = new Date(),
  spanned = previous.length,
) {
  let copy = null;
  if (
    spanned === 1 &&
    previous.length === 1 &&
    ["builder", "component"].includes(kinds[0])
  ) {
    const json = JSON.stringify(previous[0]);
    if (json.length <= RESTORABLE_BYTES) copy = JSON.parse(json);
  }
  return {
    version: 1,
    id: crypto.randomUUID(),
    blockId,
    previousBlockIds: previous.map((b) => b.id),
    labels: previous.map(blockLabel),
    kinds,
    at: now.toISOString(),
    previous: copy,
  };
}
export function appendDetachments(metadata, records) {
  if (!records.length) return metadata;
  const existing = Array.isArray(metadata?.detachments)
    ? metadata.detachments
    : [];
  return {
    ...metadata,
    detachments: [...existing, ...records].slice(-DETACHMENT_LIMIT),
  };
}
function mergeGenerated(metadata, detached) {
  if (!detached.length) return metadata;
  const ids = new Set(detached.map((u) => u.id));
  const existing = Array.isArray(metadata.detachedGenerated)
    ? metadata.detachedGenerated.filter((u) => !ids.has(u?.id))
    : [];
  return {
    ...metadata,
    detachedGenerated: [...existing, ...detached].slice(-200),
  };
}
const stripOwnership = (block) => {
  for (const k of OWNERSHIP_FIELDS) delete block[k];
  return block;
};
function generatedBlockIds(draft) {
  try {
    return new Set(
      generatedRegistry(draft).flatMap((u) => [
        ...(u.blockId ? [u.blockId] : []),
        ...(Array.isArray(u.blockIds) ? u.blockIds : []),
      ]),
    );
  } catch {
    return new Set();
  }
}
function scopedGenerated(draft, ids) {
  try {
    return detachGenerated(draft, ids);
  } catch {
    /* Malformed optional ownership must never block manual source editing. */
    return [];
  }
}

// The pre-Epic 02 behaviour: the whole draft becomes one Custom Markdown block.
// Used only when the source-preserving patch cannot prove exactness.
export function wholeDraftPatch(draft, markdown, now = new Date()) {
  const metadata = { ...(draft.metadata || {}) },
    blocks = draft.blocks || [];
  const generated = scopedGenerated(draft);
  if (generated.length) metadata.detachedGenerated = generated;
  const generatedIds = generatedBlockIds(draft);
  const owned = blocks.filter((b) => isOwnedBlock(b, metadata, generatedIds));
  const current =
    blocks.length === 1 && blocks[0].type === "custom" ? blocks[0] : null;
  let sourceContext = metadata.importSource || null;
  try {
    sourceContext = uniformContext(draft);
  } catch {
    /* Unsupported block settings must never block manual source editing. */
  }
  const block = stripOwnership(
    current
      ? {
          ...current,
          settings: { markdown },
          sourceContext,
        }
      : {
          ...createBlock("custom", { markdown }),
          sourceContext,
        },
  );
  delete metadata.bannerReference;
  const detachments = owned.length
    ? [
        {
          ...detachmentRecord(
            block.id,
            owned,
            owned.map((b) => ownershipKind(b, draft.metadata, generatedIds)),
            now,
            blocks.length + 1,
          ),
        },
      ]
    : [];
  return {
    blocks: [block],
    metadata: appendDetachments(metadata, detachments),
    detachments,
    fallback: true,
    previousCount: blocks.length,
  };
}

const splitsPair = (s, i) =>
  (s[i - 1] === "\r" && s[i] === "\n") || low(s.charCodeAt(i));
// A deletion is ambiguous when the removed text repeats around it: removing a
// whole section "\n\n## B" just before "\n\n## C" also reads as removing
// "## B\n\n". Slide such a deletion left (at most 64 characters) onto a Block
// boundary so it removes that Block and its Seam instead of touching the next.
function alignDeletion(before, range, segments) {
  const { start, end, text } = range;
  if (text || start === end) return range;
  const starts = new Set(segments.map((s) => s.start));
  for (let s = start, e = end; s >= Math.max(0, start - 64); s--, e--) {
    if (starts.has(s) && !splitsPair(before, s) && !splitsPair(before, e))
      return { start: s, end: e, text: "" };
    if (s === 0 || before[s - 1] !== before[e - 1]) break;
  }
  return range;
}

// Replace only the Blocks a raw edit touched. Returns
// { blocks, metadata, detachments, fallback }. serializeBlocks(blocks) is
// always exactly `markdown`; anything else falls back to wholeDraftPatch.
export function patchBlocks(draft, markdown, now = new Date()) {
  try {
    const result =
      splitPatch(draft, markdown, now) || sourcePatch(draft, markdown, now);
    if (result && serializeBlocks(result.blocks) === markdown) return result;
  } catch {
    /* Fall through: raw editing is never blocked. */
  }
  return wholeDraftPatch(draft, markdown, now);
}

// The separate places a raw edit changed. One changed range is split around
// every Block whose text reappears unchanged inside the replacement, so edits
// in several places (drift fixes, reviewed refactors) never sweep up the
// untouched Blocks between them.
export function editRanges(before, after, segments) {
  const range = changedRange(before, after);
  return range ? splitRange(before, range, segments, 0) : [];
}
function subRange(before, start, end, text) {
  const m = changedRange(before.slice(start, end), text);
  return m && { start: start + m.start, end: start + m.end, text: m.text };
}
function splitRange(before, range, segments, depth) {
  const { start, end, text } = range;
  let best = null;
  for (const s of segments) {
    const content = before.slice(s.contentStart, s.end);
    if (s.contentStart < start || s.end > end || !content.trim()) continue;
    if (best && best.content.length >= content.length) continue;
    const expected = s.contentStart - start;
    let at = -1;
    for (
      let p = text.indexOf(content);
      p >= 0;
      p = text.indexOf(content, p + 1)
    )
      if (at < 0 || Math.abs(p - expected) < Math.abs(at - expected)) at = p;
    if (at >= 0) best = { s, content, at };
  }
  if (!best || depth > 64) return [range];
  const { s, content, at } = best;
  const left = subRange(before, start, s.contentStart, text.slice(0, at));
  const right = subRange(before, s.end, end, text.slice(at + content.length));
  return [
    ...(left ? splitRange(before, left, segments, depth + 1) : []),
    ...(right ? splitRange(before, right, segments, depth + 1) : []),
  ];
}
// Apply a multi-place edit one range at a time, right to left, so each step is
// an ordinary single-range patch. Null for a single range, or when any step
// cannot stay exact.
function splitPatch(draft, markdown, now) {
  const ranges = editRanges(draft.markdown, markdown, documentSegments(draft));
  if (ranges.length < 2) return null;
  let current = draft;
  const detachments = [];
  for (const r of ranges.reverse()) {
    const source = current.markdown;
    const target = source.slice(0, r.start) + r.text + source.slice(r.end);
    const step = sourcePatch(current, target, now);
    if (!step || serializeBlocks(step.blocks) !== target) return null;
    detachments.unshift(...step.detachments);
    current = {
      ...current,
      blocks: step.blocks,
      metadata: step.metadata,
      markdown: target,
    };
  }
  return {
    blocks: current.blocks,
    metadata: current.metadata,
    detachments,
    fallback: false,
  };
}

function sourcePatch(draft, markdown, now) {
  const before = draft.markdown,
    blocks = draft.blocks || [],
    metadata = draft.metadata || {};
  const segments = documentSegments(draft);
  if ((segments.at(-1)?.end ?? 0) !== before.length) return null;
  const range = changedRange(before, markdown);
  if (!range)
    return { blocks: [...blocks], metadata, detachments: [], fallback: false };
  const { start, end, text } = alignDeletion(before, range, segments);
  const generatedIds = generatedBlockIds(draft);
  const kindOf = (b) => ownershipKind(b, metadata, generatedIds);
  const isCustomMarkdown = (b) => b.type === "custom" && !kindOf(b);

  // An edit inside one Seam that leaves only whitespace changes that Seam alone.
  const seam = segments.findIndex(
    (s, k) => k > 0 && s.start <= start && end <= s.contentStart,
  );
  if (seam > 0) {
    const s = segments[seam],
      next = [...blocks];
    const left = before.slice(s.start, start),
      right = before.slice(end, s.contentStart);
    if (!(left + text + right).trim()) {
      next[seam] = { ...next[seam], separator: left + text + right };
      return { blocks: next, metadata, detachments: [], fallback: false };
    }
    if (s.start < start && end < s.contentStart) {
      // Text typed or pasted inside a Seam goes into an adjacent Custom Markdown
      // block, or a new one, and never detaches a neighbour.
      const prev = next[seam - 1],
        following = next[seam];
      if (isCustomMarkdown(prev)) {
        next[seam - 1] = {
          ...prev,
          settings: { markdown: serializeBlock(prev) + left + text },
        };
        next[seam] = { ...following, separator: right };
      } else if (isCustomMarkdown(following))
        next[seam] = {
          ...following,
          separator: left,
          settings: { markdown: text + right + serializeBlock(following) },
        };
      else {
        next[seam] = { ...following, separator: right };
        next.splice(seam, 0, {
          ...createBlock("custom", { markdown: text }),
          separator: left,
          sourceContext: contextForBlock(prev, metadata),
        });
      }
      return { blocks: next, metadata, detachments: [], fallback: false };
    }
  }
  // Pure insertion at the start or end of the document.
  if (start === end && (start === 0 || start === before.length)) {
    const next = [...blocks];
    if (!next.length) {
      next.push({
        ...createBlock("custom", { markdown: text }),
        sourceContext: metadata.importSource || null,
      });
    } else if (start === 0 && isCustomMarkdown(next[0])) {
      next[0] = {
        ...next[0],
        settings: { markdown: text + serializeBlock(next[0]) },
      };
    } else if (start === 0) {
      // The old first Block's Seam was ignored at position 0 and stays empty.
      next[0] = { ...next[0], separator: "" };
      next.unshift({
        ...createBlock("custom", { markdown: text }),
        separator: "",
        sourceContext: contextForBlock(blocks[0], metadata),
      });
    } else {
      const last = next.at(-1);
      if (isCustomMarkdown(last))
        next[next.length - 1] = {
          ...last,
          settings: { markdown: serializeBlock(last) + text },
        };
      else
        next.push({
          ...createBlock("custom", { markdown: text }),
          separator: "",
          sourceContext: contextForBlock(last, metadata),
        });
    }
    return { blocks: next, metadata, detachments: [], fallback: false };
  }

  // The run of touched Blocks i..j becomes one Custom Markdown block.
  let i = segments.findIndex((s) => s.end > start || s.end === before.length);
  if (start === end) {
    // Typing right at the end of a Block's text, or right at the start of the
    // next Block's text, edits that Block. Where the Seam is empty, prefer a
    // neighbouring Custom Markdown block, then the line the cursor is on.
    const k = segments.findIndex(
      (s, n) => n > 0 && (start === s.start || start === s.contentStart),
    );
    if (k > 0) {
      const s = segments[k],
        prev = blocks[k - 1];
      if (s.start < s.contentStart) i = start === s.start ? k - 1 : k;
      else if (isCustomMarkdown(prev)) i = k - 1;
      else if (isCustomMarkdown(blocks[k])) i = k;
      else i = serializeBlock(prev).endsWith("\n") ? k : k - 1;
    }
  }
  if (i < 0) return null;
  let j = i;
  while (j + 1 < segments.length && segments[j + 1].start < end) j++;
  const ctx = { draft, markdown, segments, kindOf, now };
  // An edit that ends inside the next Block's Seam leaves that Block's text,
  // and so its ownership, alone. An edit that starts right after a Block's
  // text and stays inside the following Seam continues that Block's last line.
  return (
    (j > i &&
      end <= segments[j].contentStart &&
      replaceRun(ctx, start, i, j - 1, true)) ||
    (i > 0 &&
      i === j &&
      start < end &&
      start === segments[i].start &&
      end <= segments[i].contentStart &&
      replaceRun(ctx, start, i - 1, i - 1, true)) ||
    replaceRun(ctx, start, i, j, false)
  );
}

// Replace Blocks i..last with one Block. With `kept`, the edit reached only
// the Seam of Block last + 1: that Block keeps its text and ownership, and its
// Seam becomes the whitespace before its text. Returns null when that cannot
// reproduce `markdown` exactly.
function replaceRun(ctx, start, i, last, kept) {
  const { draft, markdown, segments, kindOf, now } = ctx;
  const blocks = draft.blocks,
    metadata = draft.metadata || {};
  const delta = markdown.length - draft.markdown.length;
  const run = blocks.slice(i, last + 1);
  const keepSeam = start >= segments[i].contentStart;
  const from = keepSeam ? segments[i].contentStart : segments[i].start;
  let slice, seamAfter;
  if (kept) {
    const at = segments[last + 1].contentStart + delta;
    // The kept Block's text must still start on its own line.
    if (at > 0 && markdown[at - 1] !== "\n") return null;
    const region = markdown.slice(from, at);
    seamAfter = /[ \t\r\n]*$/.exec(region)[0];
    slice = region.slice(0, region.length - seamAfter.length);
    // The first Block has no Seam, so leading whitespace stays in its text.
    if (i === 0 && !slice) [slice, seamAfter] = [seamAfter, ""];
  } else slice = markdown.slice(from, segments[last].end + delta);
  const owned = run.filter(kindOf);
  const touched = new Set(run.map((b) => b.id));
  const contexts = run.map((b) => contextForBlock(b, metadata));
  const sourceContext = contexts.every(
    (c) => contextKey(c) === contextKey(contexts[0]),
  )
    ? contexts[0] || null
    : { type: "mixed" };
  let next;
  if (!owned.length)
    // Custom Markdown keeps its ID: nothing visual can overwrite it.
    next = {
      ...run[0],
      settings: { markdown: slice },
      ...(run.length > 1 ? { sourceContext } : {}),
    };
  else
    // A new ID, so a form left open on an old ID can no longer overwrite it.
    next = {
      ...createBlock("custom", { markdown: slice }),
      ...(run.length === 1 && run[0].section
        ? { section: structuredClone(run[0].section) }
        : {}),
      sourceContext,
    };
  if (keepSeam) {
    if (run[0].separator !== undefined) next.separator = run[0].separator;
    else delete next.separator;
  } else next.separator = "";
  // A deletion that removed whole Blocks and their Seams leaves no empty Block.
  const drop =
    slice === "" && (i > 0 ? !keepSeam : kept || last === blocks.length - 1);
  const result = [
    ...blocks.slice(0, i),
    ...(drop ? [] : [next]),
    ...(kept ? [{ ...blocks[last + 1], separator: seamAfter }] : []),
    ...blocks.slice(last + (kept ? 2 : 1)),
  ];
  if (kept && serializeBlocks(result) !== markdown) return null;
  let nextMetadata = mergeGenerated(
    { ...metadata },
    scopedGenerated(draft, touched),
  );
  if (touched.has(metadata.bannerReference?.blockId)) {
    nextMetadata = { ...nextMetadata };
    delete nextMetadata.bannerReference;
  }
  const detachments =
    owned.length && !drop
      ? [detachmentRecord(next.id, owned, owned.map(kindOf), now, run.length)]
      : [];
  return {
    blocks: result,
    metadata: appendDetachments(nextMetadata, detachments),
    detachments,
    fallback: false,
  };
}

// The polite notice for a raw edit, or "" when nothing was detached.
export function detachmentNotice(result) {
  if (!result) return "";
  if (
    result.fallback &&
    (result.detachments.length || result.previousCount > 1)
  )
    return "All sections became Custom Markdown; Undo restores them.";
  const parts = detachedSummary(result);
  return parts
    ? `Raw edit detached: ${parts}. Undo restores visual ownership.`
    : "";
}
// "Tech Stack (builder), Banner (component)" for a patch result's records.
export const detachedSummary = (result) =>
  (result?.detachments || [])
    .flatMap((r) => r.labels.map((label, i) => `${label} (${r.kinds[i]})`))
    .join(", ");

// Seams belong to positions. Move a Block up or down, or remove it, keeping
// every other Seam's bytes; a Seam next to the change becomes a blank line only
// where text would otherwise run together.
export function moveBlock(blocks, index, action) {
  const next = structuredClone(blocks);
  if (index < 0 || index >= next.length) return next;
  const seam = (b, sep) => {
    if (sep === undefined) delete b.separator;
    else b.separator = sep;
  };
  let edges = [];
  if (action === "remove") {
    next.splice(index, 1);
    edges = [index];
  } else {
    const other = index + (action === "up" ? -1 : 1);
    if (other < 0 || other >= next.length) return next;
    const a = Math.min(index, other),
      b = Math.max(index, other);
    const seps = [next[a].separator, next[b].separator];
    [next[a], next[b]] = [next[b], next[a]];
    seam(next[a], seps[0]);
    seam(next[b], seps[1]);
    edges = [a, b, b + 1];
  }
  for (const k of edges) {
    if (k < 1 || k >= next.length) continue;
    const sep = next[k].separator ?? "\n\n";
    if (!sep.includes("\n") && !safeSerialize(next[k - 1]).endsWith("\n"))
      next[k].separator = "\n\n";
  }
  return next;
}
