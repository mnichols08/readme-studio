import { githubRepository } from "../badges/providers/github.js";
const ecosystems = { Node: "node", Rust: "rust", Python: "python", Go: "go" };
const kinds = new Set(["runtime", "development", "peer", "build", "optional"]);
export function normalizeDependencyName(name, ecosystem) {
  if (
    typeof name !== "string" ||
    !name ||
    name.length > 200 ||
    /[\s<>"'\x00-\x1f]/.test(name)
  )
    throw Error("Invalid dependency name.");
  if (ecosystem === "python") return name.toLowerCase().replace(/[-_.]+/g, "-");
  if (ecosystem === "node") return name.toLowerCase();
  if (ecosystem === "rust" || ecosystem === "go") return name;
  throw Error("Unsupported dependency ecosystem.");
}
// A dependency is direct because it is explicitly declared, not because we
// resolved a lockfile or executed a package manager. Keep evidence per kind.
export function normalizeDependencies(repository, manifests) {
  const association = githubRepository(repository).toLowerCase();
  const dependencies = new Map();
  for (const manifest of manifests) {
    const ecosystem = ecosystems[manifest.ecosystem];
    if (!ecosystem) throw Error("Unsupported dependency ecosystem.");
    for (const entry of manifest.entries) {
      if (!kinds.has(entry.role)) continue;
      const name = normalizeDependencyName(entry.name, ecosystem);
      const key = JSON.stringify([association, ecosystem, name, entry.role]);
      let dependency = dependencies.get(key);
      if (!dependency) {
        dependency = {
          name,
          ecosystem,
          kind: entry.role,
          repository: association,
          direct: true,
          evidence: [],
        };
        dependencies.set(key, dependency);
      }
      const evidence = {
        manifest: manifest.path,
        section: entry.evidence,
        line: entry.line,
      };
      if (
        !dependency.evidence.some(
          (item) => JSON.stringify(item) === JSON.stringify(evidence),
        )
      )
        dependency.evidence.push(evidence);
    }
  }
  return [...dependencies.values()].sort((a, b) => {
    const left = JSON.stringify([a.ecosystem, a.name, a.kind]),
      right = JSON.stringify([b.ecosystem, b.name, b.kind]);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
