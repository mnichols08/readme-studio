import { html as h } from "../markdown/serialize.js";
import { categories } from "../stack-intelligence/catalog.js";
import { stackDNA } from "../stack-intelligence/dna.js";
export class StackDNA extends HTMLElement {
  set records(records) {
    this.model = stackDNA(records);
    this.innerHTML = `<section aria-label="Stack DNA workspace summary"><h2>Stack DNA</h2><p>Curated technology mappings from selected repository evidence. No AI classification, skill claims or usage scores. Package declarations, engine configuration and GitHub primary-language metadata do not prove production usage. Database and deployment entries indicate declared tooling, not verified services.</p><p data-dna-coverage>${this.model.assessed} repositories with results · ${this.model.partial} partial · ${this.model.failed} not assessed.</p><label>Stack DNA category<select data-dna-category><option value="all">All categories</option>${categories.map((category) => `<option value="${h(category)}">${h(category)}</option>`).join("")}</select></label><p class="hint">Core combines Language, Framework and Runtime. Data contains Database. Select a technology to inspect its evidence. Unknown means no curated mapping exists.</p><div data-dna-groups></div><section data-dna-evidence hidden></section></section>`;
    this.querySelector("[data-dna-category]").onchange = () => this.draw();
    this.draw();
  }
  draw() {
    const selected = this.querySelector("[data-dna-category]").value;
    const groups = this.model.groups
      .map((group) => ({
        ...group,
        technologies: group.technologies.filter(
          (item) => selected === "all" || item.category === selected,
        ),
      }))
      .filter((group) => group.technologies.length);
    this.querySelector("[data-dna-evidence]").hidden = true;
    this.visible = groups.flatMap((group) => group.technologies.slice(0, 100));
    this.querySelector("[data-dna-groups]").innerHTML = groups.length
      ? groups
          .map(
            (group) =>
              `<section data-dna-group="${h(group.name)}"><h3>${h(group.name)}</h3><div class="dna-technologies">${group.technologies
                .slice(0, 100)
                .map(
                  (item) =>
                    `<button type="button" data-dna-technology="${this.visible.indexOf(item)}">${h(item.name)}${item.category === "Unknown" ? ` (${h(item.ecosystem)})` : ""}</button>`,
                )
                .join(
                  '<span aria-hidden="true"> · </span>',
                )}</div>${group.technologies.length > 100 ? "<p>Showing the first 100 technologies in this group. All dependency evidence remains available in repository results.</p>" : ""}</section>`,
          )
          .join("")
      : "<p>No technologies in this category from the current selection. Analyze selected manifests or choose another category.</p>";
    this.querySelectorAll("[data-dna-technology]").forEach(
      (button) =>
        (button.onclick = () => {
          const item = this.visible[Number(button.dataset.dnaTechnology)];
          const panel = this.querySelector("[data-dna-evidence]");
          panel.hidden = false;
          panel.innerHTML = `<h3 tabindex="-1">${h(item.name)} evidence</h3><p>Category: ${h(item.category)}. Kinds: ${h(item.kinds.join(", "))}. Associated repositories: ${item.repositories.length}.</p><ul>${item.evidence.map((source) => `<li>${h(source.repository)} — ${h(source.dependency || "Configuration / metadata")} — ${h(source.kind)} — ${h(source.source)}</li>`).join("")}</ul>${item.moreEvidence ? "<p>First 100 evidence entries shown; see repository results for the rest.</p>" : ""}<button type="button" data-dna-close>Close technology evidence</button>`;
          panel.querySelector("h3").focus();
          panel.querySelector("[data-dna-close]").onclick = () => {
            panel.hidden = true;
            button.focus();
          };
        }),
    );
  }
}
customElements.define("stack-dna", StackDNA);
