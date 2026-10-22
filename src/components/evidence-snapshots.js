import { html } from "../markdown/serialize.js";
import {
  documentSnapshots,
  differentTarget,
  snapshotSummary,
  DOCUMENT_RETENTION,
  WORKSPACE_RETENTION,
} from "../workspace/evidence-snapshots.js";

const short = (sha) => (sha ? sha.slice(0, 7) : "");
const kinds = {
  readme: "README",
  manifest: "Manifest",
  lockfile: "Lockfile",
  linked: "Linked file",
};
const statuses = {
  captured: "Captured",
  missing: "Missing on GitHub",
  failed: "Unknown (not read)",
  unchanged: "Unchanged",
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  unknown: "Unknown",
};
const when = (iso) => new Date(iso).toLocaleString();
const targetText = (t) =>
  `${html(t.repository)} · branch ${html(t.branch)} · ${html(t.path)}`;

export class EvidenceSnapshots extends HTMLElement {
  disconnectedCallback() {
    this.controller?.abort();
  }
  configure({ draft, target, snapshots, storageBlocked = false }) {
    this.state = { draft, target, snapshots, storageBlocked };
    const items = documentSnapshots(snapshots, draft.id);
    // The status live region is created once and never re-rendered, so an
    // outcome written right after a refresh is still announced.
    if (!this.querySelector(":scope > [data-status]"))
      this.innerHTML =
        '<div data-head></div><p data-status role="status"></p><div data-body></div>';
    this.querySelector("[data-head]").innerHTML =
      `<h1>Evidence snapshots</h1><p>An evidence snapshot records what GitHub reports for this document's repository at one moment: the branch head commit, the README revision, recognised manifests and lockfiles, and files your Markdown links to by relative path, plus a fingerprint of your local Markdown. Capture and change checks only read public GitHub data. They never change your Markdown or write to GitHub.</p>
      ${
        target
          ? `<p data-target-line>Target: ${targetText(target)}</p><button class="primary" data-capture>Capture evidence snapshot</button>`
          : `<p data-target-line>This document has no repository, branch and README path target, so it cannot be captured. Saved snapshots remain readable.</p><button data-set-target>Set document target</button>`
      }<button data-cancel hidden>Cancel</button>
      ${storageBlocked ? '<p role="alert">Storage recovery is active. Snapshots can be viewed and checked, but capture, Baseline and delete need restored workspace storage.</p>' : ""}`;
    this.querySelector("[data-body]").innerHTML =
      `<h2>Saved snapshots (${items.length})</h2>
      <p class="hint">Kept in this browser and in all-drafts backups, not in Studio projects or README exports. Retention keeps each document's newest ${DOCUMENT_RETENTION} snapshots plus its Baseline, up to ${WORKSPACE_RETENTION} in this workspace; a Baseline is never removed automatically.</p>
      ${
        items.length
          ? `<ol data-snapshots>${items.map((item, index) => this.item(item, index)).join("")}</ol>`
          : "<p data-empty>No evidence snapshots for this document yet. Capture one to record the repository's current evidence.</p>"
      }
      <section data-check hidden aria-label="Change check result"></section>`;
    this.querySelector("[data-capture]")?.addEventListener("click", () =>
      this.send("capture"),
    );
    this.querySelector("[data-set-target]")?.addEventListener("click", () =>
      this.send("target"),
    );
    this.querySelector("[data-cancel]").onclick = () =>
      this.controller?.abort();
    this.querySelectorAll("[data-snapshot-action]").forEach(
      (button) =>
        (button.onclick = () =>
          this.send(button.dataset.snapshotAction, button.dataset.id)),
    );
  }
  item(item, index) {
    const summary = snapshotSummary(item, this.state.draft.markdown);
    const different = differentTarget(item, this.state.target);
    const id = html(item.id),
      heading = `evidence-${index}`;
    const labels = [
      item.baseline && "Baseline",
      summary.partial && "Partial snapshot",
      different && "Different target",
      summary.sourceEdited
        ? "Markdown edited since capture"
        : "Markdown unchanged since capture",
    ].filter(Boolean);
    const readme =
      summary.readme.status === "captured"
        ? `README revision ${short(summary.readme.sha)}`
        : summary.readme.status === "missing"
          ? "README missing on GitHub"
          : "README revision unknown";
    const described = `aria-describedby="${heading}"`,
      blocked = different ? "data-blocked disabled" : "";
    return `<li data-snapshot="${id}"><h3 id="${heading}">Snapshot captured ${html(when(item.capturedAt))}</h3>
      <p data-labels>${labels.map((label) => `<span class="evidence-label">${label}</span>`).join(" ")}</p>
      <p>Branch head ${short(item.head)} · ${readme} · ${summary.captured} captured · ${summary.missing} missing · ${summary.failed} unknown</p>
      ${different ? `<p>Captured for ${targetText(item.target)}. It cannot be the Baseline or be used for a change check.</p>` : ""}
      ${item.notes.length ? `<ul>${item.notes.map((note) => `<li>${html(note)}</li>`).join("")}</ul>` : ""}
      ${summary.failed ? "<p>Unknown entries could not be read. They are not treated as drift.</p>" : ""}
      <details><summary>Evidence files (${item.entries.length})</summary><div class="evidence-table"><table><thead><tr><th scope="col">File</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Revision</th></tr></thead><tbody>${item.entries
        .map(
          (entry) =>
            `<tr><td>${html(entry.path)}</td><td>${kinds[entry.kind]}</td><td>${statuses[entry.status]}${entry.note ? ` — ${html(entry.note)}` : ""}</td><td>${short(entry.sha)}</td></tr>`,
        )
        .join("")}</tbody></table></div></details>
      <div class="evidence-actions">${
        item.baseline
          ? `<button data-snapshot-action="unpin" data-id="${id}" ${described}>Unpin Baseline</button>`
          : `<button data-snapshot-action="pin" data-id="${id}" ${described} ${blocked}>Pin as Baseline</button>`
      }<button data-snapshot-action="check" data-id="${id}" ${described} ${blocked}>Run change check</button><button data-snapshot-action="delete" data-id="${id}" ${described}>Delete snapshot</button></div></li>`;
  }
  showCheck(snapshot, result) {
    const section = this.querySelector("[data-check]");
    const { counts } = result;
    section.hidden = false;
    section.innerHTML = `<h2 tabindex="-1">Change check</h2><p>Compared the snapshot captured ${html(when(snapshot.capturedAt))} with GitHub now. Nothing was saved.</p>
      <p>${result.headChanged ? `Branch head changed: ${short(result.head.before)} → ${short(result.head.after)}.` : `Branch head unchanged: ${short(result.head.after)}.`}</p>
      <p data-counts>${counts.changed} changed · ${counts.added} added · ${counts.removed} removed · ${counts.unknown} unknown · ${counts.unchanged} unchanged</p>
      ${result.notes.length ? `<ul>${result.notes.map((note) => `<li>${html(note)}</li>`).join("")}</ul>` : ""}
      ${counts.unknown ? "<p>Unknown means the file could not be read in the snapshot or now. It is not reported as a change.</p>" : ""}
      <div class="evidence-table"><table><thead><tr><th scope="col">File</th><th scope="col">Kind</th><th scope="col">Result</th><th scope="col">Snapshot</th><th scope="col">Now</th></tr></thead><tbody>${result.entries
        .map(
          (entry) =>
            `<tr data-result="${entry.status}"><td>${html(entry.path)}</td><td>${kinds[entry.kind]}</td><td>${statuses[entry.status]}${entry.status === "unknown" && entry.note ? ` — ${html(entry.note)}` : ""}</td><td>${short(entry.before)}</td><td>${short(entry.after)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`;
    section.querySelector("h2").focus();
  }
  send(action, id) {
    this.dispatchEvent(
      new CustomEvent("evidence-action", {
        bubbles: true,
        detail: { action, id },
      }),
    );
  }
  status(message) {
    this.querySelector("[data-status]").textContent = message;
  }
  busy(value) {
    // Pin/check stay disabled for a Different target snapshot when idle.
    this.querySelectorAll("button").forEach(
      (el) => (el.disabled = value || el.hasAttribute("data-blocked")),
    );
    const cancel = this.querySelector("[data-cancel]");
    cancel.hidden = !value;
    cancel.disabled = false;
    if (value) cancel.focus();
  }
}
customElements.define("evidence-snapshots", EvidenceSnapshots);
