# Changelog

## 0.2.3

- Advisory badge alt-text, approximate contrast, duplicate technology/URL/status, long-row and per-section clutter guidance; code examples and comments remain excluded.
- Resilient collection backup/restore and partial corruption recovery, bounded large-collection previews, and explicit unsaved-edit handling.
- In-place clipboard fallback, offline markup generation, strict color/style/URL validation, and local builder validation errors.
- Desktop side-by-side preview, mobile wrapping, predictable WebKit dialog focus, and Chromium/Firefox/WebKit workflow coverage.
- Completed badge, privacy, accessibility, and architecture documentation.

## 0.2.2

- Guided dynamic helpers for GitHub workflow/stars/forks/issues/license/releases, npm version/downloads, crates.io version/downloads, PyPI, Docker, Netlify, and public Shields JSON endpoints.
- Local format validation, explicitly chosen repository suggestions, editable click-through links, and provider-specific cache settings.
- No API lookups while typing, no proxy, and clear remote preview/privacy limitations.

## 0.2.1

- Reusable local badge collections with editable starters, alias search, keyboard reorder/edit/duplicate/remove, and portable versioned JSON.
- Plain, centered, picture and category output; desktop/narrow/mobile previews with bounded remote images.
- Save badges or stack categories as collections and insert independent copies into drafts or stack blocks.

## 0.2.0

- Dedicated Badge Studio with editable presets, searchable technology logos, smart defaults, and live Markdown/HTML/URL previews.
- Theme-aware light/dark badge pairs and safe centralized Shields serialization.
- Insert at the cursor, into a badge row, or at the end of a builder section; undo remains available.

## 0.1.3

Foundation Hardening.

- Standardize dialog and action focus, announce selected states, improve contrast, reduced motion, keyboard reordering, and mobile touch targets.
- Add all-drafts backup/validated restore, deterministic collision handling, original-data recovery downloads, and persistent storage failure notices.
- Separate preview, Worker Health, and autosave scheduling; remove quadratic token traversal and cap history by count and estimated bytes.
- Centralize URL validation, restrict untrusted preview classes, expand malicious-markup tests, and preserve exact Markdown exports.
- Keep editor/export available after preview failures; add runtime recovery actions, clipboard fallback, safe filenames, offline messages, and rate-limit retry times.
- Harden narrow layouts and long draft names, including WebKit overflow; test Chromium, Firefox, WebKit, 100/250 KB documents, and static subpath hosting.
- Review the installed dependency tree without unnecessary upgrades; document browser support, recovery, performance, fixtures, and contributor checks.

## 0.1.2

Import Intelligence.

- Review GitHub, local Markdown, and Studio backups before choosing new draft, confirmed replacement, append, or merge.
- Preserve exact source while splitting H1/H2 sections, with preamble handling and advisory section kinds.
- Resolve relative GitHub images, picture sources, repository links, and local anchors in preview only; show unresolved local images clearly.
- Explicit section merge choices, likely matches, duplicate warnings, resulting Markdown review, and one-step undo/redo.
- Re-import GitHub-backed drafts with SHA change detection, source provenance in backups, bounded 2 MB reads, cancellation, and actionable errors.
- Add realistic fixtures and unit/browser coverage for source preservation, URL safety, merge decisions, ownership, keyboard use, limits, and performance.

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
