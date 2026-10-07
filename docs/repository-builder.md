# Repository README builder

Open **Create → Repository README**, or choose **Build a repository README** from Templates. Profile templates remain available separately.

The repository templates are Web App, Library, CLI, API, npm Package, Rust Crate, Python Package, Game, Open Source, Tutorial, Documentation and Generic. They offer different section structures: a game includes controls and build instructions; a CLI includes commands and flags; a package includes compatibility and usage. Sections are suggestions, not universal requirements.

## From an audit

Choose **Improve README** on an audit result or queue item, or **Improve next** in the attention queue. The builder opens with the audit's manual project-type override, or its automatic suggestion, as the selected template. PWA maps to Web App and Experiment maps to Generic. You can change the template. **Open in Studio** in the queue continues to open the exact original README without templates.

Public repository name, description, homepage, primary language and topics appear in editable fields. Review them, correct them, or clear any optional value. A homepage is not a verified live demo, and language/topics are not claims about proficiency or completeness. Creating the draft confirms the displayed values. No additional metadata requests are made while editing the form.

Select only useful sections and expand **Review generated Markdown** to inspect the full source before creation. Existing README source is kept verbatim in its own Custom Markdown block by default, followed by reviewed context and the selected sections. This does not merge or deduplicate headings: deselect already-covered sections. Uncheck the preserve option only to explicitly start a separate fresh local draft. **Open existing README unchanged** remains available, including a blank draft for a missing README. Cancel/Escape creates nothing.

## Complete the documentation

**Create repository README** creates a new local draft and opens the builder. Each section is independently editable and removable, with ordinary Markdown available throughout. In v1.2.1, supported sections open [structured documentation builders](documentation-sections.md); other sections remain Custom Markdown. Unknown commands, setup details, environment values, authentication, versions, license terms and project behavior are never guessed. Generated HTML comments identify writing prompts; replace them with actual project information or remove irrelevant sections. Comments do not render in GitHub's preview, so inspect sections in the editor before publishing.

The reviewed values and selected template are stored in Studio metadata and survive project/backup export. Exported README content is ordinary Markdown/HTML; internal template metadata is not included. No GitHub write occurs in this flow. Existing drafts and the remote repository are untouched.

Text suggestions are escaped and homepage links must use safe HTTP(S) URLs. The generated source preview is a read-only text field, not arbitrary HTML execution. The shared dialog supports Escape, outside-click dismissal, keyboard focus handling and mobile scrolling.

In v1.2.2, new templates select [project-specific documentation builders](project-documentation.md). The Library recommends sections from that template and provides a manual project-type selector without rewriting existing content.
