# Known limitations and acceptance status

- Preview approximates GitHub. Sanitization and unsupported HTML can change displayed output without changing exported Markdown. Themes cannot apply arbitrary CSS to GitHub.
- Complex imported Markdown remains Custom Markdown. Structured ownership detaches when raw edits cannot be synchronized safely.
- Remote badges/widgets depend on their providers, and relative image preview needs repository context. Link checks can be inconclusive because of CORS or network policy.
- Browser storage has quotas and may be cleared by private browsing or the user. Autosave is not an independent backup and crash-time flush is best effort.
- Large documents complete regression checks through 1 MB, but preview can be slow and undo history is bounded. Publishing supports UTF-8 README text up to 750 KB.
- Publishing requires an operator-configured HTTPS service, a GitHub App, installation and effective permissions. Static hosting alone provides authoring/export. Multi-process session storage is not supported.
- Asset and README writes are sequential, not atomic. A lost response may hide a completed remote write; inspect GitHub before retrying. No force-push or silent conflict overwrite is provided.
- Offline support requires successful prior caching and a browser that permits service workers. Remote fetch/publish/preview still needs connectivity; installation is optional.

Release candidate automation covers three browser engines, source recovery and mocked publishing failures. Manual screen-reader acceptance, live GitHub App authentication/writes, and production deployment have **not** been certified by that automation. These remain stable-release acceptance gates, not completed checks. See the [readiness record](releases/1.0-readiness.md).
