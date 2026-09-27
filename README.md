# README Studio

A visual GitHub profile README builder and Markdown studio. Build a profile with editable sections, work directly in Markdown, and export an ordinary `README.md` that works without this app.

**Version 0.6.3** · Native Web Components · Local drafts · Static hosting

![README Studio desktop workspace](docs/screenshots/studio-desktop.png)

## Run locally

Use Node.js **22.12 or newer** and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No credentials, Rust toolchain, backend, or account is required.

## What you can build

- Hero, about, learning, writing, contact, divider, and unrestricted Custom Markdown sections.
- Badge Studio with searchable logos, live Markdown/HTML/URL previews, light/dark pairs, reusable collections, and guided dynamic badges.
- Searchable technology catalog with aliases, custom technologies, categories, badges, code chips, and text lists.
- Social badges, plain links, and centered contact lines.
- Multi-project showcases with compact, detailed, and table-card layouts, screenshots, highlights, status Markdown, and custom links.
- Widget embeds for Constellation, Metrics, Snake, Typing SVG, Streak Stats, GitHub Stats, and Activity Graph. Setup instructions link to the original projects.
- Light/dark `<picture>` markup with alt text, dimensions, links, and alignment.

Choose Minimal, Developer Showcase, Open Source, Student, or Terminal on first launch, import a public GitHub README, or start blank. The sample uses fictional placeholder content. Developer Showcase follows the structural patterns described for [the reference profile](https://github.com/mnichols08/mnichols08), without copying its personal text.

## Editing and drafts

The Markdown editor preserves formatting and supports undo/redo and two-space Tab insertion. **Shift+Tab leaves the editor**, so keyboard users are never trapped. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes; Ctrl/Cmd+S saves. Alt+1–4 selects Build, Markdown, Preview, or Health on mobile. Section controls provide keyboard reordering, duplication, removal, and copying. The builder can collapse on desktop.

Builder-created documents retain editable block settings. **Editing raw Markdown turns the document into one Custom Markdown block**. Structured component ownership detaches with a visible explanation; Undo restores it. This deliberately gives manual text priority: new builder sections append to the preserved text. Undo restores the previous block state. “Split into sections” explicitly divides raw content into Custom Markdown sections and preserves its exact text; it does not infer structured form fields.

The app light/dark toggle also switches the README preview and its theme-aware picture sources. The preview toggle can then select a different preview mode independently. Neither changes Markdown.

Drafts and theme/preview settings autosave to this browser’s localStorage. Use the menu beside the draft name to rename, duplicate, delete, or create drafts. Download a JSON draft backup to retain builder settings; Markdown export preserves only the portable document. Clearing browser storage removes drafts. Storage failures are reported without silently claiming a successful save.

## Backups and recovery

Open **Manage drafts → Download all drafts backup** to export all drafts, reusable snippets/component presets, badge collections, saved themes/banner presets/visual bundles, workspace settings, schema version, and the backup creation date. Single-draft backups remain available separately. **Restore backup** validates the file and shows its draft count/version/date before applying. Merge is the default: imported drafts receive fresh IDs and colliding names receive numbered suffixes. Replacement requires explicit confirmation. Workspace restore accepts up to 500 drafts and a 50 MB file.

Unreadable JSON, unsupported future schemas, or partially damaged storage open a temporary workspace without overwriting the original. Recoverable drafts are retained when possible. The recovery notice offers **Download original recovery data** as well as a backup of the temporary workspace. Restore can replace the original data only after confirmation and a successful storage write. A failed save stays visible; export your work before closing the tab. Browser storage quotas and private browsing restrictions vary.

Autosave waits briefly after editing, saves before switching drafts, and flushes on page hide where the browser allows it. Document undo/redo is scoped to the active draft and bounded by both 80 checkpoints and an estimated 8 MB of snapshot data; older steps expire sooner for large documents. Undo history is not persisted. Workspace theme/preview preferences and whole-workspace restore are outside document undo; download a backup before replacement.

## Accessibility and resilience

Dialogs focus a meaningful field and return to their trigger when closed. Applying an import focuses the editor (or the import trigger on small screens); deleting/restoring drafts focuses the draft selector. Mobile pane buttons announce their selected state, and hidden panes leave the tab order. Section and form-row reorder controls work with the keyboard. Visible focus indicators, stronger control contrast, reduced-motion support, and mobile touch targets are included. Clipboard denial opens selectable text for manual copying.

Preview and Health errors stay local and preserve source/export. Unexpected runtime errors offer reload and current-draft download. Health runs in a Web Worker and does not block the editor. The app is tested with 100 KB and 250 KB READMEs; complexity and device speed still affect latency. See [hardening results](docs/hardening.md) for measurements and limits.

After the app has loaded, editing, local preview, existing drafts, and downloads work offline. GitHub import/autofill require connectivity; rate-limit responses include a retry time when GitHub provides one. Remote images, badges, and widgets may fail offline. There is no service worker or offline reload/install guarantee.

Current Chromium, Firefox, and WebKit engines run the core workflow suite, including 320, 375, 390, 430, and 768px layouts. Keyboard tests are regression coverage, not a complete screen-reader or accessibility certification.

## Import Intelligence

Open **Import**, choose GitHub, Local file, or Studio backup, and review the summary before applying. GitHub accepts a username, `@username`, `owner/repository`, or GitHub profile/repository URL. It fetches the public README endpoint and records the returned path, branch, SHA, and fetch time. No token is requested or stored. Imports are limited to 2 MB; timeouts, rate limits, missing repositories/READMEs, and malformed responses have distinct errors.

**New draft** is the default. **Replace current draft** requires confirmation. **Append** adds content at the end. **Merge** shows current and imported sections together, suggests matches, and requires an action for every imported section: keep current, use imported, insert before, or append after a chosen section. Review the resulting Markdown, then apply. Replacement, append, and merge each have one undo step.

Import preserves the original Markdown, including whitespace, HTML, comments, and code. **Split into sections** creates Custom Markdown blocks at H1 or H1 + H2 boundaries, preserving the preamble and exact source slices. Suggested section kinds are labels; they do not convert content into specialized forms. Merge preserves the selected slices, adding blank lines only where newly joined pieces need separation. Duplicate sections and image/widget URLs produce warnings and are never deleted automatically.

Relative GitHub images and repository links resolve **only in preview**; Markdown exports keep their original URLs. Local anchors stay within the preview. Relative assets in local files have no accessible sibling directory, so images show a placeholder and links remain inactive. Studio backups retain source context and valid builder/autofill metadata when restored as a new draft or replacement. Appending retains imported blocks; section merging and splitting deliberately produce user-owned raw blocks.

GitHub-backed drafts offer **Re-import current GitHub README**. It compares the saved SHA, reports whether the remote changed, and opens merge review without changing the draft. Combined documents retain each block’s source repository. Editing an entire document that combines different sources collapses it to one raw block; ambiguous relative assets then remain unresolved. Edit individual sections to retain their source context.

## Autofill from GitHub

Choose **Autofill from GitHub** in Sections or on the welcome screen. Enter a username, `@username`, or GitHub profile URL, then review the public profile and select what to apply. “Review resulting Markdown” shows the exact proposed document before applying.

- **Identity:** fills `Your Name`, `https://github.com/your-name` URLs, `{{name}}`, `{{display_name}}`, and `{{username}}` throughout block settings and Custom Markdown. The login is used if there is no display name. Ordinary custom names are preserved.
- **Bio and links:** uses the public bio, company, location, website, public email, and X/Twitter account when available. Untouched sample introductions and contact URLs are filled; custom text and destinations remain intact.
- **Stats:** adds a dated, editable snapshot of public repositories, followers, following, public gists, received stars/forks on non-fork repositories, and account creation date. These are static Markdown values, not live counters.
- **Optional extras:** up to three most-starred eligible public projects, a primary-language summary by repository count, and the GitHub avatar. Forks, archived repositories, and the profile repository are excluded from project suggestions. Languages describe repositories, not proficiency or code-volume percentages.

The flow reads the [public user endpoint](https://docs.github.com/en/rest/users/users#get-a-user) and [public repository list](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user). It follows pagination up to 1,000 repositories. Partial results and rate limits are labeled; private activity, contribution totals, and streaks are not inferred. Profile lookup can still succeed if repository loading fails.

Apply is a single undoable change to the current draft, including saved profile metadata. Look up the profile again to refresh untouched generated sections and filled names. Subsequent manual edits are respected. Raw Markdown editing detaches generated sections from automatic refresh; repeating autofill does not append those sections again. All applied content remains ordinary Markdown/HTML after export.

In 0.1.1, untouched autofilled hero bios and sample contact URLs also refresh. Previously generated bio/contact fields are cleared when the public profile no longer provides them; manual replacements stay yours. Closing the dialog or changing the username cancels the lookup. If the draft changes after review, apply is rejected so you can reopen autofill and review the latest source. Keyboard users can submit the username with Enter, tab through choices, and close with Escape.

Existing v0.1.0 drafts and JSON backups remain readable without a format migration. Older bio/contact fields without ownership records are treated conservatively as custom content. See [0.1.1 release scope and verification](docs/releases/0.1.1.md). Import Intelligence and Foundation Hardening are included; the v0.2.x cycle adds Badge Studio in four separate release checkpoints.

## Preview and health

The preview supports GFM tables, task lists, highlighted fenced code, details/summary, pictures, and a conservative subset of GitHub-compatible HTML. DOMPurify sanitizes generated preview HTML. External links open in a separate tab with `noopener noreferrer`; local anchors scroll within the preview. Preview width presets are maximum widths, constrained by the available pane: desktop (1012), narrow (760), tablet (640), and mobile (375). The separate preview theme toggle simulates light/dark picture sources.

README Health provides advisory Accessibility, Compatibility, Layout, Structure, and **Clutter suggestions**. It reports missing alt text, empty links, heading hierarchy issues, scripts, custom CSS, interactive HTML, large images, wide tables, and excessive badges/widgets. There is no quality score, and checks never delete or rewrite content.

## Security and privacy

Markdown and imported HTML are untrusted. Preview rendering uses an explicit HTML/attribute allowlist and removes scripts, event handlers, unsafe URLs, unsupported interactive content, and custom styles. Raw source and exports remain unchanged, including content flagged by Health. Review warnings before using an export outside GitHub.

Drafts stay on-device; there is no analytics, cloud sync, or server database. Fonts are bundled locally. **Remote images, badges, and widget previews contact their hosting services**, which may receive network information such as your IP address. GitHub import contacts GitHub’s API. Third-party widget setup and availability are managed by their maintainers.

## Architecture

See [docs/architecture.md](docs/architecture.md). Vite builds a small JavaScript application using native Custom Elements and shared CSS. Pure serialization, state, import, parsing, and compatibility modules are separate from the interface. Marked parses GFM, highlight.js highlights code, and DOMPurify sanitizes the result.

**Rust/WASM is intentionally deferred.** JavaScript handles the current document workload without a demonstrated architectural reason to add a second toolchain. Analysis remains a pure module that can later gain a WASM implementation with a JavaScript fallback. No consumer requires Rust.

## Test and build

```sh
npm test
npx playwright install chromium firefox webkit
npm run test:browser        # Chromium
npm run test:browser:all    # Chromium, Firefox, WebKit
npm run build
npm run test:static         # root and repository subpath hosting
npm run preview
```

Unit tests cover serializers, templates, sanitization, warnings, section splitting, document statistics, raw/block ownership, drafts, import errors, Unicode, and 100 KB documents. Playwright covers the showcase acceptance workflow, badges, projects, stack/social/widget/picture builders, themes, preview sizes, raw editing, history, import, storage, export, and mobile layout. GitHub responses and badge images are mocked; tests do not depend on live GitHub.

GitHub Actions runs unit tests, browser tests, the production build, and static-hosting smoke checks. Release branches run all three browser engines; other branches use Chromium. It does not deploy. See [contributor notes](docs/contributing.md) for formatting, fixtures, and test commands.

Browser tests start their own server on port 4317 and refuse to reuse an unrelated running server. Set `README_STUDIO_TEST_PORT` to another unused port if needed.

## Static deployment

`npm run build` creates `dist/`. Serve that directory with any static host.

- **GitHub Pages:** upload the contents of `dist/` using your preferred Pages workflow or publishing branch. Configure Pages separately; CI never publishes automatically.
- **Netlify:** build command `npm run build`, publish directory `dist`. A `netlify.toml` is included.

Vite uses `base: './'`, so built assets work at repository subpaths. There is no application router requiring server rewrites, no server runtime, and no runtime environment configuration.

## v0.1 limitations

- Preview approximates GitHub; it is not pixel-for-pixel parity. GitHub may apply different sanitization and rendering policies.
- Local relative assets cannot be loaded from sibling files. GitHub imports resolve them in preview using saved source context. Cross-source reference definitions and HTML spanning different source contexts may render differently; exports preserve the text.
- Arbitrary Markdown does not round-trip into specialized forms automatically. Raw editing preserves text as Custom Markdown.
- Health is heuristic, not an exhaustive HTML validator, accessibility audit, or network link checker.
- Local and GitHub Markdown import is limited to 2 MB. The baseline editing target is 100 KB, with additional 250 KB smoke coverage; there is no editor virtualization.
- No OAuth, GitHub writes, accounts, AI generation, backend, cloud sync, collaboration, full banner designer, or direct widget-service integration.

## Third-party tools

Badge output uses [Shields.io](https://shields.io). The widget catalog keeps visible links to its upstream projects; README Studio does not copy their code or proxy their services. Dependency licenses are retained in installed packages. See [CHANGELOG.md](CHANGELOG.md) for release notes.

### Badge Studio (v0.2.0)

Open **Badge Studio** in the header or from a builder section. Search a logo, choose an editable preset, and adjust label/message colors, logo, style, link, and alt text. Enable light/dark pairs for GitHub-compatible picture markup. Copy Markdown/HTML or insert at the cursor, into a badge row, or at the end of a selected section. Selected text is preserved. Build and deployment presets are static examples, not verified status badges. Preview images contact Shields directly; your draft is never sent. See [the badge guide](docs/badges.md).

### Badge collections (v0.2.1)

Save badges into named collections, or open **Collections** for editable starters and keyboard management. Import/export collection JSON, choose plain/centered/picture/category markup, and preview wrapping. Stack builder can save categories and insert saved collections. Insertions are independent copies.

### Dynamic badge helpers (v0.2.2)

Open **Dynamic badge helpers** inside Badge Studio for GitHub Actions/repository stats, npm, crates.io, PyPI, Docker, Netlify, or a public JSON endpoint. Choose a helper, enter its fields, then generate. Repository suggestions are opt-in. Customize colors, style, alt text and click-through link before insertion or collection saving. Generation validates formats locally; a preview image does not guarantee a successful workflow or correct status.

### Badge reliability (v0.2.3)

Badge guidance flags generic/missing alt text, likely low contrast, duplicate technologies/URLs, repeated status badges, and crowded rows. Suggestions never block export or remove content. Contrast estimates are advisory, not WCAG certification. Collection previews offer desktop/narrow/mobile widths and cap remote images for large groups. All-drafts backups include versioned collections; malformed storage opens a temporary recoverable workspace without overwriting originals. See [the badge guide](docs/badges.md) and [release checkpoints](docs/releases/0.2.x.md).

### Project Showcase Studio (v0.3.0)

Open **Project Studio** from the header or an existing project builder. Describe the project, your role, engineering highlights, technologies, links, status, screenshots, and badges. Review the live section, then save explicitly; Undo restores the prior source. Existing project blocks keep their exact Markdown until you save their richer representation. See [the project guide](docs/projects.md).

### GitHub project import (v0.3.1)

Project Studio can review public repositories by owner/repository or from the public repository list cached by GitHub Autofill. Filter/select multiple repositories, choose fields, confirm duplicates, and apply to the working showcase before saving. Refresh changes only untouched imported fields; your role, highlights, and manual edits remain yours.

Project Studio now includes seven presentation choices, public GitHub import with field review and safe refresh, project Health guidance, optional link checks, search and bulk controls, and portable project packs. See the [project guide](docs/projects.md). Collapsed project forms and screenshots are deferred for larger showcases. Project packs append reviewed copies; full workspace backups retain draft structure and project metadata.

Visual Theme Studio coordinates generated badge colors and builder section accents with draft-specific palettes. It does not recolor GitHub or rewrite Custom Markdown. Save reusable themes, banner presets, and visual bundles; review before applying, or export/import versioned theme and visual packs. A local gallery shows named light/dark samples. See [themes and inheritance](docs/themes.md).

[Banner Builder](docs/banners.md) generates deterministic local SVG light/dark assets. Download them, commit them to your repository, and insert the provided picture markup.

[Section styling](docs/section-styling.md) adds per-section heading/divider overrides, callouts, collapsible details, code samples, and compact two-column helpers.

## Reusable README components

[Component Library](docs/components.md) provides searchable starters, categories, favorites, recently used items, exact-source custom snippets, preview/source inspection and explicit insertion positions. Reusable snippets persist locally and join workspace backups.

[Dynamic Widget Hub](docs/widgets.md) provides attributed setup guides, a generic image/picture assistant and Typing SVG fields. Preview requests go directly to remote image hosts only when requested; provider configuration stays upstream.

[Portable snippet packs](docs/snippet-packs.md) export selected snippets, badge collections and draft-section copies as JSON. Review imported contents and choose Keep both, Replace or Skip for collisions. Four example kits provide editable starting points.

Supported components inserted as sections reopen with **Edit visually**. Template fields, widget helpers and badge row editors preserve independent settings. Save configured presets, duplicate them, or detach to exact Custom Markdown. Current/generated source review prevents silent overwrite when stored source has diverged.

Repository-aware authoring is available from **Repositories**. Browse cached GitHub Autofill data or explicitly fetch public owner/repository metadata, select repositories, and review projects, lists, badges, links or technology suggestions before insertion. See [GitHub-aware authoring](docs/github-aware.md).

**Profile Intelligence** offers explainable opportunities from loaded public data, with per-draft dismissal and reviewed contact links. It never auto-writes your README.

**Check links** explicitly scans README repositories, links and remote images, with bounded requests and clear uncertainty when browser policy prevents verification.

**Refresh GitHub data** inventories generated sources and previews selected public metadata changes. Manual fields are preserved; detached sections can be explicitly recreated by appending a new version. Apply is undoable, and source metadata stays out of README export. See [refreshing safely](docs/refreshing.md).

### README Analyzer (0.7.0)

Health provides category views, neutral statistics, section inventories and source jumps. Findings explain their reasoning and remain advisory; analysis never fetches remote URLs or changes source. See [the analyzer guide](docs/analyzer.md).
