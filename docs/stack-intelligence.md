# Stack Intelligence

Open **README audit**, load a public account, select repositories, and check **Allow read-only manifest analysis for this session**. Then choose **Analyze selected manifests**. Loading repositories or auditing READMEs does not trigger manifest reads. Closing the workspace resets consent; completed evidence remains in this tab.

Results are titled **Detected in selected repositories**. They describe declarations in repository files, not developer skill, proficiency, runtime usage or a complete resolved dependency graph. Each result identifies its repository, observed branch/time, manifest, ecosystem and dependency role. TOML and line-based declarations include source lines.

## Initial scope

| Ecosystem | Root files                       | Evidence                                                                                                         |
| --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Node      | package.json                     | Runtime, development, peer and optional declarations, including npm aliases                                      |
| Rust      | Cargo.toml                       | Dependency, development, build, target-specific and workspace declarations, including renamed crates             |
| Python    | pyproject.toml, requirements.txt | Project/optional dependencies, build requirements, dependency groups and Poetry declarations; named requirements |
| Go        | go.mod                           | Direct and indirect require declarations                                                                         |

A manifest's presence is evidence of configuration for that ecosystem, not proof its dependencies are used. Workspace-only and build-only declarations are labeled accordingly. The same dependency can appear in multiple roles.

Only allowlisted regular root files are read. Nested projects, workspace members, local paths, include files, lockfiles and transitive resolution are not followed. Symlinks/submodules and oversized files produce notices. This initial version may miss technologies in monorepos or executable configuration.

The conservative TOML declaration reader supports common quoted keys, arrays, inline tables and dependency tables. It is not a general TOML validator. Unsupported dependency values are reported rather than evaluated; unrelated tool configuration is ignored. Multiline dependency strings, Python dynamic dependencies/group includes, requirements options/continuations and Go replacement/exclusion resolution have explicit limitations. Missing detections do not prove a technology is absent.

The adapters follow the declaration models documented by [Cargo](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html), [Python packaging](https://packaging.python.org/en/latest/specifications/pyproject-toml/) and [Go modules](https://go.dev/ref/mod).

## Security and privacy

Manifest analysis reads data only. It never installs dependencies, executes package scripts, runs repository code or invokes build tools. It never executes setup.py, build scripts, shell commands or TOML/JSON values. It does not follow package download URLs or contact package registries.

Requests go directly to the [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents) for public files on the selected default branch. README Studio does not proxy requests or send draft content. Source is parsed locally and discarded; normalized evidence is escaped when displayed. No detection automatically becomes a profile skill, badge, README edit or project-type override.

## Limits and recovery

Scans use at most three concurrent repository workers, with sequential reads inside each worker. Each repository needs one root listing plus at most five manifests. Files are limited to 256 KB; each repository retains at most 200 declarations. Up to 1,000 selected repositories are accepted, with result navigation in groups of 25 and lazy detail rendering.

GitHub's unauthenticated rate limit can stop larger scans. Partial results retain successfully read manifests and explain failures; unreadable files are not treated as absent. Cancel stops pending requests. Use **Fetch fresh manifests** to bypass the five-minute cache after resolving a failure. Rate-limit cooldowns still apply.

The normalized cache is bounded to 128 repositories / approximately 2 MB. Results are session-only and are not included in workspace backups. Offline reads fail gracefully; already displayed evidence and existing drafts remain available. Scans observe files as returned by GitHub, not an atomic repository snapshot.

## Development

Pure adapters live in src/stack-intelligence/manifests.js, the bounded declaration reader in toml.js, and GitHub orchestration/cache in client.js. Tests use static manifest strings and mocked HTTP responses; none execute scanned repository code.
