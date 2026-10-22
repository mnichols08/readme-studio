import { AuditError } from "../repository-audit/github.js";
import { githubRepository } from "../badges/providers/github.js";
import { manifests } from "../stack-intelligence/manifests.js";
import { isRelativeUrl } from "../markdown/resolve-urls.js";
import { sourceUrls } from "./health.js";
import { evidencePath, LINK_LIMIT } from "../workspace/evidence-snapshots.js";

// Recognised root Evidence files: the Stack Intelligence manifest registry
// plus common lockfiles. Only revisions are recorded; content is never read.
export const lockfiles = Object.freeze([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "Pipfile.lock",
  "go.sum",
]);
export const recognisedFiles = Object.freeze([
  ...manifests.map((m) => ({ path: m.path, kind: "manifest" })),
  ...lockfiles.map((path) => ({ path, kind: "lockfile" })),
]);
const SHA = /^(?:[a-f\d]{40}|[a-f\d]{64})$/;
const types = { blob: "file", tree: "directory", commit: "submodule" };

// Repository paths the document's own Source links to by relative URL,
// resolved against its README path. Read-only; the Source is not changed.
// Resolution is done segment by segment (not with URL against a synthetic
// origin) so a link that climbs above the repository root is reported, never
// clamped onto a root file. Links that cannot be decoded are reported too.
const OUTSIDE = Symbol("outside");
function resolveLink(raw, directory) {
  const segments = raw.startsWith("/") ? [] : [...directory];
  for (const encoded of raw.split("/")) {
    const part = decodeURIComponent(encoded);
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) throw OUTSIDE;
      segments.pop();
    } else segments.push(part);
  }
  return evidencePath(segments.join("/"));
}
export function linkedPaths(markdown, readmePath) {
  const directory = readmePath.split("/").slice(0, -1);
  const paths = [];
  let skipped = 0,
    outside = 0,
    undecodable = 0;
  for (const { value } of sourceUrls(markdown)) {
    if (!isRelativeUrl(value) || /[\x00-\x1f\x7f\\]/.test(value)) continue;
    // Query- or fragment-only links point at the README itself.
    const raw = value.trim().split(/[?#]/)[0];
    if (!raw) continue;
    let path;
    try {
      path = resolveLink(raw, directory);
    } catch (error) {
      if (error === OUTSIDE) outside++;
      else if (error instanceof URIError) undecodable++;
      continue;
    }
    if (path === readmePath || paths.includes(path)) continue;
    if (paths.length >= LINK_LIMIT) skipped++;
    else paths.push(path);
  }
  const notes = [];
  if (skipped)
    notes.push(
      `Only the first ${LINK_LIMIT} relative links were recorded; ${skipped} more were not.`,
    );
  if (outside)
    notes.push(
      `${outside} relative link(s) point above the repository root and were not recorded.`,
    );
  if (undecodable)
    notes.push(
      `${undecodable} relative link(s) could not be decoded (for example a literal "%") and were not recorded.`,
    );
  return { paths, notes };
}

// Reads the branch head and one recursive tree listing. Failure to read the
// head throws (nothing to record). A failed or truncated tree still yields a
// result whose unreadable entries are `failed`, meaning unknown.
export async function readEvidence({
  client,
  target,
  linked = [],
  notes = [],
  signal,
}) {
  const base = "/repos/" + githubRepository(target.repository);
  const { data: commits } = await client.request(
    `${base}/commits?sha=${encodeURIComponent(target.branch)}&per_page=1`,
    signal,
  );
  const head = Array.isArray(commits) ? commits[0] : null;
  if (!SHA.test(head?.sha) || !SHA.test(head?.commit?.tree?.sha))
    throw new AuditError(
      "response",
      "GitHub returned no readable branch head for this target.",
    );
  const result = { head: head.sha, tree: "complete", entries: [], notes };
  let listing = new Map();
  try {
    const { data } = await client.request(
      `${base}/git/trees/${head.commit.tree.sha}?recursive=1`,
      signal,
    );
    if (!Array.isArray(data?.tree))
      throw new AuditError("response", "Unreadable repository tree.");
    for (const item of data.tree)
      if (
        typeof item?.path === "string" &&
        types[item.type] &&
        SHA.test(item.sha)
      )
        listing.set(item.path, item);
    if (data.truncated === true) {
      result.tree = "truncated";
      result.notes = [
        ...result.notes,
        "GitHub truncated the repository tree; files not listed are unknown.",
      ];
    }
  } catch (error) {
    signal?.throwIfAborted();
    result.tree = "failed";
    result.notes = [
      ...result.notes,
      `Repository tree could not be read: ${String(error.message).slice(0, 200)}`,
    ];
    listing = new Map();
  }
  const record = (path, kind, optional = false) => {
    const item = listing.get(path);
    if (item)
      return result.entries.push({
        path,
        kind,
        status: "captured",
        type: types[item.type],
        sha: item.sha,
      });
    if (optional) return;
    if (result.tree === "complete")
      return result.entries.push({ path, kind, status: "missing" });
    result.entries.push({
      path,
      kind,
      status: "failed",
      note:
        result.tree === "truncated"
          ? "Not in the truncated tree listing."
          : "Repository tree unavailable.",
    });
  };
  record(target.path, "readme");
  for (const file of recognisedFiles)
    if (file.path !== target.path) record(file.path, file.kind, true);
  for (const path of linked)
    if (!result.entries.some((entry) => entry.path === path))
      record(path, "linked");
  signal?.throwIfAborted();
  return result;
}
