import {
  CATALOG_VERSION,
  categories,
  groupForCategory,
  primaryLanguages,
  technologyById,
  technologyForDependency,
} from "./catalog.js";
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function stackDNA(records) {
  const found = new Map();
  let assessed = 0,
    failed = 0,
    partial = 0;
  const add = (technology, evidence) => {
    let item = found.get(technology.id);
    if (!item) {
      item = {
        id: technology.id,
        name: technology.name,
        category: technology.category,
        ecosystem: technology.ecosystem || "",
        evidence: [],
        keys: new Set(),
        repositories: new Set(),
        kinds: new Set(),
      };
      found.set(item.id, item);
    }
    item.repositories.add(evidence.repository);
    item.kinds.add(evidence.kind);
    // Bound retained detail while still counting every associated repository.
    const key = JSON.stringify(evidence);
    if (item.evidence.length < 100 && !item.keys.has(key)) {
      item.keys.add(key);
      item.evidence.push(evidence);
    } else if (!item.keys.has(key)) item.moreEvidence = true;
  };
  // Sort copies for deterministic evidence even if parallel reads finish differently.
  for (const record of [...records].sort((a, b) =>
    compare(a.repository, b.repository),
  )) {
    if (record.status === "failed") {
      failed++;
      continue;
    }
    assessed++;
    if (record.status === "partial") partial++;
    const language = technologyById(primaryLanguages[record.language]);
    if (language)
      add(language, {
        repository: record.repository.toLowerCase(),
        kind: "metadata",
        source: "GitHub primary language",
        dependency: "",
        ecosystem: "",
      });
    for (const manifest of record.manifests || [])
      for (const signal of manifest.signals || []) {
        const technology = technologyById(signal.id);
        if (technology?.category === "Runtime")
          add(technology, {
            repository: record.repository.toLowerCase(),
            kind: "configuration",
            source: manifest.path + " · " + signal.evidence,
            dependency: "",
            ecosystem: "node",
          });
      }
    for (const dependency of [...(record.dependencies || [])].sort((a, b) =>
      compare(
        JSON.stringify([a.ecosystem, a.name, a.kind]),
        JSON.stringify([b.ecosystem, b.name, b.kind]),
      ),
    )) {
      const technology = technologyForDependency(dependency);
      for (const source of [...dependency.evidence].sort((a, b) =>
        compare(JSON.stringify(a), JSON.stringify(b)),
      ))
        add(technology, {
          repository: dependency.repository,
          kind: dependency.kind,
          dependency: dependency.name,
          ecosystem: dependency.ecosystem,
          source:
            source.manifest +
            " · " +
            source.section +
            (source.line ? " (line " + source.line + ")" : ""),
        });
    }
  }
  const technologies = [...found.values()]
    .map(({ keys, repositories, kinds, ...item }) => ({
      ...item,
      repositories: [...repositories].sort(compare),
      kinds: [...kinds].sort(compare),
      evidence: item.evidence.sort((a, b) =>
        compare(JSON.stringify(a), JSON.stringify(b)),
      ),
    }))
    .sort(
      (a, b) =>
        categories.indexOf(a.category) - categories.indexOf(b.category) ||
        compare(a.name, b.name) ||
        compare(a.id, b.id),
    );
  return {
    version: 1,
    catalogVersion: CATALOG_VERSION,
    assessed,
    failed,
    partial,
    technologies,
    groups: [
      ...new Set(categories.map((category) => groupForCategory[category])),
    ]
      .map((name) => ({
        name,
        technologies: technologies.filter(
          (technology) => groupForCategory[technology.category] === name,
        ),
      }))
      .filter((group) => group.technologies.length),
  };
}
