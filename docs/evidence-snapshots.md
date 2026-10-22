# Evidence snapshots

Version 1.6.0 starts documentation drift detection. An **evidence snapshot** records what GitHub reports for a document's repository at one moment, so you can later see whether the repository moved on while your README stayed the same. Snapshots are evidence only: they never edit your Markdown, never decide that a README is wrong and never write to GitHub.

## What a snapshot records

Capture reads two public GitHub API responses for the document's target: the latest commit on its branch and that commit's repository tree. From those it records:

- the target repository, branch and README path, and the capture time;
- the **branch head** commit SHA;
- the **README revision** (Git blob SHA) at the target path;
- revisions of recognised root **manifests** (`package.json`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`, `go.mod`) and **lockfiles** (for example `package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `go.sum`);
- revisions of up to 40 files or folders your Markdown links to by relative path, resolved from the README's folder. External links, anchors, `mailto:` links and examples inside code fences are ignored;
- a fingerprint of your local Markdown at capture time.

Only revisions are stored, never the content of repository files. Each evidence file has an **entry status**: `captured`, `missing` (GitHub reports it absent) or `failed` (could not be read, so its state is unknown).

## Capture

1. Give the document a repository, branch and README path in **Documents** (see [Workspace documents](workspace-documents.md)). Local documents without a target cannot be captured; the dialog explains this and offers **Set document target**.
2. Open **GitHub → Evidence snapshots**, or **Evidence snapshots** in the Documents dialog.
3. Choose **Capture evidence snapshot**. Capture happens only when you choose it, never as a side effect of import, refresh, audit or publishing. **Cancel** stops it and nothing is saved.

Requests use the same public, credential-free GitHub client as the README audit, including its timeout, one retry for transient failures and shared rate-limit pause. If the branch head cannot be read (offline, rate limited, repository or branch not found), nothing is saved and existing snapshots are unchanged.

If the head is read but the tree is not, or GitHub truncates a very large tree, the snapshot is still saved as a **partial snapshot**. Files that could not be confirmed are `failed`, shown as unknown and explained in the snapshot's notes. A missing linked file also makes a snapshot partial, but its absence is a confirmed fact rather than an unknown.

## Read the list

Snapshots for the current document are listed newest first. Each shows its capture time, branch head, README revision and counts, with an expandable **Evidence files** table. Labels describe its state:

- **Baseline** — the one snapshot you pinned as this document's reference.
- **Partial snapshot** — at least one evidence file is not `captured`.
- **Different target** — the document's repository, branch or path has changed since capture. It cannot be pinned or used for a change check; capture a new snapshot for the current target.
- **Markdown edited since capture** / **Markdown unchanged since capture** — compares the stored fingerprint with your current Markdown. It is a fast non-cryptographic hash meant only to notice edits.

## Baseline and change check

**Pin as Baseline** marks one snapshot per document as the reference; pinning another moves the Baseline. **Run change check** reads GitHub again and compares the chosen snapshot with the repository now. It saves nothing. Results list each evidence file as:

- `unchanged`, `changed` — same or different revision;
- `added` — absent at capture (with a complete tree) and present now, including newly added manifests or lockfiles;
- `removed` — captured before and confirmed absent now;
- `unknown` — could not be read in the snapshot or now. Unknown is never reported as drift.

The branch head comparison is shown separately. A changed head with every file unchanged usually means commits touched other files. Interpreting changes in commands, links or configuration is planned for later releases; this release does not inspect file contents or propose edits.

## Retention, storage and recovery

Snapshots are kept in this browser's workspace storage. Each document keeps its newest 5 snapshots plus its Baseline, and the workspace keeps at most 100. Older non-Baseline snapshots are removed when a capture exceeds those limits, and the status message says how many. A Baseline is never removed automatically; if all 100 retained snapshots are Baselines, capture asks you to unpin or delete one first. **Delete snapshot** removes one explicitly, with confirmation for a Baseline. Deleting a document deletes its snapshots.

**Download all drafts backup** includes snapshots. Restore follows the existing rules: replace uses the backup's snapshots, merge keeps local snapshots and adds incoming ones (a local Baseline wins), and snapshots follow their documents when document IDs are regenerated. Damaged or future-version snapshot data opens the existing temporary recovery workspace with the original storage untouched; individually valid snapshots are salvaged. In recovery mode, and when storage is full, capture, pin and delete save nothing and say so. Snapshots can still be read and checked.

Snapshots are machine-local by design. They are not included in `.readme-studio.json` projects, single-draft JSON or README exports, so the project schema is unchanged and shared files never carry third-party repository data. See [ADR 0001](adr/0001-evidence-snapshots-stay-machine-local.md).

## Offline and accessibility

Saved snapshots remain readable offline. Capture and change checks need a connection and fail with an offline message without changing anything. All actions are native buttons; status updates use a polite live region, focus returns to the capture button after capture or to the changed control after pin/unpin, and change-check results move focus to their heading. Automated checks cover keyboard operation at 320px; they do not replace manual screen-reader review.

## Limits

- Public repositories only. Private repositories and authenticated reads are out of scope.
- Trees larger than the client's 2 MB response bound, or truncated by GitHub, produce partial snapshots.
- Manifests and lockfiles are recognised at the repository root only.
- Linked paths come from your local Markdown, not from the README currently on GitHub.
