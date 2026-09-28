import { bannerFiles, bannerMarkup } from "../banners/export.js";
import { normalizeBanner } from "../banners/banner-model.js";
import { serializeBlocks } from "../markdown/serialize.js";
import { assetPath } from "./asset-path.js";
export const MAX_ASSET_BYTES = 250_000;
export function generatedAssets(settings, directory = "assets/readme") {
  const banner = normalizeBanner(settings);
  return bannerFiles(banner).map((file) => {
    const path = assetPath(`${directory}/${file.name}`),
      bytes = new TextEncoder().encode(file.source).length;
    if (bytes > MAX_ASSET_BYTES)
      throw new Error(
        "Generated SVG exceeds the 250 KB asset limit. Download and review it separately.",
      );
    return {
      kind: "asset",
      path,
      content: file.source,
      banner,
      bytes,
      warning: bytes > 100_000 ? "Large SVG: more than 100 KB." : "",
    };
  });
}
export function validateGeneratedAsset(input) {
  assetPath(input.path);
  const directory = input.path.slice(0, input.path.lastIndexOf("/"));
  const expected = generatedAssets(input.banner, directory).find(
    (f) => f.path === input.path,
  );
  if (!expected || expected.content !== input.content)
    throw new Error(
      "Only exact Studio-generated SVG banner content may be published as an asset.",
    );
  return expected;
}
export function rewriteOwnedBanner(draft, directory, readmePath = "README.md") {
  const reference = draft.metadata?.bannerReference;
  if (!reference || serializeBlocks(draft.blocks) !== draft.markdown)
    return { source: draft.markdown, rewritten: false };
  const blocks = structuredClone(draft.blocks),
    block = blocks.find((b) => b.id === reference.blockId);
  if (
    !block ||
    block.type !== "custom" ||
    block.settings.markdown !== reference.source
  )
    return { source: draft.markdown, rewritten: false };
  // Paths are relative to the README, not necessarily to repository root.
  const readmeFolders = readmePath.split("/").slice(0, -1),
    assetFolders = directory.split("/");
  let common = 0;
  while (
    readmeFolders[common] &&
    readmeFolders[common] === assetFolders[common]
  )
    common++;
  const relative =
    "../".repeat(readmeFolders.length - common) +
    assetFolders.slice(common).join("/");
  const markup = bannerMarkup({
    ...draft.metadata.bannerSettings,
    assetDirectory: directory,
  });
  block.settings.markdown = markup.replaceAll(
    `="${directory}/`,
    `="${relative ? relative + "/" : ""}`,
  );
  return { source: serializeBlocks(blocks), rewritten: true };
}
export async function prepareAssetPlan(files, target, read) {
  const rows = [];
  for (const file of files) {
    const baseline = await read({ ...target, kind: "asset", path: file.path });
    rows.push({
      ...file,
      baseline,
      status:
        baseline.sha === null
          ? "new"
          : baseline.content === file.content
            ? "unchanged"
            : "changed",
    });
  }
  return rows;
}
export async function executeAssetPlan(rows, target, message, request) {
  const results = [];
  // Preflight all paths before writing any asset. Server SHA checks remain authoritative.
  for (const row of rows) {
    const current = await request("read", {
      ...target,
      kind: "asset",
      path: row.path,
    });
    if (current.sha !== row.baseline.sha)
      throw new Error(
        `Asset conflict: ${row.path} changed. Reload the entire plan before publishing.`,
      );
  }
  for (const row of rows) {
    if (row.status === "unchanged") {
      results.push({ path: row.path, status: "unchanged" });
      continue;
    }
    try {
      const result = await request("commit", {
        ...target,
        kind: "asset",
        path: row.path,
        sha: row.baseline.sha,
        content: row.content,
        banner: row.banner,
        message,
        confirmed: true,
      });
      results.push({
        path: row.path,
        status: "published",
        commitSha: result.commitSha,
      });
    } catch (e) {
      results.push({ path: row.path, status: "failed", error: e.message });
      for (const remaining of rows.slice(results.length))
        results.push({ path: remaining.path, status: "not attempted" });
      return { complete: false, results };
    }
  }
  return { complete: true, results };
}
