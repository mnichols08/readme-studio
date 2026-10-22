# Readme Studio

A local-first workspace for authoring GitHub profile and repository READMEs. This glossary covers the language used for documentation drift detection (Epic 13) and for guided first-run and task-based UX (Epic 01).

## Language: documentation drift (Epic 13)

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

## Language: guided first-run and task-based UX (Epic 01)

### Starting

**Guided start**:
The screen that asks a new author what they want to do first, offering the three Goals, the Start paths and a plain statement of where their work is kept. Opens by itself only when the browser has no saved workspace; afterwards it is reopened on request.
_Avoid_: Onboarding, wizard, welcome tour, setup

**Goal**:
The first task an author chose in Guided start: a **Profile README**, a **Repository README** or a **README audit**. One per workspace, changed only by choosing again, and it never changes a document.
_Avoid_: Mode, persona, track, intent

**Start path**:
A way to begin that is not a Goal: start blank, import an existing README, pick a template, open a Studio project, autofill from GitHub or explore the sample. Every Start path that existed before Guided start stays reachable under its existing name.
_Avoid_: Shortcut, quick start, advanced entry route

**Locality statement**:
The fixed text in Guided start that says drafts stay in this browser, GitHub is contacted only when the author chooses a GitHub action, and nothing is published without its own review.
_Avoid_: Privacy banner, disclaimer

### Next steps

**Arrival**:
The moment a document was just created or opened by an import, an audit, a template or a blank start. Only the latest Arrival of the active document counts, and it is forgotten on reload or document switch.
_Avoid_: Event, trigger, moment, onboarding step

**Next step**:
A suggested existing tool shown after an Arrival, with a one-line reason. Choosing it only opens that tool's normal flow; a Next step never edits Source, applies a change or publishes.
_Avoid_: Recommendation, quick action, tip, auto-fix

**Next steps panel**:
The non-blocking region that lists at most three Next steps for the active document's Arrival, beside a route to all tools. It never takes focus by itself and the author can hide it or turn it off.
_Avoid_: Wizard, checklist, coach, popup

### Usability validation

**Usability scenario**:
A scripted realistic task with a fixed starting state, success criterion and audience, either **Novice** (first visit, no saved workspace) or **Experienced** (saved workspace, uses search, tools and shortcuts).
_Avoid_: Test case, user story, journey

**Scripted run**:
An automated execution of a Usability scenario's intended path that records whether it completes and how many author actions it takes. It measures navigation cost, not people.
_Avoid_: User test, usability evidence, session

**Participant session**:
A Usability scenario attempted by a real person with a facilitator taking notes. Its results exist only when such a session actually happened.
_Avoid_: Scripted run, simulated user

**Step count**:
The number of author actions (clicks, key presses, field entries) a Scripted run needs to complete a Usability scenario.
_Avoid_: Score, time on task, effort

**Friction**:
A recorded obstacle in one Usability scenario at a named step, with a severity from 1 (cannot complete) to 4 (cosmetic) and the kind of run that found it.
_Avoid_: Bug, complaint, pain point

## Language: safe GitHub publishing (Epic 08)

### Preflight

**Publish target**:
The exact repository, branch and file path one publishing review writes to. Chosen explicitly by the author; a suggested or saved target is never used until the author loads it.
_Avoid_: Destination, remote, upstream

**Preflight**:
An explicit, read-only check of whether the signed-in author can write to a Publish target now: publishing service, session, GitHub App installation and its permissions, the author's own repository access, archive state, branch existence and branch rules. Changes nothing on GitHub and is forgotten when the target changes.
_Avoid_: Permission scan, access test, dry run

**Preflight check**:
One named question in a Preflight with a status of `pass`, `warn`, `fail` or `unknown`. A blocking check that is not `pass` makes the target Read-only; an advisory check (branch rules, default branch) only warns, because GitHub decides at write time.
_Avoid_: Rule, validation, gate

**Read-only mode**:
The default state of every publishing review. Remote content can be loaded, reviewed and downloaded, but no write can be approved until a Preflight for that exact Publish target has every blocking check `pass`.
_Avoid_: Dry run, preview mode, locked

### Change sets

**Change set**:
The complete, reviewed list of file writes one publish will make to one Publish target and branch: each file's action, Base SHA and Result SHA, plus the commit message. Any change to any of these makes a different Change set.
_Avoid_: Patch, batch, plan, commit

**File change**:
One entry in a Change set: a `create` (the file must not exist), an `update` (from a named Base SHA) or `unchanged` (nothing is written). There is no delete and no overwrite without a Base SHA.
_Avoid_: Asset row, diff, operation

**Base SHA**:
The Git blob SHA of a remote file as loaded for review, or none for a file that does not exist. A write is allowed only while the remote file still has this SHA.
_Avoid_: Old SHA, parent, ETag

**Result SHA**:
The Git blob SHA that a File change's prepared content will have once written. It identifies the reviewed content exactly and is how a later check recognises the author's own write.
_Avoid_: Content hash, checksum, new SHA

**Publish approval**:
The author's explicit confirmation of one Change set, naming its target, branch and file count. It belongs to that Change set only and is withdrawn the moment the Change set changes or goes stale.
_Avoid_: Consent checkbox, sign-off, accept

**Stale change set**:
A Change set in which at least one remote file no longer has its Base SHA. Nothing is written; the author reviews the remote change and builds a new Change set.
_Avoid_: Conflict (reserved for merge sections), out of date, race

### Recovery

**Publish attempt**:
The execution of one approved Change set, writing its File changes one at a time. Can end complete, partial (some files written, the rest not attempted) or with an Ambiguous write.
_Avoid_: Run, job, transaction

**Write outcome**:
What is known about one File change after a Publish attempt: `written`, `not written`, `unknown` or `not attempted`.
_Avoid_: Status code, result, error

**Ambiguous write**:
A File change whose request may have reached GitHub but whose answer was lost: a dropped connection, a timeout or an unreadable reply. Its Write outcome is `unknown` until Reconciliation, and it is never retried blindly.
_Avoid_: Failed write, timeout error, network error

**Reconciliation**:
The explicit, read-only check that settles an `unknown` Write outcome by reading the remote file: its Result SHA means `written`, its Base SHA (or absence, for a create) means `not written`, and anything else means **diverged**, which needs a fresh review.
_Avoid_: Sync, retry, repair, rollback

**Publish journal**:
The machine-local record of the latest Publish attempt that is not yet settled: its target, File changes and their Write outcomes, without file content or credentials. It lets Reconciliation happen after a reload and is cleared once every outcome is settled or the author dismisses it.
_Avoid_: Publishing history, log, outbox, queue
