import { render } from "../markdown/render.js";
export class GithubPreview extends HTMLElement {
  connectedCallback() {
    this.innerHTML =
      '<article class="markdown-body" aria-label="README preview"></article>';
  }
  set value(markdown) {
    this.querySelector("article").innerHTML =
      render(markdown) ||
      '<div class="empty-preview"><h2>A blank page. A fresh start.</h2><p>Add a Hero or About Me section from Build, or start typing Markdown.</p></div>';
    this.applyTheme();
  }
  applyTheme() {
    const dark = this.closest(".preview-paper")?.dataset.theme === "dark";
    this.querySelectorAll("source[media]").forEach((s) => {
      if (/prefers-color-scheme/.test(s.media)) {
        s.dataset.originalMedia = s.media;
      }
      const media = s.dataset.originalMedia;
      if (media) s.media = media.includes("dark") === dark ? "all" : "not all";
    });
  }
}
customElements.define("github-preview", GithubPreview);
