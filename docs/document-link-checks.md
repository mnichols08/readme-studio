# Cross-document link checks

README Studio can compare relative links and anchors with the documents currently open in the workspace. Open **Documents → Check document links** for the whole workspace. Exporting a path-aware document runs the same check first.

The check is local and read-only. It parses Markdown links and HTML anchor links, resolves relative paths from the source document's folder, and compares exact case-sensitive paths with other workspace documents. For Markdown targets it checks GitHub-style heading anchors and explicit HTML `id` or `name` anchors. External URLs, email links, images and examples inside code fences are outside this check. No URL is requested.

Documents created by a [Documentation suite](documentation-suites.md) use their intended suite path. Repository READMEs use their saved document target. A local document without either path is counted as not checked, because relative navigation has no safe base.

## Results and export

The report distinguishes:

- a target document that is not open in the workspace;
- two documents with the same path, which makes the target ambiguous;
- an anchor absent from the one matching target;
- a relative path that is invalid or leaves the workspace root.

The checker reads at most 500 documents and 200 links per source document and displays at most 1,000 issues. Any omitted documents, links or issues are stated; truncation never becomes a clean result.

When the current document has unresolved or truncated navigation, **Export README** opens the report instead of downloading immediately. **Export current source anyway** keeps the existing source byte-for-byte and requires all checked workspace paths and Source to be unchanged since the report opened. Fixing links is always a manual edit. A moved document path therefore makes old links unresolved until the author updates them; the checker never rewrites paths.
