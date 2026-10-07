import { stackDNA } from "./dna.js";
import { buildLinkedBadge } from "../badges/shields.js";

const code = (text) => `\n\n\`\`\`sh\n${text}\n\`\`\``;
export function readmeSuggestions(record) {
  if (!record || record.status === "failed") return [];
  const suggestions = [];
  const add = (id, title, markdown, evidence, caveat) =>
    suggestions.push({ id, title, markdown, evidence, caveat });
  const dna = stackDNA([record]);
  const known = dna.technologies.filter((t) => t.category !== "Unknown");
  if (known.length) {
    add(
      "stack",
      "Detected stack section",
      "## Detected stack\n\n" +
        dna.groups
          .map((g) => ({
            ...g,
            technologies: g.technologies.filter(
              (t) => t.category !== "Unknown",
            ),
          }))
          .filter((g) => g.technologies.length)
          .map(
            (g) =>
              `- ${g.name}: ${g.technologies.map((t) => t.name).join(" · ")}`,
          )
          .join("\n"),
      known
        .flatMap((t) => t.evidence.map((e) => `${t.name}: ${e.source}`))
        .slice(0, 100),
      "Declarations and primary-language metadata, not proficiency or verified production use. Unknown dependencies are omitted.",
    );
    for (const t of known)
      add(
        `badge:${t.id}`,
        `${t.name} badge`,
        buildLinkedBadge({
          label: t.name,
          color: "555555",
          alt: `${t.name} — repository evidence`,
        }),
        t.evidence.map((e) => e.source),
        "Optional presentation. Rendering this badge contacts Shields.io; it does not certify skill.",
      );
  }
  for (const manifest of record.manifests || []) {
    const { path, readme = {} } = manifest;
    const suggest = (
      key,
      title,
      source,
      evidence,
      caveat = "Conventional command, not verified against this repository. Review prerequisites, working directory and safety before documenting or running it.",
    ) => add(`${path}:${key}`, title, source, [`${path}: ${evidence}`], caveat);
    if (path === "package.json") {
      const manager = readme.packageManager || "npm";
      suggest(
        "manager",
        "Package manager",
        `Package manager: ${manager}.`,
        readme.packageManager
          ? "packageManager declaration"
          : "package.json; npm is a suggested fallback, not detected",
        "Confirm the manager/version against repository instructions and lockfiles; lockfiles were not read.",
      );
      suggest(
        "install",
        "Install Node dependencies",
        "## Installation" + code(`${manager} install`),
        "package.json present",
      );
      for (const key of readme.scripts || [])
        if (["test", "build"].includes(key))
          suggest(
            key,
            key === "test" ? "Testing command" : "Build command",
            `## ${key === "test" ? "Testing" : "Build"}` +
              code(`${manager} run ${key}`),
            `scripts.${key} declared`,
            "Script body was not retained, inspected for safety or executed. Review the script and any lifecycle hooks before running it.",
          );
      if (readme.packageName)
        suggest(
          "link",
          "npm package link",
          `[Package on npm](https://www.npmjs.com/package/${encodeURIComponent(readme.packageName)})`,
          "name declaration",
          "Package identity is declared; publication, ownership and availability are not verified.",
        );
    } else if (path === "Cargo.toml") {
      suggest(
        "manager",
        "Rust package manager",
        "Package manager: Cargo.",
        "Cargo manifest present",
      );
      for (const key of ["build", "test"])
        suggest(
          key,
          `Cargo ${key} command`,
          `## ${key === "test" ? "Testing" : "Build"}` + code(`cargo ${key}`),
          "Cargo manifest present",
        );
      suggest(
        "install",
        "Rust dependency setup",
        "## Installation\n\nInstall the Rust toolchain, then fetch declared dependencies:" +
          code("cargo fetch"),
        "Cargo manifest present",
      );
      if (readme.packageName)
        suggest(
          "link",
          "Crate links",
          `[crates.io](https://crates.io/crates/${encodeURIComponent(readme.packageName)}) · [docs.rs](https://docs.rs/${encodeURIComponent(readme.packageName)})`,
          "package.name declaration",
          "Publication, ownership and documentation availability are not verified.",
        );
    } else if (path === "pyproject.toml" || path === "requirements.txt") {
      suggest(
        "manager",
        "Python package manager suggestion",
        "Package manager suggestion: pip.",
        "Python manifest present",
        "pip is a convention, not a detected manager. Confirm Poetry/uv or other repository-specific workflows first.",
      );
      suggest(
        "install",
        "Install Python dependencies",
        "## Installation" +
          code(
            `python -m pip install ${path === "requirements.txt" ? "-r requirements.txt" : "."}`,
          ),
        "Python manifest present",
        "Use an appropriate virtual environment. A pyproject may be non-installable; inspect build configuration and repository instructions first.",
      );
      if (readme.packageName)
        suggest(
          "link",
          "Python package link",
          `[Package on PyPI](https://pypi.org/project/${encodeURIComponent(readme.packageName)}/)`,
          "project/package name declaration",
          "Publication, ownership and availability are not verified.",
        );
    } else if (path === "go.mod") {
      suggest(
        "manager",
        "Go module tooling",
        "Dependencies: Go modules.",
        "go.mod present",
      );
      for (const [key, command] of [
        ["install", "go mod download"],
        ["test", "go test ./..."],
        ["build", "go build ./..."],
      ])
        suggest(
          key,
          `Go ${key} command`,
          `## ${key === "install" ? "Installation" : key === "test" ? "Testing" : "Build"}` +
            code(command),
          "go.mod present",
        );
    }
  }
  if (
    (record.dependencies || []).some(
      (d) => d.ecosystem === "python" && d.name === "pytest",
    )
  )
    add(
      "python:test",
      "Python testing command",
      "## Testing" + code("python -m pytest"),
      ["pytest direct dependency declaration"],
      "Confirm test paths, environment and repository-specific options. Not executed or verified.",
    );
  return suggestions;
}
