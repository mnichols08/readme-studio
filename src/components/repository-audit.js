import { html as h } from "../markdown/serialize.js";
import { githubUsername } from "../state/github-profile.js";
import {
  auditClient,
  auditSession,
  filterRepositories,
  auditRepositories,
} from "../repository-audit/github.js";
import {
  projectTypes,
  assessProjectType,
  suggestProjectType,
} from "../repository-audit/project-types.js";
import { auditAnalyzer } from "../repository-audit/analyzer.js";
import { activityStatus } from "../repository-audit/presentation.js";

export class RepositoryAudit extends HTMLElement {
  connectedCallback() {
    this.state = auditSession;
    this.innerHTML = `<h1>Repository README audit</h1><p>Find documentation that needs attention using evidence, not scores. Only public owned repositories are listed. README content is analyzed locally; nothing is published.</p><form data-load><label>GitHub username<input name="username" autocomplete="off" required maxlength="200" value="${h(this.state.username)}"></label><button type="submit">Load repositories</button></form><p class="hint">100 repositories per page, up to 1,000. Three concurrent README requests. GitHub's unauthenticated rate limit may stop larger scans. Results and a bounded source cache stay in this tab; cached requests expire after five minutes.</p><div class="audit-controls"><label><input type="checkbox" data-forks ${this.state.includeForks ? "checked" : ""}> Include forks</label><label><input type="checkbox" data-archived ${this.state.includeArchived ? "checked" : ""}> Include archived repositories</label><label><input type="checkbox" data-fresh> Fetch fresh README content</label><button data-more>Load next 100 repositories</button><button data-select>Select all filtered repositories</button><button data-clear>Clear selection</button><button data-scan>Audit selected</button><button data-cancel disabled>Cancel audit</button></div><p data-status role="status" aria-live="polite"></p><p data-count></p><div class="audit-table-wrap"><table class="audit-table"><caption>Public repository documentation evidence</caption><thead><tr><th scope="col">Select / Repository</th><th scope="col">README state and evidence</th><th scope="col">Activity / Language</th><th scope="col">Actions</th></tr></thead><tbody></tbody></table></div><div class="audit-pagination"><button data-prev>Previous results</button><span data-page></span><button data-next>Next results</button></div><p>Improve README opens a new local draft and preserves the exact fetched source. Missing READMEs start blank. Project types and English documentation signals are suggestions. Missing topics are commonly useful, never universally required; evidence is not a judgment of the project or its developer.</p>`;
    this.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      this.load(false);
    };
    this.querySelector("[data-more]").onclick = () => this.load(true);
    for (const [selector, key] of [
      ["[data-forks]", "includeForks"],
      ["[data-archived]", "includeArchived"],
    ])
      this.querySelector(selector).onchange = (e) => {
        this.state[key] = e.target.checked;
        this.state.viewPage = 0;
        this.list();
      };
    this.querySelector("[data-select]").onclick = () => {
      for (const repo of this.filtered())
        this.state.selected.add(repo.full_name);
      this.list();
    };
    this.querySelector("[data-clear]").onclick = () => {
      this.state.selected.clear();
      this.list();
    };
    this.querySelector("[data-scan]").onclick = () => this.scan();
    this.querySelector("[data-cancel]").onclick = () => this.cancel();
    this.querySelector("[data-prev]").onclick = () => {
      this.state.viewPage--;
      this.list();
    };
    this.querySelector("[data-next]").onclick = () => {
      this.state.viewPage++;
      this.list();
    };
    this.status(
      this.state.notice ||
        "Enter a username, select repositories, then audit their READMEs.",
    );
    this.list();
  }
  disconnectedCallback() {
    this.cancel();
  }
  cancel() {
    this.controller?.abort();
    this.analyzer?.close();
  }
  status(message) {
    this.state.notice = message;
    this.querySelector("[data-status]").textContent = message;
  }
  filtered() {
    return filterRepositories(this.state.repositories, this.state);
  }
  selected() {
    return this.filtered().filter((repo) =>
      this.state.selected.has(repo.full_name),
    );
  }
  controls() {
    this.querySelectorAll(
      "form input, form button, .audit-controls input, .audit-controls button, tbody input, tbody button, tbody select",
    ).forEach((el) => {
      el.disabled = !!this.busy;
    });
    this.querySelector("[data-cancel]").disabled = !this.busy;
    this.querySelector("[data-more]").disabled =
      !!this.busy || !this.state.next;
    this.querySelector("[data-scan]").disabled =
      !!this.busy || !this.selected().length;
    this.querySelector("[data-count]").textContent =
      `${this.filtered().length} included of ${this.state.repositories.length} loaded · ${this.selected().length} selected`;
  }
  list() {
    const repos = this.filtered(),
      pages = Math.max(1, Math.ceil(repos.length / 25));
    this.state.viewPage = Math.max(0, Math.min(pages - 1, this.state.viewPage));
    this.visible = repos.slice(
      this.state.viewPage * 25,
      (this.state.viewPage + 1) * 25,
    );
    this.querySelector("tbody").innerHTML = this.visible
      .map(
        (repo, i) =>
          `<tr data-row="${i}"><th scope="row"><label><input type="checkbox" aria-label="Select ${h(repo.full_name)}" data-repo="${i}" ${this.state.selected.has(repo.full_name) ? "checked" : ""}>${h(repo.name)}</label>${repo.fork ? "<small>Fork</small>" : ""}</th><td data-result></td><td>${h(activityStatus(repo))}<br>${h(repo.language || "Language not specified")}<br><small>Last push: ${h(repo.pushed_at || "Unknown")}<br>Updated: ${h(repo.updated_at || "Unknown")}</small></td><td data-actions></td></tr>`,
      )
      .join("");
    this.querySelectorAll("[data-repo]").forEach((box) => {
      box.onchange = () => {
        const name = this.visible[Number(box.dataset.repo)].full_name;
        box.checked
          ? this.state.selected.add(name)
          : this.state.selected.delete(name);
        this.controls();
      };
    });
    this.visible.forEach((repo) => this.result(repo));
    this.querySelector("[data-page]").textContent =
      `Page ${this.state.viewPage + 1} of ${pages} · 25 rows per page`;
    this.querySelector("[data-prev]").disabled = this.state.viewPage === 0;
    this.querySelector("[data-next]").disabled =
      this.state.viewPage + 1 >= pages;
    this.controls();
  }
  result(repo) {
    const index = this.visible.findIndex((r) => r.full_name === repo.full_name);
    if (index < 0) return;
    const row = this.querySelector(`[data-row="${index}"]`),
      record = this.state.results.get(repo.full_name);
    const cell = row.querySelector("[data-result]");
    if (!cell.querySelector("[data-type]")) {
      cell.innerHTML = `<div data-assessment></div><p data-suggestion></p><label for="audit-type-${index}">Project type for ${h(repo.full_name)}</label><select id="audit-type-${index}" data-type><option value="auto">Automatic suggestion</option>${projectTypes.map((type) => `<option value="${type.id}">${h(type.name)}</option>`).join("")}</select><p class="hint" data-type-mode></p>`;
      cell.querySelector("[data-type]").onchange = (event) => {
        const choice = event.target.value;
        if (choice === "auto") this.state.typeOverrides.delete(repo.full_name);
        else this.state.typeOverrides.set(repo.full_name, choice);
        this.result(repo);
        this.status(
          `Project type updated for ${repo.name}. ${record?.result ? "Assessment updated from cached evidence." : "Audit the README to assess documentation."}`,
        );
      };
    }
    const choice = this.state.typeOverrides.get(repo.full_name) || "auto";
    const assessment = record?.result
      ? assessProjectType(record.result, choice)
      : null;
    const suggestion = record?.result?.suggestion || suggestProjectType(repo);
    const suggestedName = projectTypes.find(
      (type) => type.id === suggestion.id,
    ).name;
    cell.querySelector("[data-assessment]").innerHTML = assessment
      ? `<strong>${h(assessment.label)}</strong><ul>${assessment.evidence.map((v) => `<li>${h(v)}</li>`).join("")}</ul><small>Checked ${h(new Date(record.checkedAt).toLocaleString())}</small>`
      : `<strong>Not assessed</strong><p>${h(record?.error || "Select this repository to fetch and analyze its README.")}</p>`;
    cell.querySelector("[data-suggestion]").textContent =
      `Suggested type: ${suggestedName}. ${suggestion.reason} This is an inference, not a certainty.${suggestion.alternatives.length ? ` Other signals: ${suggestion.alternatives.map((id) => projectTypes.find((t) => t.id === id).name).join(", ")}.` : ""}`;
    cell.querySelector("[data-type]").value = choice;
    cell.querySelector("[data-type]").disabled = !!this.busy;
    cell.querySelector("[data-type-mode]").textContent =
      choice === "auto"
        ? "Using the automatic suggestion. You can choose another type."
        : "Manual override; retained in this tab. Choose Automatic suggestion to reset.";
    const url = `https://github.com/${repo.full_name.split("/").map(encodeURIComponent).join("/")}`;
    const readme = record?.readme;
    row.querySelector("[data-actions]").innerHTML =
      `<a href="${h(url)}" target="_blank" rel="noopener noreferrer">Open repository</a>${readme?.path ? `<a href="${h(`${url}/blob/${encodeURIComponent(repo.default_branch || "HEAD")}/${encodeURIComponent(readme.path)}`)}" target="_blank" rel="noopener noreferrer">Open README</a>` : ""}${record?.result ? `<button data-improve ${this.busy ? "disabled" : ""}>Improve README</button>` : ""}`;
    const improve = row.querySelector("[data-improve]");
    if (improve) improve.onclick = () => this.improve(repo);
  }
  async load(more) {
    if (this.busy) return;
    let username;
    try {
      username = githubUsername(this.querySelector("[name=username]").value);
    } catch (error) {
      this.status(error.message);
      return;
    }
    if (more && username.toLowerCase() !== this.state.username.toLowerCase()) {
      this.status("Load this username first before requesting another page.");
      return;
    }
    if (!more && username.toLowerCase() !== this.state.username.toLowerCase()) {
      Object.assign(this.state, {
        username,
        repositories: [],
        page: 0,
        next: false,
        viewPage: 0,
        selected: new Set(),
        results: new Map(),
        typeOverrides: new Map(),
      });
      this.list();
    }
    this.busy = true;
    this.controller = new AbortController();
    this.controls();
    this.status("Loading public owned repositories…");
    try {
      const result = await auditClient.repositories(
        username,
        more ? this.state.page + 1 : 1,
        { signal: this.controller.signal },
      );
      if (!this.isConnected || this.controller.signal.aborted) return;
      this.state.repositories = [
        ...new Map(
          [
            ...(more ? this.state.repositories : []),
            ...result.repositories,
          ].map((r) => [r.full_name, r]),
        ).values(),
      ];
      this.state.username = result.username;
      this.state.page = more ? this.state.page + 1 : 1;
      this.state.next = result.next;
      if (!more) this.state.viewPage = 0;
      this.status(
        `${this.state.repositories.length} repositories loaded.${result.capped ? " Reached the 1,000 repository limit." : ""}${result.skipped ? ` ${result.skipped} unreadable/non-public entries omitted.` : ""} Select repositories to audit.`,
      );
    } catch (error) {
      if (this.isConnected)
        this.status(
          this.controller.signal.aborted
            ? "Loading cancelled; loaded repositories retained."
            : `Repository list incomplete. ${error.message}`,
        );
    } finally {
      this.busy = false;
      if (this.isConnected) this.list();
    }
  }
  async scan() {
    if (this.busy || !this.selected().length) return;
    const selected = this.selected(),
      total = selected.length,
      fresh = this.querySelector("[data-fresh]").checked,
      repos = selected.filter(
        (repo) => fresh || !this.state.results.get(repo.full_name)?.result,
      ),
      retained = total - repos.length;
    if (!repos.length) {
      this.status(
        `Audit complete: ${total} of ${total} checked; 0 not assessed. Retained completed assessments; choose Fetch fresh to recheck.`,
      );
      return;
    }
    this.busy = true;
    this.controller = new AbortController();
    this.analyzer = auditAnalyzer();
    this.controls();
    this.status(
      `Auditing ${repos.length} READMEs; retaining ${retained} completed assessments…`,
    );
    let count = retained,
      failures = 0;
    try {
      const summary = await auditRepositories(repos, {
        client: auditClient,
        signal: this.controller.signal,
        force: fresh,
        analyze: (source, repo) => this.analyzer.analyze(source, repo),
        onResult: (record) => {
          if (!this.isConnected || this.controller.signal.aborted) return;
          this.state.results.set(record.repo.full_name, record);
          count++;
          if (record.error) failures++;
          this.result(record.repo);
          if (count % 10 === 0)
            this.status(
              `Assessed ${count} of ${total} repositories; ${failures} fetch/analysis failures.`,
            );
        },
      });
      if (this.isConnected)
        this.status(
          `${summary.cancelled ? "Audit cancelled" : summary.stopped ? "Audit paused" : "Audit complete"}: ${count} of ${total} checked; ${failures} not assessed. ${retained} completed assessments retained. ${summary.stopped || "Results retained in this tab."}`,
        );
    } catch (error) {
      if (this.isConnected) this.status(`Audit stopped. ${error.message}`);
    } finally {
      this.analyzer.close();
      this.busy = false;
      if (this.isConnected) {
        this.list();
        if (this.closest("dialog")?.open)
          this.querySelector("[data-scan]").focus();
      }
    }
  }
  async improve(repo) {
    if (this.busy) return;
    this.busy = true;
    this.controller = new AbortController();
    this.controls();
    this.status("Opening exact README source in a new local draft…");
    try {
      const readme = await auditClient.readme(repo, {
        signal: this.controller.signal,
      });
      if (!this.isConnected || this.controller.signal.aborted) return;
      this.dispatchEvent(
        new CustomEvent("audit-improve", {
          bubbles: true,
          detail: { repo, readme },
        }),
      );
    } catch (error) {
      if (this.isConnected)
        this.status(`Could not open README. ${error.message}`);
    } finally {
      this.busy = false;
      if (this.isConnected) this.controls();
    }
  }
}
customElements.define("repository-audit", RepositoryAudit);
