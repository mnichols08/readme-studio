import { PublishingClient } from "../github/publishing-client.js";
import { html } from "../markdown/serialize.js";
import { target, writeInput } from "../publishing/validation.js";
import { publishDiff } from "../publishing/diff.js";
export class PublishDialog extends HTMLElement {
  connectedCallback() {
    this.client = new PublishingClient();
    this.innerHTML = `<h1>Publish to GitHub</h1><p>Optional publishing. Your local draft stays unchanged. Every write requires a source review and confirmation.</p><p role="status" data-status>Checking connection…</p><section data-auth></section><section data-target></section><section data-review></section><button data-download>Download README fallback</button>`;
    this.querySelector("[data-download]").onclick = () =>
      this.emit("publish-download", {
        content: this.source,
        name: "README.md",
      });
    this.run(() => this.session());
  }
  configure(draft) {
    this.source = draft.markdown;
    this.draftId = draft.id;
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
    area.innerHTML = `<h2>Choose target</h2><p>Suggested profile repository: ${html(this.auth.identity.login)}/${html(this.auth.identity.login)}. Confirm your own selection. If missing, <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">create it on GitHub</a> and install the app for it.</p><label>Target repository<select data-repo><option value="">Select repository</option>${repositories.map((r) => `<option value="${html(r.repository)}">${html(r.repository)} · ${html(r.visibility)} · ${r.writable ? "write access" : "read only"} · default ${html(r.branch)}</option>`).join("")}</select></label><label>Target branch<input data-branch autocomplete="off"></label><label>README path<input data-path value="README.md" autocomplete="off"></label><button data-load>Load remote README</button>`;
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
    });
  }
  invalidate() {
    this.baseline = null;
    this.plan = null;
    this.querySelector("[data-review]").replaceChildren();
    this.status("Target changed. Load the remote README again.");
  }
  review() {
    const b = this.baseline,
      diff = publishDiff(b.content, this.source),
      writable = this.repositories.find(
        (r) => r.repository === b.repository,
      )?.writable;
    this.querySelector("[data-review]").innerHTML =
      `<h2>Review ${b.sha ? "updated file" : "New file"}</h2><p>${html(b.repository)} · branch ${html(b.branch)} · ${html(b.path)}</p><p>SHA baseline: <code>${html(b.sha || "New file (does not exist)")}</code></p><p>${diff.added} added / ${diff.removed} removed lines in changed region. Sections: ${html(diff.sections.join(", ") || "body content")}.</p><div class="publish-sources"><label>Remote Markdown<textarea data-before rows="8" readonly></textarea></label><label>Prepared Markdown<textarea data-after rows="8" readonly></textarea></label></div><details open><summary>Unified source diff</summary><pre data-diff tabindex="0" aria-label="Publishing diff"></pre></details><label>Commit message<input data-message value="Update README with README Studio" maxlength="500"></label><label class="check"><input type="checkbox" data-confirm> I reviewed this diff and confirm ${b.sha ? "updating" : "creating"} this exact repository, branch and path.</label><button data-commit ${!writable || b.content === this.source ? "disabled" : ""}>Confirm and publish README</button><div data-result></div>`;
    this.querySelector("[data-before]").value = b.content;
    this.querySelector("[data-after]").value = this.source;
    this.querySelector("[data-diff]").textContent = diff.text;
    this.querySelector("[data-commit]").onclick = () =>
      this.run(() => this.commit());
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
    this.status("Publishing reviewed README…");
    const result = await this.client.request("commit", input);
    const repo = `https://github.com/${result.repository}`,
      file = `${repo}/blob/${encodeURIComponent(result.branch)}/${result.path.split("/").map(encodeURIComponent).join("/")}`;
    this.querySelector("[data-result]").innerHTML =
      `<p>Published commit <a href="${repo}/commit/${html(result.commitSha)}" target="_blank" rel="noopener noreferrer">${html(result.commitSha)}</a>. <a href="${repo}" target="_blank" rel="noopener noreferrer">Repository</a> · <a href="${html(file)}" target="_blank" rel="noopener noreferrer">README</a></p>`;
    this.querySelector("[data-commit]").disabled = true;
    this.querySelector("[data-confirm]").checked = false;
    this.status("README published. Your local draft is unchanged.");
  }
}
customElements.define("publish-dialog", PublishDialog);
