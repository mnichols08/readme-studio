# README Studio

A visual GitHub profile README builder and Markdown studio. Build a profile with editable sections, work directly in Markdown, and export an ordinary `README.md` that works without this app.

**Version 0.1.2** · Native Web Components · Local drafts · Static hosting

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
- Shields badges and editable badge rows, including light/dark colors and image variants.
- Searchable technology catalog with aliases, custom technologies, categories, badges, code chips, and text lists.
- Social badges, plain links, and centered contact lines.
- Multi-project showcases with compact, detailed, and table-card layouts, screenshots, highlights, status Markdown, and custom links.
- Widget embeds for Constellation, Metrics, Snake, Typing SVG, Streak Stats, GitHub Stats, and Activity Graph. Setup instructions link to the original projects.
- Light/dark `<picture>` markup with alt text, dimensions, links, and alignment.

Choose Minimal, Developer Showcase, Open Source, Student, or Terminal on first launch, import a public GitHub README, or start blank. The sample uses fictional placeholder content. Developer Showcase follows the structural patterns described for [the reference profile](https://github.com/mnichols08/mnichols08), without copying its personal text.

## Editing and drafts

The Markdown editor preserves formatting and supports undo/redo and two-space Tab insertion. **Shift+Tab leaves the editor**, so keyboard users are never trapped. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes; Ctrl/Cmd+S saves. Alt+1–4 selects Build, Markdown, Preview, or Health on mobile. Section controls provide keyboard reordering, duplication, removal, and copying. The builder can collapse on desktop.

Builder-created documents retain editable block settings. **Editing raw Markdown turns the document into one Custom Markdown block**. This deliberately gives manual text priority: new builder sections append to the preserved text. Undo restores the previous block state. “Split into sections” explicitly divides raw content into Custom Markdown sections and preserves its exact text; it does not infer structured form fields.

Drafts and theme/preview settings autosave to this browser’s localStorage. Use the menu beside the draft name to rename, duplicate, delete, or create drafts. Download a JSON draft backup to retain builder settings; Markdown export preserves only the portable document. Clearing browser storage removes drafts. Storage failures are reported without silently claiming a successful save.

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

Existing v0.1.0 drafts and JSON backups remain readable without a format migration. Older bio/contact fields without ownership records are treated conservatively as custom content. See [0.1.1 release scope and verification](docs/releases/0.1.1.md). The next milestones are 0.1.2 Import Intelligence and 0.1.3 Foundation Hardening; later capability work is intentionally excluded from this patch.

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
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

Unit tests cover serializers, templates, sanitization, warnings, section splitting, document statistics, raw/block ownership, drafts, import errors, Unicode, and 100 KB documents. Playwright covers the showcase acceptance workflow, badges, projects, stack/social/widget/picture builders, themes, preview sizes, raw editing, history, import, storage, export, and mobile layout. GitHub responses and badge images are mocked; tests do not depend on live GitHub.

GitHub Actions runs tests, browser tests, and the production build. It does not deploy.

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
- Local and GitHub Markdown import is limited to 2 MB. The tested editing target is 100 KB; there is no editor virtualization.
- No OAuth, GitHub writes, accounts, AI generation, backend, cloud sync, collaboration, full banner designer, or direct widget-service integration.

## Third-party tools

Badge output uses [Shields.io](https://shields.io). The widget catalog keeps visible links to its upstream projects; README Studio does not copy their code or proxy their services. Dependency licenses are retained in installed packages. See [CHANGELOG.md](CHANGELOG.md) for release notes.
