import { saveProjectDialog, openProjectDialog } from "../studio-projects/ui.js";
import { bindDialogDismissal } from "./dialog-dismissal.js";
import { installWorkspace } from "../workspace/ui.js";
import "./workflow-builder.js";
import "./publish-dialog.js";
import "./refactor-dialog.js";
import "./compatibility-lab.js";
import "./refresh-center.js";
import { invalidateHealth } from "../github/health-cache.js";
import "./repository-health.js";
import "./profile-suggestions.js";
import { dismissSuggestion } from "../github/suggestions.js";
import "./repository-authoring.js";
import "./component-customizer.js";
import {
  instanceFromDetail,
  instanceBlock,
  detachBlock,
} from "../component-instances/ownership.js";
import "./snippet-pack-dialog.js";
import { importPack } from "../snippets/pack-schema.js";
import "./widget-hub.js";
import "./component-library.js";
import {
  validateComponents,
  usedComponent,
} from "../components-library/storage.js";
import { insertion } from "../components-library/insertion.js";
import "./visual-preset-gallery.js";
import {
  validateVisualLibrary,
  mergeVisualLibraries,
  emptyLibrary,
  applyVisualPreset,
  bannerVisual,
} from "../themes/visual-library.js";
import "./section-style-editor.js";
import "./banner-builder.js";
import { newBanner, themePalette } from "../banners/banner-model.js";
import "./theme-studio.js";
import { baseTheme } from "../themes/theme-model.js";
import {
  themeBlocks,
  badgeDefaults,
  derive,
} from "../themes/theme-resolver.js";
import "./project-studio.js";
import { repositorySuggestions } from "../badges/providers/index.js";
import "./badge-collection-editor.js";
import {
  validateCollection,
  validateCollections,
  collectionName,
  collectionMarkdown,
} from "../badges/collections.js";
import "./badge-studio.js";
import { html, createBlock, serializeBlock } from "../markdown/serialize.js";
import { detectSections } from "../markdown/sections.js";
import { splitDraft, draftSnapshot } from "../state/import-plan.js";
import "./import-dialog.js";
import { Store } from "../state/store.js";
import { newDraft, readDrafts, saveDrafts } from "../state/drafts.js";
import { template, templateNames } from "../data/templates.js";
import { blockTypes, defaults } from "./builder-form.js";
import "./markdown-editor.js";
import "./github-preview.js";
import "./readme-health.js";
import { profileDraftSnapshot } from "./github-profile-form.js";
import { version } from "../../package.json";
import {
  createBackup,
  restoreWorkspace,
  validateWorkspace,
  uniqueName,
  BACKUP_LIMIT,
} from "../state/workspace-backup.js";
import { safeFilename } from "../state/download.js";
import { contextForBlock } from "../markdown/source-context.js";
export class AppShell extends HTMLElement {
  connectedCallback() {
    let saved;
    try {
      saved = readDrafts();
    } catch (e) {
      this.storageError =
        e.raw !== undefined
          ? e.message
          : "Browser storage is unavailable. This temporary workspace stays in memory; download all drafts before closing this tab.";
      this.recoveryRaw = e.raw;
      saved = e.recovered;
      this.storageBlocked = true;
    }
    const draft = newDraft("My developer profile", template());
    this.data = saved || {
      version: 1,
      drafts: [draft],
      active: draft.id,
      settings: { theme: "light", preview: "1012" },
    };
    this.data.settings = {
      theme: "light",
      preview: "1012",
      ...this.data.settings,
    };
    this.data.badgeCollections ||= { version: 1, items: [] };
    this.draw();
    this.load(this.data.active);
    this.mobile(this.data.settings.pane || "build", false);
    window.addEventListener("pagehide", () => this.save());
    if (!saved) this.welcome();
    if (this.storageError) this.storageNotice(this.storageError);
    this.onRuntimeError = () => this.runtimeError();
    window.addEventListener("error", this.onRuntimeError);
    window.addEventListener("unhandledrejection", this.onRuntimeError);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.save();
    });
  }
  disconnectedCallback() {
    document.removeEventListener("keydown", this.onWorkspaceKeydown);
    window.removeEventListener("error", this.onRuntimeError);
    window.removeEventListener("unhandledrejection", this.onRuntimeError);
  }
  draw() {
    this.innerHTML = `<header class="app-header"><a class="brand" href="#" aria-label="README Studio home"><span class="brand-mark">M<span>↓</span></span><span>README <b>Studio</b><small>YOUR PROFILE, IN YOUR WORDS.</small></span></a><span class="version">v${version}</span><div class="header-actions"><button data-action="workflows">Workflows</button><button data-action="publish-github">Publish to GitHub</button><button data-action="refresh-github">Refresh GitHub data</button><button data-action="repository-health">Check links</button><button data-action="intelligence">Profile Intelligence</button><button data-action="repositories">Repositories</button><button data-action="snippet-packs">Snippet packs</button><button data-action="widgets">Widget Hub</button><button data-action="components">Components</button><button data-action="visual-presets">Visual presets</button><button data-action="section-style">Section style</button><button data-action="banner">Banner Builder</button><button data-action="visual-theme">Visual theme</button><button data-action="projects">Project Studio</button><button data-action="badges">Badge Studio</button><button data-action="collections">Collections</button><button data-action="import">↥ Import</button><button data-action="copy">Copy Markdown</button><button class="primary" data-action="download">↓ Export README</button><button data-action="theme" aria-label="Toggle color theme">◐</button></div></header>
  <div class="workspace-bar"><div class="draft-control"><span class="file-icon">▤</span><label class="sr-only" for="draft-select">Current draft</label><select id="draft-select"></select><button data-action="drafts" title="Manage drafts" aria-label="Manage drafts">···</button><span class="save-status">Not saved yet</span><span class="sr-only save-announcement" role="status" aria-atomic="true"></span></div><span class="local-label"><i></i> Local workspace <span>· No account needed</span></span></div>
  <nav class="mobile-nav" aria-label="Workspace panes"><button data-pane="build">Build</button><button data-pane="markdown">Markdown</button><button data-pane="preview">Preview</button><button data-pane="health">Health</button></nav>
  <div class="recovery-notice" hidden></div><div class="runtime-notice" hidden></div>
  <main class="workspace" data-mobile="build"><aside class="builder-pane pane" id="build-panel" aria-label="Builder"><div class="pane-heading"><span>WORKSPACE</span><button data-action="collapse" aria-label="Collapse builder">‹</button></div><nav class="builder-tabs" aria-label="Builder tools"><button class="active" data-tab="sections">Sections</button><button data-tab="library">Library</button><button data-tab="health">Health</button></nav><div class="builder-content"></div><div class="builder-footer"><span>✦</span> Make it yours. Keep it Markdown.</div></aside>
  <section class="editor-pane pane" id="markdown-panel" aria-label="Markdown editor panel"><div class="pane-heading"><span><span class="purple">M↓</span> README.md</span><div><button data-action="expand" aria-label="Show builder">☰</button><button data-action="undo" aria-label="Undo">↶</button><button data-action="redo" aria-label="Redo">↷</button><button data-action="copy-selection" title="Copy selected text">Copy selection</button></div></div><div class="editor-note">MARKDOWN <span>Editable. Portable. Always yours.</span></div><markdown-editor></markdown-editor><div class="editor-status"><span data-count></span><span>Markdown · UTF-8</span></div></section>
  <section class="preview-pane pane" id="preview-panel" aria-label="Preview panel"><div class="pane-heading"><span><i class="live-dot"></i> LIVE PREVIEW</span><span class="muted">GitHub style</span></div><div class="preview-toolbar"><label class="sr-only" for="preview-size">Preview size</label><select id="preview-size"><option value="1012">GitHub desktop</option><option value="760">Narrow README</option><option value="640">Tablet</option><option value="375">Mobile</option></select><span data-width>1012px max</span><button data-action="preview-theme" aria-label="Toggle preview color theme">◐</button></div><div class="preview-scroll"><div class="preview-paper"><div class="readme-label">▤ <strong>README</strong><span>.md</span></div><github-preview></github-preview></div></div><div class="preview-footer">Rendered locally <span>Approximate GitHub rendering</span></div></section></main>
  <div class="toast" role="status" hidden></div><dialog class="modal" aria-label="README Studio dialog"><button class="close-dialog" aria-label="Close dialog">×</button><div class="dialog-content"></div></dialog>`;
    this.editor = this.querySelector("markdown-editor");
    this.preview = this.querySelector("github-preview");
    this.content = this.querySelector(".builder-content");
    this.dialog = this.querySelector("dialog");
    installWorkspace(this);
    this.querySelector(".close-dialog").onclick = () => this.closeDialog();
    bindDialogDismissal(this.dialog, () => this.closeDialog());
    this.dialog.addEventListener("close", () => {
      if (this.dialog.open) return; // Ignore a queued close event from the previous dialog content.
      this.querySelector("import-dialog")?.cancel();
      this.querySelector("refresh-center")?.cancel();
      this.querySelector("refactor-dialog")?.cancel();
      this.querySelector("repository-health")?.controller?.abort();
      this.querySelector("repository-audit")?.cancel();
      this.querySelector("repository-authoring")?.controller?.abort();
      const target = this.afterDialogFocus || this.dialogTrigger;
      this.afterDialogFocus = null;
      if (target?.isConnected && target.getClientRects().length) target.focus();
      else this.querySelector("#draft-select").focus();
    });
    this.addEventListener("attention-download", (e) =>
      this.download(e.detail.content, e.detail.name, e.detail.type),
    );
    this.addEventListener("audit-improve", (e) => {
      const { repo, readme } = e.detail;
      if (e.detail.builder) {
        this.repositoryReadme(e.detail);
        return;
      }
      if (this.data.drafts.length >= 500) {
        this.notify(
          "Draft limit reached. Export and remove an unused draft first.",
          "warning",
        );
        return;
      }
      const [owner, repository] = repo.full_name.split("/");
      const source = {
        type: "github",
        owner,
        repository,
        ref: repo.default_branch,
        readmePath: readme.path || "README.md",
        sha: readme.sha,
        fetchedAt: new Date().toISOString(),
      };
      const block = createBlock("custom", { markdown: readme.source ?? "" });
      block.sourceContext = source;
      this.addDraft(`${repo.name} README`, [block], {
        repository: repo.full_name,
        importSource: source,
      });
      this.closeDialog();
      this.mobile("markdown", false);
      this.focusDocument();
      this.notify(
        "README opened in a new local draft. No GitHub changes were made.",
      );
    });
    this.addEventListener("import-apply", (e) => {
      const { plan, mode, name, snapshot } = e.detail;
      if (snapshot !== draftSnapshot(this.store.draft)) {
        this.notify("The draft changed. Preview the import again.");
        return;
      }
      if (mode === "new") this.addDraft(name, plan.blocks, plan.metadata);
      else this.store.blocks(plan.blocks, plan.metadata);
      this.closeDialog();
      this.focusDocument();
      this.notify(
        mode === "merge"
          ? "Merge applied. Use Undo to restore the previous draft."
          : "Import complete.",
      );
    });
    this.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.action) {
        b.focus();
        this.action(b.dataset.action);
      }
      if (b.dataset.tab) this.showTab(b.dataset.tab);
      if (b.dataset.pane) this.mobile(b.dataset.pane);
      if (b.dataset.blockType)
        this.edit({
          type: b.dataset.blockType,
          settings: defaults(b.dataset.blockType),
        });
      if (b.dataset.blockAction)
        this.blockAction(b.dataset.blockAction, b.dataset.id);
    };
    this.addEventListener("workflow-publish", (e) => {
      this.modal("<publish-dialog></publish-dialog>");
      this.querySelector("publish-dialog").configureWorkflow(
        this.store.draft,
        e.detail,
      );
    });
    this.addEventListener("workflow-insert", (e) => {
      this.store.blocks([
        ...structuredClone(this.store.draft.blocks),
        createBlock("custom", { markdown: e.detail.source }),
      ]);
      this.closeDialog();
      this.focusDocument();
      this.notify(
        "Workflow embed inserted. Commit and run the workflow on GitHub to create its images.",
      );
    });
    this.addEventListener("publish-restore", (e) => {
      this.addDraft(
        "Pre-publish recovery",
        [createBlock("custom", { markdown: e.detail.source })],
        {},
      );
      this.closeDialog();
      this.focusDocument();
      this.notify("Checkpoint restored as a new draft.");
    });
    this.addEventListener("publish-complete", ({ detail }) => {
      const draft = this.data.drafts.find((d) => d.id === detail.draftId);
      if (!draft) return;
      const { repository, branch, path, commitSha, sha } = detail.result;
      draft.metadata.publishing = {
        ...draft.metadata.publishing,
        [detail.kind === "workflow" ? "workflow" : "readme"]: {
          repository,
          branch,
          path,
          commitSha,
          ...(sha ? { sha } : {}),
        },
      };
      this.save();
    });
    this.addEventListener("publish-download", (e) =>
      this.download(e.detail.content, e.detail.name, e.detail.type),
    );
    this.addEventListener("refactor-cancel", () => this.closeDialog());
    this.addEventListener("refactor-apply", (e) => {
      if (
        e.detail.snapshot !== JSON.stringify(this.store.draft) ||
        e.detail.source !== this.store.draft.markdown
      ) {
        this.querySelector("refactor-dialog")?.fail(
          "The draft changed. Close and reopen Safe refactors before applying.",
        );
        return;
      }
      this.store.raw(e.detail.plan.newMarkdown);
      this.closeDialog(this.editor.input);
      this.mobile("markdown");
      this.focusDocument();
      this.notify(
        "Reviewed refactors applied. Undo restores source and builder ownership.",
      );
    });
    this.addEventListener("analysis-jump", (e) => {
      if (e.detail.source !== this.store.draft.markdown) {
        this.notify("The document changed. Wait for updated analysis.");
        return;
      }
      if (this.dialog.open) this.closeDialog(this.editor.input);
      this.mobile("markdown");
      this.editor.input.focus();
      this.editor.input.setSelectionRange(
        e.detail.sourceRange.start,
        e.detail.sourceRange.end,
      );
    });
    this.addEventListener("markdown-change", (e) => {
      const detached =
        e.detail !== this.store.draft.markdown &&
        this.store.draft.blocks.some((b) => b.type === "component");
      this.store.raw(e.detail);
      if (detached)
        this.notify(
          "Component source was manually edited and is now Custom Markdown. Undo restores visual ownership.",
        );
    });
    this.addEventListener("undo", () => this.store.undo());
    this.addEventListener("redo", () => this.store.redo());
    this.addEventListener("refresh-apply", (e) => {
      if (e.detail.snapshot !== JSON.stringify(this.store.draft)) {
        this.notify(
          "Draft changed. Reopen Refresh GitHub data before applying.",
        );
        return;
      }
      const result = e.detail.result;
      this.store.blocks(result.blocks, result.metadata);
      invalidateHealth();
      this.closeDialog();
      this.focusDocument();
      this.notify(
        `Refresh applied. ${result.skipped.length} manually edited values or sections preserved. Undo restores the previous draft.`,
      );
    });
    this.addEventListener("suggestion-dismiss", (e) =>
      this.updateSuggestions(
        dismissSuggestion(this.store.draft.metadata, e.detail),
      ),
    );
    this.addEventListener("suggestion-reset", () =>
      this.updateSuggestions({
        ...this.store.draft.metadata,
        suggestionDismissals: {},
      }),
    );
    this.addEventListener("suggestion-open", (e) => {
      if (e.detail === "repositories") this.openRepositories();
      else if (e.detail === "projects") this.openProjects();
      else this.openComponents();
    });
    this.addEventListener("suggestion-links", (e) => {
      if (e.detail.snapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Profile Intelligence.");
        return;
      }
      this.store.blocks([
        ...this.store.draft.blocks,
        createBlock("social", {
          title: "Contact",
          style: "links",
          items: e.detail.links,
        }),
      ]);
      this.closeDialog();
      this.focusDocument();
      this.notify("Public contact links added.");
    });
    this.addEventListener("repository-apply", (e) => {
      const d = e.detail;
      if (d.snapshot !== JSON.stringify(this.store.draft)) {
        this.notify(
          "Draft changed. Reopen repository authoring before applying.",
        );
        return;
      }
      if (d.saveComponent) {
        const library = validateComponents(this.data.componentLibrary);
        library.snippets.push({
          version: 1,
          id: crypto.randomUUID(),
          name: d.block.githubGenerated.options.title || "Repository snippet",
          category: "GitHub",
          description: "Saved repository output snapshot",
          kind: "custom",
          template: serializeBlock(d.block),
          fields: [],
          tags: ["repository"],
        });
        if (!this.saveComponentLibrary({ library })) return;
      }
      const metadata = {
        ...this.store.draft.metadata,
        repositoryContext: d.repos,
      };
      this.store.blocks([...this.store.draft.blocks, d.block], metadata);
      this.closeDialog();
      this.focusDocument();
      this.notify("Repository output added. Undo restores the previous draft.");
    });
    this.addEventListener("profile-apply", (e) => {
      if (e.detail.snapshot !== profileDraftSnapshot(this.store.draft)) {
        this.notify(
          "The draft changed since this preview. Open GitHub autofill again to review the latest draft.",
        );
        return;
      }
      this.store.blocks(e.detail.blocks, e.detail.metadata);
      this.closeDialog();
      this.showTab("sections");
      this.save();
      this.notify(
        "GitHub profile applied. Use Undo to restore your previous draft.",
      );
    });
    this.addEventListener("commit", (e) => {
      const b = e.detail;
      const blocks = structuredClone(this.store.draft.blocks);
      if (b.id) {
        const i = blocks.findIndex((v) => v.id === b.id);
        if (i < 0) {
          this.notify("This section changed. Open it again before saving.");
          return;
        }
        blocks[i] = b;
      } else blocks.push(createBlock(b.type, b.settings));
      this.store.blocks(blocks);
      this.showTab("sections");
      this.content.querySelector(`[data-id="${b.id}"]`)?.focus();
      this.notify("Section saved to README");
    });
    this.addEventListener("cancel", (e) => {
      if (e.target.tagName === "BUILDER-FORM") {
        this.showTab("sections");
        this.content.querySelector("button")?.focus();
      }
    });
    this.addEventListener("open-project-studio", () =>
      this.openProjects(this.selectedBlock),
    );
    this.addEventListener("component-widget-helper", (e) => {
      if (
        this.querySelector("component-library")?.isDirty() &&
        !confirm("Discard unsaved component fields and open the widget helper?")
      )
        return;
      this.openWidgets();
      const hub = this.querySelector("widget-hub");
      if (e.detail.preset)
        hub.loadPreset(e.detail.preset, this.data.componentLibrary);
      else hub.open(e.detail.provider);
    });
    this.addEventListener("component-edit-apply", (e) =>
      this.applyComponentEdit(e.detail),
    );
    this.addEventListener("snippet-pack-import", (e) =>
      this.applySnippetPack(e.detail),
    );
    this.addEventListener("component-library-save", (e) =>
      this.saveComponentLibrary(e.detail),
    );
    this.addEventListener("component-insert", (e) =>
      this.insertComponent(e.detail),
    );
    this.addEventListener("visual-library-save", (e) =>
      this.saveVisualLibrary(e.detail.library, e.detail.message),
    );
    this.addEventListener("save-reusable-visual", (e) => {
      try {
        const incoming = emptyLibrary();
        incoming[e.detail.kind].push({
          id: crypto.randomUUID(),
          name: e.detail.name,
          ...(e.detail.theme ? { theme: e.detail.theme } : {}),
          ...(e.detail.banner ? { banner: bannerVisual(e.detail.banner) } : {}),
        });
        this.saveVisualLibrary(
          mergeVisualLibraries(this.data.visualLibrary, incoming),
          "Reusable preset saved locally.",
        );
      } catch (error) {
        this.notify(error.message);
      }
    });
    this.addEventListener("visual-preset-apply", (e) => {
      if (this.presetSnapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Visual presets before applying.");
        return;
      }
      try {
        const next = applyVisualPreset(this.store.draft, e.detail.preset, {
          reset: e.detail.reset,
        });
        this.store.blocks(next.blocks, next.metadata);
        this.closeDialog();
        this.notify(
          "Visual preset applied. README content is preserved; Undo is available.",
        );
      } catch (error) {
        e.target.status(error.message);
      }
    });
    this.addEventListener("visual-download", (e) =>
      this.download(e.detail.content, e.detail.name, e.detail.type),
    );
    this.addEventListener("section-style-save", (e) => {
      if (this.styleSnapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Section Styling before saving.");
        return;
      }
      const blocks = structuredClone(this.store.draft.blocks),
        b = blocks.find((b) => b.id === e.detail.id);
      if (!b || b.type === "custom") return;
      b.settings.presentation = e.detail.settings.presentation;
      if (b.type === "divider") {
        b.settings.dividerStyle = e.detail.settings.dividerStyle;
        b.settings._theme ||= { derived: {}, overrides: [] };
        if (
          e.detail.settings.presentation._theme?.overrides?.includes("divider")
        )
          b.settings._theme.overrides.push("dividerStyle");
        else
          derive(
            b.settings,
            { dividerStyle: e.detail.settings.dividerStyle },
            { reset: true },
          );
      }
      this.store.blocks(blocks);
      e.target.initial = JSON.stringify(e.target.value);
      this.closeDialog();
      this.notify("Section style saved. Undo is available.");
    });
    this.addEventListener("banner-save", (e) => {
      if (this.bannerSnapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Banner Builder before saving.");
        return;
      }
      const blocks = structuredClone(this.store.draft.blocks);
      let bannerReference = this.store.draft.metadata.bannerReference;
      if (e.detail.markdown) {
        const block = createBlock("custom", { markdown: e.detail.markdown });
        blocks.push(block);
        bannerReference = { blockId: block.id, source: e.detail.markdown };
      }
      this.store.blocks(blocks, {
        ...this.store.draft.metadata,
        bannerSettings: e.detail.banner,
        ...(bannerReference ? { bannerReference } : {}),
      });
      this.bannerSnapshot = JSON.stringify(this.store.draft);
      e.target.initial = JSON.stringify(e.target.value);
      if (e.detail.markdown) {
        this.closeDialog();
        this.focusDocument();
        this.notify(
          "Banner markup inserted. Commit the downloaded SVG files at the shown paths.",
        );
      } else e.target.status("Banner settings saved in this draft.");
    });
    this.addEventListener("theme-apply", (e) => {
      if (this.visualSnapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Theme Studio before applying.");
        return;
      }
      const { theme, reset } = e.detail;
      const next = applyVisualPreset(this.store.draft, { theme }, { reset });
      this.store.blocks(next.blocks, next.metadata);
      e.target.initial = JSON.stringify(e.target.value);
      this.closeDialog();
      this.notify(
        "Visual theme applied. Explicit overrides were preserved unless reset. Undo is available.",
      );
    });
    this.addEventListener("project-save", (e) => {
      const studio = e.target;
      if (this.projectSnapshot !== JSON.stringify(this.store.draft)) {
        this.notify("Draft changed. Reopen Project Studio before saving.");
        return;
      }
      const blocks = structuredClone(this.store.draft.blocks),
        index = blocks.findIndex((b) => b.id === this.projectBlockId);
      if (index >= 0) blocks[index].settings = e.detail;
      else blocks.push(createBlock("projects", e.detail));
      this.store.blocks(blocks);
      studio.initial = JSON.stringify(studio.value);
      this.closeDialog();
      this.focusDocument();
      this.notify("Project showcase saved. Use Undo to restore it.");
    });
    this.addEventListener("collections-save", (e) =>
      this.saveCollections(e.detail),
    );
    this.addEventListener("project-pack-export", (e) =>
      this.download(
        JSON.stringify(e.detail, null, 2),
        "projects.showcase.json",
        "application/json",
      ),
    );
    this.addEventListener("collection-export", (e) =>
      this.download(
        JSON.stringify(e.detail, null, 2),
        e.detail.name + ".collection.json",
        "application/json",
      ),
    );
    this.addEventListener("collection-insert", (e) =>
      this.insertCollection(e.detail),
    );
    this.addEventListener("collection-add-badge", (e) => {
      try {
        const items = structuredClone(this.data.badgeCollections.items);
        let c = items.find((c) => c.id === e.detail.id);
        if (!c) {
          c = validateCollection({
            version: 1,
            type: "badge-collection",
            name: collectionName(e.detail.name || "My collection", items),
            badges: [],
          });
          items.push(c);
        }
        c.badges.push(e.detail.badge);
        this.saveCollections(items);
        const studio = this.querySelector("badge-studio");
        if (studio) {
          studio.suggestions = repositorySuggestions(this.store.draft);
          studio.querySelector("dynamic-badge-builder").suggestions =
            studio.suggestions;
          studio.querySelector("dynamic-badge-builder").fields();
          studio.collections = this.data.badgeCollections.items;
          studio.collectionControls();
        }
      } catch (error) {
        this.notify(error.message);
      }
    });
    this.addEventListener("stack-collection-save", (e) => {
      const c = validateCollection({
        version: 1,
        type: "badge-collection",
        name: collectionName(e.detail.name, this.data.badgeCollections.items),
        badges: e.detail.badges,
      });
      this.saveCollections([...this.data.badgeCollections.items, c]);
    });
    this.addEventListener("open-collections", () =>
      this.openCollections(this.selectedBlock),
    );
    this.addEventListener("badge-insert", (e) => this.insertBadge(e.detail));
    this.addEventListener("open-badge-studio", () =>
      this.openBadges(this.selectedBlock),
    );
    this.addEventListener("copy-markup", (e) => this.copy(e.detail));
    this.querySelector("#draft-select").onchange = (e) =>
      this.load(e.target.value);
    this.querySelector("#preview-size").onchange = (e) => {
      this.data.settings.preview = e.target.value;
      this.applySettings();
      this.save();
    };
    this.onWorkspaceKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ["p", "e"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (this.dialog.open) {
          this.closeDialog();
          if (this.dialog.open) return;
        }
        this.action(
          e.key.toLowerCase() === "p" ? "publish-github" : "download",
        );
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this.save();
      }
      if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        this.mobile(
          ["build", "markdown", "preview", "health"][Number(e.key) - 1],
        );
      }
    };
    document.addEventListener("keydown", this.onWorkspaceKeydown);
    this.querySelector('[data-pane="build"]').setAttribute(
      "aria-pressed",
      "true",
    );
    this.applySettings();
  }
  applySettings() {
    this.querySelectorAll("[data-tool-group]").forEach((el) => {
      el.open = !this.data.settings.closedGroups?.includes(
        el.dataset.toolGroup,
      );
    });
    this.querySelector(".workspace").classList.toggle(
      "collapsed",
      !!this.data.settings.collapsed,
    );
    this.editor.style.setProperty(
      "--editor-font",
      `${this.data.settings.editorFont || 13}px`,
    );
    document.documentElement.classList.toggle(
      "reduce-motion",
      !!this.data.settings.reduceMotion,
    );
    document.documentElement.dataset.theme = this.data.settings.theme;
    this.querySelector("#preview-size").value = this.data.settings.preview;
    this.querySelector(".preview-paper").style.maxWidth =
      this.data.settings.preview + "px";
    this.querySelector("[data-width]").textContent =
      this.data.settings.preview + "px max";
    this.querySelector(".preview-paper").dataset.theme =
      this.data.settings.previewTheme || this.data.settings.theme;
    this.preview?.applyTheme();
    this.querySelector('[data-action="theme"]').setAttribute(
      "aria-pressed",
      String(this.data.settings.theme === "dark"),
    );
    this.querySelector('[data-action="preview-theme"]').setAttribute(
      "aria-pressed",
      String(
        (this.data.settings.previewTheme || this.data.settings.theme) ===
          "dark",
      ),
    );
  }
  load(id) {
    if (this.store) this.save();
    clearTimeout(this.saveTimer);
    clearTimeout(this.healthTimer);
    clearTimeout(this.updateTimer);
    this.store = new Store(this.data.drafts.find((d) => d.id === id));
    this.data.active = id;
    this.store.addEventListener("change", (e) => {
      this.data.drafts[this.data.drafts.findIndex((d) => d.id === id)] =
        this.store.draft;
      this.editor.value = this.store.draft.markdown;
      this.querySelector(".save-status").textContent = "Saving…";
      clearTimeout(this.updateTimer);
      this.updateTimer = setTimeout(() => {
        this.refreshDocument();
      }, 180);
      clearTimeout(this.healthTimer);
      this.healthTimer = setTimeout(() => this.refreshHealth(), 600);
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.save(), 900);
      if (
        e.detail === "raw" &&
        this.tab !== "health" &&
        !this.content.querySelector(".ownership")
      )
        this.showTab("sections");
      else if (e.detail !== "raw")
        this.showTab(this.tab === "health" ? "health" : "sections");
    });
    this.editor.value = this.store.draft.markdown;
    this.refreshDocument();
    this.showTab("sections");
    this.draftOptions();
    this.save();
  }
  focusDocument() {
    const target = this.editor.getClientRects().length
      ? this.editor.input
      : this.querySelector('[data-action="command-palette"]');
    this.afterDialogFocus = target;
    target.focus();
  }
  refreshDocument() {
    this.preview.draft = this.store.draft;
    this.querySelector("[data-count]").textContent =
      `${this.store.draft.markdown.split("\n").length} lines · ${this.store.draft.markdown.length.toLocaleString()} characters`;
  }
  refreshHealth() {
    if (this.tab === "health" && this.content.querySelector("readme-health"))
      this.content.querySelector("readme-health").draft = this.store.draft;
  }
  save() {
    clearTimeout(this.saveTimer);
    if (this.storageBlocked) {
      this.querySelector(".save-status").textContent =
        "Temporary workspace · export to keep work";
      return false;
    }
    try {
      saveDrafts(this.data);
      this.querySelector(".save-status").textContent = "Saved locally";
      if (
        !this.lastSaveAnnouncement ||
        Date.now() - this.lastSaveAnnouncement > 5000
      ) {
        this.querySelector(".save-announcement").textContent =
          "Draft saved locally.";
        this.lastSaveAnnouncement = Date.now();
      }
      this.querySelector(".recovery-notice").hidden = true;
      return true;
    } catch {
      this.querySelector(".save-status").textContent =
        "Save failed · export to keep work";
      this.storageNotice(
        "Local storage is full or unavailable. Your current work remains in memory. Download all drafts before closing this tab.",
      );
      return false;
    }
  }
  storageNotice(message) {
    const el = this.querySelector(".recovery-notice");
    if (el.dataset.message !== message) {
      el.dataset.message = message;
      el.innerHTML = `<p role="alert">${html(message)}</p><button data-action="backup-all">Download all drafts backup</button><button data-action="restore">Restore backup</button>${this.recoveryRaw !== undefined ? '<button data-action="recovery-download">Download original recovery data</button>' : ""}`;
    }
    el.hidden = false;
  }
  runtimeError() {
    const el = this.querySelector(".runtime-notice");
    if (!el || !el.hidden) return;
    el.innerHTML =
      '<p role="alert">README Studio hit an unexpected error. Your source may still be available. Download it before reloading.</p><button data-action="download">Download current draft</button><button data-action="reload">Reload</button>';
    el.hidden = false;
  }
  closeDialog(target) {
    if (
      (this.querySelector("badge-collection-editor")?.isDirty() ||
        this.querySelector("project-studio")?.isDirty() ||
        this.querySelector("theme-studio")?.isDirty() ||
        this.querySelector("banner-builder")?.isDirty() ||
        this.querySelector("section-style-editor")?.isDirty() ||
        this.querySelector("component-library")?.isDirty() ||
        this.querySelector("widget-hub")?.isDirty() ||
        this.querySelector("component-customizer")?.isDirty()) &&
      !confirm(
        "Discard unsaved studio edits? Save or export your work to keep it.",
      )
    )
      return;
    this.afterDialogFocus = target || this.dialogTrigger;
    this.dialog.close();
  }
  draftOptions() {
    this.querySelector("#draft-select").innerHTML = this.data.drafts
      .map(
        (d) =>
          `<option value="${html(d.id)}" ${d.id === this.data.active ? "selected" : ""}>${html(d.name)}</option>`,
      )
      .join("");
  }
  saveCollections(items) {
    try {
      const collections = validateCollections({ version: 1, items });
      if (this.storageBlocked)
        throw new Error(
          "Storage recovery is active. Export this collection before closing; restore workspace storage before saving collections.",
        );
      const plan = { ...this.data, badgeCollections: collections };
      saveDrafts(plan);
      this.data.badgeCollections = collections;
      const collectionEditor = this.querySelector("badge-collection-editor");
      if (collectionEditor)
        collectionEditor.initial = JSON.stringify(collectionEditor.items);
      this.querySelector("badge-collection-editor")?.status(
        "Collections saved locally.",
      );
      this.notify("Collections saved locally.");
      return true;
    } catch (e) {
      this.querySelector("badge-collection-editor")?.status(
        "Could not save collections: " + e.message,
      );
      this.notify("Could not save collections: " + e.message);
      return false;
    }
  }
  saveComponentLibrary({
    library,
    message = "Component library saved.",
    savedSnippet = false,
  }) {
    try {
      if (this.storageBlocked)
        throw Error(
          "Storage recovery is active. Export recovery data before restoring storage.",
        );
      const next = validateComponents(library);
      saveDrafts({
        ...this.data,
        componentLibrary: next,
        drafts: this.data.drafts.map((d) =>
          d.id === this.store.draft.id ? this.store.draft : d,
        ),
      });
      this.data.componentLibrary = next;
      const customizer = this.querySelector("component-customizer");
      if (customizer) {
        customizer.library = next;
        customizer.status(message);
      }
      this.querySelector("widget-hub")?.accept(next, message);
      this.querySelector("component-library")?.accept(
        next,
        message,
        savedSnippet,
      );
      this.notify(message);
      return true;
    } catch (e) {
      this.querySelector("component-library")?.status(
        "Could not save components: " + e.message,
      );
      this.querySelector("component-customizer")?.status(
        "Could not save components: " + e.message,
      );
      this.querySelector("widget-hub")?.status(
        "Could not save components: " + e.message,
      );
      this.notify("Could not save components: " + e.message);
      return false;
    }
  }
  openComponentEditor(block) {
    this.componentEditId = block.id;
    this.componentEditSnapshot = JSON.stringify(block);
    this.modal("<component-customizer></component-customizer>");
    this.dialog.classList.add("import-modal");
    try {
      this.querySelector("component-customizer").configure(
        block,
        this.data.componentLibrary,
      );
    } catch {
      this.dialog.querySelector(".dialog-content").innerHTML =
        "<h1>Visual settings unavailable</h1><p>This component has unsupported settings. Its Markdown is preserved; edit source or export the draft.</p>";
    }
  }
  applyComponentEdit({ id, mode, instance }) {
    const customizer = this.querySelector("component-customizer"),
      blocks = structuredClone(this.store.draft.blocks),
      index = blocks.findIndex((b) => b.id === id);
    if (index < 0 || blocks[index].type !== "component") {
      customizer.status(
        "This component was detached or removed. Its Markdown remains yours; reopen the current section.",
      );
      return;
    }
    if (JSON.stringify(blocks[index]) !== this.componentEditSnapshot) {
      this.componentEditSnapshot = JSON.stringify(blocks[index]);
      customizer.reviewConflict(blocks[index]);
      return;
    }
    try {
      if (mode === "detach") blocks[index] = detachBlock(blocks[index]);
      else {
        const next = instanceBlock(instance);
        if (mode === "duplicate") blocks.splice(index + 1, 0, next);
        else blocks[index] = { ...blocks[index], settings: next.settings };
      }
      this.store.blocks(blocks);
      customizer.markSaved();
      this.closeDialog();
      this.focusDocument();
      this.notify(
        mode === "detach"
          ? "Component is now Custom Markdown; source preserved."
          : "Component saved. Undo restores the previous source.",
      );
    } catch (e) {
      customizer.status(e.message);
    }
  }
  openSnippetPacks() {
    this.modal("<snippet-pack-dialog></snippet-pack-dialog>");
    this.dialog.classList.add("import-modal");
    this.querySelector("snippet-pack-dialog").configure(
      this.data,
      this.store.draft,
    );
  }
  applySnippetPack({ pack, mode }) {
    try {
      if (this.storageBlocked)
        throw Error(
          "Storage recovery is active. Restore storage before importing reusable snippets.",
        );
      const next = importPack(this.data, pack, mode);
      saveDrafts({
        ...this.data,
        ...next,
        drafts: this.data.drafts.map((d) =>
          d.id === this.store.draft.id ? this.store.draft : d,
        ),
      });
      Object.assign(this.data, next);
      const dialog = this.querySelector("snippet-pack-dialog");
      dialog.configure(this.data, this.store.draft);
      dialog.status(
        "Snippet pack imported locally. Draft Markdown is unchanged.",
      );
      dialog.querySelector("[data-review-pack]").focus();
      this.notify("Snippet pack imported.");
    } catch (e) {
      this.querySelector("snippet-pack-dialog")?.status(
        "Could not import pack: " + e.message,
      );
    }
  }
  updateSuggestions(metadata) {
    this.store.checkpoint();
    this.store.draft.metadata = metadata;
    this.store.emit("metadata");
    this.querySelector("profile-suggestions")?.configure(this.store.draft);
    this.querySelector("profile-suggestions h1")?.setAttribute(
      "tabindex",
      "-1",
    );
    this.querySelector("profile-suggestions h1")?.focus();
    this.notify("Suggestion preferences updated for this draft.");
  }
  openRefresh() {
    this.modal("<refresh-center></refresh-center>");
    this.dialog.classList.add("import-modal");
    this.querySelector("refresh-center").configure(this.store.draft);
  }
  openRepositoryHealth() {
    this.modal("<repository-health></repository-health>");
    this.dialog.classList.add("import-modal");
    this.querySelector("repository-health").configure(this.store.draft);
  }
  openIntelligence() {
    this.modal("<profile-suggestions></profile-suggestions>");
    this.dialog.classList.add("import-modal");
    this.querySelector("profile-suggestions").configure(this.store.draft);
  }
  openRepositories() {
    this.modal("<repository-authoring></repository-authoring>");
    this.dialog.classList.add("import-modal");
    this.querySelector("repository-authoring").configure(this.store.draft);
  }
  openWidgets() {
    this.componentSnapshot = JSON.stringify(this.store.draft);
    this.componentCursor = this.editor.input.selectionStart;
    this.modal("<widget-hub></widget-hub>");
    this.dialog.classList.add("import-modal");
    this.querySelector("widget-hub").configure(this.data.componentLibrary);
  }
  openComponents() {
    this.componentSnapshot = JSON.stringify(this.store.draft);
    this.componentCursor = this.editor.input.selectionStart;
    const selection = this.editor.value.slice(
      this.editor.input.selectionStart,
      this.editor.input.selectionEnd,
    );
    this.modal("<component-library></component-library>");
    this.dialog.classList.add("import-modal");
    this.querySelector("component-library").configure({
      library: this.data.componentLibrary,
      blocks: this.store.draft.blocks,
      selectedBlock: this.selectedBlock,
      selection,
    });
  }
  insertComponent(detail) {
    if (
      this.querySelector("component-library")?.dirty &&
      !confirm("Insert this component and discard the unsaved My Snippet form?")
    )
      return;
    if (this.componentSnapshot !== JSON.stringify(this.store.draft)) {
      this.notify(
        "Draft changed. Reopen the component library before inserting.",
      );
      return;
    }
    try {
      const instance = instanceFromDetail(detail);
      const result = insertion(this.store.draft, detail.markdown, {
        instance,
        ...detail,
        cursor: this.componentCursor,
      });
      if (result.blocks) this.store.blocks(result.blocks);
      else this.store.raw(result.markdown);
      this.saveComponentLibrary({
        library: usedComponent(this.data.componentLibrary, detail.component.id),
        message: "Component inserted; recent usage saved.",
      });
      if (this.querySelector("component-library")) {
        this.querySelector("component-library").dirty = false;
        this.querySelector("component-library").composerDirty = false;
      }
      if (this.querySelector("widget-hub"))
        this.querySelector("widget-hub").dirty = false;
      this.closeDialog();
      this.focusDocument();
    } catch (e) {
      this.querySelector("component-library")?.status(e.message);
      this.querySelector("widget-hub")?.status(e.message);
    }
  }
  saveVisualLibrary(value, message) {
    try {
      if (this.storageBlocked)
        throw Error(
          "Storage recovery is active. Download recovery data or restore workspace storage before saving visual presets.",
        );
      const library = validateVisualLibrary(value),
        plan = {
          ...this.data,
          visualLibrary: library,
          drafts: this.data.drafts.map((d) =>
            d.id === this.store.draft.id ? this.store.draft : d,
          ),
        };
      saveDrafts(plan);
      this.data.visualLibrary = library;
      const gallery = this.querySelector("visual-preset-gallery");
      if (gallery) {
        gallery.value = library;
        gallery.status(message);
        gallery.querySelector("[data-visual-selected]").focus();
      }
      this.querySelector("theme-studio .theme-status")?.replaceChildren(
        document.createTextNode(message),
      );
      this.querySelector("banner-builder")?.status(message);
      this.notify(message);
      return true;
    } catch (e) {
      const message = "Could not save visual presets: " + e.message;
      this.querySelector("visual-preset-gallery")?.status(message);
      this.notify(message);
      return false;
    }
  }
  openVisualPresets() {
    this.presetSnapshot = JSON.stringify(this.store.draft);
    this.modal("<visual-preset-gallery></visual-preset-gallery>");
    this.dialog.classList.add("import-modal");
    const gallery = this.querySelector("visual-preset-gallery");
    gallery.draftTheme = this.store.draft.metadata.visualTheme || baseTheme;
    gallery.draftBanner =
      this.store.draft.metadata.bannerSettings || newBanner(gallery.draftTheme);
    gallery.value = this.data.visualLibrary;
  }
  openSectionStyle() {
    this.styleSnapshot = JSON.stringify(this.store.draft);
    this.modal("<section-style-editor></section-style-editor>");
    this.dialog.classList.add("import-modal");
    this.querySelector("section-style-editor").configure(
      this.store.draft.blocks,
      this.store.draft.metadata.visualTheme || baseTheme,
    );
  }
  openBanner() {
    this.bannerSnapshot = JSON.stringify(this.store.draft);
    this.modal("<banner-builder></banner-builder>");
    this.dialog.classList.add("import-modal");
    const builder = this.querySelector("banner-builder");
    builder.activeTheme = this.store.draft.metadata.visualTheme || baseTheme;
    try {
      builder.settings =
        this.store.draft.metadata.bannerSettings ||
        newBanner(builder.activeTheme);
    } catch {
      builder.settings = newBanner();
      this.notify(
        "Stored banner settings could not be read. Original Markdown remains available.",
      );
    }
  }
  openTheme() {
    this.visualSnapshot = JSON.stringify(this.store.draft);
    this.modal("<theme-studio></theme-studio>");
    this.dialog.classList.add("import-modal");
    try {
      this.querySelector("theme-studio").theme =
        this.store.draft.metadata.visualTheme || baseTheme;
    } catch {
      this.querySelector("theme-studio").theme = baseTheme;
      this.notify(
        "Stored theme could not be read. Choose a valid theme; original source is preserved.",
      );
    }
  }
  openProjects(id) {
    const block =
      this.store.draft.blocks.find(
        (b) => b.id === id && b.type === "projects",
      ) ||
      (!id ? this.store.draft.blocks.find((b) => b.type === "projects") : null);
    this.projectBlockId = block?.id;
    this.projectSnapshot = JSON.stringify(this.store.draft);
    this.modal("<project-studio></project-studio>");
    this.dialog.classList.add("import-modal");
    const studio = this.querySelector("project-studio");
    studio.availableRepositories = structuredClone(
      this.store.draft.metadata.githubProfile?.repositories || [],
    );
    studio.activeTheme = this.store.draft.metadata.visualTheme || baseTheme;
    studio.collections = structuredClone(this.data.badgeCollections.items);
    try {
      studio.settings = block?.settings || {
        title: "Selected Projects",
        items: [],
      };
    } catch (e) {
      studio.innerHTML =
        "<h1>Project data could not be opened</h1><p>Your original Markdown is preserved. Continue in the source editor or export it.</p>";
      studio.initial = JSON.stringify(studio.value);
    }
  }
  openCollections(stackId) {
    this.collectionStack = stackId;
    this.badgeCursor = this.editor.input.selectionStart;
    this.badgeSnapshot = this.store.draft.markdown;
    this.modal("<badge-collection-editor></badge-collection-editor>");
    this.dialog.classList.add("import-modal");
    const editor = this.querySelector("badge-collection-editor");
    editor.items = structuredClone(this.data.badgeCollections.items);
    editor.initial = JSON.stringify(editor.items);
    editor.selected = editor.items[0]?.id;
    editor.draw();
  }
  insertCollection(c) {
    const collectionEditor = this.querySelector("badge-collection-editor");
    if (collectionEditor?.isDirty()) {
      if (
        !confirm(
          "Insert this collection without saving its library edits? Save collection first to reuse those edits later.",
        )
      )
        return;
      collectionEditor.initial = JSON.stringify(collectionEditor.items);
    }
    if (this.badgeSnapshot !== this.store.draft.markdown) {
      this.notify("Draft changed. Reopen collections before inserting.");
      return;
    }
    const blocks = structuredClone(this.store.draft.blocks),
      stack = blocks.find(
        (b) => b.id === this.collectionStack && b.type === "stack",
      );
    if (stack) {
      stack.settings.items.push(
        ...c.badges.map((b) => ({
          ...b,
          name: b.name || b.label || b.alt,
          category: c.name,
        })),
      );
      this.store.blocks(blocks);
      this.closeDialog();
      this.focusDocument();
      this.notify("Collection inserted into stack. Use Undo to restore it.");
    } else
      this.insertBadge({ markdown: collectionMarkdown(c), target: "cursor" });
  }
  openBadges(selectedBlock) {
    this.badgeCursor = this.editor.input.selectionStart;
    this.badgeSnapshot = this.store.draft.markdown;
    this.modal("<badge-studio></badge-studio>");
    this.dialog.classList.add("import-modal");
    const studio = this.querySelector("badge-studio");
    studio.activeTheme = this.store.draft.metadata.visualTheme || baseTheme;
    if (this.store.draft.metadata.visualTheme)
      studio.badge = derive(studio.value, badgeDefaults(studio.activeTheme), {
        reset: true,
      });
    studio.blocks = structuredClone(this.store.draft.blocks);
    studio.selectedBlock = selectedBlock;
    studio.suggestions = repositorySuggestions(this.store.draft);
    studio.querySelector("dynamic-badge-builder").suggestions =
      studio.suggestions;
    studio.querySelector("dynamic-badge-builder").fields();
    studio.collections = this.data.badgeCollections.items;
    studio.collectionControls();
    studio.targets();
  }
  insertBadge({ badge, markdown, target }) {
    if (this.badgeSnapshot !== this.store.draft.markdown) {
      this.notify("The draft changed. Reopen Badge Studio before inserting.");
      return;
    }
    if (target === "cursor") {
      const source = this.store.draft.markdown;
      const at = Math.min(this.badgeCursor, source.length);
      this.store.raw(
        source.slice(0, at) + "\n\n" + markdown + "\n\n" + source.slice(at),
      );
    } else {
      const blocks = structuredClone(this.store.draft.blocks);
      const block = blocks.find((b) => b.id === target);
      if (!block) {
        this.notify("This section is no longer available.");
        return;
      }
      if (block.type === "badges") block.settings.items.push(badge);
      else {
        const source = serializeBlock(block);
        block.type = "custom";
        block.settings = { markdown: source + "\n\n" + markdown };
      }
      this.store.blocks(blocks);
    }
    this.closeDialog();
    this.focusDocument();
    this.notify("Badge added. Use Undo to restore the previous draft.");
  }
  showTab(tab) {
    this.tab = tab;
    this.querySelectorAll("[data-tab]").forEach(
      (b) => (
        b.classList.toggle("active", b.dataset.tab === tab),
        b.setAttribute("aria-pressed", String(b.dataset.tab === tab))
      ),
    );
    if (tab === "health") {
      this.content.innerHTML = "<readme-health></readme-health>";
      this.content.firstElementChild.draft = this.store.draft;
      return;
    }
    if (tab === "library") {
      this.content.innerHTML = `<div class="section-title"><h2>Build your story</h2><p>Good sections. Ordinary Markdown.</p></div><div class="library-grid">${Object.entries(
        blockTypes,
      )
        .map(
          ([type, name], i) =>
            `<button data-block-type="${type}"><span class="library-icon">${["H", "≡", "⌘", "↗", "▣", "◈", "⌁", "✎", "@", "—", "&lt;/&gt;", "◇", "▦", "◐", "!", "▸", "{}", "▥"][i]}</span><span>${name}</span><span>+</span></button>`,
        )
        .join(
          "",
        )}</div><button class="wide" data-action="components">Browse Component Library</button><button class="wide" data-action="templates">Browse templates →</button><button class="wide" data-action="banner">Open Banner Builder</button>`;
      return;
    }
    const blocks = this.store.draft.blocks;
    this.content.innerHTML = `<button class="profile-entry" data-action="profile">Autofill from GitHub ↗</button>${this.store.draft.metadata.importSource?.type === "github" ? '<button class="wide" data-action="reimport">Re-import current GitHub README</button>' : ""}<div class="section-title"><h2>Your sections <span>${blocks.length}</span></h2><p>Shape the story behind your code.</p></div><div class="block-list">${blocks.map((b, i) => `<article class="block-row"><button class="block-open" data-block-action="edit" data-id="${b.id}"><span class="block-number">${String(i + 1).padStart(2, "0")}</span><span><strong>${html(b.section?.title || (b.type === "component" ? "Edit visually: " + b.settings.name : blockTypes[b.type]) || "Section")}</strong><small>${html((b.section ? `Suggested ${b.section.kind} · Custom Markdown` : "") || b.settings.name || b.settings.title || (b.type === "custom" ? "Your original Markdown" : b.type === "stack" ? `${b.settings.items?.length || 0} technologies` : "Click to edit"))}</small></span></button><div class="block-actions"><button data-block-action="up" data-id="${b.id}" aria-label="Move ${html(b.type === "component" ? b.settings.name : blockTypes[b.type])} up" ${i === 0 ? "disabled" : ""}>↑</button><button data-block-action="down" data-id="${b.id}" aria-label="Move ${html(b.type === "component" ? b.settings.name : blockTypes[b.type])} down" ${i === blocks.length - 1 ? "disabled" : ""}>↓</button><button data-block-action="copy" data-id="${b.id}" aria-label="Copy ${html(b.type === "component" ? b.settings.name : blockTypes[b.type])}">⧉</button><button data-block-action="duplicate" data-id="${b.id}" aria-label="Duplicate ${html(b.type === "component" ? b.settings.name : blockTypes[b.type])}">+</button><button data-block-action="remove" data-id="${b.id}" aria-label="Remove ${html(b.type === "component" ? b.settings.name : blockTypes[b.type])}">×</button></div></article>`).join("")}</div>${!blocks.length ? '<div class="empty-state"><h3>Introduce yourself.</h3><p>Start with a Hero, add a few skills, then share what you’re building.</p></div>' : ""}<button class="add-section wide" data-tab="library">+ Add a section</button>${blocks.length === 1 && blocks[0].type === "custom" ? '<p class="hint ownership">Manual Markdown is preserved in a Custom Markdown block. New sections are appended.</p>' : ""}${this.store.draft.markdown ? '<button class="wide" data-action="split">Split into sections</button>' : ""}<div class="tip"><span>↳</span><p><strong>Built for GitHub READMEs</strong><br>Export a README.md that works anywhere. No lock-in, no extra setup.</p></div><button class="text-button" data-action="templates">Start from a template ↗</button>`;
  }
  edit(block) {
    if (block.type === "component") {
      this.selectedBlock = block.id;
      this.openComponentEditor(block);
      return;
    }
    if (block.type === "projects" && block.settings.version === 1) {
      this.openProjects(block.id);
      return;
    }
    this.selectedBlock = block.id;
    this.tab = "form";
    this.content.innerHTML = `<div class="section-title"><h2>${html(blockTypes[block.type])}</h2><p>Customize, preview, then add to your story.</p></div><builder-form></builder-form>`;
    try {
      this.content.querySelector("builder-form").block = block;
    } catch {
      this.content.innerHTML =
        '<h2>Section could not be opened</h2><p>Your Markdown is preserved. Edit it directly or export a backup.</p><button data-tab="sections">Back to sections</button>';
      this.notify(
        "This section has incompatible settings. The editor and export are still available.",
      );
    }
    this.content.scrollTop = 0;
    this.content.querySelector("input,textarea,select,button")?.focus();
  }
  blockAction(action, id) {
    const blocks = structuredClone(this.store.draft.blocks);
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    if (action === "edit") {
      this.edit(blocks[i]);
      return;
    }
    if (action === "copy") {
      this.copy(serializeBlock(blocks[i]));
      return;
    }
    if (action === "remove") blocks.splice(i, 1);
    if (action === "duplicate")
      blocks.splice(i + 1, 0, {
        ...createBlock(blocks[i].type, structuredClone(blocks[i].settings)),
        sourceContext: contextForBlock(blocks[i], this.store.draft.metadata),
        ...(blocks[i].section
          ? { section: structuredClone(blocks[i].section) }
          : {}),
      });
    if (action === "up" || action === "down") {
      const j = i + (action === "up" ? -1 : 1);
      if (j < 0 || j >= blocks.length) return;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    this.store.blocks(blocks);
    const target =
      this.content.querySelector(
        `[data-id="${id}"][data-block-action="${action}"]:not(:disabled)`,
      ) ||
      this.content.querySelector(`[data-id="${id}"]`) ||
      this.content.querySelector(".block-open") ||
      this.content.querySelector(".add-section");
    target?.focus();
    this.notify(
      action === "remove"
        ? "Section removed. Use Undo to restore it."
        : action === "duplicate"
          ? "Section duplicated."
          : "Section moved.",
    );
  }
  mobile(pane, focus = true) {
    this.data.settings.pane = pane;
    this.querySelector(".workspace").dataset.mobile = pane;
    this.querySelectorAll("[data-pane]").forEach(
      (b) => (
        b.classList.toggle("active", b.dataset.pane === pane),
        b.setAttribute("aria-pressed", String(b.dataset.pane === pane))
      ),
    );
    if (pane === "health") this.showTab("health");
    if (pane === "build" && this.tab === "health") this.showTab("sections");
    if (focus) this.save();
    if (!focus) return;
    if (pane === "markdown") this.editor.input.focus();
    else {
      const heading = this.querySelector(
        pane === "preview"
          ? ".preview-pane .pane-heading"
          : ".builder-content h2",
      );
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  }
  async copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      this.notify("Markdown copied");
    } catch {
      this.modal(
        '<h1>Copy Markdown</h1><p>Clipboard access is unavailable. Select and copy the text below.</p><label>Markdown to copy<textarea id="copy-fallback" rows="12" readonly></textarea></label>',
      );
      const input = this.querySelector("#copy-fallback");
      input.value = value;
      input.focus();
      input.select();
    }
  }
  download(content, name, type = "text/markdown") {
    name = safeFilename(name);
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.notify(`${name} download started`);
  }
  notify(message, kind = "info") {
    const el = this.querySelector(".toast");
    el.textContent = message;
    el.dataset.kind = ["success", "info", "warning", "error"].includes(kind)
      ? kind
      : "info";
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (el.hidden = true), 6500);
  }
  modal(content) {
    if (!this.dialog.open) this.dialogTrigger = document.activeElement;
    this.afterDialogFocus = null;
    this.dialog.classList.remove("import-modal");
    this.querySelector(".dialog-content").innerHTML = content;
    const context = document.createElement("p");
    context.className = "dialog-context";
    context.textContent = this.store?.draft.name
      ? `Workspace / ${this.store.draft.name}`
      : "Workspace";
    this.querySelector(".dialog-content").prepend(context);
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => {
      if (!this.dialog.open) return;
      const title = this.dialog.querySelector("h1");
      this.dialog.setAttribute(
        "aria-label",
        title?.textContent || "README Studio dialog",
      );
      if (
        document.activeElement === this.dialog ||
        document.activeElement === this.querySelector(".close-dialog") ||
        !this.dialog.contains(document.activeElement)
      )
        this.dialog
          .querySelector(
            ".dialog-content input:not([type=hidden]),.dialog-content select,.dialog-content textarea,.dialog-content button",
          )
          ?.focus();
    });
  }
  welcome() {
    this.modal(
      `<div class="eyebrow">WELCOME TO YOUR WORKSPACE</div><h1>A README that feels like you.</h1><p>Start with a little structure. Make every line your own.</p><div class="welcome-options"><button class="primary" data-start="templates">Start from a template <span>→</span></button><button data-action="profile">Autofill from GitHub <span>↗</span></button><button data-start="import">Import GitHub README <span>↥</span></button><button data-action="open-project">Open Studio project <span>↥</span></button><button data-start="blank">Start blank <span>+</span></button></div><p class="hint">Your drafts stay in this browser. No sign-in required.</p><button class="text-button" data-start="sample">Explore the sample profile →</button>`,
    );
    this.querySelectorAll("[data-start]").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.start === "templates") this.templates();
          else if (b.dataset.start === "import") this.importDialog();
          else {
            this.closeDialog();
            if (b.dataset.start === "blank") this.addDraft("Untitled", []);
          }
        }),
    );
  }
  addDraft(name, blocks, metadata = {}) {
    const d = newDraft(uniqueName(name, this.data.drafts), blocks);
    d.metadata = metadata;
    this.data.drafts.push(d);
    this.load(d.id);
  }
  async repositoryReadme(context = {}) {
    await import("./repository-readme-builder.js");
    this.modal("<repository-readme-builder></repository-readme-builder>");
    const builder = this.querySelector("repository-readme-builder");
    builder.configure(context);
    builder.addEventListener("repository-readme-original", () => {
      this.dispatchEvent(
        new CustomEvent("audit-improve", {
          detail: { ...context, builder: false },
        }),
      );
    });
    builder.addEventListener("repository-readme-create", (event) => {
      if (this.data.drafts.length >= 500) {
        builder.status(
          "Draft limit reached. Export and remove an unused draft first.",
        );
        return;
      }
      const { name, blocks, metadata } = event.detail;
      this.addDraft(name, blocks, metadata);
      this.closeDialog();
      this.mobile("build", false);
      this.notify(
        "Repository README created as a new local draft. Edit the selected sections to replace writing prompts.",
      );
    });
    builder.querySelector("select").focus();
  }
  templates() {
    this.modal(
      `<div class="eyebrow">A STARTING POINT, NOT A BOX</div><h1>Choose your structure.</h1><p>Each template opens as a new draft. Every section is editable.</p><h2>Repository READMEs</h2><p>Web App, Library, CLI, API, npm Package, Rust Crate, Python Package, Game, Open Source, Tutorial, Documentation and Generic.</p><button data-repository-template>Build a repository README</button><h2>Profile READMEs</h2><div class="template-grid">${templateNames.map((name, i) => `<button data-template="${name}"><span class="template-art">${["# Hello, world.", "## Built to share.", "$ git contribute", "> Always learning.", "~/hello_world"][i]}</span><strong>${name}</strong><small>${["Simple, clear, and to the point.", "Projects, tools, writing, and you.", "Put your contributions first.", "Your learning journey, in public.", "For those who feel at home in a shell."][i]}</small></button>`).join("")}</div>`,
    );
    this.querySelector("[data-repository-template]").onclick = () =>
      this.repositoryReadme();
    this.querySelectorAll("[data-template]").forEach(
      (b) =>
        (b.onclick = () => {
          this.addDraft(b.dataset.template, template(b.dataset.template));
          this.closeDialog();
        }),
    );
  }
  importDialog(reimport = false) {
    this.modal("<import-dialog></import-dialog>");
    this.dialog.classList.add("import-modal");
    const component = this.querySelector("import-dialog");
    component.draft = this.store.draft;
    if (reimport) component.reimport();
    component.querySelector("input")?.focus();
  }
  splitDialog() {
    const snapshot = draftSnapshot(this.store.draft);
    this.modal(
      '<h1>Split into sections</h1><p>Exact source slices become Custom Markdown blocks. Suggested kinds are labels only.</p><label>Split by<select id="split-levels"><option value="both">H1 + H2</option><option value="h1">H1</option></select></label><div id="split-summary"></div><button id="apply-split" class="primary">Split into sections</button>',
    );
    const levels = () =>
      this.querySelector("#split-levels").value === "h1" ? [1] : [1, 2];
    const update = () => {
      this.querySelector("#split-summary").innerHTML = detectSections(
        this.store.draft.markdown,
        { levels: levels() },
      )
        .map((s) => `<p>${html(s.title)} · suggested ${s.kind}</p>`)
        .join("");
    };
    update();
    this.querySelector("#split-levels").onchange = update;
    this.querySelector("#apply-split").onclick = () => {
      if (snapshot !== draftSnapshot(this.store.draft)) {
        this.notify("The draft changed. Open split again.");
        return;
      }
      this.store.blocks(splitDraft(this.store.draft, levels()));
      this.closeDialog();
      this.focusDocument();
    };
  }
  profileDialog() {
    this.modal("<github-profile-form></github-profile-form>");
    this.querySelector("github-profile-form").draft = this.store.draft;
    this.querySelector("github-profile-form input").focus();
  }
  drafts() {
    this.modal(
      `<div class="eyebrow">LOCAL DRAFTS</div><h1>A version for every you.</h1><label>Draft name<input id="draft-name" value="${html(this.store.draft.name)}"></label><div class="draft-buttons"><button data-manage="rename">Rename</button><button data-manage="duplicate">Duplicate draft</button><button data-manage="new">New blank draft</button><button data-manage="backup">Download draft backup</button><button data-action="backup-all">Download all drafts backup</button><button data-action="restore">Restore backup</button><button data-manage="delete" class="danger">Delete this draft</button></div><p class="hint">Back up drafts before clearing browser data. Markdown exports do not retain builder forms.</p>${this.store.draft.metadata.repository ? `<a href="https://github.com/${html(this.store.draft.metadata.repository)}" target="_blank" rel="noopener noreferrer">Open repository on GitHub ↗</a>` : ""}`,
    );
    this.querySelectorAll("[data-manage]").forEach(
      (b) =>
        (b.onclick = () => {
          const action = b.dataset.manage;
          if (action === "rename") {
            this.store.draft.name =
              this.querySelector("#draft-name").value.trim() || "Untitled";
            this.draftOptions();
            this.save();
          }
          if (action === "new") this.addDraft("Untitled", []);
          if (action === "duplicate")
            this.addDraft(
              this.store.draft.name + " copy",
              structuredClone(this.store.draft.blocks),
              structuredClone(this.store.draft.metadata),
            );
          if (action === "backup") {
            this.download(
              JSON.stringify(this.store.draft, null, 2),
              "readme-studio-draft.json",
              "application/json",
            );
            return;
          }
          if (action === "delete") {
            this.modal(
              '<h1>Delete this local draft?</h1><p>This removes the saved draft from this browser.</p><button id="confirm-delete" class="danger">Delete draft</button><button id="keep-draft">Keep draft</button>',
            );
            this.querySelector("#keep-draft").onclick = () =>
              this.closeDialog();
            this.querySelector("#confirm-delete").onclick = () => {
              this.data.drafts = this.data.drafts.filter(
                (d) => d.id !== this.data.active,
              );
              if (!this.data.drafts.length)
                this.data.drafts.push(newDraft("Untitled", []));
              this.load(this.data.drafts[0].id);
              this.closeDialog(this.querySelector("#draft-select"));
            };
            return;
          }
          this.closeDialog();
        }),
    );
  }
  restoreDialog() {
    this.modal(
      '<h1>Restore workspace backup</h1><p>Validate a backup before changing any drafts. Download your current workspace first if you need a recovery copy.</p><label>Workspace backup file<input id="workspace-file" type="file" accept=".json"></label><p id="restore-status" role="status"></p><div id="restore-review"></div>',
    );
    const input = this.querySelector("#workspace-file");
    let generation = 0;
    input.onchange = async () => {
      const ticket = ++generation,
        file = input.files[0];
      this.querySelector("#restore-review").replaceChildren();
      if (!file) return;
      try {
        if (file.size > BACKUP_LIMIT)
          throw new Error("Workspace backup exceeds the 50 MB limit.");
        const backup = validateWorkspace(JSON.parse(await file.text()));
        if (ticket !== generation || !input.isConnected) return;
        const snapshot = JSON.stringify(this.data);
        this.querySelector("#restore-status").textContent =
          `${backup.drafts.length} drafts · backup version ${backup.version}${backup.createdAt ? ` · created ${backup.createdAt}` : ""} · ${backup.badgeCollections.items.length} badge collections · ${backup.visualLibrary.themes.length} themes · ${backup.visualLibrary.banners.length} banner presets · ${backup.visualLibrary.bundles.length} visual bundles · ${backup.componentLibrary.snippets.length} reusable snippets`;
        this.querySelector("#restore-review").innerHTML =
          '<label>Restore mode<select id="restore-mode" aria-label="Restore mode"><option value="merge">Merge with local drafts</option><option value="replace">Replace local drafts</option></select></label><label class="check"><input id="restore-confirm" type="checkbox"> I confirm replacing local drafts, collections, or original recovery data</label><button id="apply-restore" class="primary">Restore backup</button>';
        this.querySelector("#restore-mode").focus();
        this.querySelector("#apply-restore").onclick = () => {
          try {
            if (snapshot !== JSON.stringify(this.data))
              throw new Error(
                "Workspace changed. Choose the backup again to review the latest state.",
              );
            const mode = this.querySelector("#restore-mode").value;
            if (
              (mode === "replace" || this.storageBlocked) &&
              !this.querySelector("#restore-confirm").checked
            )
              throw new Error(
                "Confirm replacing drafts or recovery data before restoring.",
              );
            const plan = restoreWorkspace(this.data, backup, mode);
            saveDrafts(plan);
            this.data = plan;
            this.storageBlocked = false;
            this.recoveryRaw = undefined;
            this.store = null;
            this.load(plan.active);
            this.applySettings();
            this.closeDialog(this.querySelector("#draft-select"));
            this.notify("Workspace backup restored.");
          } catch (e) {
            this.querySelector("#restore-status").textContent =
              e.name === "QuotaExceededError"
                ? "Storage is full. Nothing was replaced; download your current drafts and free browser storage."
                : e.message;
          }
        };
      } catch (e) {
        if (input.isConnected)
          this.querySelector("#restore-status").textContent = e.message;
      }
    };
  }
  action(action) {
    if (this.workspaceAction?.(action)) return;
    if (action === "save-project") return saveProjectDialog(this);
    if (action === "open-project") return openProjectDialog(this);
    if (action === "workflows")
      this.modal("<workflow-builder></workflow-builder>");
    if (action === "publish-github") {
      this.modal("<publish-dialog></publish-dialog>");
      this.querySelector("publish-dialog").configure(this.store.draft);
    }
    if (action === "refactors") {
      this.modal("<refactor-dialog></refactor-dialog>");
      this.querySelector("refactor-dialog").configure(this.store.draft);
    }
    if (action === "compatibility") {
      this.modal("<compatibility-lab></compatibility-lab>");
      this.querySelector("compatibility-lab").draft = this.store.draft;
    }
    if (action === "snippet-packs") this.openSnippetPacks();
    if (action === "refresh-github") this.openRefresh();
    if (action === "repository-health") this.openRepositoryHealth();
    if (action === "intelligence") this.openIntelligence();
    if (action === "repositories") this.openRepositories();
    if (action === "repository-audit" || action === "readme-attention") {
      this.modal(
        `<repository-audit data-start-view="${action === "readme-attention" ? "queue" : "audit"}"><p role="status">Loading README audit…</p></repository-audit>`,
      );
      this.dialog.classList.add("import-modal");
      const panel = this.querySelector("repository-audit");
      import("./repository-audit.js")
        .then(() => {
          if (panel.isConnected && this.dialog.open)
            panel.querySelector("input")?.focus();
        })
        .catch(() => {
          if (panel.isConnected)
            panel.textContent =
              "README audit could not load. Reload the app and try again; your draft is preserved.";
        });
    }
    if (action === "widgets") this.openWidgets();
    if (action === "components") this.openComponents();
    if (action === "visual-presets") this.openVisualPresets();
    if (action === "section-style") this.openSectionStyle();
    if (action === "banner") this.openBanner();
    if (action === "visual-theme") this.openTheme();
    if (action === "projects") this.openProjects();
    if (action === "collections") this.openCollections();
    if (action === "badges") this.openBadges();
    switch (action) {
      case "backup-all":
        this.download(
          JSON.stringify(createBackup(this.data), null, 2),
          "readme-studio-workspace.json",
          "application/json",
        );
        break;
      case "restore":
        this.restoreDialog();
        break;
      case "recovery-download":
        this.download(
          this.recoveryRaw,
          "readme-studio-recovery.json",
          "application/json",
        );
        break;
      case "reload":
        location.reload();
        break;
      case "profile":
        this.profileDialog();
        break;
      case "import":
        this.importDialog();
        break;
      case "copy":
        this.copy(this.store.draft.markdown);
        break;
      case "download":
        this.download(this.store.draft.markdown, "README.md");
        break;
      case "theme":
        this.data.settings.theme =
          this.data.settings.theme === "dark" ? "light" : "dark";
        this.data.settings.previewTheme = this.data.settings.theme;
        this.applySettings();
        this.save();
        break;
      case "preview-theme":
        this.data.settings.previewTheme =
          (this.data.settings.previewTheme || this.data.settings.theme) ===
          "dark"
            ? "light"
            : "dark";
        this.applySettings();
        this.save();
        break;
      case "repository-readme":
        this.repositoryReadme();
        break;
      case "templates":
        this.templates();
        break;
      case "drafts":
        this.drafts();
        break;
      case "undo":
        this.store.undo();
        break;
      case "redo":
        this.store.redo();
        break;
      case "copy-selection": {
        const input = this.editor.input;
        this.copy(input.value.slice(input.selectionStart, input.selectionEnd));
        break;
      }
      case "collapse":
        this.data.settings.collapsed = true;
        this.querySelector(".workspace").classList.add("collapsed");
        this.save();
        break;
      case "expand":
        this.data.settings.collapsed = false;
        this.querySelector(".workspace").classList.remove("collapsed");
        this.save();
        break;
      case "reimport":
        this.importDialog(true);
        break;
      case "split":
        this.splitDialog();
        break;
    }
  }
}
customElements.define("app-shell", AppShell);
