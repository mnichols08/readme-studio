import { sourceUrls } from "../github/health.js";
import { isRelativeUrl } from "../markdown/resolve-urls.js";
import { documentTarget } from "./documents.js";
import {
  evidencePath,
  resolveRelativePath,
  OUTSIDE_ROOT,
} from "./evidence-snapshots.js";
import { markdownAnchors } from "./drift-check.js";

export const DOCUMENT_LINK_LIMITS = Object.freeze({
  documents: 500,
  linksPerDocument: 200,
  issues: 1_000,
});

export function documentPath(draft) {
  const candidate =
    draft?.metadata?.documentationSuite?.path || documentTarget(draft)?.path;
  try {
    return candidate ? evidencePath(candidate) : null;
  } catch {
    return null;
  }
}

function decoded(value) {
  return decodeURIComponent(value);
}

function linkTarget(value, sourcePath) {
  const hash = value.indexOf("#");
  const beforeHash = hash < 0 ? value : value.slice(0, hash);
  const anchor = hash < 0 ? "" : decoded(value.slice(hash + 1));
  if (value.startsWith("#")) return { targetPath: sourcePath, anchor };
  if (!isRelativeUrl(value)) return null;
  const query = beforeHash.indexOf("?");
  const relativePath = query < 0 ? beforeHash : beforeHash.slice(0, query);
  const directory = sourcePath.split("/").slice(0, -1);
  return {
    targetPath: relativePath
      ? resolveRelativePath(relativePath, directory)
      : sourcePath,
    anchor,
  };
}

export function checkDocumentLinks(drafts, { sourceId = null } = {}) {
  const bounded = Array.isArray(drafts)
    ? drafts.slice(0, DOCUMENT_LINK_LIMITS.documents)
    : [];
  const indexed = new Map();
  for (const draft of bounded) {
    const path = documentPath(draft);
    if (!path) continue;
    if (!indexed.has(path)) indexed.set(path, []);
    indexed.get(path).push(draft);
  }
  const anchorCache = new Map();
  const issues = [];
  let checked = 0,
    truncatedLinks = 0,
    truncatedIssues = 0;
  const issue = (details) => {
    if (issues.length < DOCUMENT_LINK_LIMITS.issues) issues.push(details);
    else truncatedIssues++;
  };
  for (const draft of bounded) {
    if (sourceId && draft.id !== sourceId) continue;
    const sourcePath = documentPath(draft);
    if (!sourcePath) continue;
    const links = sourceUrls(draft.markdown).filter((item) => !item.image);
    truncatedLinks += Math.max(
      links.length - DOCUMENT_LINK_LIMITS.linksPerDocument,
      0,
    );
    for (const { value } of links.slice(
      0,
      DOCUMENT_LINK_LIMITS.linksPerDocument,
    )) {
      let target;
      try {
        target = linkTarget(value, sourcePath);
      } catch (error) {
        checked++;
        issue({
          sourceId: draft.id,
          sourcePath,
          value,
          targetPath: "",
          anchor: "",
          kind: error === OUTSIDE_ROOT ? "outside-workspace" : "invalid-link",
        });
        continue;
      }
      if (!target) continue;
      checked++;
      const matches = indexed.get(target.targetPath) || [];
      if (!matches.length) {
        issue({
          sourceId: draft.id,
          sourcePath,
          value,
          ...target,
          kind: "missing-document",
        });
        continue;
      }
      if (matches.length > 1) {
        issue({
          sourceId: draft.id,
          sourcePath,
          value,
          ...target,
          kind: "ambiguous-document",
        });
        continue;
      }
      if (target.anchor) {
        if (!anchorCache.has(matches[0].id))
          anchorCache.set(
            matches[0].id,
            new Set(markdownAnchors(matches[0].markdown)),
          );
        if (!anchorCache.get(matches[0].id).has(target.anchor))
          issue({
            sourceId: draft.id,
            sourcePath,
            value,
            ...target,
            kind: "missing-anchor",
          });
      }
    }
  }
  return {
    version: 1,
    checked,
    issues,
    indexedDocuments: [...indexed.values()].reduce(
      (count, matches) => count + matches.length,
      0,
    ),
    skippedDocuments: bounded.length - [...indexed.values()].flat().length,
    truncatedDocuments: Math.max(
      (Array.isArray(drafts) ? drafts.length : 0) - bounded.length,
      0,
    ),
    truncatedLinks,
    truncatedIssues,
  };
}
