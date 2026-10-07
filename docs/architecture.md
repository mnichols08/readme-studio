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

## Badge Studio (v0.2.x)

`src/badges/shields.js` is the shared pure static/linked/picture serializer for Badge Studio and existing builders. It implements Shields path escaping, query encoding, named/hex color validation, constrained logo slugs and the shared safe-URL boundary. No arbitrary HTML input or remote script is executed. Generated Markdown remains ordinary source; preview sanitization changes only temporary DOM.

The logo catalog derives from data-driven technology records with explicit WebAssembly support. Presets, aliases and defaults are separate from component search. Provider adapters generate GitHub, npm, crates, Netlify and other documented Shields URLs locally. Dynamic preview is requested only on Generate; static preview follows composer edits. There is no proxy or API fetch while typing. Metadata contributes explicit target suggestions, never silently selected repositories.

`collections.js` validates portable schema-1 collection files and the workspace's schema-1 `badgeCollections` field. Collections are independent of draft blocks. Insertions clone settings or serialize source; stack integration does not establish live references. Collection saves write validated data before replacing in-memory persisted state. Quota/unavailable-storage failures leave the editable collection open for export. Backup merge resolves IDs and names; recovery salvages readable badges while preserving the damaged raw storage until explicit restore.

`contrast.js` and `duplicates.js` are pure advisory analyses. README Health reuses parsed Markdown tokens and performs badge checks in its existing Worker, ignoring fenced code and HTML comments. Duplicate output is bounded to 100 distinct guidance messages. Collection previews cap remote images at twenty and allow three widths; export is never truncated. No new runtime dependency was added.

Badge components use native controls and the app's dialog focus management. Composer clipboard fallback selects its output in place, retaining edits. Collection close prompts protect unsaved changes. Malformed builder settings fail locally; source editing and downloads remain available. Cross-browser tests cover these workflows in Chromium, Firefox and WebKit with mocked image providers.

## Project Showcase Studio (v0.3.x)

`projects/project-model.js` normalizes legacy and version-1 project entries. Legacy blocks retain their existing serializer until the user explicitly saves a studio edit. Custom Markdown remains a raw source block. `project-output.js` provides shared escaped content and URL boundaries; `layouts/` holds pure serializers with ordinary Markdown or GitHub-compatible HTML. Preview sanitization never rewrites exported source.

`github-project.js` fetches only public repository metadata, never README HTML or manifests. Its allowlisted mapping records each generated field value; refresh compares current content with the prior generated value before applying selected changes. The picker reviews all network results before a working-copy mutation, tolerates partial failures, and rejects stale reviews. Studio saves also compare the draft snapshot before writing history. No authentication, proxy, or GitHub writes are involved.

`project-health.js` provides pure advisory analysis, reused by the existing worker and the studio. `project-links.js` is an explicit browser-only HEAD checker with bounded concurrency, timeout, cancellation, and unverified results for network restrictions. `project-pack.js` validates a portable version-1 schema, strips unrelated metadata, and resolves collisions on append. Working copies remain separate until Save showcase; the ordinary draft backup/history paths retain structured project content.

Collapsed editors defer form creation. Preview HTML is prepared in an inert template and screenshot sources for collapsed entries are removed before insertion; this affects only the temporary preview DOM. Layout serializers retain all source URLs. No new runtime dependency was added for project features.

## Visual Design Studio (v0.4.x)

`themes/theme-model.js` validates normalized visual configuration without arbitrary CSS. `theme-resolver.js` tracks the prior derived values and explicit overrides, including intentional same-value overrides. Theme application modifies cloned builder-owned settings; Custom Markdown bypasses presentation entirely. `styling/` contains pure heading/divider/callout/details/code/table serializers and advisory Health checks. User-entered source remains authoritative and preview sanitization only touches temporary DOM.

`banners/` validates bounded dimensions and strings, generates deterministic self-contained escaped SVG using a JavaScript PRNG, and serializes safe filenames and picture markup. SVG contains no scripts, foreignObject, remote fonts, remote images, or user markup. The builder displays SVG through blob-backed image elements, revokes URLs, debounces edits, and caches output. Gallery samples cache at most nine themes times two modes. Picture markup does not render SVG. Banner editor work is isolated from unrelated Markdown changes.

`themes/visual-library.js` owns portable schema-1 themes, banner presets, bundles and packs. Normalization strips unrelated fields and explicitly rejects executable presentation payloads. Banner presets whitelist visual fields, excluding README/banner content and asset paths. Applying a reviewed preset is a draft history operation; saving reusable library entries is an independent workspace operation. Components use working copies, stale-draft guards, native modal focus behavior and selectable clipboard fallbacks.

`workspace-backup.js` includes the optional versioned visual library; old workspaces normalize to an empty library without rewriting their source. Library mutations validate and write before changing persisted in-memory state. Invalid library data uses the existing storage recovery boundary and preserves original recovery bytes. Restore resolves IDs and names without silent overwrite. Saved libraries do not establish live references to drafts.

Workspace app appearance follows `prefers-color-scheme` until the editor toolbar toggle stores an explicit light/dark override. Legacy light defaults migrate to system preference; prior dark settings remain explicit. Manual app theme changes synchronize `previewTheme`, then apply preview colors and temporary picture media overrides. The separate preview control may override that mode afterward. Both preferences persist outside document undo and never mutate source.

## Component Library (v0.5.0)

`components-library/` owns versioned component normalization, explicit interpolation, immutable catalog copies, pure filtering/insertion and local preference storage. Templates are data, never executable functions. Custom snippets bypass interpolation and retain exact source. Metadata is bounded plain text; generated URL fields share the safe URL boundary. Raw template HTML is sanitized only in preview and remains ordinary source in exports.

The component dialog renders at most forty search cards initially, loads no card images and renders a selected source only on request. Native controls retain keyboard operation; insertion captures a draft snapshot and cursor before opening, rejects stale drafts and offers append/before/after/cursor without replacing selected text. v0.5.0 insertion creates Custom Markdown blocks. Workspace validation/recovery includes the optional component library, preserving old workspaces and original damaged storage.

## Dynamic Widget Hub (v0.5.1)

`widgets/registry.js` contains upstream attribution and setup/hosting notes. `widgets/embed.js` validates URLs and dimensions and serializes ordinary Markdown/HTML/picture markup; the Typing SVG adapter only constructs documented query parameters locally. No provider API, credential or proxy code is present. Field edits clear preview content and never fetch images. An explicit preview action creates sanitized image elements; failed images become placeholders without disabling insertion. UI attribution is always visible for named providers, while README credit is optional.

Widget favorites share Component Library IDs. The Hub retains working settings until insertion and has close/discard protection and clipboard fallback. `widgets/health.js` reuses the existing parsed image analysis, ignores code examples through that boundary and provides bounded advisory duplicate/alt/layout guidance in the Health Worker.

## Portable snippet packs (v0.5.2)

`snippets/pack-schema.js` validates version-1 portable packs, whitelists metadata and content types, builds export choices and calculates pure import plans. Collision modes are explicit: Keep both by default, confirmed Replace or Skip. Ambiguous ID/name replacement is rejected instead of silently deleting multiple items. Pack review and explicit sanitized previews do not mutate reusable storage or drafts. A single successful workspace write commits both snippet and badge collection changes; failed writes retain the editable import review.

Pack JSON is a transport, not an execution format. Raw Markdown/HTML source is preserved but only rendered through the existing sanitizer. Built-in example packs are local data. Exact draft-section copies allow project/widget/layout source sharing without reverse engineering or embedding Studio metadata in the README.

## Component customization (v0.5.3)

`component-instances/` normalizes explicit field/widget/badge presets, generates source, records synchronization, supports safe detachment and provides component-aware Health checks. Component blocks store both their configuration and exact generated Markdown; serialization returns only that source. Themes do not implicitly regenerate these instances. Raw editing removes ownership; draft undo restores it. Imported JSON with mismatched cached source retains that source until explicit diff review and confirmation. Stale component edits trigger a fresh comparison instead of overwriting a detached or changed block.

The customizer reuses Widget Hub and badge row forms with independent working copies. Hidden management controls leave keyboard flow; badge editor completion returns focus to an available row action. Configured preset files preserve fallback Markdown or configured field defaults for older readers. Unknown future preset metadata downgrades to custom source, while known invalid settings fail validation. No generic HTML reverse engineering is attempted.

Catalog results render in batches of forty and never load card images. Component previews remain explicit except for the existing bounded badge row composer preview. Syntax highlighting is emitted as a separate statically imported bundle chunk, preserving availability after initial app load while avoiding a monolithic main chunk. No new dependency or runtime backend was added.

## GitHub-aware authoring and refresh

`github/repository-context.js` normalizes public metadata and adapts to the existing project import and badge provider boundaries. Repository authoring produces reviewed, escaped ordinary markup with source snapshots only in Studio state. `github/suggestions.js` is deterministic and local; context fingerprints scope per-draft dismissals without scores or inferred claims.

`github/health.js` extracts tokenized links/images (including HTML picture variants) per import source segment. Explicit scans use four workers, a target cap, request timeouts, bounded body inspection and cancellable fetches. `health-cache.js` holds five-minute results only in memory. Ambiguous browser-policy failures remain unverified; no scanning is coupled to editing.

`generated/registry.js` derives a source inventory from existing ownership records. `github/refresh.js` separates explicit fetching, pure preview/application and normalized snapshots. Profile path/link and project-field ownership preserve manual values; repository sections use exact generated-source ownership. Raw editing archives bounded detached source records. Recreating appends only after review. Refresh Center rejects stale draft snapshots, applies one Store checkpoint, and invalidates Health cache. Full-source diff DOM is lazy; no remote content is inserted into the UI as trusted HTML.

## Structural analysis

`analysis/source.js` maps normalized parser offsets back to original UTF-16 source and caches one token tree per worker. `analysis/analyze.js` emits bounded, explainable findings and section inventories. Health rejects stale source jumps. Preview sanitization and exported source remain independent.

### Optional analysis core

The Health worker lazily initializes `analysis/wasm-loader.js`. Runtime statistics cross the WASM boundary; Marked parsing, section boundaries and rule diagnostics stay in JavaScript to avoid large JSON transfers. The standalone Rust structural API shares fixture parity tests. Initialization is bounded, failures use JavaScript, and consumers need no Rust toolchain. See [the Rust core guide](rust-core.md).

### Compatibility boundary

`compatibility/registry.js` provides support metadata; `compatibility/analyze.js` consumes the existing source-aware inventory and emits bounded explanations. The dedicated Lab reuses the Health worker and emits guarded source-navigation events. Rules are advisory, separate from DOM sanitization, and cannot change exported Markdown.

### Source transformation boundary

`refactors/registry.js` provides pure proposals, strict patch validation, overlap rejection and old/new offset mappings. `refactors/refactor.worker.js` prepares catalogs and combined reviews off the UI thread. `refactor-dialog` invalidates obsolete reviews, displays all source as text and only emits an Apply event after explicit review. AppShell verifies a full draft snapshot before calling `Store.raw` once. Whole-draft detachment is conservative and visible; undo restores all original metadata. No transformation runs as part of preview sanitization or autosave.

## Optional publishing boundary (0.8.0)

`server/publishing.js` owns ephemeral credentials and a fixed GitHub API operation allowlist. The optional Node server serves built static files and the same-origin boundary. `src/github/publishing-client.js` carries an in-memory CSRF nonce only; `publish-dialog` holds an immutable prepared source and independent remote baseline. Pure `publishing/validation.js` validates targets on both sides. Writes never flow through autosave, local backups, or generic public GitHub reads. See [deployment/security model](github-publishing.md).

Generated asset publishing uses pure plans in `publishing/assets.js`. The browser reviews each file and the optional owned banner rewrite; the server independently regenerates requested SVGs from normalized settings. Each remote write has a SHA precondition. Files are sequential, README last, with explicit partial-result reporting. Banner ownership is exact-source metadata and detaches on raw edits.

Workflow generation is a pure structured model and central quoted YAML serializer (`workflows/`). Generated sources carry no Studio runtime. The server re-generates YAML before accepting workflow writes and separately gates Workflows permission; scripts/commands execute only after users commit/run them on GitHub. Local settings do not hold secret values.

## Workspace navigation (0.9.0)

`workspace/commands.js` defines task groups, bounded search and the activity allowlist. `workspace/ui.js` wires those definitions to existing AppShell actions; it never performs a GitHub write or source transformation. Shortcuts invoke the same actions and unsaved-dialog guards as visible controls. Preferences pass through `workspaceSettings`; pending operation state is not persisted. Activity stores only known command identifiers and numeric timestamps, capped at 50 entries.

`components/source-diff.js` supplies shared read-only source panes and a textual diff for publishing, assets, workflows, refactors, import/merge and refresh. It assigns source using DOM `value`/`textContent`, preserving the preview/export boundary. Approval, stale snapshots and conflict choices remain owned by the calling flow. Linear changed-region diffs avoid quadratic sequence-comparison memory; their line counts describe the changed region, not a minimal patch.

## Portable projects (0.9.1)

`studio-projects/model.js` owns the schema-1 envelope, sequential legacy adapter, exact source checks, credential-key exclusion, generated-banner asset validation and recovery extraction. `studio-projects/ui.js` owns explicit file review and new-draft application. No filesystem write handle is retained: saves download a new file, and opening never changes the original. Global libraries are opt-in and use existing collision-safe validators/merge paths. Normal workspace reload preserves block IDs; import remaps exact banner ownership. GitHub publish completion records non-secret target/commit references independently of source and authentication.

## Offline and fallback boundaries (0.9.2)

The build-only offline plugin emits a versioned service worker with a static asset allowlist. Credential-free installation is atomic; failed installation deletes its incomplete cache. Navigation is network-first, and API/auth/write/query/remote requests are never intercepted. Update activation is user-triggered after a successful workspace save. Scope-specific cleanup retains the previous cache and does not remove other applications' caches.

Health and refactor Workers fall back to locally imported JavaScript modules when unavailable. Request IDs and component connection checks reject stale fallback results. The fallback can briefly occupy the main thread on large documents; source editing/export remain independent. Marked/DOMPurify are a separate shared chunk, while fallback analysis modules load only when needed. No external analysis service is used.

## Repository README audit (1.1.0)

The audit workspace loads on demand. `repository-audit/github.js` constructs fixed public GitHub API requests, paginates owned repositories, verifies root READMEs, and schedules at most three fetch/analysis jobs. Timeouts, rate limits and malformed source are separate from confirmed missing results. Session caches are bounded and never enter workspace/project exports.

`classify.js` consumes the existing analyzer and token parser; it returns explicit coverage rules and evidence rather than a numerical score. Activity lives separately in `presentation.js` and cannot change documentation classification. A dedicated Worker runs classification, with a deferred JavaScript fallback when Workers fail. The DOM renders at most 25 repository rows and never previews remote images.

Improve emits an exact-source request to the app shell, which creates a new Custom Markdown draft with source context. No writes or automatic transformations occur. Modal closure aborts active requests and terminates analysis. The selected user's public repository identifiers are the only new data sent to GitHub; README text is analyzed locally.

### Project-type intelligence (1.1.1)

`repository-audit/project-types.js` owns stable type IDs, advisory profiles, deterministic inference and pure assessment. Classification extracts populated-section facts once in the audit Worker and returns bounded boolean topic evidence plus a suggestion/reason. It does not retain another copy of README source. Worker and deferred fallback receive the same repository metadata. No extra API request, package scan or remote inference is introduced.

The audit view applies session-only overrides to cached evidence; it does not rerun parsing or fetch on selection. The original suggestion remains visible. Select controls retain their DOM identity during reassessment so keyboard focus stays predictable. Changing accounts clears overrides; fresh scans preserve them. Neither suggested nor chosen type mutates draft source, stored project schemas, preview or exports. Missing/fetch failure and activity remain separate boundaries.

### README Attention Queue (1.1.2)

`repository-audit/attention.js` derives descriptive tiers, contextual reasons, stable ordering and conjunctive filters from existing successful assessments. It never fetches or re-parses source. Type overrides are resolved through the same profile model. Archived/inactive status affects the queue, never the underlying documentation classification. Missing/failing fetches remain distinct.

`attention-storage.js` validates a separate version-1 local preference envelope. Canonical owner/repository identifiers hold only decision kind, README revision and ignore expiry. Intentionally-minimal markers require a valid Git blob SHA or confirmed root-README absence; they never fall back to source length or repository push dates. Reads do not overwrite malformed/future data, writes re-read current preferences and only update in-memory decisions after storage succeeds. Recovery download and reset are explicit. No source, credentials or drafts enter this key; it is outside project/workspace exports.

`readme-attention-queue` renders at most 25 candidates, keeps filters outside the replaced list, and returns focus after actions. Opening a candidate uses the audit's existing exact-source/new-draft event. The shared public fetch concurrency/cache/cancellation boundary is unchanged. The queue adds no network request and does not claim unavailable pinned/release metadata.

See [repository audit hardening](audit-hardening.md) for conservative placeholder/history findings, optional link checks, retry policy and large-account limits.

## Repository README templates

`data/repository-templates.js` defines twelve project-type section profiles and pure suggestion/serialization functions. `repository-readme-builder` reviews metadata and selected sections before emitting a new-draft plan. The audit supplies its explicit override or suggested type; PWA maps to Web App and Experiment to Generic. Existing source remains an exact Custom Markdown block by default. Generated sections use editable Custom Markdown with explicit writing comments, not fabricated commands. `metadata.repositoryReadme` carries versioned reviewed context in Studio state only; normal README export remains plain source. The builder is loaded lazily, reuses the modal focus/dismissal boundary, and makes no network requests itself.

## Structured documentation sections

`documentation/sections.js` defines 18 version-1 `doc-*` section models, editor field descriptors and a pure Markdown serializer. `builder-form` reuses normal save/copy/preview and history behavior, adding boolean environment rows with existing keyboard reorder controls. `markdown/serialize.js` dispatches documentation types to this serializer. Command fences adapt to embedded backticks; environment cells escape table delimiters. No command is executed and no secret value is generated. New repository templates map supported headings to structured types while preserving existing Custom Markdown. Portable projects keep settings when serialized source matches; unknown settings recover stored Markdown through existing draft validation.

## Project-specific documentation

`documentation/project-types.js` centralizes specialized section descriptors, recommended section IDs and fresh-template structures. `documentation/sections.js` reuses the pure serializer with typed row columns, literal code languages and safe link/image output. `builder-form` uses these row descriptors with the existing keyboard controls and 200-row cap. The Library reads `metadata.documentationProjectType`, falling back to `metadata.repositoryReadme.templateId`; changing recommendations checkpoints metadata only and leaves Markdown unchanged. Registry URLs are user-entered and are not fetched. Screenshot previews use the existing sanitizer/remote-image boundary. Existing section types and prior templates are not migrated or rewritten.

## Repository template hardening

`documentation/template-merge.js` matches top-level Markdown/HTML headings against explicit aliases and related topics. It reports source lines and content evidence without changing source or claiming completeness. Code/comment examples are excluded; missing suggestions alone are selected by default. Matching runs when the import/template changes, not on every metadata keystroke.

UTF-8 file imports are byte-bounded and preserve BOM/line endings. Async imports use a sequence token so late reads cannot replace a newer import or reopen a closed dialog. Local imports clear prior GitHub source context. The builder retains the original as a separate Custom Markdown block and makes context insertion optional.

Changed existing-source plans require a snapshot containing original source, generated source, draft name and metadata. The diff uses the shared safe text/value rendering; any settings change invalidates approval. Both the form and app-shell apply handler verify approval. Unchanged-source opening remains separate. Preview is lazy, sanitized and independent from exported source; width/theme controls do not change the approved plan.

## Stack Intelligence

The stack-intelligence module exposes a fixed root manifest registry and pure adapters for Node, Rust, Python and Go declarations. The bounded TOML reader handles dependency syntax without evaluation; unsupported declarations fail locally. Dependencies retain role, manifest and line evidence. No skill model, source rewrite, registry resolution or executable configuration is involved.

The client reads allowlisted regular files through the shared public GitHub client, reusing timeout/retry/cooldown behavior. Three workers read sequential manifests with cancellation. File bytes, entry counts, cache bytes/count and selected repository count are bounded. Normalized evidence is cached briefly; raw source is discarded. Partial failures remain distinguishable from no supported manifests. An explicit UI consent gate is required for each opened audit workspace.

The stack-results component renders escaped, paginated repository evidence. Result state is separate from README classifications, project-type suggestions and draft storage. Closing the audit cancels work; changing accounts clears visible result state.

### Direct dependency normalization (1.3.1)

The pure dependencies module normalizes name/ecosystem/kind/repository tuples and merges source evidence without collapsing different roles or repositories. Python/npm normalization differs from Rust/Go spelling preservation. Go indirect and unused/unresolved Cargo workspace declarations are excluded before result limits; same-file workspace references retain their consuming dependency kind.

The version-2 session result envelope includes normalized dependencies. Cache keys canonicalize repository casing while retaining branch identity. Cached responses preserve the caller's repository label for audit selection identity. The UI renders normalized evidence; no new network request, package-manager execution, persistence schema or draft mutation is introduced.

### Stack DNA (1.3.2)

The versioned catalog in stack-intelligence/catalog.js maps exact normalized ecosystem/package identities to technology IDs and one primary category. The pure dna.js model merges associations and source evidence across currently selected result records. Stable ordering and bounded retained evidence avoid output dependence on request completion order. Unknown entries retain their names/ecosystems rather than falling into a guessed category.

The version-3 session result envelope carries the existing GitHub primary-language field and explicit package.json engine signals. These provide labeled evidence without fetching language files, workflows or registry data. Engine values remain unexecuted data. No runtime inference is made from manifest presence alone.

The stack-dna Web Component filters categories, groups Core/Data for display, and exposes bounded evidence with keyboard focus return. It reads existing result state and never changes drafts, skills or scan consent. Raw dependency evidence remains independently available.

### Stack-to-README (1.3.3)

`readme-metadata.js` retains only recognized package-manager identifiers, test/build script presence and bounded package names. Script bodies, arbitrary URLs, tokens and raw manifests are not retained. This additive metadata is session-only. `readme-suggestions.js` combines it with the deterministic DNA catalog; it never requests registry data or executes commands. Inferred conventions are labeled separately from declarations.

The lazy `stack-readme-review` component starts with no selection, renders evidence as escaped text, and places editable source in textarea values. Each selected item becomes a separate Custom Markdown block. Before application it verifies builder/source synchronization and that the generated document retains the existing source prefix, presents the exact diff, and requires explicit approval tied to the selection and text. The app also checks a full draft snapshot (ID, source, blocks, metadata). Accepted blocks bypass theme regeneration so the reviewed source is applied exactly; one Store checkpoint preserves Undo/Redo. Existing blocks and metadata remain intact. No analysis metadata or Studio runtime is injected into README exports.

### Optional writing assistance (1.4.0)

`writing/model.js` defines deterministic action instructions, source ranges and exact replacement. Existing Markdown tokenization maps sections to original CRLF/Unicode offsets, excluding headings in code. `writing/client.js` is a small configurable chat-completions adapter with no SDK or hardcoded remote provider. It sends only fixed action instructions plus the chosen Original and notes, never the whole workspace. HTTPS or explicit loopback HTTP endpoints are allowed; URL credentials/query/fragment and redirects are rejected, cookies/referrers omitted. Inputs, completion tokens, response bytes and output text are bounded. Cancellation/timeout applies through body reading. Provider error bodies are not exposed and requests are not automatically retried.

The lazy `writing-assistant` dialog holds connection data only in module memory, outside the persistence and export schemas. Changing endpoint clears the key and consent. Dialog close aborts pending requests; request identities prevent late responses from replacing local edits. Output is inert text in editable Proposed and source-diff fields. Exact approval is invalidated by input changes; application checks the full draft snapshot. The existing Store.raw path applies one undoable edit, preserving source outside the selected range and detaching unsafe builder ownership. No AI-generated content enters preview until explicit Apply; the existing sanitizer remains the preview boundary.

### Explicit writing context (1.4.1)

`writing/context.js` projects allowlisted profile and repository-builder fields, public repository choices and one repository's existing Stack DNA into editable text. It never enumerates other drafts or fetches data. `writing-context` owns seven unchecked sources and independent repository/section selectors. Sources are session UI state, not persisted prompt history.

The pure context validator rejects unknown/duplicate/empty/oversized entries and labels style as nonfactual guidance. `writingMessages` is shared by exact preview and provider request construction. Generate compares the current normalized messages with the displayed preview before transmission. Context changes abort requests and clear consent/proposal approval; context is also part of the diff review signature. System grounding requires omission of unsupported claims and treats context as data. This constrains the request contract, not a guarantee of model factual correctness.

### Rewrite alternatives (1.4.2)

`writing/alternatives.js` defines fixed style instructions and a sequential three-request orchestrator. It reuses the same input/context and provider boundary for each independent output, stops on failure/abort, and keeps completed versions. No alternative is fed into another request. The preview and provider share `writingMessages` with a validated style identifier, so all three previewed message sets match transmitted messages.

The inert `writing-comparison` component renders at most three bounded text outputs. Selecting a ready card stages Proposed and invalidates diff approval; it never mutates a draft. Input/context/mode changes clear comparisons and consent. Request identities suppress late results. Identical-output detection is exact after trimming, not a semantic quality assessment. Desktop grid becomes a single column on narrow screens.

### Writing provider boundary (1.4.3)

`writing/providers.js` owns the adapter registry, endpoint/key validation, request serialization and response parsing. An adapter exposes name/key policy, connect, request and parse; extending a protocol does not require changing document operations. Compatible and loopback-only adapters share the same wire protocol; disabled mode rejects before network access. Only explicitly registered adapters are selectable. No remote plugin code is loaded.

`writing/client.js` owns bounded transport, timeout/cancellation and safe HTTP errors. `writing/model.js` continues to own action/grounding instructions and exact source replacement without provider selection. The UI shows adapter metadata and destination, cancels requests and clears keys/consent when destinations or adapters change. Keys remain module memory only.

`state/portable-data.js` removes credential-shaped object fields recursively at project, single-draft JSON and workspace-backup boundaries. Source strings remain exact. This is defense in depth, not a scanner that can find secrets pasted into arbitrary prose. The [AI safety audit](ai-safety.md) documents prompt injection and output-review boundaries.

### Multi-document workspace (1.5.0)

Documents remain entries in the existing version-1 drafts envelope. `workspace/documents.js` validates draft-specific `metadata.workspaceDocument` (version 1, group and optional target), reads legacy import/publishing targets, derives display groups and matches repository/branch/path identities. Source is never inferred from the target. A null explicit target overrides legacy metadata. Portable Studio projects allowlist this document metadata; workspace backups already preserve it.

`DocumentHistories` retains inactive Store histories by draft ID in session memory, with a 32 MB aggregate cap in addition to the Store's own 8 MB / 80-checkpoint cap. Load creates a fresh Store/listener and restores only matching source history; deleted entries are pruned and workspace restore clears the cache. Neither history nor credential state is serialized. Active Markdown remains authoritative and survives history eviction.

The lazy `workspace-documents` component supplies grouped search and target settings. App-shell flushes saves before switching, cancels scheduled updates and recreates the active Health panel, terminating its old worker. Audit actions look for an existing target before opening a template or adding a draft, preserving local edits. Publish dialog may prefill an authorized saved target but does not fetch/write it automatically.

### Shared documentation (1.5.1)

`workspace/shared-components.js` validates a version-1 workspace library, revisions, safe update plans and restore collision remapping. Each inserted Custom Markdown block retains a `sharedComponent` reference with definition ID, applied revision and exact inserted source. Serialization ignores this metadata. Save/delete touches only definitions. Update planning replaces only source-matching custom copies and preserves all other blocks/separators; mismatched source is reported and skipped.

The lazy `shared-components` dialog renders inert per-document source diffs. Editing fields or selections invalidates approval. Apply checks definition identity and every affected full draft snapshot, then persists the complete result before changing any Store. Active/inactive document Stores receive independent history checkpoints; inactive history is returned to the workspace cache. Raw edits remove shared ownership; Undo restores it. Existing preview sanitization remains separate from source export.

Workspace backup validation/recovery includes shared definitions. Merge remaps incoming definition IDs and block references, suffixes name collisions, and detaches orphan incoming references without touching their Markdown. No remote fetch, dynamic include resolution or automatic propagation occurs.

### Cross-document preview selection (1.5.2)

Workspace-wide shared preview scans only documents linked to the chosen definition. `planShared` produces immutable before/after snapshots for safe changes; `selectSharedPlan` narrows those entries without regenerating source, preserving workspace order and rejecting unknown recipients. The dialog keeps the full preview separate from its selected apply plan. Every recipient change resets approval and updates affected/selected counts.

The existing persistence boundary accepts only the dialog's approved selected plan, validates its definition and selected document snapshots, and writes only those entries. Unselected document changes are irrelevant to this transaction and remain intact. There is no background propagation, GitHub write, or new persistence schema.

### Review batches (1.5.3)

`workspace/batch-review.js` validates versioned review targets and explicit pending/reviewed/skipped transitions. Queue Improve next snapshots filtered, non-deferred repository order into workspace `reviewBatch`, capped at 200 items. No source content or credentials are duplicated in progress metadata. Normal workspace validation/recovery includes it; replace restore restores it and merge preserves the current batch.

App-shell opens targets through the existing document identity matcher and read-only AuditClient. Requests are sequential and cancellable; fetched source is persisted before joining the workspace. Current target is recorded before fetching so errors/skip refer to the failed item. Completed sources survive partial failure. A reviewed decision requires the matching active local document; no automatic Health-based resolution occurs.

The lazy `batch-review` dialog can prepare selected repositories for common-section insertion. It passes explicit document IDs to Shared components, which preserves that selection through definition save and uses the existing per-document diff/approval transaction. Batch actions never invoke publishing. Dialog close/replacement aborts in-flight fetching.
