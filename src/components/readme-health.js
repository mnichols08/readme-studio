import { analyze } from "../markdown/compatibility.js";
import { html } from "../markdown/serialize.js";
import { documentSegments } from "../markdown/source-context.js";
import { isRelativeUrl, validSourceContext } from "../markdown/resolve-urls.js";
import { duplicateWarnings } from "../markdown/merge.js";
import { contextResolver } from "../state/import-plan.js";
export class ReadmeHealth extends HTMLElement {
  set draft(draft) {
    this.value = draft.markdown;
    const warnings = duplicateWarnings(draft.markdown, contextResolver(draft));
    for (const segment of documentSegments(draft)) {
      if (validSourceContext(segment.sourceContext)) continue;
      const a = analyze(segment.source);
      if (a.images.some((i) => isRelativeUrl(i.url)))
        warnings.push(
          "Relative image cannot be previewed from this local or mixed-source import.",
        );
      if (a.links.some((i) => isRelativeUrl(i.url)))
        warnings.push("Relative repository link has no known source.");
    }
    if (warnings.length)
      this.insertAdjacentHTML(
        "beforeend",
        `<section class="health-group"><h3>Import suggestions</h3>${[...new Set(warnings)].map((w) => `<p class="issue">${html(w)}</p>`).join("")}</section>`,
      );
  }
  set value(markdown) {
    const a = analyze(markdown);
    this.innerHTML = `<h2>README Health</h2><p class="hint">Suggestions, not a score. Your content stays yours.</p><div class="stats"><span><b>${a.words}</b> words</span><span><b>${a.images.length}</b> images</span><span><b>${a.codeBlocks}</b> code blocks</span><span><b>${(a.bytes / 1024).toFixed(1)}</b> KB</span></div>${[
      "Accessibility",
      "Compatibility",
      "Layout",
      "Structure",
      "Content density",
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
  }
}
customElements.define("readme-health", ReadmeHealth);
