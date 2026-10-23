import {
  html as h,
  createBlock,
  serializeBlocks,
} from "../markdown/serialize.js";
import { readmeSuggestions } from "../stack-intelligence/readme-suggestions.js";
import { draftSnapshot } from "../state/import-plan.js";
import { sourceDiffMarkup, fillSourceDiff } from "./source-diff.js";

export class StackReadmeReview extends HTMLElement {
  configure(record, draft) {
    this.draft = structuredClone(draft);
    this.snapshot = draftSnapshot(draft);
    this.suggestions = readmeSuggestions(record);
    this.innerHTML = `<h1>Review stack-to-README suggestions</h1>
      <p>Repository: ${h(record.repository)}. Target draft: ${h(draft.name)}.</p>
      <p>Detected technology is repository evidence, not proficiency. Select each suggestion you want, review its evidence, and edit its Markdown. Nothing is selected automatically. Commands are text only; Studio never runs them.</p>
      ${record.status === "partial" ? '<p class="hint">Partial scan: suggestions cover only successfully read manifests.</p>' : ""}
      <p>Observed: ${h(new Date(record.observedAt ?? record.checkedAt).toLocaleString())}; branch: ${h(record.ref || "unknown")}. These session results may be outdated.</p>
      <div data-items>${this.suggestions.map((item, index) => `<section><label><input type="checkbox" data-choice="${index}"> ${h(item.title)}</label><p>${h(item.caveat)}</p><ul>${item.evidence.map((e) => `<li>${h(e)}</li>`).join("")}</ul><label>${h(item.title)} Markdown<textarea data-source="${index}" rows="3"></textarea></label><label><input type="checkbox" data-confirm="${index}" disabled> I confirm this suggestion is true for this repository.</label></section>`).join("")}</div>
      ${this.suggestions.length ? "" : "<p>No suggestions are available from this scan.</p>"}
      <p>Selected content is appended to the current draft. Existing sections are not replaced or deduplicated; review repeated headings before applying.</p>
      <button data-preview disabled>Review exact diff</button>
      <div data-review hidden>${sourceDiffMarkup()}<label><input type="checkbox" data-approve> I reviewed this exact change and each selected suggestion</label><button data-apply disabled>Append reviewed suggestions</button></div>
      <p role="status" data-status></p>`;
    this.querySelectorAll("[data-source]").forEach((el) => {
      el.value = this.suggestions[Number(el.dataset.source)].markdown;
    });
    this.querySelectorAll("[data-choice]").forEach((choice) => {
      choice.onchange = () => {
        const confirmation = this.querySelector(
          `[data-confirm="${choice.dataset.choice}"]`,
        );
        confirmation.disabled = !choice.checked;
        if (!choice.checked) confirmation.checked = false;
        this.invalidate();
        this.updatePreviewAvailability();
      };
    });
    this.querySelectorAll("[data-source]").forEach((source) => {
      source.oninput = () => {
        this.querySelector(
          `[data-confirm="${source.dataset.source}"]`,
        ).checked = false;
        this.invalidate();
        this.updatePreviewAvailability();
      };
    });
    this.querySelectorAll("[data-confirm]").forEach((confirmation) => {
      confirmation.onchange = () => {
        this.invalidate();
        this.updatePreviewAvailability();
      };
    });
    this.querySelector("[data-preview]").onclick = () => this.preview();
    this.querySelector("[data-approve]").onchange = () => {
      this.querySelector("[data-apply]").disabled = !this.canApply();
    };
    this.querySelector("[data-apply]").onclick = () => {
      if (!this.canApply()) return;
      this.dispatchEvent(
        new CustomEvent("stack-readme-apply", {
          bubbles: true,
          detail: { snapshot: this.snapshot, plan: structuredClone(this.plan) },
        }),
      );
    };
  }
  selection() {
    return [...this.querySelectorAll("[data-choice]:checked")].map((el) => ({
      id: this.suggestions[Number(el.dataset.choice)].id,
      markdown: this.querySelector(`[data-source="${el.dataset.choice}"]`)
        .value,
    }));
  }
  updatePreviewAvailability() {
    const selected = [...this.querySelectorAll("[data-choice]:checked")];
    this.querySelector("[data-preview]").disabled =
      !selected.length ||
      selected.some(
        (choice) =>
          !this.querySelector(`[data-confirm="${choice.dataset.choice}"]`)
            .checked,
      );
  }
  invalidate() {
    this.plan = null;
    this.querySelector("[data-review]").hidden = true;
    this.querySelector("[data-approve]").checked = false;
    this.querySelector("[data-apply]").disabled = true;
    this.querySelector("[data-status]").textContent =
      "Review the updated diff before applying.";
  }
  canApply() {
    return (
      !!this.plan &&
      this.signature === JSON.stringify(this.selection()) &&
      this.querySelector("[data-approve]").checked
    );
  }
  preview() {
    this.invalidate();
    const selected = this.selection();
    if (!selected.length || selected.some((item) => !item.markdown.trim())) {
      this.querySelector("[data-status]").textContent =
        "Select at least one suggestion. Selected Markdown must not be empty.";
      return;
    }
    if (
      [...this.querySelectorAll("[data-choice]:checked")].some(
        (choice) =>
          !this.querySelector(`[data-confirm="${choice.dataset.choice}"]`)
            .checked,
      )
    ) {
      this.querySelector("[data-status]").textContent =
        "Confirm each selected suggestion before reviewing the exact diff.";
      return;
    }
    const blocks = [
      ...structuredClone(this.draft.blocks),
      ...selected.map((item) =>
        createBlock("custom", { markdown: item.markdown }),
      ),
    ];
    const markdown = serializeBlocks(blocks);
    if (
      serializeBlocks(this.draft.blocks) !== this.draft.markdown ||
      !markdown.startsWith(this.draft.markdown)
    ) {
      this.querySelector("[data-status]").textContent =
        "Draft source and builder sections differ. Reopen the draft as Custom Markdown before appending suggestions.";
      return;
    }
    this.plan = { blocks, markdown };
    this.signature = JSON.stringify(selected);
    this.querySelector("[data-review]").hidden = false;
    fillSourceDiff(this, this.draft.markdown, markdown);
    this.querySelector("[data-status]").textContent =
      `${selected.length} suggestions ready for review.`;
    this.querySelector("[data-after]").focus();
  }
}
customElements.define("stack-readme-review", StackReadmeReview);
