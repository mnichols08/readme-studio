import { html as h } from "../markdown/serialize.js";
export class StackResults extends HTMLElement {
  setData(records) {
    this.records = records;
    this.page = Math.min(
      this.page || 0,
      Math.max(0, Math.ceil(records.length / 25) - 1),
    );
    this.render();
  }
  render() {
    const records = this.records || [],
      pages = Math.max(1, Math.ceil(records.length / 25));
    this.innerHTML = `<h2 tabindex="-1">Detected in selected repositories</h2><p>Direct dependency declarations are repository evidence, not developer skill or proof that a dependency runs in production. Root manifests only. Indirect Go requirements and unused or unresolved Cargo workspace declarations are excluded. No transitive dependency resolution or executable configuration.</p><p>${records.length} selected repositories with results. Results stay in this tab; no README or profile is changed.</p><div>${records
      .slice(this.page * 25, (this.page + 1) * 25)
      .map(
        (record) =>
          `<details data-stack-record="${records.indexOf(record)}"><summary>${h(record.repository)} — ${h({ read: "Manifests read", none: "No supported root manifests found", partial: "Partial results", failed: "Not assessed" }[record.status])}</summary><div data-stack-body></div></details>`,
      )
      .join(
        "",
      )}</div><div class="audit-pagination"><button data-stack-prev ${this.page === 0 ? "disabled" : ""}>Previous stack results</button><span>Page ${this.page + 1} of ${pages}</span><button data-stack-next ${this.page + 1 >= pages ? "disabled" : ""}>Next stack results</button></div>`;
    this.querySelectorAll("[data-stack-record]").forEach((details) => {
      details.ontoggle = () => {
        const body = details.querySelector("[data-stack-body]");
        if (!details.open || body.childElementCount) return;
        const record = records[Number(details.dataset.stackRecord)];
        body.innerHTML = `<p>Observed: ${h(new Date(record.checkedAt).toLocaleString())}; branch: ${h(record.ref || "unknown")}</p>${record.issues.map((issue) => `<p class="hint">Notice: ${h(issue)}</p>`).join("")}<h3>Direct dependencies</h3><p>${record.dependencies?.length || 0} normalized dependency records. The same name in different kinds remains separate.</p><ul data-dependencies>${(record.dependencies || []).map((entry) => `<li><strong>${h(entry.name)}</strong> — ${h(entry.ecosystem)} · ${h(entry.kind)} · ${h(entry.repository)}<ul>${entry.evidence.map((item) => `<li>${h(item.manifest)} — ${h(item.section)}${item.line ? ` (line ${item.line})` : ""}</li>`).join("")}</ul></li>`).join("")}</ul>${record.manifests.map((manifest) => `<section><h3>${h(manifest.ecosystem)} — ${h(manifest.path)}</h3><p>Manifest present.</p>${manifest.notes.map((note) => `<p class="hint">${h(note)}</p>`).join("")}</section>`).join("")}`;
      };
    });
    for (const [selector, step] of [
      ["[data-stack-prev]", -1],
      ["[data-stack-next]", 1],
    ])
      this.querySelector(selector).onclick = () => {
        this.page += step;
        this.render();
        this.querySelector("h2").focus();
      };
  }
}
customElements.define("stack-results", StackResults);
