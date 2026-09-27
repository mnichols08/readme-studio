# Component Library

Open **Components** or **Library → Browse Component Library**. Search names, descriptions and tags, filter thirteen categories, or select Favorites, Recently used and Saved by you. Built-ins are copied for editing; saving never mutates their definitions. Results render forty cards at a time with Show more.

Select Preview to inspect a starter, edit supported fields and view its generated Markdown. Render preview uses the same sanitizer as the main README preview. Images may contact their external hosts; lists never load remote images. Widget starters identify their upstream project and setup requirements. Placeholder image URLs need your own published output before sharing a README.

Insert at cursor without replacing selected text, before/after an explicitly selected section, or append. In this release, generated source is inserted as Custom Markdown; Undo restores the previous draft. Cursor insertion preserves all source, and conservatively gives the raw editor ownership of the whole document.

Save My Snippet accepts a name, category, description, comma-separated tags and exact Markdown. Selecting editor text before opening Components pre-fills the source field. Saved source preserves line endings and template-like text; custom snippets never interpolate placeholders. Built-in supported fields use explicit escaped interpolation and safe URL validation, never evaluation.

Favorites, thirty recent IDs and up to 500 saved snippets persist locally and participate in all-drafts backup/restore. Malformed libraries use storage recovery without overwriting the original. Imports/restores resolve IDs and names without silent overwrite. Failed saves are visible. Raw Markdown/HTML in snippets is user source, not executable application code; preview sanitization never rewrites exported Markdown.
