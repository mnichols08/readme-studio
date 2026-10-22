# Editing and recovery

Markdown is canonical. Builder-owned blocks retain settings while serialization exactly matches their source. Custom Markdown is never silently converted into structured fields.

## Source-preserving raw edits

Typing in the Markdown editor changes only the Blocks your edit touches (its Edited scope). Every byte outside it stays identical, including CRLF line endings, a byte order mark, trailing whitespace, fenced code and HTML.

- Editing inside a Custom Markdown block, such as a split section, keeps that block, its section label and its source origin.
- Typing between two sections, or at the start or end of the document, adds the text to a neighbouring Custom Markdown block or to a new one. Builder, component and generated sections next to it keep their visual ownership.
- Editing inside an Owned block (a builder section, a component, a generated, shared or profile section, or the inserted banner) causes a Detachment: that block becomes a Custom Markdown block holding exactly what you typed. An edit that spans several blocks merges them into one Custom Markdown block. A change made in several places at once, such as drift fixes or reviewed refactors, detaches only the blocks each change touches; untouched sections between them keep their ownership. Deleting a section's last line, or an edit that reaches only the blank line before the next section, leaves that next section alone. Text that runs on from a section's last line changes that line, so it detaches that section too, for example typing over the line break before the next heading. Moving an Owned section to another place in one edit detaches it, and its record sits on the Custom Markdown block that now holds its text.
- A Detachment is never silent. A polite status message names what was detached, for example "Raw edit detached: Tech Stack (builder). Undo restores visual ownership.", without moving focus. The Sections list shows "Detached from Tech Stack" on that block.
- Each Detachment is saved as a Detachment record on the document. Records travel with Undo, autosave, draft and workspace backups and Studio projects, keep only the 20 newest entries, and never appear in exported Markdown. A record that kept the single builder or component section it replaced is Restorable. That copy of the earlier settings stays in this browser (Undo and autosave): downloads (Studio projects, draft and workspace backups) keep only the record's kinds and the section names that still appear in the Markdown (a generic name such as "Builder section" replaces any other) and leave out records of sections deleted since, so text you removed with a raw edit never travels in a file; restoring it through an Ownership review arrives with a later release. Until then, use Undo.
- In the rare case the patch cannot be proven exact, the whole draft becomes one Custom Markdown block, as in earlier releases, and the message "All sections became Custom Markdown; Undo restores them." appears. Raw editing is never blocked.

Moving or removing a section keeps the spacing between the other sections. Where a moved section's last line has no line break, a blank line is added after it so it never runs into the next heading.

Raw edits work offline and never contact the network. An empty document or an edit that changes nothing creates no Detachment record.

Reorder sections with their up/down controls; drag-and-drop is not required. Undo/redo belongs to the active draft. History retains at most 80 checkpoints and an estimated 8 MB, so large documents retain fewer steps. History is not persisted across reloads. Workspace preferences and whole-workspace replacement are outside document undo.

Drafts and preferences autosave to localStorage after a short delay. Draft switching saves first, and page hide attempts a final flush. Browser termination cannot guarantee that last flush; use portable project downloads for independent copies. Failed saves are visible and must not be treated as success.

The draft menu creates, renames, duplicates and deletes drafts. After deletion focus moves to the draft selector. Dialogs return focus to their trigger; autosave and preview refresh do not move focus. App appearance follows the device color preference until you use the editor toolbar toggle to set a persistent light/dark override. The preview control can override README preview colors separately without changing source.

For a single editable document, save a [Studio project](studio-projects.md). For everything, download the all-drafts backup. Restore validates first and offers merge or confirmed replacement. Merge generates new draft IDs and numbered names. Libraries, themes and workspace preferences participate in backup.

If storage is corrupt or unavailable, preserve the original recovery download and export your temporary work before closing. Original broken storage is not automatically overwritten. Future project schemas offer source-only recovery when readable. Truncated source strings cannot always be recovered. Clipboard denial offers selectable source; downloads use sanitized filenames.
