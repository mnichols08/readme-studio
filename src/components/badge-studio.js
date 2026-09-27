import { html } from "../markdown/serialize.js";
import { buildLinkedBadge, badgeImages, styles } from "../badges/shields.js";
import {
  defaultBadge,
  searchLogos,
  technologyBadge,
} from "../badges/badge-model.js";
import { badgePresets } from "../data/badge-presets.js";
export class BadgeStudio extends HTMLElement {
  connectedCallback() {
    this.value ||= defaultBadge();
    this.draw();
  }
  set badge(value) {
    this.value = structuredClone(value);
    if (this.isConnected) this.draw();
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
  draw() {
    this.innerHTML = `<h1>Badge Studio</h1><p>Editable badges. Ordinary Markdown. Remote previews contact the image provider.</p><label>Badge preset<select data-preset><option value="">Choose a preset</option>${badgePresets.map((p, i) => `<option value="${i}">${html(p.name)}</option>`).join("")}</select></label><label>Search logos<input data-logo-search placeholder="React, JS, Node, Postgres, Rust, WASM"></label><div class="logo-results" aria-label="Logo results"></div><div class="badge-fields">${[
      ["label", "Label"],
      ["message", "Message"],
      ["logo", "Logo"],
      ["logoColor", "Logo color"],
      ["labelColor", "Label color"],
      ["color", "Message color"],
      ["link", "Link URL"],
      ["alt", "Alt text"],
    ]
      .map(
        ([k, n]) =>
          `<label>${n}<input data-badge-field="${k}" value="${html(this.value[k] || "")}"></label>`,
      )
      .join(
        "",
      )}<label>Badge style<select data-badge-field="style">${styles.map((s) => `<option ${s === this.value.style ? "selected" : ""}>${s}</option>`).join("")}</select></label></div><label class="check"><input type="checkbox" data-pair ${this.value.darkColor ? "checked" : ""}> Light / dark badge pair</label><fieldset data-dark ${this.value.darkColor ? "" : "hidden"}><legend>Dark variant (main colors are the light variant)</legend><label>Dark background<input data-badge-field="darkColor" value="${html(this.value.darkColor || "20232A")}"></label><label>Dark logo color<input data-badge-field="darkLogoColor" value="${html(this.value.darkLogoColor || "white")}"></label></fieldset><div class="badge-status" role="status"></div><div class="badge-preview" aria-label="Badge preview"></div><label>Generated Markdown<textarea data-output="markdown" readonly rows="3"></textarea></label><label>Generated HTML<textarea data-output="html" readonly rows="3"></textarea></label><label>Final Shields URL<textarea data-output="url" readonly rows="2"></textarea></label><div class="row-actions"><button data-badge-copy="markdown">Copy Markdown</button><button data-badge-copy="html">Copy HTML</button><button data-duplicate-badge>Duplicate badge</button><button data-reset-badge>Reset</button></div><div class="badge-insertion"></div><button class="primary" data-insert-badge>Add to README</button>`;
    this.querySelector("[data-logo-search]").oninput = (e) =>
      this.search(e.target.value);
    this.querySelector("[data-preset]").onchange = (e) => {
      if (e.target.value !== "") {
        this.badge = badgePresets[Number(e.target.value)].badge;
        this.querySelector('[data-badge-field="label"]').focus();
      }
    };
    this.querySelectorAll("[data-badge-field]").forEach(
      (el) =>
        (el.oninput = () => {
          this.value[el.dataset.badgeField] = el.value;
          this.update();
        }),
    );
    this.querySelector("[data-pair]").onchange = (e) => {
      this.value.darkColor = e.target.checked
        ? this.querySelector('[data-badge-field="darkColor"]').value
        : "";
      this.value.darkLogoColor = this.querySelector(
        '[data-badge-field="darkLogoColor"]',
      ).value;
      this.querySelector("[data-dark]").hidden = !e.target.checked;
      this.update();
    };
    this.querySelectorAll("[data-badge-copy]").forEach(
      (b) =>
        (b.onclick = () => {
          if (this.output)
            this.emit("copy-markup", this.output[b.dataset.badgeCopy]);
        }),
    );
    this.querySelector("[data-reset-badge]").onclick = () => {
      this.badge = defaultBadge();
      this.querySelector('[data-badge-field="label"]').focus();
    };
    this.querySelector("[data-duplicate-badge]").onclick = () => {
      this.value = structuredClone(this.value);
      this.value.alt = `${this.value.alt || this.value.label} copy`;
      this.draw();
      this.querySelector('[data-badge-field="alt"]').focus();
    };
    this.querySelector("[data-insert-badge]").onclick = () => {
      if (this.output)
        this.emit("badge-insert", {
          badge: structuredClone(this.value),
          markdown: this.output.markdown,
          target: this.querySelector("[data-insert-target]")?.value || "cursor",
        });
    };
    this.search("");
    this.targets();
    this.update();
  }
  targets() {
    this.querySelector(".badge-insertion").innerHTML =
      `<label>Insert badge into<select data-insert-target><option value="cursor">Current cursor (preserve selected text)</option>${(this.blocks || []).map((b) => `<option value="${html(b.id)}" ${b.id === this.selectedBlock ? "selected" : ""}>${b.type === "badges" ? "Badge row" : "End of section"}: ${html(b.section?.title || b.settings.title || b.settings.name || b.type)}</option>`).join("")}</select></label>`;
  }
  search(q) {
    const results = searchLogos(q).slice(0, 12);
    this.querySelector(".logo-results").innerHTML = results.length
      ? results
          .map(
            (t, i) =>
              `<button data-logo-result="${i}">${html(t.name)}</button>`,
          )
          .join("")
      : "No matching logos. Enter a custom slug below.";
    this.querySelectorAll("[data-logo-result]").forEach(
      (b) =>
        (b.onclick = () => {
          this.badge = technologyBadge(results[Number(b.dataset.logoResult)]);
          this.querySelector('[data-badge-field="label"]').focus();
        }),
    );
  }
  update() {
    const status = this.querySelector(".badge-status");
    try {
      const images = badgeImages(this.value);
      this.output = {
        markdown: buildLinkedBadge(this.value),
        html: buildLinkedBadge(this.value, "html"),
        url: [images.light, images.dark].filter(Boolean).join("\n"),
      };
      for (const [k, v] of Object.entries(this.output))
        this.querySelector(`[data-output="${k}"]`).value = v;
      this.querySelector(".badge-preview").innerHTML =
        `<img src="${html(images.light)}" alt="${html(this.value.alt || "Light badge preview")}">${images.dark ? `<img src="${html(images.dark)}" alt="Dark badge preview">` : ""}`;
      status.textContent = navigator.onLine
        ? ""
        : "Offline: badge markup is available; remote previews may fail.";
      this.querySelectorAll(".badge-preview img").forEach(
        (img) =>
          (img.onerror = () => {
            status.textContent =
              "Remote preview unavailable. You can still copy or insert the badge.";
          }),
      );
    } catch (e) {
      this.output = null;
      status.textContent = e.message;
      this.querySelectorAll("[data-output]").forEach((el) => (el.value = ""));
      this.querySelector(".badge-preview").replaceChildren();
    }
    this.querySelectorAll("[data-insert-badge],[data-badge-copy]").forEach(
      (b) => (b.disabled = !this.output),
    );
  }
}
customElements.define("badge-studio", BadgeStudio);
