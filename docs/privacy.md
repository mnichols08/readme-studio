# Privacy

README Studio's core editor is local-first. Markdown rendering, section building, analysis, refactors and local exports run in the browser. There is no application analytics service or cloud draft account in this repository.

## Stored in this browser

Drafts, builder metadata, public GitHub snapshots, reusable badge collections, themes, snippets, favorites, recent choices and workspace preferences use browser storage. The optional local activity list stores bounded command identifiers and timestamps, not source or search terms. Publishing recovery keeps a local pre-publish source checkpoint and a bounded list of non-secret commit references.

Browser storage is not encrypted by Studio. Other users or software with access to the browser profile may read it. Download backups before clearing site data, changing devices or relying on private-browsing persistence. Portable exports contain the source and metadata you choose to include; treat them as documents that may contain personal information.

## Network requests

- GitHub import, autofill, repository lookup and explicit refresh/link checks contact GitHub or the requested public endpoint and use the identifiers you provide.
- Remote images, badges and widget previews contact their providers. The URL, URL parameters and your network address are visible to that provider. Studio does not proxy those requests or send the full draft as an analysis request.
- Clicking external links opens their sites. Their own privacy policies apply.
- Optional GitHub publishing sends the specifically reviewed file content and target to the same-origin publishing server and GitHub. Authentication credentials stay in that server's temporary session memory. Closing or clearing the browser alone is not a substitute for revoking an App grant on GitHub.

Generated workflow commands run only if you commit and run them on GitHub; their third-party actions have separate permissions and network behavior. Inspect them and their upstream documentation.

## Your control

Core authoring works without signing in. Network-dependent features may be unavailable offline; remote media can fail while editing and export remain usable. Clear local activity from its dialog, disconnect publishing from its dialog, export your documents, and use browser site-data controls to remove local data. The optional deployment host may keep access logs independently of this code; ask its operator about retention.

## Optional Writing Assistant

Writing assistance is off until you configure an endpoint/model, confirm the displayed content and choose Generate. The request sends the selected Original, optional notes, explicitly checked context and the chosen editing instructions to that endpoint; the API key is an Authorization header. Other drafts, unchecked repository metadata and editing history are not sent. The exact messages are displayed before sending; every optional context source starts unchecked. Connections are held in tab memory, not browser storage, projects, backups or exports; Forget connection or reload clears them. Changing the endpoint clears the key.

Provider processing, retention and billing depend on your chosen service. The request asks not to store the completion, but Studio cannot guarantee provider policy. Browser network tools and extensions can still access a key used by the page. Use a trusted local endpoint or an operator-controlled gateway for shared deployments; never bundle an operator secret into a public site. No connection test, model-list fetch, background generation or automatic retry occurs. See [Writing Assistant](writing-assistant.md).
