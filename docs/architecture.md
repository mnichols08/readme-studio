# Architecture

## Application boundaries

`src/components/app-shell.js` coordinates draft selection, dialogs, pane visibility, preview settings, autosave, and import/export. `markdown-editor`, `github-preview`, `builder-form`, and `readme-health` are native Custom Elements. They use light DOM so shared design tokens, focus behavior, and accessibility relationships remain straightforward. The app does not need a framework or component runtime. Shadow DOM is an optional future boundary for independently distributed components.

`builder-form.js` uses a small field schema for badges, projects, links, and images. Repeating entries support edit, remove, reorder, and duplicate. Technology and widget data live outside components in `src/data`. Each widget supplies project attribution, instructions, and generic embed fields; no third-party private API is called.

## Markdown pipeline

1. The editor emits untouched Markdown.
2. The store records a bounded undo checkpoint and updates the draft.
3. A 180ms debounce batches preview rendering, health analysis, and local persistence.
4. Marked parses GFM; highlight.js highlights explicitly recognized code languages.
5. DOMPurify sanitizes the HTML against explicit tag and attribute allowlists.
6. Safe links receive a new tab target and `noopener noreferrer`; task inputs are disabled.
7. The preview replaces only its document content. The builder is not rendered on every keystroke after the initial ownership transition.

`<picture>` media sources are adjusted only in the preview DOM when simulating a theme. The source Markdown and exported media queries remain intact. Raw HTML is never used directly as application chrome. Form values, block labels, and metadata are escaped before interpolation.

Sanitization is a security boundary. `markdown/compatibility.js` is a separate advisory analysis layer and is not relied upon for security. Analysis traverses Markdown tokens, excludes fenced code examples, and reports categories instead of a numeric score. Regex checks for HTML patterns are intentionally heuristic.

## Block ownership

A block is `{ id, type, settings, separator? }`. `serializeBlock` emits ordinary Markdown/HTML. `serializeBlocks` inserts a blank line by default. Explicitly split imported sections use a single newline separator to preserve the original source exactly. No ownership comments are added to exported content.

Builder operations replace only the block list and regenerate its document. Manual editor input changes the draft into one Custom Markdown block containing the exact source. Later builder operations append or edit this explicit representation. This prevents hidden stale forms from overwriting a manual edit. Undo checkpoints include both Markdown and blocks, so the ownership transition can be reversed.

The explicit section splitter recognizes H1/H2 boundaries outside backtick and tilde fences. It creates Custom Markdown blocks rather than guessing structured fields. Import does not call the splitter.

## Local state and recovery

`state/store.js` maintains one active draft and up to 80 history checkpoints. Drafts store names, Markdown, blocks, project metadata, IDs, and timestamps. `state/drafts.js` persists a versioned draft collection and workspace settings under `readme-studio:v1`. Draft JSON import validates its basic structure and compares serialization to raw Markdown; incompatible block metadata falls back to preserved source.

Malformed saved data is not overwritten automatically: the app opens a temporary working draft, reports the storage problem, and allows exports. Quota/unavailable-storage errors are visible. JSON backups preserve settings for individual blocks; exported README files intentionally have no application metadata. History is session-local.

GitHub import fetches only the public GitHub README API endpoint, using the raw media type and a timeout. Imports create new drafts. There is no arbitrary HTML fetch/render API, token storage, or authenticated write path.

## GitHub profile autofill

`state/github-profile.js` validates usernames/profile URLs, fetches the public user record and paginated owned repository list, and normalizes a curated set of public data. Requests are limited to GitHub API endpoints, a 30-second timeout, and ten 100-item repository pages. Repository failure returns a usable profile with explicit incomplete-result metadata. Counts of received stars/forks exclude forks; language summaries count primary repository languages. No contribution or private-activity data is fabricated.

`state/profile-autofill.js` is a pure draft transformation. It replaces explicit placeholders, safely escapes external text, fills known sample content, and adds chosen generated sections. Internal block metadata records the last generated Markdown and identity placeholder source/value pairs. Refresh replaces only content that still matches its last generated form; manual changes relinquish ownership. Draft metadata retains detached section kinds to prevent duplicate insertion after raw editing. These records never appear in exported Markdown.

`github-profile-form` loads and previews the transformation without mutating the draft. Request generations discard stale results after input changes or dialog replacement. Applying calls the store with both blocks and metadata in one undo checkpoint. Profile metadata is scoped to the draft and included in JSON backups; no account-wide automatic fetching or background refresh occurs.

## Performance and future Rust boundary

Editor input is native textarea editing; unrelated component trees do not rerender continuously. Preview and analysis are debounced. Unit coverage includes a Unicode document over 100 KB, with browser workflow coverage separately. Performance depends on markup complexity and device capability; this is not a latency guarantee.

Rust is not included in v0.1. Future measurements could justify moving deterministic analysis or large-document transforms behind the existing `analyze(markdown)` interface, optionally in a worker. A WASM loader should always preserve the JavaScript implementation as fallback and keep editor/preview startup independent of WASM. DOM rendering, forms, and local state belong in JavaScript.

Future banners can emit ordinary light/dark asset URLs into the existing picture block. A future schema migration should be explicit and preserve raw source on failure. OAuth, remote persistence, and integrations are outside this release’s boundaries.
