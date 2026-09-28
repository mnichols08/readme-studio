import "./writing-comparison.js";
import { variants, generateAlternatives } from "../writing/alternatives.js";
import "./writing-context.js";
import { html as h } from "../markdown/serialize.js";
import { draftSnapshot } from "../state/import-plan.js";
import {
  actions,
  scopes,
  replaceScope,
  writingMessages,
} from "../writing/model.js";
import { connection, generateWriting } from "../writing/client.js";
import { sourceDiffMarkup, fillSourceDiff } from "./source-diff.js";

// Deliberately outside draft/workspace state, storage, backups and activity logs.
let sessionConnection = { endpoint: "", model: "", key: "" };
export class WritingAssistant extends HTMLElement {
  configure(draft, start, end) {
    this.draft = structuredClone(draft);
    this.snapshot = draftSnapshot(draft);
    this.ranges = scopes(draft.markdown, start, end);
    this.requestId = 0;
    this.innerHTML = `<h1>Writing assistant</h1><p>Optional AI assistance for ${h(draft.name)}. Manual editing, preview and export work without AI.</p>
      <label>Content to edit<select data-scope>${this.ranges.map((r, i) => `<option value="${i}">${h(r.label)}</option>`).join("")}</select></label>
      <label>Writing action<select data-action-choice>${Object.entries(actions)
        .map(([id, [name]]) => `<option value="${id}">${h(name)}</option>`)
        .join("")}</select></label>
      <label>Generation mode<select data-mode><option value="single">Single proposal</option><option value="compare">Compare Concise, Technical and Friendly (up to 3 requests)</option></select></label>
      <p>Comparison generates three versions sequentially and may incur three provider charges. It stops on failure and keeps completed versions. No automatic retry.</p>
      <label>Original<textarea data-original rows="6" readonly></textarea></label>
      <label>Optional factual notes or instructions<textarea data-notes rows="3" maxlength="32000"></textarea></label>
      <writing-context></writing-context>
      <label>Exact messages to send<textarea data-request rows="8" readonly></textarea></label>
      <p>The request also includes the model identifier, stream/store flags and completion-token limit. The API key is sent only as an Authorization header, never in these messages.</p>
      <fieldset data-connection><legend>Optional AI connection — memory only</legend>
        <label>Chat completions endpoint<input data-endpoint type="url" autocomplete="off" placeholder="http://localhost:1234/v1/chat/completions"></label>
        <label>Model identifier<input data-model autocomplete="off" maxlength="200"></label>
        <label>API key (optional for local models)<input data-key type="password" autocomplete="off" spellcheck="false" maxlength="4096"></label>
        <p>Use a trusted provider or your own local model. Keys are held in this tab's memory, never saved in drafts or backups. Provider billing and retention policies apply. Browser access requires provider CORS support.</p>
        <button data-forget>Forget connection</button>
      </fieldset>
      <label><input type="checkbox" data-consent> Send the displayed messages and selected context to this endpoint when I choose Generate</label>
      <p>Unchecked context, other drafts and workspace history are not sent. Check the displayed messages for secrets before sending.</p>
      <div class="row-actions"><button data-generate>Generate proposal</button><button data-cancel disabled>Cancel request</button></div>
      <p data-status role="status"></p>
      <writing-comparison hidden></writing-comparison>
      <label>Proposed<textarea data-proposed rows="8" maxlength="64000" placeholder="Generate a proposal, or paste and edit one here without connecting AI."></textarea></label>
      <p>AI can make mistakes. Verify facts, links and commands. Applying uses source editing and converts builder-owned content to Custom Markdown; Undo restores source and ownership.</p>
      <button data-review>Review diff</button>
      <section data-review-panel hidden><h2>Diff</h2>${sourceDiffMarkup({ beforeLabel: "Current README", afterLabel: "Proposed README", label: "Writing assistant diff" })}
      <label><input type="checkbox" data-approve> I reviewed Original, Proposed and Diff</label><button data-apply disabled>Apply</button></section>`;
    for (const key of ["endpoint", "model", "key"])
      this.querySelector(`[data-${key}]`).value = sessionConnection[key];
    const initial = this.ranges.findIndex((r) => r.id === "selection");
    const cursor = this.ranges.at(-1).start;
    const atCursor = this.ranges.findIndex(
      (r) =>
        r.id.startsWith("section:") &&
        r.start <= cursor &&
        (r.end > cursor ||
          (cursor === draft.markdown.length && r.end === cursor)),
    );
    this.querySelector("[data-scope]").value = String(
      initial >= 0
        ? initial
        : atCursor >= 0
          ? atCursor
          : this.ranges.length - 1,
    );
    this.querySelector("[data-action-choice]").value =
      this.range().start === this.range().end ? "draft" : "improve";
    this.original();
    this.querySelector("writing-context").configure(
      draft,
      this.ranges,
      this.range(),
    );
    this.updateRequest();
    this.addEventListener("writing-context-change", () => {
      this.resetInput();
    });
    this.querySelector("[data-scope]").onchange = () => {
      this.resetInput();
      this.original();
      this.querySelector("writing-context").setSection(this.range());
      this.updateRequest();
    };
    this.querySelector("[data-action-choice]").onchange = () =>
      this.resetInput();
    this.querySelector("[data-notes]").oninput = () => this.resetInput();
    this.querySelector("[data-mode]").onchange = () => this.resetInput();
    this.addEventListener("writing-alternative", (event) => {
      if (this.busy) return;
      this.invalidate();
      this.querySelector("[data-proposed]").value = event.detail;
      this.status(
        "Alternative copied into Proposed. Review its diff before applying.",
      );
      this.querySelector("[data-proposed]").focus();
    });
    this.querySelector("[data-proposed]").oninput = () => {
      this.cancel();
      this.invalidate();
    };
    this.querySelector("[data-connection]").oninput = (e) => {
      this.cancel();
      this.invalidate();
      this.querySelector("[data-consent]").checked = false;
      if (e.target.matches("[data-endpoint]")) {
        this.querySelector("[data-key]").value = "";
        sessionConnection = { endpoint: "", model: "", key: "" };
      }
    };
    this.querySelector("[data-forget]").onclick = () => {
      this.cancel();
      sessionConnection = { endpoint: "", model: "", key: "" };
      for (const key of ["endpoint", "model", "key"])
        this.querySelector(`[data-${key}]`).value = "";
      this.querySelector("[data-consent]").checked = false;
      this.status("Connection forgotten. Local review remains available.");
    };
    this.querySelector("[data-consent]").onchange = () => {
      if (!this.querySelector("[data-consent]").checked) this.cancel();
    };
    this.querySelector("[data-generate]").onclick = () => this.generate();
    this.querySelector("[data-cancel]").onclick = () => {
      this.cancel();
      this.status("Request cancelled. Your draft is unchanged.");
    };
    this.querySelector("[data-review]").onclick = () => this.review();
    this.querySelector("[data-approve]").onchange = () => {
      this.querySelector("[data-apply]").disabled = !this.canApply();
    };
    this.querySelector("[data-apply]").onclick = () => {
      if (this.canApply())
        this.dispatchEvent(
          new CustomEvent("writing-apply", {
            bubbles: true,
            detail: { snapshot: this.snapshot, markdown: this.plan },
          }),
        );
    };
  }
  range() {
    return this.ranges[Number(this.querySelector("[data-scope]").value)];
  }
  original() {
    const r = this.range();
    this.querySelector("[data-original]").value = this.draft.markdown.slice(
      r.start,
      r.end,
    );
  }
  status(text) {
    this.querySelector("[data-status]").textContent = text;
  }
  input() {
    return {
      action: this.querySelector("[data-action-choice]").value,
      original: this.querySelector("[data-original]").value,
      notes: this.querySelector("[data-notes]").value,
      context: this.querySelector("writing-context").entries(),
    };
  }
  requestMessages(input = this.input()) {
    const messages = (variant = "") =>
      writingMessages(
        input.action,
        input.original,
        input.notes,
        input.context,
        variant,
      );
    return this.querySelector("[data-mode]").value === "compare"
      ? Object.entries(variants).map(([id, [label]]) => ({
          alternative: label,
          messages: messages(id),
        }))
      : messages();
  }
  updateRequest() {
    try {
      this.querySelector("[data-request]").value = JSON.stringify(
        this.requestMessages(),
        null,
        2,
      );
    } catch (error) {
      this.querySelector("[data-request]").value =
        `Not ready to send: ${error.message}`;
    }
  }
  resetInput() {
    this.cancel();
    this.alternatives = [];
    this.querySelector("writing-comparison").show([]);
    this.invalidate();
    this.querySelector("[data-proposed]").value = "";
    this.querySelector("[data-consent]").checked = false;
    this.updateRequest();
  }
  invalidate() {
    this.plan = null;
    this.querySelector("[data-review-panel]").hidden = true;
    this.querySelector("[data-approve]").checked = false;
    this.querySelector("[data-apply]").disabled = true;
  }
  signature() {
    return JSON.stringify([
      this.range(),
      this.querySelector("[data-proposed]").value,
      this.querySelector("[data-action-choice]").value,
      this.querySelector("[data-notes]").value,
      this.querySelector("writing-context").entries(),
      this.querySelector("[data-mode]").value,
    ]);
  }
  canApply() {
    return (
      !this.busy &&
      typeof this.plan === "string" &&
      this.reviewSignature === this.signature() &&
      this.querySelector("[data-approve]").checked
    );
  }
  busyState(value) {
    this.busy = value;
    this.querySelector("writing-comparison")?.show(
      this.alternatives || [],
      value,
    );
    this.querySelector("[data-generate]").disabled = value;
    this.querySelector("[data-cancel]").disabled = !value;
    this.querySelector("[data-review]").disabled = value;
  }
  cancel() {
    this.requestId++;
    this.controller?.abort();
    for (const item of this.alternatives || [])
      if (item.status === "pending") item.status = "not generated";
    if (this.querySelector("[data-generate]")) this.busyState(false);
  }
  disconnectedCallback() {
    this.cancel();
  }
  async generate() {
    if (this.busy) return;
    try {
      if (!this.querySelector("[data-consent]").checked)
        throw Error("Confirm the content and endpoint before sending.");
      const config = connection(
        Object.fromEntries(
          ["endpoint", "model", "key"].map((key) => [
            key,
            this.querySelector(`[data-${key}]`).value,
          ]),
        ),
      );
      const input = this.input();
      const messages = this.requestMessages(input);
      if (
        this.querySelector("[data-request]").value !==
        JSON.stringify(messages, null, 2)
      ) {
        this.querySelector("[data-consent]").checked = false;
        this.updateRequest();
        throw Error(
          "Request changed. Review the displayed messages and confirm again.",
        );
      }
      this.cancel();
      this.invalidate();
      this.alternatives = [];
      this.busyState(true);
      const id = this.requestId;
      this.controller = new AbortController();
      sessionConnection = config;
      this.status("Generating a proposal. Your draft is unchanged…");
      try {
        if (this.querySelector("[data-mode]").value === "compare") {
          const items = await generateAlternatives(config, input, {
            generate: generateWriting,
            signal: this.controller.signal,
            onResult: (items) => {
              if (id === this.requestId && this.isConnected) {
                this.alternatives = items;
                this.querySelector("writing-comparison").show(items, true);
              }
            },
          });
          if (id !== this.requestId || !this.isConnected) return;
          this.alternatives = items;
          this.status(
            `${items.filter((item) => item.status === "ready").length} of 3 alternatives ready. Compare and choose one for Proposed; your draft is unchanged.`,
          );
          return;
        }
        const proposed = await generateWriting(config, input, {
          signal: this.controller.signal,
        });
        if (id !== this.requestId || !this.isConnected) return;
        this.querySelector("[data-proposed]").value = proposed;
        this.status(
          "Proposal ready. Review and edit it, then review the diff before applying.",
        );
        this.querySelector("[data-proposed]").focus();
      } catch (error) {
        if (id === this.requestId && this.isConnected)
          this.status(error.message);
      } finally {
        if (id === this.requestId) this.busyState(false);
      }
    } catch (error) {
      this.status(error.message);
    }
  }
  review() {
    this.invalidate();
    if (this.busy) return;
    try {
      const proposed = this.querySelector("[data-proposed]").value;
      const plan = replaceScope(this.draft.markdown, this.range(), proposed);
      if (plan === this.draft.markdown)
        throw Error("There are no changes to apply.");
      this.plan = plan;
      this.reviewSignature = this.signature();
      fillSourceDiff(this, this.draft.markdown, plan);
      this.querySelector("[data-review-panel]").hidden = false;
      this.querySelector("[data-after]").focus();
      this.status("Review the exact change. Nothing has been applied.");
    } catch (error) {
      this.status(error.message);
    }
  }
}
customElements.define("writing-assistant", WritingAssistant);
