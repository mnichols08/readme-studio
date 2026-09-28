import { describe, it, expect } from "vitest";
import { analyzeManifest } from "../src/stack-intelligence/manifests.js";
import { normalizeDependencies } from "../src/stack-intelligence/dependencies.js";
import { readmeSuggestions } from "../src/stack-intelligence/readme-suggestions.js";
import { createBlock, serializeBlocks } from "../src/markdown/serialize.js";
import "../src/components/stack-readme-review.js";

const record = (...sources) => {
  const manifests = sources.map(([path, source]) =>
    analyzeManifest(path, source),
  );
  return {
    repository: "example/app",
    status: "read",
    ref: "main",
    checkedAt: 0,
    manifests,
    dependencies: normalizeDependencies("example/app", manifests),
  };
};
const node = (data) => record(["package.json", JSON.stringify(data)]);

describe("reviewable stack documentation", () => {
  it("retains only safe allowlisted metadata, never script bodies or secrets", () => {
    const r = node({
      name: "@example/app",
      packageManager: "pnpm@10.0.0",
      scripts: {
        test: "echo secret; throw Error()",
        build: "evil()",
        postinstall: "secret",
      },
      description: "secret",
      token: "secret",
    });
    expect(r.manifests[0].readme).toEqual({
      packageName: "@example/app",
      packageManager: "pnpm",
      scripts: ["test", "build"],
    });
    expect(JSON.stringify(r)).not.toMatch(/secret|evil|postinstall/);
    const suggestions = readmeSuggestions(r);
    expect(
      suggestions.find((s) => s.id === "package.json:test").markdown,
    ).toContain("pnpm run test");
    expect(
      suggestions.find((s) => s.id === "package.json:link").markdown,
    ).toContain("%40example%2Fapp");
  });
  it("does not invent test/build scripts or publication for private packages", () => {
    const suggestions = readmeSuggestions(
      node({ private: true, name: "private", scripts: { test: 2, build: "" } }),
    );
    expect(suggestions.map((s) => s.id)).toEqual([
      "package.json:manager",
      "package.json:install",
    ]);
    expect(suggestions[0].evidence.join()).toContain("not detected");
  });
  it("bounds scoped package identifiers", () => {
    const r = node({ name: "@" + "x".repeat(220) + "/package" });
    expect(r.manifests[0].readme.packageName).toBeUndefined();
  });
  it("rejects injected package/manager identifiers", () => {
    const r = node({ name: "x)<script>", packageManager: "npm@1;evil()" });
    expect(r.manifests[0].readme).toEqual({ scripts: [] });
    expect(JSON.stringify(readmeSuggestions(r))).not.toContain("evil()");
  });
  it("offers deterministic known technology badges with evidence, not unknown packages", () => {
    const r = node({
      dependencies: { react: "19", mystery: "1" },
      devDependencies: { vitest: "4" },
    });
    const result = readmeSuggestions(r);
    expect(result.find((s) => s.id === "stack").markdown).toContain("React");
    expect(result.find((s) => s.id === "stack").markdown).not.toContain(
      "mystery",
    );
    expect(result.find((s) => s.id === "badge:react").markdown).toContain(
      "img.shields.io",
    );
    expect(result.every((s) => s.evidence.length && s.caveat)).toBe(true);
    expect(readmeSuggestions(r)).toEqual(result);
  });
  it("offers Rust conventions and declared crate links, suppressing private registries", () => {
    const r = record(["Cargo.toml", '[package]\nname="my-crate"\nversion="1"']);
    const result = readmeSuggestions(r);
    expect(
      result.find((s) => s.id === "Cargo.toml:install").markdown,
    ).toContain("cargo fetch");
    expect(result.find((s) => s.id === "Cargo.toml:link").markdown).toContain(
      "docs.rs/my-crate",
    );
    for (const publish of ["false", "[]", '["internal"]'])
      expect(
        readmeSuggestions(
          record([
            "Cargo.toml",
            `[package]\nname="private"\npublish=${publish}`,
          ]),
        ).some((s) => s.id.endsWith(":link")),
      ).toBe(false);
  });
  it("handles Python, requirements and Go without assuming build scripts", () => {
    const result = readmeSuggestions(
      record(
        [
          "pyproject.toml",
          '[project]\nname="sample"\ndependencies=["pytest>=8"]',
        ],
        ["requirements.txt", "requests>=2"],
        ["go.mod", "module example.com/app\ngo 1.23"],
      ),
    );
    const markdown = result.map((s) => s.markdown).join("\n");
    expect(markdown).toContain("python -m pip install .");
    expect(markdown).toContain("python -m pip install -r requirements.txt");
    expect(markdown).toContain("python -m pytest");
    expect(markdown).toContain("go test ./...");
    expect(markdown).toContain("go build ./...");
    expect(markdown).toContain("pypi.org/project/sample");
  });
  it("produces no suggestions for failed scans and does not mutate partial evidence", () => {
    expect(readmeSuggestions({ status: "failed" })).toEqual([]);
    const r = node({ dependencies: { react: "19" } });
    r.status = "partial";
    const before = JSON.stringify(r);
    expect(readmeSuggestions(r).length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("exact source review", () => {
  const setup = () => {
    const el = document.createElement("stack-readme-review");
    const blocks = [
      createBlock("custom", { markdown: "# Original\r\n\r\nExact source\n" }),
    ];
    const draft = {
      id: "draft",
      name: "Original",
      blocks,
      markdown: serializeBlocks(blocks),
      metadata: {},
    };
    el.configure(node({ scripts: { test: "test" } }), draft);
    return { el, draft };
  };
  it("starts unselected and requires exact approval after reviewing source", () => {
    const { el, draft } = setup();
    expect(el.selection()).toEqual([]);
    el.preview();
    expect(el.canApply()).toBe(false);
    el.querySelector('[data-choice="0"]').checked = true;
    el.preview();
    expect(el.canApply()).toBe(false);
    el.querySelector("[data-approve]").checked = true;
    expect(el.canApply()).toBe(true);
    expect(el.plan.markdown.startsWith(draft.markdown)).toBe(true);
    expect(el.plan.blocks[0]).toEqual(draft.blocks[0]);
    el.querySelector('[data-source="0"]').value += " changed";
    expect(el.canApply()).toBe(false);
    el.invalidate();
    expect(el.plan).toBeNull();
  });
  it("keeps edited suggestion HTML inert in the review UI", () => {
    const { el } = setup();
    el.querySelector('[data-choice="0"]').checked = true;
    el.querySelector('[data-source="0"]').value =
      "<script>globalThis.evil=true</script>";
    el.preview();
    expect(el.querySelector("script")).toBeNull();
    expect(el.plan.markdown).toContain("<script>");
    expect(globalThis.evil).toBeUndefined();
  });
  it("refuses stale builder/source synchronization instead of replacing source", () => {
    const { el } = setup();
    el.draft.markdown = "# Original";
    el.querySelector('[data-choice="0"]').checked = true;
    el.preview();
    expect(el.plan).toBeNull();
    expect(el.querySelector("[data-status]").textContent).toContain("differ");
  });
});
