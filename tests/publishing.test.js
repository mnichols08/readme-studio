import { describe, it, expect } from "vitest";
import { target, writeInput } from "../src/publishing/validation.js";
import { publishDiff } from "../src/publishing/diff.js";
const t = { repository: "octocat/octocat", branch: "main", path: "README.md" };
describe("publishing boundaries", () => {
  it("requires exact confirmed target, source, SHA and message", () => {
    expect(
      writeInput({
        ...t,
        sha: null,
        content: "🧑‍💻\r\n",
        message: "My update",
        confirmed: true,
      }).content,
    ).toBe("🧑‍💻\r\n");
    for (const changed of [
      { confirmed: false },
      { sha: "not-sha" },
      { message: "" },
      { content: "x".repeat(750001) },
    ])
      expect(() =>
        writeInput({
          ...t,
          sha: null,
          content: "text",
          message: "update",
          confirmed: true,
          ...changed,
        }),
      ).toThrow();
  });
  it("rejects traversal, special branches, credentials and non-README paths", () => {
    for (const path of [
      "../README.md",
      "/README.md",
      ".env",
      ".github/workflows/test.yml",
      "a/../../README.md",
      "a\\README.md",
      "a/%2e%2e/README.md",
    ])
      expect(() => target({ ...t, path })).toThrow();
    for (const branch of [
      "../main",
      "a..b",
      "refs/@{x}",
      "- bad",
      "a.lock",
      "a//b",
    ])
      expect(() => target({ ...t, branch })).toThrow();
    expect(() =>
      target({ ...t, repository: "https://user:token@github.com/x/y" }),
    ).toThrow();
  });
  it("preserves exact source and handles a large linear-size diff", () => {
    const before = "# Hi\r\n" + "a\n".repeat(125000),
      after = before + "🦀";
    const result = publishDiff(before, after);
    expect(result.text).toContain("+🦀");
    expect(result.added).toBe(1);
    expect(publishDiff(before, before).text).toBe("No source changes.");
  });
});
