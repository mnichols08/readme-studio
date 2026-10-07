import { describe, it, expect } from "vitest";
import {
  createBatch,
  validateBatch,
  decideBatch,
  nextBatchIndex,
  recoverBatch,
} from "../src/workspace/batch-review.js";
import {
  createBackup,
  validateWorkspace,
  restoreWorkspace,
} from "../src/state/workspace-backup.js";
import { newDraft } from "../src/state/drafts.js";
import "../src/components/batch-review.js";
const repos = Array.from({ length: 12 }, (_, i) => ({
  full_name: `example/repo-${i}`,
  default_branch: "main",
}));
describe("batch review progression", () => {
  it("preserves queue order, deduplicates and progresses only after explicit decisions", () => {
    const batch = createBatch([...repos, repos[0]]);
    expect(batch.items).toHaveLength(12);
    expect(nextBatchIndex(batch)).toBe(0);
    const next = decideBatch(batch, 0, "reviewed");
    expect(batch.items[0].state).toBe("pending");
    expect(nextBatchIndex(next)).toBe(1);
    expect(nextBatchIndex(decideBatch(next, 1, "skipped"))).toBe(2);
    expect(nextBatchIndex(decideBatch(next, 0, "pending"))).toBe(0);
    const done = {
      ...batch,
      items: batch.items.map((item) => ({ ...item, state: "reviewed" })),
    };
    expect(nextBatchIndex(done)).toBe(-1);
  });
  it("rejects malformed targets, unknown versions, invalid decisions and oversized batches", () => {
    expect(() => createBatch([])).toThrow();
    expect(() =>
      createBatch([{ full_name: "<script>", default_branch: "main" }]),
    ).toThrow();
    expect(() =>
      validateBatch({ ...createBatch(repos), version: 2 }),
    ).toThrow();
    expect(() => decideBatch(createBatch(repos), 50, "reviewed")).toThrow();
    expect(() =>
      createBatch(
        Array.from({ length: 201 }, (_, i) => ({
          full_name: `example/r${i}`,
          default_branch: "main",
        })),
      ),
    ).toThrow();
    expect(recoverBatch({ version: 99 })).toBeNull();
  });
  it("backs up progress and preserves the current session during merge restore", () => {
    const draft = newDraft("local");
    const workspace = {
      drafts: [draft],
      active: draft.id,
      settings: {},
      reviewBatch: decideBatch(createBatch(repos), 0, "reviewed"),
    };
    const backup = validateWorkspace(createBackup(workspace));
    expect(backup.reviewBatch).toEqual(workspace.reviewBatch);
    expect(
      restoreWorkspace(workspace, { ...backup, reviewBatch: null }, "merge")
        .reviewBatch,
    ).toEqual(workspace.reviewBatch);
    expect(
      restoreWorkspace(workspace, { ...backup, reviewBatch: null }, "replace")
        .reviewBatch,
    ).toBeNull();
  });
  it("renders local review status without any publishing action and requires batch selection", () => {
    const el = document.createElement("batch-review");
    el.configure({ drafts: [], reviewBatch: createBatch(repos) });
    expect(el.querySelectorAll("[data-include]:checked")).toHaveLength(0);
    expect(el.textContent).toContain("12 READMEs pending");
    expect(
      [...el.querySelectorAll("button")].some((button) =>
        /publish/i.test(button.textContent),
      ),
    ).toBe(false);
  });
});
