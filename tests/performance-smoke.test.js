import { it, expect } from "vitest";
import { analyzeDocument } from "../src/analysis/analyze.js";
import { publishDiff } from "../src/publishing/diff.js";
import { searchWorkspace } from "../src/workspace/commands.js";
import { createProject, inspectProject } from "../src/studio-projects/model.js";
import { newDraft } from "../src/state/drafts.js";
import { createBlock } from "../src/markdown/serialize.js";
it.each([100, 250, 500, 1024])(
  "%s KB source completes analysis, diff and portable round-trip",
  (kb) => {
    const source =
      "# Large\n\n" +
      "Ordinary paragraph with a [relative link](./guide.md).\n\n".repeat(
        Math.ceil((kb * 1024) / 55),
      );
    expect(analyzeDocument(source).stats).toBeTruthy();
    expect(publishDiff(source, source + "\nEnd").text).toContain("+End");
    const d = newDraft("Large", [createBlock("custom", { markdown: source })]);
    expect(inspectProject(JSON.stringify(createProject(d))).source).toBe(
      source,
    );
  },
  30000,
);
it("bounds search results across large reusable libraries", () => {
  expect(
    searchWorkspace(
      Array.from({ length: 2000 }, (_, i) => ({
        id: i,
        name: "Reusable " + i,
        category: "Components",
      })),
      "reusable",
    ),
  ).toHaveLength(50);
});
