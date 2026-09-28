import { html } from "../markdown/serialize.js";
import { sourceDiffMarkup, fillSourceDiff } from "./source-diff.js";
import {
  validateShared,
  saveShared,
  planShared,
  sharedStarters,
} from "../workspace/shared-components.js";

export class SharedComponents extends HTMLElement {
  configure(data) {
    this.data = data;
    this.library = validateShared(data.sharedComponents);
    this.plan = null;
    this.innerHTML = `<h1>Shared components</h1><p>Reusable Markdown across workspace documents. Saving a definition never changes a README. Insertions and updates require a preview and approval.</p>
      <label>Shared definition<select data-component><option value="">New shared component</option>${this.library.items.map((item) => `<option value="${html(item.id)}">${html(item.name)} · revision ${item.revision}</option>`).join("")}</select></label>
      <label>Example starting point<select data-starter><option value="">Choose an editable example</option>${Object.keys(
        sharedStarters,
      )
        .map((name) => `<option>${html(name)}</option>`)
        .join("")}</select></label>
      <label>Shared component name<input data-name maxlength="120"></label><label>Shared Markdown<textarea data-source rows="8" maxlength="100000"></textarea></label>
      <button data-save>Save shared definition</button><button data-delete disabled>Delete definition</button>
      <p>Examples are writing prompts; replace placeholders before insertion. Raw document edits detach shared copies. Locally changed builder copies are skipped during updates. Deleting a definition leaves every document's source intact.</p>
      <fieldset><legend>Documents to preview</legend>${data.drafts.map((draft) => `<label class="check"><input type="checkbox" data-document value="${html(draft.id)}" ${draft.id === data.active ? "checked" : ""}> ${html(draft.name)}</label>`).join("")}</fieldset>
      <button data-insert>Preview insertion</button><button data-update>Preview linked updates</button>
      <p data-status role="status"></p><section data-review hidden><h2>Review document changes</h2><div data-diffs></div><label class="check"><input data-approve type="checkbox"> I reviewed every document diff</label><button data-apply disabled>Apply reviewed changes</button></section>`;
    this.querySelector("[data-component]").onchange = () => this.select();
    this.querySelector("[data-starter]").onchange = () => {
      const name = this.querySelector("[data-starter]").value;
      if (!name) return;
      this.querySelector("[data-component]").value = "";
      this.querySelector("[data-name]").value = name;
      this.querySelector("[data-source]").value = sharedStarters[name];
      this.querySelector("[data-delete]").disabled = true;
      this.invalidate();
    };
    for (const field of this.querySelectorAll(
      "[data-name], [data-source], [data-document]",
    ))
      field.oninput = () => this.invalidate();
    this.querySelector("[data-save]").onclick = () => {
      try {
        const library = saveShared(this.library, {
          id: this.querySelector("[data-component]").value,
          name: this.querySelector("[data-name]").value,
          markdown: this.querySelector("[data-source]").value,
        });
        this.send("shared-library-save", { library });
      } catch (error) {
        this.status(error.message);
      }
    };
    this.querySelector("[data-delete]").onclick = () => {
      if (
        !confirm(
          "Delete this shared definition? Existing README copies remain unchanged.",
        )
      )
        return;
      this.send("shared-library-save", {
        library: {
          version: 1,
          items: this.library.items.filter(
            (item) => item.id !== this.querySelector("[data-component]").value,
          ),
        },
      });
    };
    this.querySelector("[data-insert]").onclick = () => this.preview("insert");
    this.querySelector("[data-update]").onclick = () => this.preview("update");
    this.querySelector("[data-approve]").onchange = () =>
      (this.querySelector("[data-apply]").disabled = !this.canApply());
    this.querySelector("[data-apply]").onclick = () => {
      if (this.canApply()) this.send("shared-apply", this.plan);
    };
  }
  isDirty() {
    const item = this.library.items.find(
      (item) => item.id === this.querySelector("[data-component]").value,
    );
    return (
      this.querySelector("[data-name]").value !== (item?.name || "") ||
      this.querySelector("[data-source]").value !== (item?.markdown || "")
    );
  }
  send(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }
  status(message) {
    this.querySelector("[data-status]").textContent = message;
  }
  select() {
    const item = this.library.items.find(
      (item) => item.id === this.querySelector("[data-component]").value,
    );
    this.querySelector("[data-name]").value = item?.name || "";
    this.querySelector("[data-source]").value = item?.markdown || "";
    this.querySelector("[data-delete]").disabled = !item;
    this.invalidate();
  }
  invalidate() {
    this.plan = null;
    this.querySelector("[data-review]").hidden = true;
    this.querySelector("[data-approve]").checked = false;
    this.querySelector("[data-apply]").disabled = true;
  }
  canApply() {
    return (
      !!this.plan?.entries.length &&
      this.querySelector("[data-approve]").checked
    );
  }
  preview(mode) {
    this.invalidate();
    try {
      const component = this.library.items.find(
        (item) => item.id === this.querySelector("[data-component]").value,
      );
      if (
        !component ||
        component.name !== this.querySelector("[data-name]").value.trim() ||
        component.markdown !== this.querySelector("[data-source]").value
      )
        throw Error("Save the definition before previewing document changes.");
      const ids = [...this.querySelectorAll("[data-document]:checked")].map(
        (el) => el.value,
      );
      if (!ids.length) throw Error("Select at least one document.");
      this.plan = planShared(this.data.drafts, component, ids, mode);
      this.querySelector("[data-diffs]").innerHTML = this.plan.entries
        .map(
          (entry, i) =>
            `<section data-entry="${i}"><h3>${html(entry.name)}</h3>${sourceDiffMarkup()}</section>`,
        )
        .join("");
      this.plan.entries.forEach((entry, i) =>
        fillSourceDiff(
          this.querySelector(`[data-entry="${i}"]`),
          entry.before,
          entry.markdown,
        ),
      );
      this.querySelector("[data-review]").hidden = false;
      this.status(
        `${this.plan.entries.length} document(s) will change. ${this.plan.skipped.map((item) => `${item.name}: ${item.reason}`).join(" ")} Nothing has been applied.`,
      );
      this.querySelector("[data-after]")?.focus();
    } catch (error) {
      this.status(error.message);
    }
  }
}
customElements.define("shared-components", SharedComponents);
