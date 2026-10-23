# Example provenance is explicit Source metadata

Implemented in v1.9.14.

Each structured documentation code field owns a local status and verification note. Its Markdown emits only an inert, portable status comment before the fence. New fields default to Placeholder; Verified requires a note; imported and legacy examples remain unclassified until the author explicitly edits and saves them.

Copy and export parse only bounded status comments. Placeholder, invalid or incomplete results require an explicit unchanged-Source continuation guarded by a fresh draft snapshot. Studio never runs commands or examples and does not infer verification from repository contents, filenames or successful application behavior.

We rejected automatic command execution because imported source is untrusted and environment-dependent. We rejected silently treating authored text as verified because provenance is a claim the author must make explicitly. Notes stay local because they may describe internal verification context and are not needed by README readers.
