import { it, expect } from "vitest";
import {
  exportPack,
  validatePack,
  importPack,
  packCollisions,
  packChoices,
} from "../src/snippets/pack-schema.js";
import { examplePacks } from "../src/snippets/example-packs.js";
import { emptyComponents } from "../src/components-library/storage.js";
import { starterCollection } from "../src/badges/collections.js";
const snippet = (name = "Mine", id = "mine") => ({
  version: 1,
  id,
  name,
  category: "Utilities",
  description: "Exact source",
  kind: "custom",
  fields: [],
  tags: [],
  template: "\ufeff# Raw\r\n<script>alert(1)</script>\n{{x}}",
});
const current = () => ({
  componentLibrary: { ...emptyComponents(), snippets: [snippet()] },
  badgeCollections: { version: 1, items: [] },
});
it("round trips valid pack metadata, exact raw source and badge collections", () => {
  const pack = exportPack(
    {
      name: "Kit",
      description: "Useful",
      author: "Ada",
      homepage: "https://example.com",
      license: "MIT",
    },
    [snippet()],
    [starterCollection("Frontend")],
  );
  expect(validatePack(JSON.stringify(pack))).toEqual(pack);
  expect(pack.snippets[0].template).toBe(snippet().template);
});
it.each([
  {
    version: 2,
    type: "readme-studio-snippet-pack",
    name: "Future",
    snippets: [],
  },
  { version: 1, type: "wrong", name: "Wrong", snippets: [] },
  {
    version: 1,
    type: "readme-studio-snippet-pack",
    name: "<img onerror=evil>",
    snippets: [],
  },
  {
    version: 1,
    type: "readme-studio-snippet-pack",
    name: "Bad URL",
    homepage: "javascript:evil",
    snippets: [],
  },
  { version: 1, type: "readme-studio-snippet-pack", name: "Missing" },
  {
    version: 1,
    type: "readme-studio-snippet-pack",
    name: "Unknown type",
    snippets: [{ ...snippet(), kind: "script" }],
  },
])("rejects malformed/future packs and malicious metadata", (raw) =>
  expect(() => validatePack(raw)).toThrow(),
);
it("default Keep both changes colliding IDs and deterministic names", () => {
  const result = importPack(
    current(),
    exportPack({ name: "Kit" }, [snippet()]),
  );
  expect(result.componentLibrary.snippets.map((c) => c.name)).toEqual([
    "Mine",
    "Mine (2)",
  ]);
  expect(result.componentLibrary.snippets[1].id).not.toBe("mine");
});
it("Replace preserves matched identity and Skip keeps existing values", () => {
  const pack = exportPack({ name: "Kit" }, [
    { ...snippet(), template: "updated" },
  ]);
  expect(
    importPack(current(), pack, "replace").componentLibrary.snippets[0]
      .template,
  ).toBe("updated");
  expect(
    importPack(current(), pack, "replace").componentLibrary.snippets[0].id,
  ).toBe("mine");
  expect(importPack(current(), pack, "skip").componentLibrary.snippets).toEqual(
    current().componentLibrary.snippets.map(
      (c) => validatePack(exportPack({ name: "Kit" }, [c])).snippets[0],
    ),
  );
});
it("handles name collisions case-insensitively and rejects ambiguous replacement", () => {
  const data = current();
  data.componentLibrary.snippets.push(snippet("Second", "second"));
  const pack = exportPack({ name: "Kit" }, [snippet("SECOND", "mine")]);
  expect(packCollisions(data, pack)[0].matches).toHaveLength(2);
  expect(() => importPack(data, pack, "replace")).toThrow(
    "different IDs/names",
  );
  expect(importPack(data, pack, "keep").componentLibrary.snippets).toHaveLength(
    3,
  );
});
it("resolves collisions within a pack and never overwrites built-ins", () => {
  const pack = exportPack({ name: "Kit" }, [
    snippet("A", "builtin:example"),
    snippet("A", "builtin:example"),
  ]);
  const result = importPack({}, pack);
  expect(result.componentLibrary.snippets.map((c) => c.name)).toEqual([
    "A",
    "A (2)",
  ]);
  expect(
    result.componentLibrary.snippets.every((c) => !c.id.startsWith("builtin:")),
  ).toBe(true);
});
it("example packs are editable definitions and current project source can be exported", () => {
  expect(examplePacks).toHaveLength(4);
  for (const pack of examplePacks)
    expect(validatePack(pack).snippets.length).toBeGreaterThan(0);
  const choices = packChoices(
    {},
    {
      blocks: [
        { id: "raw", type: "custom", settings: { markdown: "EXACT\r\n" } },
      ],
    },
  );
  expect(choices[0].component.template).toBe("EXACT\r\n");
});
it("badge collection collisions follow Keep both, Replace and Skip", () => {
  const c = starterCollection("Frontend"),
    data = { badgeCollections: { version: 1, items: [c] } },
    p = exportPack({ name: "Badges" }, [], [c]);
  expect(importPack(data, p).badgeCollections.items).toHaveLength(2);
  expect(importPack(data, p, "replace").badgeCollections.items).toHaveLength(1);
  expect(importPack(data, p, "skip").badgeCollections.items).toHaveLength(1);
});
