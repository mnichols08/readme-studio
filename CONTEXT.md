# Readme Studio

A local-first workspace for authoring GitHub profile and repository READMEs. This glossary covers the language used for documentation drift detection (Epic 13), guided first-run and task-based UX (Epic 01), the actionable README audit (Epic 03), and repository evidence and stack intelligence (Epic 04).

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
A way to begin that is not a Goal: start blank, import an existing README, pick a template, open a Studio project, autofill from GitHub, restore a backup or explore the sample. Every Start path that existed before Guided start stays reachable under its existing name.
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

## Language: actionable README audit (Epic 03)

### Improvement plans

**Audit finding**:
One observation from a repository's README audit that may call for a change: a missing or thin README, a project-type topic that was not detected, leftover placeholder or starter text, an unavailable link or image, or README history that predates significant activity. Every Audit finding has a stable identity, so decisions and snapshots can refer to the same finding across audits.
_Avoid_: Issue, problem, error, violation, Observed mismatch (a Drift check term)

**Improvement plan**:
The ordered list of Recommendations for one audited repository, derived from its latest successful audit and the author's Audit decisions. It is recalculated, never saved, and is not a score.
_Avoid_: Score, report, checklist, to-do list

**Recommendation**:
One concrete suggested change in an Improvement plan, derived from exactly one Audit finding. It cites the evidence that was observed and its Applicability, names what to add or review, and never supplies content, commands, links or facts that the audit did not observe.
_Avoid_: Fix, requirement, rule, Next step, Fix proposal

**Applicability**:
The statement on a Recommendation of why it fits this repository's project type, where that type came from, and when the Recommendation might not apply.
_Avoid_: Severity, importance, confidence score

**Plan band**:
The descriptive group a Recommendation belongs to: **Start here**, **Next** or **Optional**. Bands order a plan; they are not ratings of the README or its author.
_Avoid_: Priority score, severity, Attention priority (the queue's High/Medium/Low)

**Skip** (Recommendation):
Setting a Recommendation aside for the rest of this session without saying anything about whether it applies.
_Avoid_: Ignore for now (the queue's seven-day decision), defer, snooze

**Dismissal**:
The author's explicit statement that a Recommendation does not apply to a repository, made against one Observed revision. A missing or thin README cannot be dismissed; Intentionally minimal covers that.
_Avoid_: Ignore, mute, resolve, false-positive flag

### Persistent audit decisions

**Audit decision**:
An explicit choice the author made about a repository in the audit and that this browser keeps: a Manual project type, Ignore for now, Intentionally minimal or a Dismissal. Only ever created by the author's own action.
_Avoid_: Preference, setting, rule

**Canonical repository**:
The case-insensitive owner/name identity that Audit decisions and Audit snapshots are keyed by. A renamed or transferred repository is a different Canonical repository.
_Avoid_: Repository URL, repository ID

**Observed revision**:
The README revision the audit saw when a decision was made or a snapshot was saved: a Git blob revision, or confirmed absence of a root README.
_Avoid_: Version, commit, README SHA

**Stale decision**:
A revision-bound Audit decision whose Observed revision differs from the one the latest audit saw. It is kept and shown, but no longer applied until the author confirms it again or forgets it.
_Avoid_: Expired, invalid, orphaned

**Manual project type**:
The project type the author chose for a repository instead of the automatic suggestion. It belongs to the repository, not to a README revision.
_Avoid_: Override (in user-facing text), forced type

### Audit change tracking

**Audit snapshot**:
A saved, explicitly requested record of the audit results already on screen for one account at one moment: per repository its Observed revision, README state, project type and Audit findings. It holds no README content, does not contact GitHub and is never saved as a side effect.
_Avoid_: Evidence Snapshot (per document), audit history, scan, report

**Partial audit snapshot**:
An Audit snapshot in which at least one included repository was not assessed. Still saved; the unassessed repositories are unknown, never clean.
_Avoid_: Incomplete, failed snapshot

**Audit comparison**:
A read-only comparison of two Audit snapshots of the same account that reports each Audit finding as added, resolved, unchanged or unknown. It describes only what the two captures observed and never implies monitoring in between.
_Avoid_: Trend, monitoring, live diff, Change check (a per-document term)

**Resolved** (Audit comparison):
An Audit finding observed in the earlier snapshot and not in the later one, with the repository re-assessed in the later snapshot under the same project type and audit rules. It means no longer observed, not fixed.
_Avoid_: Fixed, closed, done

**Unknown** (Audit comparison):
An Audit finding whose change cannot be decided: the repository was not assessed or not captured in one snapshot, was not re-audited between them, its links were checked in only one, or its project type or the audit rules changed. Unknown is never reported as added or resolved.
_Avoid_: Skipped, unchanged, passed

## Language: repository evidence and stack intelligence (Epic 04)

### Discovery

**Manifest**:
A recognised file in a repository that declares dependencies for one ecosystem (`package.json`, `Cargo.toml`, `pyproject.toml`, `requirements.txt` or `go.mod`). A manifest is read as data and never executed.
_Avoid_: Config, build file, lockfile

**Declaration**:
One dependency or engine statement in a Manifest, with its ecosystem and kind (runtime, development, peer, build, optional). A Declaration says what a repository asks for, never what a developer knows or what runs in production.
_Avoid_: Skill, usage, technology, dependency graph

**Project boundary**:
A directory in a repository that holds at least one Manifest and is treated as its own project: the repository root, a Workspace member or a Nested project. Every Declaration belongs to exactly one Project boundary.
_Avoid_: Package, module, app, sub-repo

**Workspace declaration**:
A root-level statement that names member directories: `workspaces` in `package.json`, `packages` in `pnpm-workspace.yaml`, `[workspace] members` in `Cargo.toml`, `use` in `go.work` or `[tool.uv.workspace] members` in `pyproject.toml`. Read as data; patterns it cannot interpret are reported, not guessed.
_Avoid_: Monorepo config, workspace file

**Workspace member**:
A Project boundary whose directory is named by a Workspace declaration.
_Avoid_: Child package, sub-project

**Nested project**:
A Project boundary below the root that holds a Manifest but is not named by any Workspace declaration, for example `docs/site/package.json`. Shown separately from Workspace members because it may be an example or tool rather than part of the product.
_Avoid_: Orphan, member

**Nested discovery**:
The separately consented, bounded search of one repository tree listing for Manifests below the root. Off unless the author turns it on for the session; root-only analysis is unchanged without it.
_Avoid_: Crawl, recursive scan, deep scan

**Discovery limit**:
A fixed bound on Nested discovery (directory depth, excluded directories, Manifests read per repository, repositories per run). A Manifest beyond a limit is reported as found but not read, never as absent.
_Avoid_: Quota, cutoff

### Freshness and confidence

**Provenance**:
Where and when one Declaration was observed: repository, branch, Project boundary, Manifest path, file revision, section, line when known, and Observed at.
_Avoid_: Source (that word means the author's Markdown), citation, origin

**Observed at**:
The time Studio read the Manifest from GitHub. Not the time the Manifest was last changed and not the commit date.
_Avoid_: Updated at, last modified, timestamp

**Stale** (stack result):
A stack result that may no longer match the repository: the loaded repository list reports a newer push than the one the scan started from, or it was Observed at more than 24 hours ago. Stale is a reason to refresh, never a claim that anything changed. Not the same as a Different target or an Observed mismatch.
_Avoid_: Outdated, expired, invalid

**Confidence basis**:
The named reason a Declaration is believed, one of **explicit** (stated directly in a supported field), **inherited** (resolved from a workspace table in the same file), **conditional** (optional, peer, build or target-specific, so it may not be active) or **ambiguous** (the file cannot distinguish direct from generated or aliased entries). A basis comes with a one-line explanation and is never a percentage or ranking.
_Avoid_: Confidence score, certainty, accuracy

**Uncertain stack result**:
A Declaration whose Confidence basis is conditional or ambiguous, or a Manifest that was found but not read. Shown beside explicit results with its reason, never hidden and never promoted.
_Avoid_: Uncertain finding (that is a Drift check result), warning, low confidence

### Evidence to documentation

**Evidence suggestion**:
Editable README text derived only from Declarations and Manifest facts of one stack result, carrying the Provenance it came from. Starts unselected.
_Avoid_: Recommendation, generated section, auto-fill

**Command suggestion**:
An Evidence suggestion that contains a shell command, built only from a fixed set of conventional commands for the evidence present. It is documentation text that Studio never runs.
_Avoid_: Script, action, run step

**Technology claim**:
An Evidence suggestion that states the repository uses a technology, package manager or published package, such as a Detected stack section, a badge or a registry link.
_Avoid_: Skill, proficiency, stack badge

**Confirmation**:
The author's explicit per-item acknowledgement that a selected Command suggestion or Technology claim is true for their repository. Required before the exact diff can be reviewed, separate from diff approval, and cleared when the item's text changes.
_Avoid_: Approval (that is for the whole diff), consent (that is for reading manifests), verification

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

_Publish attempts run since story #98: files are written in order and the attempt stops at the first failure, leaving later files `not attempted`. Ambiguous writes, the `unknown` and `not written` outcomes, Reconciliation and the Publish journal are planned for story #99; not implemented yet._

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
