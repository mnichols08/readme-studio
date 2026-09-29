# Editing and recovery

Markdown is canonical. Builder-owned blocks retain settings while serialization exactly matches their source. Custom Markdown is never silently converted into structured fields. A raw edit can detach ownership; keep editing the text or explicitly recreate a supported component.

Reorder sections with their up/down controls; drag-and-drop is not required. Undo/redo belongs to the active draft. History retains at most 80 checkpoints and an estimated 8 MB, so large documents retain fewer steps. History is not persisted across reloads. Workspace preferences and whole-workspace replacement are outside document undo.

Drafts and preferences autosave to localStorage after a short delay. Draft switching saves first, and page hide attempts a final flush. Browser termination cannot guarantee that last flush; use portable project downloads for independent copies. Failed saves are visible and must not be treated as success.

The draft menu creates, renames, duplicates and deletes drafts. After deletion focus moves to the draft selector. Dialogs return focus to their trigger; autosave and preview refresh do not move focus. App light/dark mode changes preview, and the preview control can override it separately without changing source.

For a single editable document, save a [Studio project](studio-projects.md). For everything, download the all-drafts backup. Restore validates first and offers merge or confirmed replacement. Merge generates new draft IDs and numbered names. Libraries, themes and workspace preferences participate in backup.

If storage is corrupt or unavailable, preserve the original recovery download and export your temporary work before closing. Original broken storage is not automatically overwritten. Future project schemas offer source-only recovery when readable. Truncated source strings cannot always be recovered. Clipboard denial offers selectable source; downloads use sanitized filenames.
