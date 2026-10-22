# Studio project schema

Public file type: `readme-studio-project`. Schema version: **1**, independent of `appVersion`. Extension: `.readme-studio.json`. Maximum file size: 10 MB UTF-8. Unknown future schema versions are never opened as editable structured projects or overwritten; Markdown-only recovery remains available.

| Field                    | Required               | Meaning                                                                                                    |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `schemaVersion`          | Yes                    | Integer `1`                                                                                                |
| `type`                   | Yes                    | `readme-studio-project`                                                                                    |
| `name`                   | Yes                    | Nonempty string, at most 200 characters                                                                    |
| `appVersion`             | Written by exporter    | Informational producer version; never a migration discriminator                                            |
| `createdAt`, `updatedAt` | Yes                    | Parseable date strings; exporter writes ISO timestamps                                                     |
| `document.markdown`      | Yes                    | Canonical source, preserved exactly                                                                        |
| `document.blocks`        | For structured opening | At most 2,000 uniquely identified blocks whose serialization exactly matches Markdown                      |
| `document.metadata`      | Optional               | Supported draft theme, banner, GitHub source/snapshot, ownership, detachment and project creation metadata |
| `settings`               | Optional               | Allowlisted workspace preferences; applying them is opt-in                                                 |
| `assets`                 | Yes                    | Array of supported generated-banner descriptors, at most 32                                                |
| `libraries`              | Optional               | Versioned badge collections, visual library and component library; import requires explicit merge choice   |

Each asset has `id`, `type: "generated-banner"`, `filename`, `hash` and textual `source`. Filenames/IDs are unique. SVG source must exactly match the banner generator for the stored settings. The `fnv1a32:` hash detects accidental content differences; it is **not** an authenticity signature or a security substitute for regeneration validation. Arbitrary SVG, scripts and binary attachments are not accepted.

The metadata allowlist includes `visualTheme`, `bannerSettings`, `bannerReference`, `githubProfile`, `repository`, `repositoryContext`, `importSource`, `importHistory`, `detachedGenerated`, `detachments`, `dismissedSuggestions`, `publishing` and `studioProject`. Authentication/session/credential keys are excluded recursively. Detachment records are exported with their kinds, and with each label only when that section name still appears in the Markdown (otherwise a generic name such as "Builder section"). `previous` (the copy of a detached section's earlier settings) is always `null` in project files and backups, and records whose section was deleted are left out, so text removed with a raw edit does not travel in a file. User-authored source strings are not a secret-scanning boundary: text you type is still text you export.

Schema 1 source recovery is the stable compatibility boundary. Builder internals remain implementation-specific and may safely fall back to Custom Markdown when unrecognized. Exported README contains no schema, ownership marker or Studio runtime. File parsing and source extraction live in `src/studio-projects/model.js`; UI application lives separately in `src/studio-projects/ui.js`.
