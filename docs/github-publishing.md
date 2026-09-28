# GitHub publishing

Publishing is optional. Static hosting (including GitHub Pages and ordinary Netlify builds) keeps every local editing/export feature and displays a setup message instead of pretending authentication is configured. No real GitHub writes are performed by the test suite.

## Server setup

The optional, dependency-free Node 22 service serves `dist` and a small same-origin `/api/publishing/` boundary. Build with `npm run build`, then run `npm run serve:publishing` behind an HTTPS reverse proxy. Set **server-only** environment variables:

- `PUBLISH_ORIGIN`: exact public HTTPS origin, for example `https://studio.example.com` (no trailing slash or subpath).
- `GITHUB_APP_CLIENT_ID`: the registered GitHub App client ID.
- `PORT`: optional loopback service port, default 8787.

Register a GitHub App with repository **Contents: read/write** and **Metadata: read**, enable device flow and expiring user access tokens, and install it only on selected repositories. No organization/admin permissions, private key, client secret, PAT field, or frontend environment variables are needed. Keep the backend on loopback behind the proxy; do not log request bodies, cookies, authorization headers, or authentication responses. Apply deployment-level connection/rate limits. A public deployment requires the operator to register/install this app and configure HTTPS; this repository does not contain credentials or a deployed authentication service.

## Authentication boundary

Connect GitHub displays a short-lived user code for GitHub's device authorization page. Check authorization after approving on GitHub. Only approve a code you requested in Studio; never share it. This extra step deliberately avoids authorization-code callback URLs and client secrets in a static bundle. GitHub recommends web flow for browser applications; this implementation uses its supported device flow to meet the no-code-in-URL boundary. See [GitHub's user access token documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).

Access tokens and pending device codes live only in server memory. Refresh tokens are discarded. The browser receives an opaque `HttpOnly; Secure; SameSite=Lax` session cookie, plus a CSRF nonce held only in the publishing component. POSTs require the exact configured Origin and nonce. Sessions expire after at most one hour; a restart signs everybody out. Disconnect immediately deletes the server session; it does not uninstall/revoke the GitHub App grant (manage that on GitHub). There is no silent refresh or login-triggered publish.

This intentionally small deployment supports one server process. Multi-instance/serverless deployments require a separately reviewed shared session store and are not supported by the memory implementation. The server caps sessions and serializes operations per session, bounds bodies, times out upstream requests, rejects redirects, and uses fixed GitHub hosts/operation routes. It never returns or logs raw GitHub error bodies or credentials. Authentication state is entirely separate from drafts, backups, snippets and exported README files.

## Review and publish

1. Connect, then choose an explicitly selected repository. The picker shows visibility, default branch, and effective write status based on app installation and user access. A profile repository is suggested, never assumed or created.
2. Enter the branch and README path. Load remote README captures its exact text, blob SHA and branch commit separately from your local draft.
3. Review remote/prepared source, the unified changed-region diff, line counts and headings. The diff uses bounded linear memory and may include unchanged interior lines within a changed region; source panes are authoritative.
4. Edit the commit message and check the confirmation naming the target. Confirm and publish makes exactly one Contents API write, using the loaded SHA for updates and omitting it only for a new file. GitHub rejects a stale SHA. No files are deleted.
5. Success shows the commit, repository and file links. Local source remains unchanged. Failure keeps the prepared source/diff and Download README fallback. If a network response is lost, check GitHub before retrying; a remote write may have completed.

Publishing supports UTF-8 README text up to 750 KB, relative README paths without hidden folders/traversal, and valid Git ref names. Read-only repositories remain exportable. Offline editing/export works; publishing needs connectivity. Changing the target invalidates the review. Source is a snapshot taken when opening publishing, so unrelated background editor changes cannot silently change the reviewed commit.

## Verification

`npm test` includes server tests in Node with mocked OAuth and Contents responses: cookie flags, CSRF/Origin rejection, permission enforcement, token redaction, read/create/update, exact Unicode source and disconnect. `tests/browser/publishing.spec.js` covers explicit confirmation, unchanged local source, new files, denied writes and mobile download fallback in all three engines. Manual deployment verification with a real app is still required before offering publishing publicly; automated tests do not prove an operator's proxy/configuration is secure.

The API contract follows [GitHub Contents documentation](https://docs.github.com/en/rest/repos/contents). Check upstream permission changes when enabling new write types.

## Concurrent changes and recovery (0.8.1)

The browser and server re-fetch the remote blob SHA before a commit. A changed SHA stops publishing. Review the latest remote changes, merge, reload the baseline for an explicitly reviewed local replacement, or cancel. GitHub's SHA precondition also guards the race between the final read and write.

Three-way merge compares the loaded remote BASE, prepared LOCAL and latest REMOTE. Independent changes in uniquely identified, unchanged section structures merge automatically. Rename/reorder/duplicate-heading and structural changes fall back to an explicit whole-document conflict. Each conflict offers local, remote, combine (local then remote), or manual text. A new diff and unchecked confirmation follow every merge. This changes only prepared publishing source, never the local draft.

A source checkpoint is saved locally before a write; inability to save stops publishing. Download it or restore it as a **new Custom Markdown draft** under Local publishing history and recovery. This recovery preserves source, not builder ownership. The latest checkpoint and at most 50 metadata-only commit records live in a separate versioned browser key. Existing malformed history is never overwritten. History save failure after a successful remote commit is reported as a local failure, not a failed remote write.

Target branch remains explicit. Optional Create branch requires its own confirmation and unchanged source commit SHA, then requires loading and reviewing the README on that new branch. After committing, a GitHub compare link helps prepare a PR; Studio does not create or merge it. Branch protection is never bypassed. Previous/new commit links provide recovery context without implementing destructive rollback.
