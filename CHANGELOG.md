# Changelog

## 0.1.1 — GitHub Autofill

- GitHub profile autofill from a username or profile URL, with a review step and optional fields.
- Safe name/username placeholder replacement, public bio/contact details, dated public stats, and optional project, language, and avatar suggestions.
- Conservative refresh of unedited autofill content, undo/redo, persistence, pagination, partial-results handling, and mocked profile API tests.
- Refresh untouched hero introductions and sample contact URLs; preserve manual edits and remove previously generated contact details when no longer public.
- Cancel obsolete GitHub requests when input changes or the dialog closes. Reject applying a preview if the draft changed after review.
- Handle malformed API responses, preserve completed repository pages on timeout, and ignore malformed legacy identity metadata.
- Add keyboard focus, cancellation, security, storage/backup compatibility, refresh, and stale-preview regression coverage. Display the application version from package metadata.
- Give browser tests a dedicated configurable port and reject reuse of unrelated local servers.

## 0.1.0 — 2026-09-27

Initial local-first release.

- Markdown editor with undo/redo, tab support, and sanitized GitHub-style live preview.
- Visual sections, conservative Markdown ownership, Custom Markdown, and five editable templates.
- Badge generation and badge rows, including theme-aware variants.
- Searchable technology stack, project showcases, and social/contact builders.
- Attributed external widget library and light/dark image helper.
- Advisory README Health and clutter suggestions.
- Named local drafts, autosave, JSON backups, public GitHub/file import, and Markdown copy/download.
- Responsive preview sizes, desktop pane collapse, mobile navigation, and keyboard controls.
- Unit/browser tests, CI, architecture documentation, and static deployment configuration.
