import { normalizeDependencies } from "./dependencies.js";
import { auditClient, AuditError } from "../repository-audit/github.js";
import { githubRepository } from "../badges/providers/github.js";
import { manifests, analyzeManifest, MANIFEST_LIMIT } from "./manifests.js";
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
  async repository(repo, { signal, force = false } = {}) {
    signal?.throwIfAborted();
    const name = githubRepository(repo.full_name).toLowerCase();
    const key = JSON.stringify([name, repo.default_branch || "HEAD"]);
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
    const ref = "?ref=" + encodeURIComponent(repo.default_branch || "HEAD");
    const base = "/repos/" + name + "/contents/";
    const { data: listing } = await this.client.request(base + ref, signal);
    if (!Array.isArray(listing) || listing.length > 1000)
      throw new AuditError("response", "Unreadable root manifest listing.");
    const result = {
      version: 3,
      language: repo.language || "",
      repository: repo.full_name,
      ref: repo.default_branch || "HEAD",
      checkedAt: this.now(),
      manifests: [],
      issues: [],
      status: "read",
    };
    if (listing.length === 1000)
      result.issues.push(
        "Root listing may be truncated; absence of other manifests is uncertain.",
      );
    for (const descriptor of manifests) {
      signal?.throwIfAborted();
      const listed = listing.find((entry) => entry.path === descriptor.path);
      if (!listed) continue;
      if (
        listed.type !== "file" ||
        listed.submodule_git_url ||
        listed.size > MANIFEST_LIMIT
      ) {
        result.issues.push(
          descriptor.path + ": not a regular file within the 256 KB limit.",
        );
        continue;
      }
      try {
        const { data } = await this.client.request(
          base + encodeURIComponent(descriptor.path) + ref,
          signal,
        );
        if (
          data?.type !== "file" ||
          data.path !== descriptor.path ||
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
        const source = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);
        const analysis = analyzeManifest(descriptor.path, source);
        const remaining = Math.max(
          0,
          200 - result.manifests.reduce((n, m) => n + m.entries.length, 0),
        );
        if (analysis.entries.length > remaining) {
          analysis.entries = analysis.entries.slice(0, remaining);
          result.issues.push(
            "Only the first 200 dependency declarations per repository are retained.",
          );
        }
        result.manifests.push({
          ...analysis,
          sha: typeof data.sha === "string" ? data.sha : "",
        });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        result.issues.push(
          descriptor.path + ": " + String(error.message).slice(0, 1000),
        );
        if (["rate-limit", "forbidden"].includes(error.kind)) {
          result.stopped = error.message;
          break;
        }
      }
    }
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
  { client, signal, onResult = () => {}, force = false } = {},
) {
  const repos = [
    ...new Map(
      repositories.map((repo) => [repo.full_name.toLowerCase(), repo]),
    ).values(),
  ].slice(0, 1000);
  let cursor = 0,
    completed = 0,
    stopped = "";
  await Promise.all(
    Array.from({ length: Math.min(3, repos.length) }, async () => {
      while (cursor < repos.length && !stopped && !signal?.aborted) {
        const repo = repos[cursor++];
        let result;
        try {
          result = await client.repository(repo, { signal, force });
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
