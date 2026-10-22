# Detachment records are saved on the document, bounded and additive

A Detachment must not be silent. A transient notice alone is lost on reload, and Undo history is not persisted. So each Detachment adds a record to `draft.metadata.detachments`. A record holds the current Block ID, the previous Block IDs, labels and ownership kinds, a timestamp and, only when it is Restorable, a copy of the single previous builder or component Block (at most 32 KB of JSON, otherwise `null`). The list keeps the 20 newest records and drops the oldest. Records are part of the draft, so they follow Undo/redo, autosave, workspace backups and Studio projects. They never appear in exported Markdown.

We considered a separate storage key (it would then be left out of backups and projects, and would need its own recovery path) and an in-memory list (lost on reload). We chose additive metadata because the code already handles optional ownership metadata this way. The storage key stays `readme-studio:v1` and the project schema stays 1, with no migration.

Readers ignore malformed or unknown entries and never rewrite them on read. When block IDs are remapped (project open, backup merge), `blockId` and `previousBlockIds` are remapped too. A record whose Block no longer exists is dropped; the Markdown itself is untouched.
