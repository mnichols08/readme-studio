# Project Showcase Studio

## Manual projects

Open Project Studio from the header to edit the first showcase or create one. The existing project builder also opens its selected block in Project Studio. This working copy is separate from the draft until Save showcase; closing with unsaved changes asks before discarding. Undo restores the saved change in one step.

Add a project, name the problem it solves, and explain what you personally contributed. Roles, project types and status have suggestions but accept custom text. Engineering highlights have repeatable titles and descriptions: describe architecture, testing, accessibility, performance or meaningful technical decisions. Nothing is auto-written.

Search the shared technology catalog or enter a custom technology. Choose inline code chips (default), badges or plain text. Repository, Live Demo, Case Study and custom links render only when populated and safe. Optional status can be text, badge or hidden; manually entered status is not a verified GitHub fact.

Images use a URL, meaningful alt text, optional click target, width and alignment. There is no upload service. Attach a saved badge collection as an independent copy or compose a badge with the existing Badge Studio. Remote images contact their providers when previewed; source stays local.

Use native details controls to collapse editors, and labeled buttons to move, duplicate or delete entries. The preview renders the same serialized section that will be saved. Existing legacy project fields migrate when opened, including links, highlights, technologies and original status Markdown, but their source is unchanged until Save. If conversion fails, the original Markdown remains editable/exportable. Imported/custom Markdown is never automatically converted.

## GitHub import and refresh

Choose Import GitHub projects, enter owner/repository, and look up public metadata. Or run GitHub Autofill first to cache its public repository list locally, then filter by name/description, language, archived state or fork state and sort by name, stars or updated date. Select up to fifty repositories per batch. Up to three lookups run concurrently with twelve-second timeouts; failed repositories do not discard successful results. No README HTML or dependency manifests are fetched, and no authentication is required.

Review name, description, homepage, primary language, topics, archived state, license and the returned stars/forks snapshot. Missing statistics remain Unknown. Choose fields to apply; technology and archived-status suggestions are opt-in. No role or engineering highlight is inferred. Existing repository URLs produce a duplicate warning and require explicit confirmation. Applying review edits only the working showcase; Save showcase updates the draft.

Imported entries record repository identity, last fetch time, the public snapshot and generated field values. Refresh from GitHub fetches that source again and shows the same review. A field is refreshed only if it is still equal to its previously imported value; manually changed fields and fields that were never imported are preserved. Roles and highlights never come from GitHub. Reopening or reloading retains this ownership record. Rate limits, missing repositories, offline/network failures and timeouts are explained; no automatic retries or writes to GitHub occur.

Reference: [GitHub repository metadata API](https://docs.github.com/en/rest/repos/repos#get-a-repository).
