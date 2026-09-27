# Architecture

## Application boundaries

`src/components/app-shell.js` coordinates draft selection, dialogs, pane visibility, preview settings, autosave, and import/export. `markdown-editor`, `github-preview`, `builder-form`, and `readme-health` are native Custom Elements. They use light DOM so shared design tokens, focus behavior, and accessibility relationships remain straightforward. The app does not need a framework or component runtime. Shadow DOM is an optional future boundary for independently distributed components.

`builder-form.js` uses a small field schema for badges, projects, links, and images. Repeating entries support edit, remove, reorder, and duplicate. Technology and widget data live outside components in `src/data`. Each widget supplies project attribution, instructions, and generic embed fields; no third-party private API is called.

## Markdown pipeline

1. The editor emits untouched Markdown.
2. The store records a bounded undo checkpoint and updates the draft.
3. Independent debounces schedule preview at 180ms, Health at 600ms, and autosave at 900ms. Raw input updates the source immediately.
4. Marked parses GFM; highlight.js highlights explicitly recognized code languages.
5. DOMPurify sanitizes the HTML against explicit tag and attribute allowlists.
6. Safe links receive a new tab target and `noopener noreferrer`; task inputs are disabled.
7. The preview replaces only its document content. The builder is not rendered on every keystroke after the initial ownership transition.

`<picture>` media sources are adjusted only in the preview DOM when simulating a theme. The source Markdown and exported media queries remain intact. Raw HTML is never used directly as application chrome. Form values, block labels, and metadata are escaped before interpolation.

Sanitization is a security boundary. `markdown/compatibility.js` is a separate advisory analysis layer and is not relied upon for security. Analysis traverses Markdown tokens, excludes fenced code examples, and reports categories instead of a numeric score. Regex checks for HTML patterns are intentionally heuristic.

## Block ownership

A block is `{ id, type, settings, separator? }`. `serializeBlock` emits ordinary Markdown/HTML. `serializeBlocks` inserts a blank line by default. Explicitly split imported sections use an empty separator: every byte of spacing is already included in their exact source slices. No ownership comments are added to exported content.

Builder operations replace only the block list and regenerate its document. Manual editor input changes the draft into one Custom Markdown block containing the exact source. Later builder operations append or edit this explicit representation. This prevents hidden stale forms from overwriting a manual edit. Undo checkpoints include both Markdown and blocks, so the ownership transition can be reversed.

The explicit section splitter recognizes H1/H2 boundaries outside backtick and tilde fences. It creates Custom Markdown blocks rather than guessing structured fields. Import does not call the splitter.

## Local state and recovery

`state/store.js` maintains one active draft and up to 80 history checkpoints, with a shared estimated 8,000,000-byte snapshot budget for undo/redo. Drafts store names, Markdown, blocks, project metadata, IDs, and timestamps. `state/drafts.js` persists a versioned draft collection and workspace settings under `readme-studio:v1`. Draft JSON import validates its basic structure and compares serialization to raw Markdown; incompatible block metadata falls back to preserved source.

Malformed saved data is not overwritten automatically: the app opens a temporary working draft, reports the storage problem, and allows exports. Quota/unavailable-storage errors are visible. JSON backups preserve settings for individual blocks; exported README files intentionally have no application metadata. History is session-local.

GitHub import fetches repository metadata and the public README endpoint, with a 20-second timeout and bounded response reads. Base64 content is decoded as UTF-8 without discarding a BOM. Larger READMEs use the raw media type and recheck the SHA to reject a remote change during retrieval. Markdown is capped at 2 MB of UTF-8 bytes, not JavaScript characters. There is no arbitrary HTML fetch/render API, token storage, or authenticated write path.

## Import pipeline

`markdown/resolve-urls.js` is a pure URL resolver. `render(markdown, { sourceContext })` sanitizes first, then resolves safe image/srcset/link attributes in the preview DOM. GitHub context contains owner, repository, ref, README path, SHA, and fetch time. Images use raw GitHub URLs; files use GitHub blob URLs. Anchors stay local and the preview assigns heading IDs. Unsafe schemes and unresolvable local paths cannot become application-relative requests. The sanitizer allowlist is unchanged; image data URLs are rejected by the resolver.

`markdown/sections.js` uses top-level Marked tokens and maps normalized lexer offsets back to the untouched source, including CRLF. It recognizes H1/H2/H3 and supports chosen boundary levels. Fences, comments, raw HTML, inline code, and nested blockquote/list content are not mistaken for structural boundaries. Genuinely parsed Markdown headings inside details can be boundaries. Each result has original start/end offsets, title, level, kind, body, and exact source. Classification is advisory metadata.

`markdown/merge.js` indexes normalized headings, deterministic body hashes, conservative kind aliases, and image URLs. Hash matches are verified against content; normalization is comparison-only. Candidate lists are bounded, and similarity checks inspect a bounded prefix only for matching headings. Ambiguous matches and duplicates never select or delete anything. `assembleMerge` requires every imported decision, rejects conflicting replacements, and retains original slices. Only newly joined boundaries may gain blank lines. This is a section-selection tool, not a Git three-way merge.

`state/import-plan.js` creates pure new/replace/append/merge plans. `import-dialog` loads a source, summarizes it, collects choices, and reviews the result before dispatching an apply event. A snapshot check rejects stale reviews. Current-draft operations call `Store.blocks` once with blocks and metadata, so undo restores both. New draft creation is separate. Requests cancel on input changes, source changes, close, or removal, and generation checks discard obsolete responses.

Draft `metadata.importSource` supports re-import; an additive import history records other fetched sources. Blocks can override context with `sourceContext`, including explicit null for local content. Adjacent blocks with matching context render together, preserving reference definitions and HTML across splits. Cross-source groups render independently. Splits/merges derive context from the actual source ranges, ignoring separator-only whitespace. A raw edit that collapses mixed-source blocks marks the result mixed rather than assigning an incorrect repository. Preview then warns for ambiguous relative images. Context and classification are backup-only metadata, never inserted into exported Markdown.

Plain Markdown imports have no inferred generated ownership. Valid Studio backups retain blocks and metadata for new/replace; append retains their blocks. Section split/merge produces user-owned Custom Markdown and does not invent autofill ownership. Existing detached-autofill section records remain conservative to avoid later duplicate generation. No storage schema migration is required; old v1 drafts with no context still work.

## GitHub profile autofill

`state/github-profile.js` validates usernames/profile URLs, fetches the public user record and paginated owned repository list, and normalizes a curated set of public data. Requests are limited to GitHub API endpoints, a 30-second timeout, and ten 100-item repository pages. Repository failure returns a usable profile with explicit incomplete-result metadata. Counts of received stars/forks exclude forks; language summaries count primary repository languages. No contribution or private-activity data is fabricated.

`state/profile-autofill.js` is a pure draft transformation. It replaces explicit placeholders, safely escapes external text, fills known sample content, and adds chosen generated sections. Internal block metadata records the last generated Markdown and identity placeholder source/value pairs. Refresh replaces only content that still matches its last generated form; manual changes relinquish ownership. Draft metadata retains detached section kinds to prevent duplicate insertion after raw editing. These records never appear in exported Markdown.

`github-profile-form` loads and previews the transformation without mutating the draft. An AbortController cancels requests on username changes, dialog close, or component removal; request generations also discard stale results. The loader clears its 30-second timeout and removes cancellation listeners when a request ends. Completed repository pages survive repository timeouts, but explicit cancellation produces no usable result.

Applying compares the reviewed snapshot (draft ID, Markdown, blocks, and metadata) against the current draft before recording one undo checkpoint. A mismatched snapshot is rejected. Internal `profileIntro` and `profileLinks` records allow untouched hero bios and sample contact URLs to refresh. Contact records check the row index, label, and previous URL before updating; reordered or edited rows are treated conservatively. Missing formerly public fields clear only generated values. Older v0.1.0 drafts keep their content, and absent ownership records are never inferred from ordinary personal text.

Profile metadata is scoped to the draft and included in JSON backups; no account-wide automatic fetching or background refresh occurs. The local storage schema remains version 1; additive ownership metadata requires no destructive migration.

## Performance and future Rust boundary

Editor input is native textarea editing; unrelated component trees do not rerender continuously. Preview and analysis are debounced. Unit coverage includes a Unicode document over 100 KB, with browser workflow coverage separately. Performance depends on markup complexity and device capability; this is not a latency guarantee.

Rust is not included in v0.1. Future measurements could justify moving deterministic analysis or large-document transforms behind the existing `analyze(markdown)` interface, behind the existing Worker boundary. A WASM loader should always preserve the JavaScript implementation as fallback and keep editor/preview startup independent of WASM. DOM rendering, forms, and local state belong in JavaScript.

Future banners can emit ordinary light/dark asset URLs into the existing picture block. A future schema migration should be explicit and preserve raw source on failure. OAuth, remote persistence, and integrations are outside this release’s boundaries.

## Foundation hardening boundaries

`state/workspace-backup.js` validates version 1 workspaces, normalizes known settings, regenerates imported IDs, and resolves name collisions. Reads of malformed/partial/future-schema storage preserve the original string and enter a write-blocked temporary workspace. Valid drafts from a partial version 1 document can be salvaged. The original remains downloadable. Replace/merge restore builds a candidate workspace and writes it successfully before switching in-memory state. Confirmation is required before replacing local drafts or the blocked recovery data. Restore itself is not a document history operation.

The store records source immediately and synchronizes it into the workspace before scheduling side effects. Draft switches save the outgoing workspace; pagehide and hidden-document events attempt a synchronous flush. Quota/access errors keep a persistent notice and download actions. A visual save status may change while typing; the separate live region announces settled saves rather than every keystroke. Local storage remains best-effort browser storage, not a durable database.

History snapshot sizes use twice the serialized JSON character count as a conservative estimate, cached in a WeakMap. Both count and byte caps prune old snapshots. This bounds retained history, not total browser memory or a single active document. Each newly loaded draft has its own store/history. Workspace presentation settings do not enter Markdown undo.

`markdown/url-safety.js` is shared by serializers, sanitizer, and preview URL resolution. It validates safe HTTP(S), mailto links, relative paths, and local anchors while rejecting credentials, control characters, backslashes, and unsafe schemes. Images exclude mailto/anchors/data payloads. DOMPurify remains the HTML boundary; only inert task checkboxes survive input sanitization. Preview CSS classes are limited to code/task-list classes so untrusted HTML cannot borrow application overlay styling. Preview DOM transformations never modify the store, source, or download path.

`markdown/visit-tokens.js` traverses parsed tokens in source order without Marked's accumulating callback-result arrays. This removes quadratic allocation from analysis. `health.worker.js` computes pure Health/duplicate results off the UI thread. The Health component has at most one request running and one latest pending draft; obsolete results are discarded and the Worker terminates when the component leaves the page. Worker failure produces a local explanation rather than rerunning expensive analysis synchronously. Whole-Markdown and identical source-segment analysis are reused within a request.

The preview catches rendering failures locally and keeps source/editor/export intact. Builder initialization failures show a local fallback. Unexpected window errors and unhandled rejections show a persistent recovery notice with reload/download actions, without exposing stacks in normal UI. Console diagnostics remain available for development. Clipboard errors open a readonly, selected-text dialog. Downloads use sanitized filenames, attached temporary anchors, and delayed object-URL revocation.

Dialogs retain their original trigger through nested content changes, focus meaningful fields on open, and restore a connected visible target on close. Import/split completion can explicitly target the editor; draft deletion/restore targets the draft selector. Background rendering/saves do not steal focus. Native dialog modality keeps hidden workspace controls outside tab flow.

Static builds include a separate Health Worker asset and relative Vite asset references. `scripts/static-smoke.mjs` verifies root and `/readme-studio/` deployments with a plain HTTP file server and no route fallback. A browser `file://` launch is not supported for ES modules/Workers; serve `dist/` over HTTP(S).
