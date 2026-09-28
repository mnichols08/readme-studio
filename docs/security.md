# Security boundaries

## Source and preview

Markdown is untrusted input. The preview renders locally and sanitizes its HTML through DOMPurify and the shared URL-safety boundary. Script-bearing HTML, event handlers and dangerous URL schemes are removed from the preview. Sanitization never rewrites the user's Markdown. Export intentionally preserves source, including unsafe examples or markup: sanitize again if you later render that source in another application.

Analysis and deterministic refactors inspect text; they do not execute it. Applying a refactor requires source review and an explicit action. Structured metadata is not executable code. Imported metadata is escaped before display; imported source follows the same preview sanitizer as typed source.

## Generated assets and workflows

Banner SVG comes from bounded, validated settings and escaped strings. The generator does not accept arbitrary SVG, external fonts, scripts or `foreignObject`. Generated-asset publishing independently regenerates the expected SVG on the server. Workflow generation validates paths, schedules and provider settings, uses secret-name placeholders and shows requested permissions. Explicit user-supplied commands are executable **when the workflow is run on GitHub**, not in Studio; inspect them before committing.

## Optional GitHub publishing

The optional same-origin Node service keeps GitHub credentials in ephemeral server sessions. The browser receives an HttpOnly/Secure/SameSite cookie and holds a CSRF nonce in memory. State-changing requests require the configured origin and nonce. The server uses a fixed host/operation allowlist, validates targets and permissions, and checks remote SHAs before writes. Workflow writes require an additional server opt-in and permission.

Draft autosave is never a GitHub write. Publishing requires a reviewed repository, branch, path, diff, message and confirmation. Asset batches are separate commits and can partially succeed; the UI reports each outcome and stops on failure. Conflicts require a fresh review. See [publishing setup](github-publishing.md) for session expiry, limits and deployment responsibilities.

Disconnect destroys the server session; it does not revoke the GitHub App grant. Manage or revoke that grant on GitHub. Tokens must not be placed in frontend environment variables, source, URLs, workflows, backups, logs or project metadata. Studio does not scan arbitrary user-authored README text for secrets; review what you choose to export or publish.

## Local data and external services

Browser drafts and libraries are local, unencrypted data available to software with access to that browser profile. Clearing site data can remove them. Download backups and keep sensitive information out of READMEs. Storage failure opens a recoverable/temporary workspace instead of silently overwriting unreadable originals.

Previewing remote images contacts their hosts and can disclose IP address and URL parameters. External widgets and badges remain third-party services; Studio does not proxy their traffic. Follow links to their upstream documentation and inspect generated markup. See [privacy](privacy.md).

## Reporting a vulnerability

Use the repository's private **Report a vulnerability** route on [GitHub Security](https://github.com/mnichols08/readme-studio/security) when available. If private reporting is unavailable, open an issue asking the maintainer for a private contact channel without posting exploit details, credentials or private README content. Do not test attacks against other users' deployments or repositories.

Automated security fixtures and mocked publishing tests do not constitute an independent security audit. Production HTTPS/proxy configuration and a real GitHub App installation require separate operator verification before public publishing is enabled.
