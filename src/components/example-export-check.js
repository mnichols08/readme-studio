import { html } from "../markdown/serialize.js";

export class ExampleExportCheck extends HTMLElement {
  configure({ report, action, snapshot }) {
    this.innerHTML = `<h1 tabindex="-1">Review example provenance</h1>
      <p>This local check reads provenance markers only. It never runs commands, code, tests or imported source.</p>
      <p><strong>${report.counts.placeholder} placeholder${report.counts.placeholder === 1 ? "" : "s"}</strong> · ${report.counts["user-confirmed"]} user-confirmed · ${report.counts.verified} verified</p>
      ${report.issues.some((issue) => issue.kind === "invalid-marker") ? '<p class="hint">One or more provenance markers are not recognized.</p>' : ""}
      ${report.truncatedSource ? '<p class="hint">This source exceeds the 750,000-byte review limit.</p>' : ""}
      ${report.truncatedMarkers ? `<p class="hint">${html(report.truncatedMarkers)} marker(s) were beyond the review limit.</p>` : ""}
      <p>Continue only if these examples are intentionally placeholders. The Markdown stays byte-for-byte unchanged.</p>
      <button data-continue>${action === "copy" ? "Copy" : "Export"} current source anyway</button>
      <p data-status role="status"></p>`;
    this.querySelector("[data-continue]").onclick = () =>
      this.dispatchEvent(
        new CustomEvent("example-export-continue", {
          bubbles: true,
          detail: { snapshot },
        }),
      );
  }
}

customElements.define("example-export-check", ExampleExportCheck);
