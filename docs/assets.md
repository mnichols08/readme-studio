# Generated asset publishing

Save or insert a banner in Banner Builder, then open **Publish to GitHub**. Select the repository/branch/README, enable **Include generated banner SVG files**, and choose a visible relative asset directory (default `assets/readme`). Load remote README to prepare the entire plan. This is optional; SVG downloads remain available without authentication.

Each generated light/dark file shows its path, byte size, remote SHA, new/changed/unchanged status and textual source diff. Existing SVG source is displayed as text, never injected into the UI. A filename absent from the prepared README raises an advisory unreferenced-file warning. Review the prepared README and every listed asset before confirming.

The server generates each SVG again from validated banner settings and compares it byte-for-byte with the requested content. Arbitrary SVG/filesystem uploads are not supported. Paths must be relative, in visible folders, with an SVG filename; absolute paths, traversal, hidden/token files and workflow directories are rejected. Assets are capped at 250 KB; files over 100 KB receive a size warning. No remote deletion occurs.

## Owned reference updates

Banner markup inserted by this version records its block identity and exact generated source. The optional path rewrite works only while that block and source remain unchanged and builder serialization still matches the draft. Manual Markdown editing detaches this reference; pre-existing raw banner links are never inferred as owned. Nested README paths receive correctly relative links. Rewrites affect the prepared publishing copy, not the local draft. Download the prepared README if you want to retain that version locally.

## Conflicts and partial completion

All asset SHAs are checked before the first write. The server checks again immediately before each Contents API update; GitHub enforces the SHA precondition. A conflict requires reloading and reviewing the plan. Assets are committed sequentially and README last. This is **not atomic**: if a later file fails, earlier commits remain. The result lists each successful commit, failed file and unattempted file. README is not attempted after an asset failure. Reload the plan before retrying; already identical files will be unchanged. A lost network response can make a write outcome uncertain—inspect GitHub before retrying.

The pre-publish source checkpoint remains downloadable/restorable as a new draft. Local README source and saved banner settings remain unchanged on both success and failure. See [authentication, permissions and recovery](github-publishing.md).
