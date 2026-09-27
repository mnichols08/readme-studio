import { builtInThemes } from "../themes/built-ins.js";
import { baseTheme, safeName } from "../themes/theme-model.js";
import {
  emptyLibrary,
  validateVisualLibrary,
  mergeVisualLibraries,
  exportVisualEntry,
  readVisualFile,
  bannerVisual,
} from "../themes/visual-library.js";
import { newBanner } from "../banners/banner-model.js";
import { renderBanner } from "../banners/render-svg.js";
import { html } from "../markdown/serialize.js";
import { heading, divider } from "../styling/presentation.js";
import { render } from "../markdown/render.js";
export class VisualPresetGallery extends HTMLElement {
  connectedCallback() {
    this.library ||= emptyLibrary();
    this.draw();
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
  set value(library) {
    this.library = validateVisualLibrary(library);
    this.draw();
  }
  status(text) {
    this.querySelector(".visual-library-status").textContent = text;
  }
  draw() {
    this.release();
    this.innerHTML = `<h1>Visual presets</h1><p>Reusable visual configuration, separate from each draft. Presets contain no README prose, banner text, or generated assets.</p><label>Preset name<input data-preset-name value="My visual preset"></label><div class="row-actions"><button data-save-visual="themes">Save current theme</button><button data-save-visual="banners">Save banner preset</button><button data-save-visual="bundles">Save visual bundle</button></div><label>Saved preset<select data-visual-selected aria-label="Saved preset"><option value="">Choose a saved preset</option>${["themes", "banners", "bundles"].map((kind) => this.library[kind].map((e) => `<option value="${kind}:${html(e.id)}">${kind}: ${html(e.name)}</option>`).join("")).join("")}</select></label><div class="row-actions"><button data-visual-action="review">Review preset</button><button data-visual-action="rename">Rename preset</button><button data-visual-action="duplicate">Duplicate preset</button><button data-visual-action="delete">Delete preset</button><button data-visual-action="export">Export preset</button><button data-export-themes>Export theme pack</button><button data-export-visual>Export visual pack</button></div><details><summary>Import themes and visual presets</summary><label>Visual preset JSON file<input data-visual-file type="file" accept="application/json,.json"></label><label>Visual preset JSON<textarea data-visual-json rows="5"></textarea></label><button data-review-visual>Review import</button><div class="visual-import-review"></div></details><div class="visual-apply-review"></div><p class="visual-library-status" role="status"></p><h2>Built-in theme gallery</h2><p>Samples are generated locally. Choose Review theme to inspect settings before applying.</p><label>Gallery mode<select data-gallery-mode aria-label="Gallery mode"><option>light</option><option>dark</option></select></label><div class="theme-gallery"></div>`;
    for (const b of this.querySelectorAll("[data-save-visual]"))
      b.onclick = () => {
        try {
          const kind = b.dataset.saveVisual,
            name = safeName(this.querySelector("[data-preset-name]").value),
            theme = structuredClone(this.draftTheme || baseTheme),
            banner = bannerVisual(this.draftBanner || newBanner(theme));
          const entry = {
            id: crypto.randomUUID(),
            name,
            ...(kind !== "banners" ? { theme } : {}),
            ...(kind !== "themes" ? { banner } : {}),
          };
          this.persist(
            mergeVisualLibraries(this.library, {
              ...emptyLibrary(),
              [kind]: [entry],
            }),
            "Preset saved locally.",
          );
        } catch (e) {
          this.status(e.message);
        }
      };
    for (const b of this.querySelectorAll("[data-visual-action]"))
      b.onclick = () => this.action(b.dataset.visualAction);
    this.querySelector("[data-export-themes]").onclick = () =>
      this.download(
        {
          version: 1,
          type: "readme-studio-theme-pack",
          themes: this.library.themes.map((e) =>
            exportVisualEntry(e, "themes"),
          ),
        },
        "themes.pack.json",
      );
    this.querySelector("[data-export-visual]").onclick = () =>
      this.download(
        {
          version: 1,
          type: "readme-studio-visual-pack",
          library: this.library,
        },
        "visual.pack.json",
      );
    this.querySelector("[data-review-visual]").onclick = () =>
      this.importReview();
    this.querySelector("[data-visual-json]").oninput = () =>
      this.querySelector(".visual-import-review").replaceChildren();
    this.querySelector("[data-visual-file]").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2_000_000)
          throw Error("Visual preset file exceeds the 2 MB limit.");
        const text = await file.text();
        if (!this.isConnected) return;
        this.querySelector("[data-visual-json]").value = text;
        this.importReview();
      } catch (error) {
        this.status(error.message);
      }
    };
    this.querySelector("[data-gallery-mode]").onchange = () => this.gallery();
    this.gallery();
  }
  persist(library, message) {
    this.emit("visual-library-save", { library, message });
  }
  selected() {
    const [kind, id] = (
      this.querySelector("[data-visual-selected]").value || ""
    ).split(":");
    return { kind, entry: this.library[kind]?.find((e) => e.id === id) };
  }
  action(action) {
    try {
      const { kind, entry } = this.selected();
      if (!entry) {
        this.status("Choose a saved preset first.");
        return;
      }
      if (action === "review") {
        this.review(entry);
        return;
      }
      if (action === "export") {
        this.download(
          exportVisualEntry(entry, kind),
          entry.name + ".preset.json",
        );
        return;
      }
      const next = structuredClone(this.library);
      if (action === "rename")
        next[kind].find((e) => e.id === entry.id).name = safeName(
          this.querySelector("[data-preset-name]").value,
        );
      if (action === "duplicate")
        next[kind].push({ ...structuredClone(entry), id: crypto.randomUUID() });
      if (action === "delete") {
        if (
          !confirm(
            `Delete saved preset “${entry.name}”? Draft content is not changed.`,
          )
        )
          return;
        next[kind] = next[kind].filter((e) => e.id !== entry.id);
      }
      this.persist(validateVisualLibrary(next), "Visual library updated.");
    } catch (e) {
      this.status(e.message);
    }
  }
  download(value, name) {
    this.emit("visual-download", {
      content: JSON.stringify(value, null, 2),
      name,
      type: "application/json",
    });
  }
  importReview() {
    const area = this.querySelector(".visual-import-review");
    try {
      const incoming = readVisualFile(
        this.querySelector("[data-visual-json]").value,
      );
      area.innerHTML = `<p>Version 1 · ${incoming.themes.length} themes · ${incoming.banners.length} banner presets · ${incoming.bundles.length} bundles. Append with new IDs/names where collisions occur.</p><button data-append-visual>Append reviewed presets</button>`;
      area.querySelector("button").onclick = () => {
        try {
          this.persist(
            mergeVisualLibraries(this.library, incoming),
            "Imported presets saved locally.",
          );
        } catch (e) {
          this.status(e.message);
        }
      };
      area.querySelector("button").focus();
    } catch (e) {
      area.textContent = e.message;
    }
  }
  review(entry) {
    this.pending = structuredClone(entry);
    const t = entry.theme,
      b = entry.banner;
    const area = this.querySelector(".visual-apply-review");
    area.innerHTML = `<h2 tabindex="-1">Apply ${html(entry.name)}</h2><dl><dt>Badge defaults</dt><dd>${t ? html(`${t.badges.style}; light #${t.badges.lightBackground}, dark #${t.badges.darkBackground}`) : "Keep current"}</dd><dt>Heading style</dt><dd>${html(t?.headings.style || "Keep current")}</dd><dt>Divider style</dt><dd>${html(t?.dividers.style || "Keep current")}</dd><dt>Banner palette/style</dt><dd>${b ? html(`${b.pattern}; light #${b.palette.light}, dark #${b.palette.dark}`) : t ? html(`Theme-derived palette: light #${t.palette.backgroundLight}, dark #${t.palette.backgroundDark}`) : "Keep current"}</dd></dl><label>Preset apply mode<select data-visual-apply-mode aria-label="Preset apply mode"><option value="derived">Apply to theme-derived settings only</option><option value="reset">Reset builder-owned visual overrides</option></select></label><button data-apply-visual class="primary">Apply reviewed preset</button>`;
    area.querySelector("button").onclick = () => {
      const reset = area.querySelector("select").value === "reset";
      if (
        reset &&
        !confirm(
          "Reset builder-owned visual overrides? README prose and Custom Markdown remain unchanged.",
        )
      )
        return;
      this.emit("visual-preset-apply", { preset: this.pending, reset });
    };
    area.querySelector("h2").focus();
  }
  gallery() {
    this.release();
    const mode = this.querySelector("[data-gallery-mode]").value;
    this.svgCache ||= new Map();
    this.querySelector(".theme-gallery").innerHTML = builtInThemes
      .map(
        (t, i) =>
          `<article class="theme-card"><h3>${html(t.name)} — ${mode}</h3><div class="theme-card-sample markdown-body" style="background-color:#${t.palette[mode === "dark" ? "backgroundDark" : "backgroundLight"]};color:#${mode === "dark" ? "f8fafc" : t.palette.foreground}">${render(heading("Selected work", { heading: t.headings.style, decoration: t.headings.decoration }))}<div class="local-badge-row"><span style="background-color:#${mode === "dark" ? t.badges.darkBackground : t.badges.lightBackground}">Build · passing</span><span style="background-color:#${t.palette.accent}">Portfolio ↗</span></div>${render(divider(t.dividers.style, t.headings.decoration))}<img data-theme-thumb="${i}" alt="${html(t.name)} ${mode} banner sample" loading="lazy"></div><button data-review-theme="${i}">Review ${html(t.name)} theme</button></article>`,
      )
      .join("");
    for (const img of this.querySelectorAll("[data-theme-thumb]")) {
      const t = builtInThemes[Number(img.dataset.themeThumb)],
        cacheKey = `${t.id}:${mode}`,
        svg =
          this.svgCache.get(cacheKey) ||
          renderBanner(
            {
              ...newBanner(t),
              name: t.name,
              title: "Software developer",
              pattern: "minimal",
            },
            mode,
          ),
        url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      this.svgCache.set(cacheKey, svg);
      this.urls.push(url);
      img.src = url;
    }
    for (const b of this.querySelectorAll("[data-review-theme]"))
      b.onclick = () => {
        const theme = builtInThemes[Number(b.dataset.reviewTheme)];
        this.review({ name: theme.name, theme });
      };
  }
  release() {
    for (const u of this.urls || []) URL.revokeObjectURL(u);
    this.urls = [];
  }
  disconnectedCallback() {
    this.release();
  }
}
customElements.define("visual-preset-gallery", VisualPresetGallery);
