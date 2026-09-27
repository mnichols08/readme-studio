# Changelog

## 0.5.0

- Added a searchable Component Library with 34 editable starters, category filters, source inspection and sanitized previews.
- Added explicit cursor/before/after/append insertion, local favorites/recents and exact-source custom snippet saving.
- Included versioned reusable components in workspace backup/recovery with safe interpolation and collision handling.

## 0.4.3

- Added reusable theme libraries, banner presets and visual bundles with rename/duplicate/delete, validated JSON import/export, theme packs, and visual packs.
- Added a local light/dark gallery and reviewed preset application that preserves explicit overrides by default. Visual presets contain configuration only, never README prose or banner text.
- Included visual libraries in workspace backup/restore, collision handling, and damaged-storage recovery; failed saves leave saved data intact.
- Cached local banner samples, avoided generating SVG when only picture markup is needed, and hardened ownership records and unsafe/incomplete preset validation.
- App light/dark changes now switch the README preview and picture variants too, while preserving the separate preview toggle and source Markdown.

## 0.4.2

- Added per-section heading/divider styles, editable accent glyphs, theme inheritance/reset, and centered compact image/badge content.
- Added readable callouts, collapsible details, safe fenced code samples, and escaped two-column helpers using ordinary GitHub Markdown/HTML.
- Added advisory styling Health checks for centering/divider/prompt/glyph overuse, nested details, and large table layouts. Custom Markdown remains excluded from styling.

## 0.4.1

- Added local SVG Banner Builder with eight restrained styles, deterministic seeds, dimension presets, editable content, and theme palette defaults with independent overrides.
- Generate light/dark asset pairs, preview desktop/mobile widths, download SVGs, copy source or README picture markup, and insert markup without uploading anything.
- Bounded dimensions/text, escaped XML, required alt text, safe filenames, clipboard fallback, and draft-specific banner settings keep output portable and recoverable.

## 0.4.0

- Added draft-specific visual themes, nine built-in palettes, custom palette/default editing, light/dark samples, and advisory contrast guidance.
- Theme-owned settings follow subsequent theme changes while explicit overrides remain intact. Reset is explicit and confirmed; Custom Markdown is never decorated.
- Integrated badge defaults and builder/project heading/divider presentation with undo, draft persistence, and ordinary Markdown output.

## 0.3.3

- Added advisory project Health checks for missing context, links, alt text, roles, repeated names/repositories/technology aliases, large stacks, archived status conflicts, and stale source activity.
- Added project search, collapse/expand all, bulk reviewed GitHub refresh, copy all, and versioned portable project packs with validation and deterministic collision handling.
- Added explicit bounded link checks that distinguish unavailable URLs from browser/network restrictions, plus source-change review and last-refreshed dates.
- Deferred collapsed forms and screenshots, tested 10/25/50-project showcases, and hardened field escaping, ownership preservation, table output, keyboard focus, and offline editing.

## 0.3.2

- Added compact, detailed, featured, card, two-column, case-study, and featured-first project layouts through pure serializers.
- Added layout presets, screenshot placement and light/dark pictures, responsive preview widths, and single-project copy with selectable fallback.
- Project table layouts include mobile guidance in README Health. Layout changes preserve the full editable model.

## 0.3.1

- Review public GitHub repository metadata before creating or refreshing project entries.
- Filter and select cached GitHub Autofill repositories; bounded multi-import preserves partial successes and explains unavailable/rate-limited repositories.
- Confirm duplicate repositories, explicitly select language/topic and archived-status suggestions, and preserve manually edited fields during ownership-aware refresh. No roles, highlights, or statistics are invented.

## 0.3.0

- Project Studio adds normalized editable projects, roles/types, engineering highlights, catalog/custom technologies, status, links, and accessible screenshots.
- Attach independent badge collection copies or compose individual badges with the existing Badge Studio.
- Keyboard reorder/duplicate/delete, collapsed editors, live section preview, explicit save/undo, and exact legacy source preservation until migration is saved.

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
