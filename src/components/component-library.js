import { html } from "../markdown/serialize.js";
import { render } from "../markdown/render.js";
import {
  categories,
  componentSource,
  searchComponents,
  normalizeComponent,
} from "../components-library/model.js";
import { componentCatalog } from "../components-library/registry.js";
import {
  validateComponents,
  favoriteComponent,
} from "../components-library/storage.js";
export class ComponentLibrary extends HTMLElement {
  connectedCallback() {
    this.library = validateComponents(this.library);
    this.draw();
  }
  configure({ library, blocks, selectedBlock, selection = "" }) {
    this.library = validateComponents(library);
    this.blocks = blocks;
    this.selectedBlock = selectedBlock;
    this.selection = selection;
    this.draw();
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
  status(message) {
    this.querySelector("[data-component-status]").textContent = message;
  }
  isDirty() {
    return !!this.dirty;
  }
  draw() {
    this.innerHTML = `<h1>Component Library</h1><p>Browse built-in starters or reuse your own exact Markdown. Remote image previews contact their hosts.</p><div class="row-actions"><label>Search components<input data-component-search type="search"></label><label>Component category<select data-component-category aria-label="Component category"><option value="">All categories</option>${categories.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Library view<select data-component-view aria-label="Library view"><option value="all">All components</option><option value="favorites">Favorites</option><option value="recent">Recently used</option><option value="saved">Saved by you</option></select></label></div><p data-result-count role="status"></p><div class="component-results"></div><button data-more-components hidden>Show more components</button><div class="component-detail"></div><details class="save-snippet"><summary>Save My Snippet</summary><label>Snippet name<input data-snippet="name" maxlength="120"></label><label>Snippet category<select data-snippet="category" aria-label="Snippet category">${categories.map((c) => `<option>${c}</option>`).join("")}</select></label><label>Snippet description<input data-snippet="description" maxlength="1000"></label><label>Snippet tags<input data-snippet="tags" placeholder="terminal, contact"></label><label>Snippet Markdown<textarea data-snippet="template" rows="6">${html(this.selection || "")}</textarea></label><button data-save-snippet>Save snippet locally</button></details><p data-component-status role="status"></p>`;
    this.limit = 40;
    for (const el of this.querySelectorAll(
      "[data-component-search],[data-component-category],[data-component-view]",
    ))
      el.oninput = () => {
        this.limit = 40;
        this.results();
      };
    this.querySelector("[data-more-components]").onclick = () => {
      this.limit += 40;
      this.results();
    };
    for (const el of this.querySelectorAll("[data-snippet]"))
      el.oninput = () => (this.dirty = true);
    this.querySelector("[data-save-snippet]").onclick = () => {
      try {
        const values = Object.fromEntries(
          [...this.querySelectorAll("[data-snippet]")].map((e) => [
            e.dataset.snippet,
            e.value,
          ]),
        );
        const c = normalizeComponent({
          ...values,
          version: 1,
          id: crypto.randomUUID(),
          kind: "custom",
          fields: [],
          tags: values.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        this.emit("component-library-save", {
          library: validateComponents({
            ...this.library,
            snippets: [...this.library.snippets, c],
          }),
          message: "Snippet saved locally.",
          savedSnippet: true,
        });
      } catch (e) {
        this.status(e.message);
      }
    };
    this.results();
  }
  accept(library, message, savedSnippet) {
    this.library = validateComponents(library);
    if (savedSnippet) {
      this.dirty = false;
      this.querySelector('[data-snippet="name"]').value = "";
      this.querySelector('[data-snippet="template"]').value = "";
    }
    this.results();
    this.status(message);
  }
  results() {
    const list = searchComponents(componentCatalog(this.library), {
      query: this.querySelector("[data-component-search]").value,
      category: this.querySelector("[data-component-category]").value,
      view: this.querySelector("[data-component-view]").value,
      ...this.library,
    });
    this.querySelector("[data-result-count]").textContent =
      `${list.length} components · showing ${Math.min(this.limit, list.length)}`;
    this.querySelector(".component-results").innerHTML = list
      .slice(0, this.limit)
      .map(
        (c) =>
          `<article><h2>${html(c.name)}</h2><p>${html(c.category)} · ${c.id.startsWith("builtin:") ? "Built-in" : "Saved by you"}</p><p>${html(c.description)}</p><button data-open-component="${html(c.id)}">Preview ${html(c.name)}</button><button data-favorite-component="${html(c.id)}" aria-label="Favorite ${html(c.name)}" aria-pressed="${this.library.favorites.includes(c.id)}">${this.library.favorites.includes(c.id) ? "★" : "☆"} Favorite</button></article>`,
      )
      .join("");
    this.querySelector("[data-more-components]").hidden =
      list.length <= this.limit;
    for (const b of this.querySelectorAll("[data-open-component]"))
      b.onclick = () =>
        this.open(
          componentCatalog(this.library).find(
            (c) => c.id === b.dataset.openComponent,
          ),
        );
    for (const b of this.querySelectorAll("[data-favorite-component]"))
      b.onclick = () => {
        this.favoriteFocus = b.dataset.favoriteComponent;
        this.emit("component-library-save", {
          library: favoriteComponent(this.library, b.dataset.favoriteComponent),
          message: "Favorites updated.",
        });
        this.querySelector(
          `[data-favorite-component="${this.favoriteFocus}"]`,
        )?.focus();
      };
  }
  open(c) {
    this.current = c;
    this.values = {};
    const detail = this.querySelector(".component-detail");
    detail.innerHTML = `<h2 tabindex="-1">${html(c.name)}</h2><p>${html(c.description)}</p><p>${c.external ? "External image service required. Rendering preview contacts the image host." : "Local markup. Images in custom snippets may contact external hosts."}</p>${c.attribution ? `<p>Configured at <a href="${html(c.attribution.url)}" target="_blank" rel="noopener noreferrer">${html(c.attribution.name)}</a></p>` : ""}<div class="component-fields">${c.fields.map((f) => `<label>${html(f.label)}<input data-component-field="${f.key}" value="${html(f.default)}"></label>`).join("")}</div><button data-render-component>Render preview</button><div class="component-preview markdown-body"></div><label>Component Markdown<textarea data-component-source readonly rows="7"></textarea></label><label>Insert position<select data-component-position aria-label="Insert position"><option value="append">Append to README</option><option value="cursor">At cursor (keeps selected text)</option><option value="before">Before selected block</option><option value="after">After selected block</option></select></label><label>Insertion section<select data-component-section aria-label="Insertion section">${(this.blocks || []).map((b, i) => `<option value="${html(b.id)}" ${b.id === this.selectedBlock ? "selected" : ""}>${i + 1}. ${html(b.settings.title || b.settings.name || b.type)}</option>`).join("")}</select></label><button data-insert-component class="primary">Insert component</button>`;
    this.updateSource();
    for (const el of detail.querySelectorAll("[data-component-field]"))
      el.oninput = () => {
        this.values[el.dataset.componentField] = el.value;
        this.updateSource();
        detail.querySelector(".component-preview").replaceChildren();
      };
    detail.querySelector("[data-render-component]").onclick = () => {
      if (this.updateSource())
        detail.querySelector(".component-preview").innerHTML = render(
          this.markdown,
        );
    };
    detail.querySelector("[data-insert-component]").onclick = () => {
      if (this.updateSource())
        this.emit("component-insert", {
          component: this.current,
          values: this.values,
          markdown: this.markdown,
          position: detail.querySelector("[data-component-position]").value,
          blockId: detail.querySelector("[data-component-section]").value,
        });
    };
    detail.querySelector("h2").focus();
  }
  updateSource() {
    try {
      this.markdown = componentSource(this.current, this.values);
      this.querySelector("[data-component-source]").value = this.markdown;
      this.querySelector("[data-insert-component]").disabled = false;
      this.status("");
      return true;
    } catch (e) {
      this.status(e.message);
      this.querySelector("[data-insert-component]").disabled = true;
      return false;
    }
  }
}
customElements.define("component-library", ComponentLibrary);
