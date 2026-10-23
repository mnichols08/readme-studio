import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBlock, serializeBlocks } from "../src/markdown/serialize.js";
import { newDraft } from "../src/state/drafts.js";
import {
  createBackup,
  validateWorkspace,
} from "../src/state/workspace-backup.js";
import { createProject, inspectProject } from "../src/studio-projects/model.js";

const root = join(process.cwd(), "tests", "fixtures", "round-trip");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixture = (name) => readFileSync(join(root, name));
function normalizedBackup(backup) {
  const copy = structuredClone(backup);
  delete copy.appVersion;
  delete copy.createdAt;
  copy.drafts.forEach((draft) => delete draft.updated);
  const ids = new Map();
  copy.drafts.forEach((draft, draftIndex) => {
    ids.set(draft.id, `draft:${draftIndex}`);
    draft.blocks.forEach((block, blockIndex) =>
      ids.set(block.id, `block:${draftIndex}:${blockIndex}`),
    );
  });
  const visit = (value) => {
    if (typeof value === "string") return ids.get(value) || value;
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item)]),
    );
  };
  return visit(copy);
}

describe("round-trip gate", () => {
  it("pins every fixture byte-for-byte and rejects unlisted Markdown", () => {
    expect(manifest.version).toBe(1);
    const listed = manifest.fixtures.map((entry) => entry.name).sort();
    const present = readdirSync(root)
      .filter((name) => name.endsWith(".md"))
      .sort();
    expect(listed).toEqual(present);
    for (const entry of manifest.fixtures) {
      expect(entry.kind).toBe("markdown");
      expect(entry.covers).toEqual(expect.any(String));
      expect(sha256(fixture(entry.name)), entry.name).toBe(entry.sha256);
    }
  });

  it.each(manifest.fixtures)(
    "$name survives Markdown, project, and workspace round trips",
    ({ name }) => {
      const source = fixture(name).toString("utf8");
      const draft = newDraft("Round trip", [
        createBlock("custom", { markdown: source }),
      ]);
      expect(serializeBlocks(draft.blocks)).toBe(source);

      const savedAt = "2026-10-22T00:00:00.000Z";
      const project = createProject(draft, {}, undefined, savedAt);
      const opened = inspectProject(JSON.stringify(project));
      expect(opened.mode).toBe("project");
      expect(opened.draft.markdown).toBe(source);
      expect(
        createProject(opened.draft, opened.settings, undefined, savedAt),
      ).toEqual(project);

      const seed = createBackup({
        version: 1,
        drafts: [draft],
        active: draft.id,
        settings: { pane: "preview", theme: "dark", editorFont: "15" },
      });
      const restored = validateWorkspace(seed);
      expect(restored.drafts[0].markdown).toBe(source);
      expect(serializeBlocks(restored.drafts[0].blocks)).toBe(source);
      const first = createBackup(restored);
      const reopened = validateWorkspace(first);
      const second = createBackup(reopened);
      expect(normalizedBackup(second)).toEqual(normalizedBackup(first));
      expect(normalizedBackup(second)).toMatchObject({
        version: 1,
        active: "draft:0",
        settings: { pane: "preview", theme: "dark", editorFont: "15" },
        drafts: [
          {
            id: "draft:0",
            markdown: source,
            blocks: [{ id: "block:0:0" }],
          },
        ],
      });
    },
  );
});
