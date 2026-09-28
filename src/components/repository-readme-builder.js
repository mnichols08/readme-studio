import {
  repositoryTemplates,
  repositorySuggestions,
  buildRepositoryTemplate,
} from "../data/repository-templates.js";
import { html as h, serializeBlocks } from "../markdown/serialize.js";

export class RepositoryReadmeBuilder extends HTMLElement {
  configure({ repo = {}, readme = null, projectType = "generic" } = {}) {
    this.repo = repo;
    this.readme = readme;
    const suggestions = repositorySuggestions(repo, projectType);
    this.innerHTML = `<h1>Repository README builder</h1><p>Review the public repository suggestions below. They are not verified documentation. Choose useful sections and write the actual instructions; no commands, credentials, compatibility or license terms are invented.</p><form><label>Repository template<select name="template" aria-label="Repository template">${repositoryTemplates.map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join("")}</select></label><p>Suggested project type: ${h(projectType)}. You can choose another template. PWA uses Web App; Experiment uses Generic.</p><fieldset><legend>Review repository suggestions</legend>${[
      ["name", "Repository name"],
      ["description", "Repository description"],
      ["homepage", "Repository homepage"],
      ["language", "Primary language"],
      ["topics", "Repository topics"],
    ]
      .map(
        ([key, label]) =>
          `<label>${label}<input name="${key}" value="${h(suggestions[key])}" maxlength="${key === "description" ? 2000 : 1000}" ${key === "name" ? "required" : ""}></label>`,
      )
      .join(
        "",
      )}<p>Clear any suggestion you do not want to include. Homepage is a supplied URL, not a verified live demo.</p></fieldset>${readme?.source != null ? '<label><input type="checkbox" name="preserve" checked> Keep existing README verbatim and append selected template sections</label><p>Existing content is not rewritten or deduplicated. Deselect sections already covered. Starting fresh creates a separate local draft.</p>' : ""}<fieldset data-sections><legend>Sections to include — editable after creation</legend></fieldset><details><summary>Review generated Markdown</summary><textarea data-source readonly aria-label="Generated repository README" rows="12"></textarea></details><p role="status"></p><button type="submit">Create repository README</button>${readme ? '<button type="button" data-original>Open existing README unchanged</button>' : ""}</form>`;
    this.querySelector('[name="template"]').value = suggestions.templateId;
    this.drawSections();
    this.querySelector('[name="template"]').onchange = () => {
      this.drawSections();
      this.preview();
    };
    this.querySelector("form").oninput = () => this.preview();
    this.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      try {
        const plan = this.plan();
        this.dispatchEvent(
          new CustomEvent("repository-readme-create", {
            bubbles: true,
            detail: plan,
          }),
        );
      } catch (error) {
        this.status(error.message);
      }
    };
    this.querySelector("[data-original]")?.addEventListener("click", () =>
      this.dispatchEvent(
        new CustomEvent("repository-readme-original", { bubbles: true }),
      ),
    );
    this.preview();
  }
  drawSections() {
    const template = repositoryTemplates.find(
      (t) => t.id === this.querySelector('[name="template"]').value,
    );
    this.querySelector("[data-sections]").innerHTML =
      `<legend>Sections to include — editable after creation</legend>${template.sections.map((section) => `<label><input type="checkbox" data-section value="${h(section)}" checked> ${h(section)}</label>`).join("")}`;
  }
  status(message) {
    this.querySelector("[role=status]").textContent = message;
  }
  plan() {
    const form = this.querySelector("form"),
      values = Object.fromEntries(new FormData(form));
    const templateId = values.template;
    const sections = [...this.querySelectorAll("[data-section]:checked")].map(
      (el) => el.value,
    );
    const [owner, repository] = (this.repo.full_name || "").split("/");
    const sourceContext =
      owner && repository
        ? {
            type: "github",
            owner,
            repository,
            ref: this.repo.default_branch || "HEAD",
            readmePath: this.readme?.path || "README.md",
            sha: this.readme?.sha || "",
            fetchedAt: new Date().toISOString(),
          }
        : null;
    const blocks = buildRepositoryTemplate({
      templateId,
      values,
      sections,
      existing: values.preserve ? this.readme.source : null,
      sourceContext,
    });
    return {
      name: `${values.name.trim()} README`,
      blocks,
      metadata: {
        ...(sourceContext
          ? { repository: this.repo.full_name, importSource: sourceContext }
          : {}),
        repositoryReadme: {
          version: 1,
          templateId,
          reviewed: {
            name: values.name,
            description: values.description,
            homepage: values.homepage,
            language: values.language,
            topics: values.topics,
            projectType: templateId,
          },
        },
      },
    };
  }
  preview() {
    try {
      this.querySelector("[data-source]").value = serializeBlocks(
        this.plan().blocks,
      );
      this.status(
        "Review the suggestions and selected sections before creating a new draft.",
      );
    } catch (error) {
      this.querySelector("[data-source]").value = "";
      this.status(error.message);
    }
  }
}
customElements.define("repository-readme-builder", RepositoryReadmeBuilder);
