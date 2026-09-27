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
    this.draw();
    this.load(this.data.active);
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
  draw() {
    this.innerHTML = `<header class="app-header"><a class="brand" href="#" aria-label="README Studio home"><span class="brand-mark">M<span>↓</span></span><span>README <b>Studio</b><small>YOUR PROFILE, IN YOUR WORDS.</small></span></a><span class="version">v${version}</span><div class="header-actions"><button data-action="import">↥ Import</button><button data-action="copy">Copy Markdown</button><button class="primary" data-action="download">↓ Export README</button><button data-action="theme" aria-label="Toggle color theme">◐</button></div></header>
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
    this.querySelector(".close-dialog").onclick = () => this.closeDialog();
    this.dialog.addEventListener("close", () => {
      this.querySelector("import-dialog")?.cancel();
      const target = this.afterDialogFocus || this.dialogTrigger;
      this.afterDialogFocus = null;
      if (target?.isConnected && target.getClientRects().length) target.focus();
      else this.querySelector("#draft-select").focus();
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
      if (b.dataset.action) this.action(b.dataset.action);
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
    this.addEventListener("markdown-change", (e) => this.store.raw(e.detail));
    this.addEventListener("undo", () => this.store.undo());
    this.addEventListener("redo", () => this.store.redo());
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
    this.addEventListener("copy-markup", (e) => this.copy(e.detail));
    this.querySelector("#draft-select").onchange = (e) =>
      this.load(e.target.value);
    this.querySelector("#preview-size").onchange = (e) => {
      this.data.settings.preview = e.target.value;
      this.applySettings();
      this.save();
    };
    this.addEventListener("keydown", (e) => {
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
    });
    this.querySelector('[data-pane="build"]').setAttribute(
      "aria-pressed",
      "true",
    );
    this.applySettings();
  }
  applySettings() {
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
      : this.querySelector('.header-actions [data-action="import"]');
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
            `<button data-block-type="${type}"><span class="library-icon">${["H", "≡", "⌘", "↗", "▣", "◈", "⌁", "✎", "@", "—", "&lt;/&gt;", "◇", "▦", "◐"][i]}</span><span>${name}</span><span>+</span></button>`,
        )
        .join(
          "",
        )}</div><button class="wide" data-action="templates">Browse templates →</button><div class="coming-soon"><small>ON THE HORIZON</small><p>Banner builder <span>Coming soon</span></p></div>`;
      return;
    }
    const blocks = this.store.draft.blocks;
    this.content.innerHTML = `<button class="profile-entry" data-action="profile">Autofill from GitHub ↗</button>${this.store.draft.metadata.importSource?.type === "github" ? '<button class="wide" data-action="reimport">Re-import current GitHub README</button>' : ""}<div class="section-title"><h2>Your sections <span>${blocks.length}</span></h2><p>Shape the story behind your code.</p></div><div class="block-list">${blocks.map((b, i) => `<article class="block-row"><button class="block-open" data-block-action="edit" data-id="${b.id}"><span class="block-number">${String(i + 1).padStart(2, "0")}</span><span><strong>${html(b.section?.title || blockTypes[b.type] || "Section")}</strong><small>${html((b.section ? `Suggested ${b.section.kind} · Custom Markdown` : "") || b.settings.name || b.settings.title || (b.type === "custom" ? "Your original Markdown" : b.type === "stack" ? `${b.settings.items?.length || 0} technologies` : "Click to edit"))}</small></span></button><div class="block-actions"><button data-block-action="up" data-id="${b.id}" aria-label="Move ${html(blockTypes[b.type])} up" ${i === 0 ? "disabled" : ""}>↑</button><button data-block-action="down" data-id="${b.id}" aria-label="Move ${html(blockTypes[b.type])} down" ${i === blocks.length - 1 ? "disabled" : ""}>↓</button><button data-block-action="copy" data-id="${b.id}" aria-label="Copy ${html(blockTypes[b.type])}">⧉</button><button data-block-action="duplicate" data-id="${b.id}" aria-label="Duplicate ${html(blockTypes[b.type])}">+</button><button data-block-action="remove" data-id="${b.id}" aria-label="Remove ${html(blockTypes[b.type])}">×</button></div></article>`).join("")}</div>${!blocks.length ? '<div class="empty-state"><h3>Introduce yourself.</h3><p>Start with a Hero, add a few skills, then share what you’re building.</p></div>' : ""}<button class="add-section wide" data-tab="library">+ Add a section</button>${blocks.length === 1 && blocks[0].type === "custom" ? '<p class="hint ownership">Manual Markdown is preserved in a Custom Markdown block. New sections are appended.</p>' : ""}${this.store.draft.markdown ? '<button class="wide" data-action="split">Split into sections</button>' : ""}<div class="tip"><span>↳</span><p><strong>Built for your GitHub profile</strong><br>Export a README.md that works anywhere. No lock-in, no extra setup.</p></div><button class="text-button" data-action="templates">Start from a template ↗</button>`;
  }
  edit(block) {
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
  mobile(pane) {
    this.querySelector(".workspace").dataset.mobile = pane;
    this.querySelectorAll("[data-pane]").forEach(
      (b) => (
        b.classList.toggle("active", b.dataset.pane === pane),
        b.setAttribute("aria-pressed", String(b.dataset.pane === pane))
      ),
    );
    if (pane === "health") this.showTab("health");
    if (pane === "build" && this.tab === "health") this.showTab("sections");
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
  notify(message) {
    const el = this.querySelector(".toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (el.hidden = true), 6500);
  }
  modal(content) {
    if (!this.dialog.open) this.dialogTrigger = document.activeElement;
    this.afterDialogFocus = null;
    this.dialog.classList.remove("import-modal");
    this.querySelector(".dialog-content").innerHTML = content;
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
      `<div class="eyebrow">WELCOME TO YOUR WORKSPACE</div><h1>A README that feels like you.</h1><p>Start with a little structure. Make every line your own.</p><div class="welcome-options"><button class="primary" data-start="templates">Start from a template <span>→</span></button><button data-action="profile">Autofill from GitHub <span>↗</span></button><button data-start="import">Import GitHub README <span>↥</span></button><button data-start="blank">Start blank <span>+</span></button></div><p class="hint">Your drafts stay in this browser. No sign-in required.</p><button class="text-button" data-start="sample">Explore the sample profile →</button>`,
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
  templates() {
    this.modal(
      `<div class="eyebrow">A STARTING POINT, NOT A BOX</div><h1>Choose your structure.</h1><p>Each template opens as a new draft. Every section is editable.</p><div class="template-grid">${templateNames.map((name, i) => `<button data-template="${name}"><span class="template-art">${["# Hello, world.", "## Built to share.", "$ git contribute", "> Always learning.", "~/hello_world"][i]}</span><strong>${name}</strong><small>${["Simple, clear, and to the point.", "Projects, tools, writing, and you.", "Put your contributions first.", "Your learning journey, in public.", "For those who feel at home in a shell."][i]}</small></button>`).join("")}</div>`,
    );
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
          `${backup.drafts.length} drafts · backup version ${backup.version}${backup.createdAt ? ` · created ${backup.createdAt}` : ""}`;
        this.querySelector("#restore-review").innerHTML =
          '<label>Restore mode<select id="restore-mode" aria-label="Restore mode"><option value="merge">Merge with local drafts</option><option value="replace">Replace local drafts</option></select></label><label class="check"><input id="restore-confirm" type="checkbox"> I confirm replacing local drafts or original recovery data</label><button id="apply-restore" class="primary">Restore backup</button>';
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
        this.querySelector(".workspace").classList.add("collapsed");
        break;
      case "expand":
        this.querySelector(".workspace").classList.remove("collapsed");
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
