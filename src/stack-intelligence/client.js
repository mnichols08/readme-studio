import { normalizeDependencies } from "./dependencies.js";
import { auditClient, AuditError } from "../repository-audit/github.js";
import { githubRepository } from "../badges/providers/github.js";
import { manifests, analyzeManifest, MANIFEST_LIMIT } from "./manifests.js";
import {
  DISCOVERY_LIMITS,
  discoverManifests,
  displayPath,
  encodePath,
  workspaceFiles,
  workspacePatterns,
} from "./discovery.js";
import { readTree } from "../github/evidence.js";
export const NESTED_LIMIT_MESSAGE = (count) =>
  `Nested manifests can be included for at most ${DISCOVERY_LIMITS.repositories} repositories per run; ${count} are selected. Select fewer repositories or turn off Include nested manifests. Nothing was read.`;
const DECLARATION_NOTICE =
  "Only the first 200 dependency declarations per repository are retained.";
// Root-only manifest notes that are no longer true with Nested discovery:
// members are mapped from the tree; local path dependencies still are not.
const nestedNotes = {
  "Workspace members are not followed; only root declarations were read.": [],
  "Workspace members and local path dependencies are not followed.": [
    "Local path dependencies are not followed.",
  ],
};
export class StackClient {
  constructor({ client = auditClient, now = () => Date.now() } = {}) {
    this.client = client;
    this.now = now;
    this.cache = new Map();
    this.bytes = 0;
  }
  clear() {
    this.cache.clear();
    this.bytes = 0;
  }
  async repository(repo, { signal, force = false, nested = false } = {}) {
    signal?.throwIfAborted();
    nested = nested === true;
    const name = githubRepository(repo.full_name).toLowerCase();
    const branch = repo.default_branch || "HEAD";
    const key = JSON.stringify([name, branch, nested]);
    const cached = this.cache.get(key);
    if (!force && cached && this.now() - cached.at < 300000)
      return {
        ...cached.value,
        repository: repo.full_name,
        language: repo.language || "",
      };
    if (cached) {
      this.bytes -= cached.size;
      this.cache.delete(key);
    }
    const ref = "?ref=" + encodeURIComponent(branch);
    const base = "/repos/" + name + "/contents/";
    const result = {
      version: 4,
      language: repo.language || "",
      repository: repo.full_name,
      ref: branch,
      checkedAt: this.now(),
      manifests: [],
      projects: [],
      issues: [],
      status: "read",
    };
    const discovery = {
      nested,
      tree: "not-read",
      found: 0,
      read: 0,
      skipped: [],
    };
    // Reads one regular file through the contents API with the existing
    // checks. `path` is a validated repository path; each segment is encoded.
    const readFile = async (path) => {
      const { data } = await this.client.request(
        base + encodePath(path) + ref,
        signal,
      );
      if (
        data?.type !== "file" ||
        data.path !== path ||
        data.target ||
        data.submodule_git_url ||
        data.encoding !== "base64" ||
        !Number.isSafeInteger(data.size) ||
        data.size < 0 ||
        data.size > MANIFEST_LIMIT ||
        typeof data.content !== "string" ||
        data.content.length > MANIFEST_LIMIT * 2
      )
        throw Error("Not a bounded regular manifest file.");
      const bytes = Uint8Array.from(
        atob(data.content.replace(/\s/g, "")),
        (c) => c.charCodeAt(0),
      );
      if (bytes.length !== data.size || bytes.length > MANIFEST_LIMIT)
        throw Error("Incomplete manifest content.");
      return {
        source: new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes),
        sha: typeof data.sha === "string" ? data.sha : "",
      };
    };
    const failed = (path, error) => {
      if (signal?.aborted) throw signal.reason;
      const message = String(error.message).slice(0, 1000);
      result.issues.push(displayPath(path) + ": " + message);
      return message;
    };
    const stop = (error) => {
      if (["rate-limit", "forbidden"].includes(error.kind))
        result.stopped = error.message;
    };
    const rootSources = {};
    const analyze = async ({ path, file, project }) => {
      signal?.throwIfAborted();
      try {
        const { source, sha } = await readFile(path);
        if (!project) rootSources[file] = source;
        const analysis = analyzeManifest(file, source);
        if (nested)
          analysis.notes = analysis.notes.flatMap((note) =>
            Object.hasOwn(nestedNotes, note) ? nestedNotes[note] : [note],
          );
        const remaining = Math.max(
          0,
          200 - result.manifests.reduce((n, m) => n + m.entries.length, 0),
        );
        if (analysis.entries.length > remaining) {
          analysis.entries = analysis.entries.slice(0, remaining);
          if (!result.issues.includes(DECLARATION_NOTICE))
            result.issues.push(DECLARATION_NOTICE);
        }
        result.manifests.push({ ...analysis, path, file, project, sha });
      } catch (error) {
        const message = failed(path, error);
        discovery.skipped.push({
          path: displayPath(path),
          reason: message.slice(0, 300),
        });
        stop(error);
      }
    };
    const notRegular = (path) => {
      result.issues.push(
        path + ": not a regular file within the 256 KB limit.",
      );
      discovery.skipped.push({
        path,
        reason: "not a regular file within the 256 KB limit",
      });
    };
    // Nested discovery replaces the root contents listing with one tree
    // listing; a failed tree falls back to the root-only listing.
    let tree = null;
    if (nested) {
      tree = await readTree({
        client: this.client,
        target: { repository: repo.full_name, branch },
        signal,
      });
      result.headSha = tree.head;
      discovery.tree = tree.tree;
      if (tree.tree === "truncated")
        result.issues.push(
          "GitHub truncated the repository tree; nested manifests not listed are unknown.",
        );
      if (tree.tree === "failed") {
        result.issues.push(
          ...tree.notes,
          "Nested manifests could not be listed; only root manifests were read.",
        );
        tree = null;
      }
    }
    const roots = [];
    if (tree) {
      for (const descriptor of manifests) {
        const listed = tree.listing.get(descriptor.path);
        if (!listed) continue;
        if (
          listed.type !== "blob" ||
          listed.mode === "120000" ||
          !Number.isSafeInteger(listed.size) ||
          listed.size > MANIFEST_LIMIT
        )
          notRegular(descriptor.path);
        else roots.push(descriptor.path);
      }
    } else {
      const { data: listing } = await this.client.request(base + ref, signal);
      if (!Array.isArray(listing) || listing.length > 1000)
        throw new AuditError("response", "Unreadable root manifest listing.");
      if (listing.length === 1000)
        result.issues.push(
          "Root listing may be truncated; absence of other manifests is uncertain.",
        );
      for (const descriptor of manifests) {
        const listed = listing.find((entry) => entry.path === descriptor.path);
        if (!listed) continue;
        if (
          listed.type !== "file" ||
          listed.submodule_git_url ||
          listed.size > MANIFEST_LIMIT
        )
          notRegular(descriptor.path);
        else roots.push(descriptor.path);
      }
    }
    discovery.found = roots.length + discovery.skipped.length;
    for (const path of roots) {
      if (result.stopped) {
        discovery.skipped.push({ path, reason: "not read; the scan stopped" });
        continue;
      }
      await analyze({ path, file: path, project: "" });
    }
    const boundaries = [];
    if (tree && !result.stopped) {
      // Workspace declaration files are read only here and never analyzed
      // as Manifests; they count toward the per-repository request budget.
      for (const file of workspaceFiles) {
        const listed = tree.listing.get(file);
        if (!listed || result.stopped) continue;
        if (
          listed.type !== "blob" ||
          listed.mode === "120000" ||
          !Number.isSafeInteger(listed.size) ||
          listed.size > MANIFEST_LIMIT
        ) {
          result.issues.push(
            file + ": not a regular file within the 256 KB limit.",
          );
          continue;
        }
        try {
          rootSources[file] = (await readFile(file)).source;
        } catch (error) {
          failed(file, error);
          stop(error);
        }
      }
      const declared = workspacePatterns(rootSources);
      const found = discoverManifests(tree.listing, declared.patterns, {
        complete: tree.tree === "complete",
      });
      result.issues.push(...declared.notices, ...found.notices);
      discovery.found += found.found;
      discovery.skipped.push(...found.skipped);
      boundaries.push(...found.boundaries);
      for (const item of found.toRead) {
        if (result.stopped) {
          discovery.skipped.push({
            path: item.path,
            reason: "not read; the scan stopped",
          });
          continue;
        }
        await analyze(item);
      }
    }
    discovery.read = result.manifests.length;
    result.discovery = discovery;
    const rootManifests = result.manifests
      .filter((m) => !m.project)
      .map((m) => m.path);
    result.projects = [
      ...(rootManifests.length
        ? [{ path: "", role: "root", declaredBy: [], manifests: rootManifests }]
        : []),
      ...boundaries,
    ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    result.dependencies = normalizeDependencies(
      repo.full_name,
      result.manifests,
    );
    result.status = result.issues.length
      ? "partial"
      : result.manifests.length
        ? "read"
        : "none";
    if (!result.issues.length) {
      const size = JSON.stringify(result).length * 2;
      this.cache.set(key, { at: this.now(), value: result, size });
      this.bytes += size;
      while (this.cache.size > 128 || this.bytes > 2_000_000) {
        const first = this.cache.keys().next().value;
        this.bytes -= this.cache.get(first).size;
        this.cache.delete(first);
      }
    }
    return result;
  }
}
export async function scanStacks(
  repositories,
  { client, signal, onResult = () => {}, force = false, nested = false } = {},
) {
  const repos = [
    ...new Map(
      repositories.map((repo) => [repo.full_name.toLowerCase(), repo]),
    ).values(),
  ].slice(0, 1000);
  // Nested discovery is refused, never truncated, above its Discovery limit.
  if (nested && repos.length > DISCOVERY_LIMITS.repositories)
    throw new AuditError("limit", NESTED_LIMIT_MESSAGE(repos.length));
  let cursor = 0,
    completed = 0,
    stopped = "";
  await Promise.all(
    Array.from({ length: Math.min(3, repos.length) }, async () => {
      while (cursor < repos.length && !stopped && !signal?.aborted) {
        const repo = repos[cursor++];
        let result;
        try {
          result = await client.repository(repo, { signal, force, nested });
        } catch (error) {
          if (signal?.aborted) return;
          result = {
            repository: repo.full_name,
            status: "failed",
            manifests: [],
            issues: [error.message],
            checkedAt: Date.now(),
          };
          if (["rate-limit", "forbidden"].includes(error.kind))
            result.stopped = error.message;
        }
        if (signal?.aborted) return;
        completed++;
        if (result.stopped) stopped = result.stopped;
        onResult(result);
      }
    }),
  );
  return {
    completed,
    total: repos.length,
    remaining: repos.length - completed,
    stopped,
    cancelled: !!signal?.aborted,
  };
}
export const stackClient = new StackClient();
