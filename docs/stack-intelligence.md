# Stack Intelligence

Open **README audit**, load a public account, select repositories, and check **Allow read-only manifest analysis for this session**. Then choose **Analyze selected manifests**. Loading repositories or auditing READMEs does not trigger manifest reads. Closing the workspace resets consent; completed evidence remains in this tab.

Results are titled **Detected in selected repositories**. They describe declarations in repository files, not developer skill, proficiency, runtime usage or a complete resolved dependency graph. Each result identifies its repository, observed branch/time, manifest, ecosystem and dependency role. TOML and line-based declarations include source lines.

## Initial scope

| Ecosystem | Root files                       | Evidence                                                                                                                   |
| --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Node      | package.json                     | Runtime, development, peer and optional declarations, including npm aliases                                                |
| Rust      | Cargo.toml                       | Direct runtime, development, build and optional declarations, including same-file workspace inheritance and renamed crates |
| Python    | pyproject.toml, requirements.txt | Project/optional dependencies, build requirements, dependency groups and Poetry declarations; named requirements           |
| Go        | go.mod                           | Direct require declarations; indirect entries are excluded                                                                 |

A manifest's presence is evidence of configuration for that ecosystem, not proof its dependencies are used. Unused workspace declarations are excluded; referenced same-file workspace values are resolved without fetching member manifests. Unresolved references are omitted with a notice. Build dependencies are labeled accordingly. The same dependency can appear in multiple roles.

Only allowlisted regular root files are read. Nested projects, workspace members, local paths, include files, lockfiles and transitive resolution are not followed. Symlinks/submodules and oversized files produce notices. This initial version may miss technologies in monorepos or executable configuration.

The conservative TOML declaration reader supports common quoted keys, arrays, inline tables and dependency tables. It is not a general TOML validator. Unsupported dependency values are reported rather than evaluated; unrelated tool configuration is ignored. Multiline dependency strings, Python dynamic dependencies/group includes, requirements options/continuations and Go replacement/exclusion resolution have explicit limitations. Missing detections do not prove a technology is absent.

The adapters follow the declaration models documented by [Cargo](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html), [Python packaging](https://packaging.python.org/en/latest/specifications/pyproject-toml/) and [Go modules](https://go.dev/ref/mod).

## Normalized dependency records (1.3.1)

Each direct declaration produces a record containing name, ecosystem (node/rust/python/go), kind (runtime/development/peer/build/optional), repository and source evidence. Names normalize to lowercase for npm and to lowercase with collapsed dash/underscore/dot runs for Python. Rust crate spelling and case-sensitive Go module paths are preserved. GitHub repository association uses canonical lowercase owner/repository.

Matching name/ecosystem/kind/repository records merge their manifest/section/line evidence. Different kinds and repositories remain independent. npm aliases and Cargo renamed dependencies use the declared package name, retaining alias evidence. Results have deterministic ordering and share the existing session cache.

“Direct” means explicitly declared by the inspected root manifest; it does not mean verified production usage. Go indirect entries are excluded. requirements.txt has no universal direct/transitive distinction: explicit lines are retained, and generated freeze files may contain transitive packages. No graph or lockfile is traversed to guess that distinction. Optional/target-specific dependencies may not run in every build.

## Security and privacy

Manifest analysis reads data only. It never installs dependencies, executes package scripts, runs repository code or invokes build tools. It never executes setup.py, build scripts, shell commands or TOML/JSON values. It does not follow package download URLs or contact package registries.

Requests go directly to the [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents) for public files on the selected default branch. README Studio does not proxy requests or send draft content. Source is parsed locally and discarded; normalized evidence is escaped when displayed. No detection automatically becomes a profile skill, badge, README edit or project-type override.

## Limits and recovery

Scans use at most three concurrent repository workers, with sequential reads inside each worker. Each repository needs one root listing plus at most five manifests. Files are limited to 256 KB; each repository retains at most 200 declarations. Up to 1,000 selected repositories are accepted, with result navigation in groups of 25 and lazy detail rendering.

GitHub's unauthenticated rate limit can stop larger scans. Partial results retain successfully read manifests and explain failures; unreadable files are not treated as absent. Cancel stops pending requests. Use **Fetch fresh manifests** to bypass the five-minute cache after resolving a failure. Rate-limit cooldowns still apply.

The normalized cache is bounded to 128 repositories / approximately 2 MB. Results are session-only and are not included in workspace backups. Offline reads fail gracefully; already displayed evidence and existing drafts remain available. Scans observe files as returned by GitHub, not an atomic repository snapshot.

## Development

Pure adapters live in src/stack-intelligence/manifests.js, the bounded declaration reader in toml.js, and GitHub orchestration/cache in client.js. Tests use static manifest strings and mocked HTTP responses; none execute scanned repository code.

## Stack DNA (1.3.2)

[Stack DNA](stack-dna.md) adds a curated technology summary above repository dependency results. Exact ecosystem/package mappings produce categories; unknown packages remain explicit. Existing primary-language metadata and explicit package.json engine declarations provide labeled language/runtime evidence without additional requests. Categories are separate from dependency kinds and developer proficiency.

## Stack-to-README (1.3.3)

[Stack-to-README](stack-to-readme.md) offers evidence-backed suggestions from each expanded result. Allowlisted manager/package identifiers and test/build script presence stay in session evidence; script bodies are discarded. Nothing is inserted until individual selection, source review and explicit diff approval. Existing source and builder blocks remain intact.
