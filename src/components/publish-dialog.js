import { documentTarget } from "../workspace/documents.js";
import { sourceDiffMarkup, fillSourceDiff } from "./source-diff.js";
import {
  generatedAssets,
  rewriteOwnedBanner,
  prepareAssetPlan,
  executeAssetPlan,
} from "../publishing/assets.js";
import { mergeThreeWay, resolveMerge } from "../publishing/conflicts.js";
import {
  readPublishingHistory,
  savePublishCheckpoint,
  recordPublish,
} from "../publishing/history.js";
import { PublishingClient } from "../github/publishing-client.js";
import { html } from "../markdown/serialize.js";
import { target, writeInput } from "../publishing/validation.js";
import { publishDiff } from "../publishing/diff.js";
export class PublishDialog extends HTMLElement {
  connectedCallback() {
    this.client = new PublishingClient();
    this.innerHTML = `<h1>Publish to GitHub</h1><p>Optional publishing. Your README source stays unchanged. Every write requires a source review and confirmation.</p><p role="status" data-status>Checking connection…</p><section data-auth></section><section data-target></section><section data-review></section><section data-history></section><button data-download>Download README fallback</button>`;
    this.querySelector("[data-download]").onclick = () =>
      this.emit("publish-download", {
        content: this.source,
        name:
          this.kind === "workflow"
            ? this.workflowPath.split("/").at(-1)
            : "README.md",
        type: this.kind === "workflow" ? "text/yaml" : "text/markdown",
      });
    this.run(() => this.session());
  }
  configure(draft) {
    this.draftSnapshot = structuredClone(draft);
    this.source = draft.markdown;
    this.draftId = draft.id;
    this.originalSource = draft.markdown;
    this.historyView();
  }
  configureWorkflow(draft, result) {
    this.configure(draft);
    this.kind = "workflow";
    this.workflow = result.config;
    this.workflowPath = result.path;
    this.source = result.yaml;
    this.initialSource = result.yaml;
    this.querySelector("h1").textContent = "Publish workflow to GitHub";
    this.querySelector("[data-download]").textContent =
      "Download YAML fallback";
    const notice = document.createElement("p");
    notice.textContent = `${result.permissionReason} Publishing requires server opt-in and GitHub App Workflows: write. A committed workflow can execute scheduled commands on GitHub. Review the complete YAML.`;
    this.querySelector("h1").after(notice);
  }
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
  status(text) {
    this.querySelector("[data-status]").textContent = text;
  }
  async run(fn) {
    if (this.busy) return;
    this.busy = true;
    this.setAttribute("aria-busy", "true");
    try {
      await fn();
    } catch (e) {
      if (e.remote && this.baseline) this.stale(e.remote);
      this.status(e.message);
    } finally {
      this.busy = false;
      this.removeAttribute("aria-busy");
    }
  }
  async session() {
    this.auth = await this.client.request("session");
    this.authView();
    if (this.auth.connected) await this.loadRepositories();
    else
      this.status(
        this.auth.configured
          ? "Connect GitHub to select a repository."
          : "Publishing is not configured on this deployment. All local tools and downloads remain available.",
      );
  }
  authView() {
    const area = this.querySelector("[data-auth]");
    area.innerHTML = this.auth.connected
      ? `<p><img src="${html(this.auth.identity.avatar)}" width="32" height="32" alt=""> Connected as <strong>${html(this.auth.identity.name)}</strong> (${html(this.auth.identity.login)}).</p><p>Access is limited to repositories shared with this GitHub App and your own repository permissions. README publishing requires Contents: read/write and Metadata: read.</p><button data-disconnect>Disconnect GitHub</button>`
      : `<button data-connect ${!this.auth.configured ? "disabled" : ""}>Connect GitHub</button><div data-device></div>`;
    area.querySelector("[data-connect]")?.addEventListener("click", () =>
      this.run(async () => {
        const result = await this.client.request("connect", {});
        area.querySelector("[data-device]").innerHTML =
          `<p>Open <a href="https://github.com/login/device" target="_blank" rel="noopener noreferrer">GitHub device authorization</a> and enter <strong>${html(result.code)}</strong>. Only authorize the code you requested here. Never share it.</p><button data-poll>Check authorization</button>`;
        area.querySelector("[data-poll]").onclick = () =>
          this.run(async () => {
            const state = await this.client.request("poll", {});
            if (state.pending) {
              this.status(
                "Waiting for GitHub authorization. Complete the GitHub prompt, then check again.",
              );
              return;
            }
            await this.session();
          });
        this.status("Authorize access on GitHub, then check authorization.");
        area.querySelector("[data-poll]").focus();
      }),
    );
    area.querySelector("[data-disconnect]")?.addEventListener("click", () =>
      this.run(async () => {
        await this.client.request("disconnect", {});
        this.baseline = null;
        this.plan = null;
        this.querySelector("[data-target]").replaceChildren();
        this.querySelector("[data-review]").replaceChildren();
        await this.session();
        this.querySelector("[data-connect]")?.focus();
      }),
    );
  }
  async loadRepositories() {
    const { repositories } = await this.client.request("repositories", {});
    this.repositories = repositories;
    const area = this.querySelector("[data-target]");
    area.innerHTML = `<h2>Choose target</h2><p>Suggested profile repository: ${html(this.auth.identity.login)}/${html(this.auth.identity.login)}. Confirm your own selection. If missing, <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">create it on GitHub</a> and install the app for it.</p><label>Target repository<select data-repo><option value="">Select repository</option>${repositories.map((r) => `<option value="${html(r.repository)}">${html(r.repository)} · ${html(r.visibility)} · ${(this.kind === "workflow" ? r.workflowsWritable : r.writable) ? "write access" : "read only"} · default ${html(r.branch)}</option>`).join("")}</select></label><label>Target branch<input data-branch autocomplete="off"></label><label>${this.kind === "workflow" ? "Workflow path" : "README path"}<input data-path value="${html(this.workflowPath || "README.md")}" ${this.kind === "workflow" ? "readonly" : ""} autocomplete="off"></label><fieldset data-assets-options ${this.kind !== "workflow" && this.draftSnapshot?.metadata?.bannerSettings ? "" : "hidden"}><legend>Generated banner assets</legend><label class="check"><input type="checkbox" data-include-assets> Include generated banner SVG files in this publishing plan</label><label>Asset directory<input data-asset-directory value="assets/readme"></label><label class="check"><input type="checkbox" data-rewrite-banner> Update only Studio-owned banner references in the prepared README</label></fieldset><button data-load>Load remote ${this.kind === "workflow" ? "workflow" : "README"}</button>`;
    const destination =
      this.kind === "workflow"
        ? null
        : documentTarget(this.draftSnapshot || {});
    if (
      destination &&
      repositories.some((repo) => repo.repository === destination.repository)
    ) {
      area.querySelector("[data-repo]").value = destination.repository;
      area.querySelector("[data-branch]").value = destination.branch;
      area.querySelector("[data-path]").value = destination.path;
    }
    area.querySelector("[data-repo]").onchange = () => {
      area.querySelector("[data-branch]").value =
        repositories.find(
          (r) => r.repository === area.querySelector("[data-repo]").value,
        )?.branch || "";
      this.invalidate();
    };
    area
      .querySelectorAll("input")
      .forEach((el) => (el.oninput = () => this.invalidate()));
    area.querySelector("[data-load]").onclick = () =>
      this.run(async () => {
        this.baseline = await this.client.request("read", this.target());
        this.source = this.initialSource || this.originalSource;
        this.assetRows = [];
        if (this.querySelector("[data-include-assets]").checked) {
          const directory = this.querySelector("[data-asset-directory]").value;
          const files = generatedAssets(
            this.draftSnapshot.metadata.bannerSettings,
            directory,
          );
          this.assetRows = await prepareAssetPlan(files, this.target(), (t) =>
            this.client.request("read", t),
          );
          if (this.querySelector("[data-rewrite-banner]").checked) {
            const rewrite = rewriteOwnedBanner(
              this.draftSnapshot,
              directory,
              this.baseline.path,
            );
            this.source = rewrite.source;
            this.rewriteApplied = rewrite.rewritten;
          }
        }
        this.plan = null;
        this.review();
        this.status(
          "Remote baseline loaded separately from your local draft. Review all source changes.",
        );
        this.querySelector("[data-message]").focus();
      });
    this.status(
      repositories.length
        ? "Select a repository and branch."
        : "No repositories available. Install the GitHub App for your repository, then reconnect.",
    );
  }
  target() {
    return target({
      repository: this.querySelector("[data-repo]").value,
      branch: this.querySelector("[data-branch]").value,
      path: this.querySelector("[data-path]").value,
      ...(this.kind ? { kind: this.kind } : {}),
    });
  }
  invalidate() {
    this.baseline = null;
    this.assetRows = [];
    this.plan = null;
    this.querySelector("[data-review]").replaceChildren();
    this.status("Target changed. Load the remote README again.");
  }
  review() {
    const b = this.baseline,
      diff = publishDiff(b.content, this.source),
      writable = this.repositories.find((r) => r.repository === b.repository)?.[
        this.kind === "workflow" ? "workflowsWritable" : "writable"
      ];
    this.querySelector("[data-review]").innerHTML =
      `<h2>Review ${b.sha ? "updated file" : "New file"}</h2><p>${html(b.repository)} · branch ${html(b.branch)} · ${html(b.path)}</p><p>SHA baseline: <code>${html(b.sha || "New file (does not exist)")}</code></p><p>${diff.added} added / ${diff.removed} removed lines in changed region. Sections: ${html(diff.sections.join(", ") || "body content")}.</p>${sourceDiffMarkup({ beforeLabel: `Remote ${this.kind === "workflow" ? "YAML" : "Markdown"}`, afterLabel: `Prepared ${this.kind === "workflow" ? "YAML" : "Markdown"}`, label: "Publishing diff" })}<label>Commit message<input data-message value="Update README with README Studio" maxlength="500"></label><label class="check"><input type="checkbox" data-confirm> I reviewed this diff and confirm ${b.sha ? "updating" : "creating"} this exact repository, branch, path and every listed asset write.</label><button data-commit ${!writable || (b.content === this.source && !this.assetRows?.some((r) => r.status !== "unchanged")) ? "disabled" : ""}>Confirm and publish README</button><div data-result></div><section data-stale></section><details><summary>Publish on a new branch instead</summary><p>Create a branch from ${html(b.branch)} at commit ${html(b.commitSha || "unknown")}. This creates only a branch; committing still needs a fresh review.</p><label>New branch name<input data-new-branch value="readme-studio/update-${new Date().toISOString().slice(0, 10)}"></label><label class="check"><input type="checkbox" data-confirm-branch> I confirm creating this branch in ${html(b.repository)}.</label><button data-create-branch ${!writable ? "disabled" : ""}>Create branch for review</button></details>`;
    if (this.assetRows?.length) {
      const area = document.createElement("section");
      area.innerHTML = `<h2>Asset publish plan</h2><p>Separate commits, not an atomic transaction. README is written last. ${this.rewriteApplied ? "Owned banner paths updated in prepared source." : "No banner source rewrite applied."}</p>${this.assetRows.map((r, i) => `<details><summary>${html(r.path)} — ${r.status} — ${r.bytes} bytes</summary><p>Baseline SHA: ${html(r.baseline.sha || "New file")}. ${html(r.warning)} ${this.source.includes(r.path.split("/").at(-1)) ? "" : "Warning: asset appears unreferenced by this README."}</p><div data-asset-diff="${i}"></div></details>`).join("")}<div data-asset-results role="status"></div>`;
      this.querySelector("[data-review]").prepend(area);
      this.assetRows.forEach((r, i) => {
        const panel = area.querySelector(`[data-asset-diff="${i}"]`);
        panel.innerHTML = sourceDiffMarkup({
          beforeLabel: `Current ${r.path}`,
          afterLabel: `Generated ${r.path}`,
          label: `Asset diff ${r.path}`,
        });
        fillSourceDiff(panel, r.baseline.content, r.content);
      });
    }
    fillSourceDiff(
      this.querySelector("[data-review] > .source-diff"),
      b.content,
      this.source,
      diff.text,
    );
    if (this.kind === "workflow") {
      this.querySelector("[data-commit]").textContent =
        "Confirm and publish workflow";
      this.querySelector("[data-message]").value = "Update README workflow";
    }
    this.querySelector("[data-commit]").onclick = () =>
      this.run(() => this.commit());
    this.querySelector("[data-create-branch]").onclick = () =>
      this.run(() => this.createBranch());
    if (!writable)
      this.status(
        "Read-only repository. Publishing is disabled; download remains available.",
      );
  }
  async commit() {
    const input = writeInput({
      ...this.baseline,
      content: this.source,
      message: this.querySelector("[data-message]").value,
      confirmed: this.querySelector("[data-confirm]").checked,
    });
    if (JSON.stringify(this.target()) !== JSON.stringify(target(this.baseline)))
      throw new Error("Target changed. Reload and review.");
    if (this.kind === "workflow") input.workflow = this.workflow;
    const latest = await this.client.request("read", this.target());
    if (latest.sha !== this.baseline.sha) {
      this.stale(latest);
      return;
    }
    savePublishCheckpoint(this.draftId, this.originalSource);
    this.historyView();
    this.status("Publishing reviewed README…");
    if (this.assetRows?.length) {
      const result = await executeAssetPlan(
        this.assetRows,
        this.target(),
        input.message,
        (op, data) => this.client.request(op, data),
      );
      this.querySelector("[data-asset-results]").textContent = result.results
        .map(
          (r) =>
            `${r.path}: ${r.status}${r.commitSha ? " (" + r.commitSha + ")" : ""}${r.error ? " — " + r.error : ""}`,
        )
        .join(" · ");
      this.querySelector("[data-confirm]").checked = false;
      this.querySelector("[data-commit]").disabled = true;
      if (!result.complete) {
        this.status(
          "Partial asset publish. README was not attempted. Review the reported files and reload the plan before retrying.",
        );
        return;
      }
      if (input.content === this.baseline.content) {
        this.status(
          "All reviewed assets published or unchanged. README needed no write. Local draft is unchanged.",
        );
        return;
      }
    }
    let result;
    try {
      result = await this.client.request("commit", input);
    } catch (e) {
      if (this.assetRows?.length)
        throw new Error(
          `Assets completed, but README failed: ${e.message} Reload and review before retrying.`,
        );
      throw e;
    }
    const repo = `https://github.com/${result.repository}`,
      file = `${repo}/blob/${encodeURIComponent(result.branch)}/${result.path.split("/").map(encodeURIComponent).join("/")}`;
    this.querySelector("[data-result]").innerHTML =
      `<p>Published commit <a href="${repo}/commit/${html(result.commitSha)}" target="_blank" rel="noopener noreferrer">${html(result.commitSha)}</a>. <a href="${repo}" target="_blank" rel="noopener noreferrer">Repository</a> · <a href="${html(file)}" target="_blank" rel="noopener noreferrer">README</a></p>`;
    this.querySelector("[data-commit]").disabled = true;
    this.querySelector("[data-confirm]").checked = false;
    const previous = result.previousCommitSha || this.baseline.commitSha;
    if (previous) {
      const link = document.createElement("a");
      link.href = `${repo}/blob/${previous}/${result.path.split("/").map(encodeURIComponent).join("/")}`;
      link.textContent = "View previous version on GitHub";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      this.querySelector("[data-result]").append(link);
    }
    if (this.branchBase) {
      const link = document.createElement("a");
      link.href = `${repo}/compare/${encodeURIComponent(this.branchBase)}...${encodeURIComponent(result.branch)}?expand=1`;
      link.textContent = "Prepare pull request on GitHub";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      this.querySelector("[data-result]").append(link);
    }
    try {
      recordPublish(result, previous);
      this.emit("publish-complete", {
        draftId: this.draftId,
        kind: this.kind || "readme",
        result,
      });
      this.historyView();
      this.status(
        `${this.kind === "workflow" ? "Workflow" : "README"} published. Your README source is unchanged.`,
      );
    } catch (e) {
      this.status(
        `README published (${result.commitSha}), but local history could not be saved. ${e.message}`,
      );
    }
  }
  historyView() {
    const area = this.querySelector("[data-history]");
    if (!area) return;
    try {
      const history = readPublishingHistory();
      area.innerHTML = `<details><summary>Local publishing history and recovery</summary>${history.checkpoint ? "<button data-recovery>Download pre-publish checkpoint</button><button data-restore>Restore checkpoint as a new draft</button>" : ""}<ol>${history.entries.map((e) => `<li>${html(e.repository)} · ${html(e.branch)} · ${html(e.path)} · ${html(e.commitSha)} · ${html(new Date(e.timestamp).toISOString())}</li>`).join("")}</ol></details>`;
      area.querySelector("[data-recovery]")?.addEventListener("click", () =>
        this.emit("publish-download", {
          content: history.checkpoint.source,
          name: "README-pre-publish.md",
        }),
      );
      area
        .querySelector("[data-restore]")
        ?.addEventListener("click", () =>
          this.emit("publish-restore", { source: history.checkpoint.source }),
        );
    } catch (e) {
      area.textContent = e.message;
    }
  }
  stale(remote) {
    this.latest = remote;
    this.querySelector("[data-commit]").disabled = true;
    this.querySelector("[data-confirm]").checked = false;
    const area = this.querySelector("[data-stale]");
    area.innerHTML = `<h2 tabindex="-1">Remote README changed since you loaded it</h2><details open><summary>View remote changes</summary><pre data-remote-diff></pre><label>Latest remote Markdown<textarea data-latest readonly rows="6"></textarea></label></details><button data-merge>Merge local and remote</button><button data-reload>Reload remote baseline and review local replacement</button><button data-cancel>Cancel publishing review</button><section data-conflicts></section>`;
    area.querySelector("[data-latest]").value = remote.content;
    area.querySelector("[data-remote-diff]").textContent = publishDiff(
      this.baseline.content,
      remote.content,
    ).text;
    area.querySelector("[data-merge]").onclick = () => this.mergeView();
    if (this.kind === "workflow") {
      area.querySelector("[data-merge]").hidden = true;
      area.querySelector("[data-reload]").textContent =
        "Reload workflow baseline and review generated replacement";
    }
    area.querySelector("[data-reload]").onclick = () => {
      this.baseline = remote;
      this.review();
      this.status(
        "Remote baseline reloaded. Review the replacement and confirm again.",
      );
    };
    area.querySelector("[data-cancel]").onclick = () => this.invalidate();
    area.querySelector("h2").focus();
    this.status(
      "Remote README changed. No write was made. Resolve or reload and review.",
    );
  }
  mergeView() {
    const parts = mergeThreeWay(
      this.baseline.content,
      this.source,
      this.latest.content,
    );
    const area = this.querySelector("[data-conflicts]");
    area.innerHTML = `<h3>Three-way merge</h3><p>Unchanged sections and non-overlapping section edits are combined. Resolve every conflicting section, then review the final source before any write.</p>${parts.map((p, i) => (p.conflict ? `<fieldset><legend>${html(p.title)}</legend><label>Local section ${i + 1}<textarea data-local="${i}" readonly></textarea></label><label>Remote section ${i + 1}<textarea data-remote="${i}" readonly></textarea></label><label>Resolution for ${html(p.title)}<select data-resolution="${i}"><option value="">Choose resolution</option><option value="local">Use local</option><option value="remote">Use remote</option><option value="combine">Combine local then remote</option><option value="manual">Edit manually</option></select></label><label>Manual resolution ${i + 1}<textarea data-manual="${i}" rows="5"></textarea></label></fieldset>` : "")).join("")}<button data-review-merge>Review merged README</button>`;
    for (const [i, p] of parts.entries())
      if (p.conflict) {
        area.querySelector(`[data-local="${i}"]`).value = p.local;
        area.querySelector(`[data-remote="${i}"]`).value = p.remote;
        area.querySelector(`[data-manual="${i}"]`).value = p.local;
      }
    area.querySelector("[data-review-merge]").onclick = () =>
      this.run(async () => {
        const decisions = {};
        for (const el of area.querySelectorAll("[data-resolution]"))
          decisions[el.dataset.resolution] = {
            choice: el.value,
            content: area.querySelector(
              `[data-manual="${el.dataset.resolution}"]`,
            ).value,
          };
        this.source = resolveMerge(parts, decisions);
        this.baseline = this.latest;
        this.review();
        this.status(
          "Merged source prepared. Review and confirm again. Local draft is unchanged.",
        );
        this.querySelector("[data-after]").focus();
      });
  }
  async createBranch() {
    if (!this.querySelector("[data-confirm-branch]").checked)
      throw new Error("Confirm branch creation first.");
    const newBranch = this.querySelector("[data-new-branch]").value;
    target({ ...this.baseline, branch: newBranch });
    savePublishCheckpoint(this.draftId, this.originalSource);
    const result = await this.client.request("branch", {
      ...this.baseline,
      newBranch,
      confirmed: true,
    });
    this.branchBase = this.baseline.branch;
    this.querySelector("[data-branch]").value = result.branch;
    this.invalidate();
    this.status(
      `Branch ${result.branch} created. Load remote README on that branch and review before committing.`,
    );
  }
}
customElements.define("publish-dialog", PublishDialog);
