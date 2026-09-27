import { analyze } from "../markdown/compatibility.js";
import { html } from "../markdown/serialize.js";
export class ReadmeHealth extends HTMLElement {
  disconnectedCallback() {
    this.worker?.terminate();
    this.worker = null;
  }
  set draft(draft) {
    this.pending = structuredClone(draft);
    if (!this.querySelector("h2"))
      this.innerHTML =
        '<h2 tabindex="-1">README Health</h2><p role="status">Analyzing README…</p>';
    if (!this.worker) {
      try {
        this.worker = new Worker(
          new URL("../markdown/health.worker.js", import.meta.url),
          { type: "module" },
        );
        this.worker.onmessage = ({ data }) => {
          this.busy = false;
          if (this.pending) {
            this.run();
            return;
          }
          if (data.error) {
            this.failure();
            return;
          }
          this.display(data.result.analysis);
          const warnings = data.result.warnings;
          if (navigator.onLine === false)
            warnings.push(
              "Remote preview media may be unavailable offline. Local editing and export still work.",
            );
          if (warnings.length)
            this.insertAdjacentHTML(
              "beforeend",
              `<section class="health-group"><h3>Import suggestions</h3>${warnings.map((w) => `<p class="issue">${html(w)}</p>`).join("")}</section>`,
            );
        };
        this.worker.onerror = () => {
          this.busy = false;
          this.worker?.terminate();
          this.worker = null;
          this.failure();
        };
      } catch {
        this.failure();
        return;
      }
    }
    if (!this.busy) this.run();
  }
  run() {
    this.busy = true;
    this.worker.postMessage(this.pending);
    this.pending = null;
  }
  failure() {
    this.innerHTML =
      '<h2>README Health</h2><p role="status">Health analysis is unavailable. Your Markdown is preserved and export still works.</p>';
  }
  set value(markdown) {
    try {
      this.display(analyze(markdown));
    } catch {
      this.failure();
    }
  }
  display(a) {
    const focused = this.contains(document.activeElement);
    this.innerHTML = `<h2 tabindex="-1">README Health</h2><p class="hint">Suggestions, not a score. Your content stays yours.</p><div class="stats"><span><b>${a.words}</b> words</span><span><b>${a.images.length}</b> images</span><span><b>${a.codeBlocks}</b> code blocks</span><span><b>${(a.bytes / 1024).toFixed(1)}</b> KB</span></div>${[
      "Accessibility",
      "Compatibility",
      "Layout",
      "Structure",
      "Content density",
      "Projects",
    ]
      .map(
        (c) =>
          `<section class="health-group"><h3>${c === "Content density" ? "Clutter suggestions" : c}</h3>${
            a.issues
              .filter((i) => i.category === c)
              .map(
                (i) =>
                  `<p class="issue">${html(i.message.replace("Clutter suggestions: ", ""))}</p>`,
              )
              .join("") || '<p class="healthy">✓ No suggestions</p>'
          }</section>`,
      )
      .join("")}`;
    if (focused) this.querySelector("h2").focus({ preventScroll: true });
  }
}
customElements.define("readme-health", ReadmeHealth);
