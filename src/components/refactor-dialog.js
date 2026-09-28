import { html } from "../markdown/serialize.js";
export class RefactorDialog extends HTMLElement {
  configure(draft) {
    this.source = draft.markdown;
    this.snapshot = JSON.stringify(draft);
    this.requestId = 0;
    this.draw();
    try {
      this.worker = new Worker(
        new URL("../refactors/refactor.worker.js", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = () =>
        this.fail(
          "Refactor analysis is unavailable. Your source is unchanged.",
        );
      this.request();
    } catch {
      this.fail("Refactor analysis is unavailable. Your source is unchanged.");
    }
  }
  disconnectedCallback() {
    this.cancel();
  }
  cancel() {
    this.worker?.terminate();
    this.worker = null;
  }
  draw() {
    this.innerHTML = `<h1>Safe refactors</h1><p>Choose deterministic source changes, then review Before, After and Diff. Nothing changes until you apply.</p><p class="issue">Applying converts this draft to Custom Markdown so stale builder settings cannot overwrite your changes. Undo restores the original source and ownership.</p><div data-choices><p role="status">Finding conservative matches…</p></div><label>Badge row output<select data-badge-mode><option value="spacing">Normalize spacing</option><option value="paragraph">Plain HTML row</option><option value="center">Centered HTML row</option></select></label><div class="row-actions"><button data-review disabled>Review selected refactors</button><button data-cancel>Cancel</button></div><p data-status role="status"></p><section data-review-panel hidden><h2>Review source changes</h2><label>Before<textarea data-before aria-label="Before refactor" rows="7" readonly></textarea></label><label>After<textarea data-after aria-label="After refactor" rows="7" readonly></textarea></label><h3>Diff</h3><pre data-diff tabindex="0" aria-label="Refactor diff"></pre><button data-apply class="primary" disabled>Apply reviewed refactors</button></section>`;
    this.querySelector("[data-badge-mode]").onchange = () => {
      this.invalidate();
      this.request();
    };
    this.querySelector("[data-review]").onclick = () => this.request(true);
    this.querySelector("[data-cancel]").onclick = () =>
      this.dispatchEvent(new CustomEvent("refactor-cancel", { bubbles: true }));
    this.querySelector("[data-apply]").onclick = () => {
      if (this.review && this.review.changes.length)
        this.dispatchEvent(
          new CustomEvent("refactor-apply", {
            bubbles: true,
            detail: {
              snapshot: this.snapshot,
              source: this.source,
              plan: this.review,
            },
          }),
        );
    };
  }
  invalidate() {
    this.selection = [...this.querySelectorAll("[data-refactor]:checked")].map(
      (e) => e.dataset.refactor,
    );
    this.requestId++;
    this.review = null;
    this.querySelector("[data-review-panel]").hidden = true;
    this.querySelector("[data-apply]").disabled = true;
    this.querySelector("[data-status]").textContent =
      "Selections changed. Review again before applying.";
  }
  request(review = false) {
    if (!this.worker) return;
    if (!review) {
      this.querySelector("[data-review]").disabled = true;
      this.querySelectorAll("[data-refactor]").forEach(
        (input) => (input.disabled = true),
      );
    }
    const selected = review
      ? [...this.querySelectorAll("[data-refactor]:checked")].map(
          (e) => e.dataset.refactor,
        )
      : undefined;
    if (review && !selected.length) {
      this.fail("Select at least one available refactor.");
      return;
    }
    this.review = null;
    this.querySelector("[data-apply]").disabled = true;
    this.querySelector("[data-status]").textContent = review
      ? "Preparing combined diff…"
      : "Analyzing locally…";
    this.worker.postMessage({
      id: ++this.requestId,
      source: this.source,
      selected,
      options: { badgeMode: this.querySelector("[data-badge-mode]").value },
    });
  }
  receive(data) {
    if (data.id !== this.requestId) return;
    if (data.error) {
      this.fail(data.error);
      return;
    }
    if (data.catalog) {
      this.querySelector("[data-choices]").innerHTML =
        `<fieldset><legend>Available refactors</legend>${data.catalog.map((r) => `<label class="check"><input type="checkbox" data-refactor="${r.id}" ${r.count ? "" : "disabled"} ${r.count && this.selection?.includes(r.id) ? "checked" : ""}>${html(r.title)} (${r.count} edits)</label><p class="hint">${html(r.description)}</p>`).join("")}</fieldset>`;
      this.querySelectorAll("[data-refactor]").forEach(
        (e) => (e.onchange = () => this.invalidate()),
      );
      this.querySelector("[data-review]").disabled = false;
      this.querySelector("[data-status]").textContent =
        "Select fixes to review; unsupported or approximate patterns are skipped.";
      this.closest("dialog")?.setAttribute("aria-label", "Safe refactors");
      return;
    }
    this.review = data.plan;
    this.querySelector("[data-before]").value = this.source;
    this.querySelector("[data-after]").value = data.plan.newMarkdown;
    this.querySelector("[data-diff]").textContent =
      data.diff || "No changes for this selection.";
    this.querySelector("[data-review-panel]").hidden = false;
    this.querySelector("[data-apply]").disabled = !data.plan.changes.length;
    this.querySelector("[data-status]").textContent =
      `${data.plan.changes.length} edits ready for review. Source is unchanged.`;
    this.querySelector("[data-before]").focus();
  }
  fail(message) {
    this.review = null;
    this.querySelector("[data-review-panel]").hidden = true;
    this.querySelector("[data-apply]").disabled = true;
    this.querySelector("[data-status]").textContent = message;
  }
}
customElements.define("refactor-dialog", RefactorDialog);
