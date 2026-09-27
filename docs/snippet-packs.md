# Portable snippet packs

Open **Snippet packs** to select saved snippets, saved badge collections, or copies of current draft sections. Project, widget, layout and other draft sections export as exact Custom Markdown snippets in v0.5.2; supported component definitions may retain editable template fields. Original drafts remain unchanged. Supply a pack name, description, optional author, HTTP(S) homepage and license note, then Download selected pack. Download all reusable snippets backup exports saved reusable snippets and badge collections, excluding draft-only sections.

Packs are ordinary versioned JSON files:

```json
{
  "version": 1,
  "type": "readme-studio-snippet-pack",
  "name": "My GitHub Profile Kit",
  "description": "Reusable source",
  "author": "Optional author",
  "homepage": "https://example.com",
  "license": "Optional license note",
  "snippets": [],
  "badgeCollections": []
}
```

Each snippet uses the version-1 component model described in [Components](components.md). The importer accepts up to 10 MB, 500 snippets and 500 badge collections, validates types/fields and rejects unsupported versions. Optional `badgeCollections` defaults to empty. Arbitrary Markdown/HTML is preserved as source; metadata is bounded plain text, URLs are validated, and no templates are evaluated as code. Pack license notes are user-provided descriptions, not a license verification service.

Import a file or paste JSON, then Review snippet pack. Review shows name, metadata, counts, existing collisions and item source. Explicit Render item preview sanitizes Markdown; remote images contact their hosts. Four editable examples are included: Minimal Profile Kit, Open Source Kit, Terminal Kit and Developer Showcase Kit. They contain placeholders, not personal data or live provider configuration.

The collision policy applies to all conflicts, including repeated entries inside a pack:

- **Keep both** (default): preserve existing items, assign new IDs when needed and add numbered name suffixes.
- **Replace**: requires confirmation and replaces a matching saved item while retaining its ID. If an incoming ID and name match two different saved items, replacement is rejected; choose Keep both or Skip.
- **Skip**: ignore conflicting incoming entries and preserve local items.

Cancel import changes nothing. Import writes reusable snippets and badge collections atomically before updating in-memory saved state. A failed save leaves the current library intact and the review available. Imported items join Component Library and all-drafts backups; restoring that workspace retains favorites/recents too. Pack files contain reusable content and file metadata, not workspace preferences. They can be committed to GitHub, attached to a repository, shared in a gist or sent directly. README Studio needs no sharing backend or accounts. Relative assets still need to accompany the README in its target repository.
