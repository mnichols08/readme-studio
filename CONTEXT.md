# Readme Studio

A local-first workspace for authoring GitHub profile and repository READMEs. This glossary covers the language used for documentation drift detection (Epic 13).

## Language

**Source**:
The user's own Markdown text of a document. Never used for anything fetched from GitHub.
_Avoid_: Using "source" for repository files or snapshots

**Evidence**:
A fact about a repository that was read from GitHub and could support or contradict a README statement.
_Avoid_: Proof, truth

**Evidence file**:
A repository file read as evidence: a recognised manifest or lockfile, the README itself, or a file the README links to by relative path.
_Avoid_: Source file

**Evidence Snapshot**:
A saved, explicitly requested record of a document's repository evidence at one moment: the branch head, the README revision, the Evidence files and the document's own Source hash at that time.
_Avoid_: Source revision snapshot, repository snapshot, backup

**Capture**:
The explicit user action that creates an Evidence Snapshot. Never happens as a side effect of another fetch.
_Avoid_: Auto-save, sync, scan

**Baseline**:
The one Evidence Snapshot per document that the user has pinned as the reference for later comparison and which retention never evicts.
_Avoid_: Golden, original

**Entry status**:
The outcome recorded for each Evidence file in a snapshot: `captured`, `missing` (GitHub reports it absent) or `failed` (could not be read, so its state is unknown).
_Avoid_: Error, skipped

**Partial snapshot**:
An Evidence Snapshot in which at least one Evidence file is not `captured`. Still saved, and a `failed` entry means unknown, never drift.
_Avoid_: Incomplete, corrupt

**Eligible document**:
A workspace document that has a repository, branch and path target, and so can be captured.
_Avoid_: Linked document
