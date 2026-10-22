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

**Change check**:
A read-only comparison of a chosen Evidence Snapshot against the repository's current state. Saves nothing and reports each Evidence file as `unchanged`, `changed`, `added`, `removed` or `unknown`.
_Avoid_: Diff, sync, refresh

**Different target**:
The label on an Evidence Snapshot whose repository, branch or path no longer matches its document's current target. Such a snapshot cannot be used as a Baseline for comparison.
_Avoid_: Stale, orphaned

**Claim**:
A checkable statement in a document's Source: a shell command, a repository path, a link or anchor, or a config key or version. Claims are read from the user's local Source, never from the README on GitHub.
_Avoid_: Assertion, fact

**Drift check**:
An explicit, read-only comparison of a document's Claims with Evidence read from the repository now, including the bounded content of a few Evidence files. Saves nothing, runs nothing and never edits Source.
_Avoid_: Lint, scan, audit, validation

**Observed mismatch**:
A Drift check result where Evidence directly contradicts a Claim, for example `npm run lint` when the repository's root `package.json` has no `lint` script.
_Avoid_: Error, broken, stale

**Uncertain finding**:
A Drift check result where a heuristic suggests drift but the Claim may still be correct, for example a missing file under `dist/` or a Node version in prose. Never presented as an Observed mismatch.
_Avoid_: Warning, false positive

**Unknown** (Drift check):
A Claim whose Evidence could not be read or does not cover it (failed or truncated tree, unreadable file, workspace package). Unknown is never drift.
_Avoid_: Skipped, passed

**Fix proposal**:
A reviewed, line-level edit derived from an Observed mismatch or Uncertain finding of one Drift check. It shows the finding's Evidence and exact diff, may carry a suggestion only when Evidence supplies one, starts unapproved and is applied only after explicit per-change approval. Never derived from an Unknown result. Not saved.
_Avoid_: Auto-fix, quick fix, patch

**Conflict** (drift fix):
The Source, document or target changed after the Drift check that produced the Fix proposals. Nothing is applied; the author re-runs the check.
_Avoid_: Merge, rebase
