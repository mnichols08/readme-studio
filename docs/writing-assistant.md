# Writing Assistant

Version 1.4.1 adds explicit context to optional AI editing. README Studio's editor, builders, preview, exports and local recovery still work without an AI account, connection or model.

## Original → Proposed → Diff → Apply

1. Select text in the Markdown editor, then open **Review → Writing assistant** (also available in workspace search).
2. Confirm **Content to edit**. Choose selected text, a named Markdown section, or **New section at cursor**. The exact affected source appears under **Original**. For an empty insertion, choose **Draft section** and supply factual notes.
3. Choose an action: Draft section, Improve wording, Shorten, Expand, Make more technical, Make more casual, Turn notes into bullets, Turn bullets into paragraph, or Grammar cleanup.
4. Optionally add facts or instructions. Configure a trusted chat-completions endpoint, its model identifier and an API key if required. Confirm the content being sent, then choose **Generate proposal**.
5. Inspect and edit **Proposed**. Generation never changes the draft. You can also paste a proposal manually without connecting AI.
6. Choose **Review diff**, inspect the complete current/resulting README and line diff, approve the exact change, then **Apply**.

Changing the proposal or inputs invalidates approval. A draft changed elsewhere cannot be overwritten: reopen the assistant against the current draft. Applying replaces only the chosen range; surrounding source remains exact. Check heading spacing when drafting at the cursor. The existing source-edit path converts builder content to Custom Markdown to avoid stale settings overwriting edits; Undo restores source and ownership. AI metadata is not embedded in exported Markdown.

The assistant requests fact-preserving edits but cannot guarantee correctness. Review claims, URLs, commands, code and placeholders. Expansion is not permission to invent project capabilities or developer proficiency.

## Optional connection

Provide the **full endpoint ending in `/chat/completions`**, such as a local server's `http://localhost:1234/v1/chat/completions`, and a model that server actually provides. No model or paid provider is selected automatically. HTTPS remote endpoints and HTTP loopback endpoints are supported. Browser CORS access must be enabled by the endpoint operator; Studio cannot bypass it.

The adapter uses the [documented chat-completions message format](https://developers.openai.com/api/reference/cli/resources/chat), non-streaming text, `store: false`, and an 8,192 completion-token limit. Compatible providers must accept those fields and return a complete text choice with `finish_reason: "stop"`. Tool calls, refusals, partial/truncated or empty responses are rejected. Not every provider or model implements this subset identically. Automated tests use mocked responses; no paid provider availability or live model quality is certified by the release checks.

Connection settings and keys live only in this tab's memory. They never join drafts, local storage, backups, project files or exports. **Forget connection** or reload clears them; changing endpoint clears the key and consent. For shared deployments, use your own secured gateway and keep operator secrets server-side. Never ship a shared API key in a public frontend. A user's entered key is accessible to that browser session, its developer tools and extensions.

Only Original, optional notes, explicitly selected context and fixed editing instructions are sent after confirmation and Generate. No surrounding README, other drafts or repository metadata is included automatically. Provider retention/billing rules still apply; `store: false` is a request, not a guarantee about an external service. No source or response logging is added by Studio.

## Limits and recovery

- Original plus notes and serialized context: 32,000 characters. Choose a smaller selection for large READMEs.
- Proposed Markdown: 64,000 characters; provider JSON response: 512 KB maximum.
- One request at a time, 60-second timeout, no automatic retries.
- Cancel request or close the dialog to stop waiting. Late responses cannot overwrite a locally edited proposal.
- Authentication, missing model/endpoint, usage limits, malformed responses and network/CORS failures leave the draft untouched.
- Manual proposal editing and review work offline once the app is loaded. Remote generation requires connectivity; local models depend on local server/browser access.

Source proposals are displayed as text, never executable HTML. After Apply, the normal preview sanitizer still applies; exported source remains ordinary user-controlled Markdown.

## Trusted context (1.4.1)

Seven optional sources appear in the assistant, all unchecked each time it opens:

- **GitHub profile:** allowlisted facts from this draft's previously imported public profile snapshot; excludes email, credentials and repository lists.
- **Selected repository:** choose one already loaded public repository. Only its displayed fields are available; no new fetch occurs.
- **Project type:** this draft's chosen documentation type, editable before inclusion. A type describes intent, not proof of features.
- **Stack DNA:** existing session evidence for the chosen repository only, with observation time/status and the distinction between detection and proficiency. Missing scans remain blank; they are not inferred or fetched.
- **Project metadata:** reviewed repository-builder fields from this draft. These do not silently change when another context repository is chosen.
- **Selected section:** choose one Markdown section. When editing a smaller text selection this can explicitly supply surrounding section text. No other sections are sent.
- **Current writing style:** editable tone guidance referencing Original; paste a style sample if desired. Style context is not factual evidence.

Inspect/edit each text field before checking **Include**. Blank sources can receive manually supplied facts; checked empty or oversized sources block generation. Sources are not independently certified as true: trust is your explicit choice. Refresh stale GitHub evidence through the normal workflows first.

**Exact messages to send** displays the actual system and user messages, including Original, notes and only checked context. No hidden workspace context is added. Model and request flags are described separately; the API key stays outside the preview in the Authorization header. Changes clear send consent, cancel in-flight generation and invalidate the proposal/diff approval. Switching repository clears its repository/Stack DNA selections; switching target section clears selected-section inclusion. Reopening starts all sources unchecked again.

The grounding prompt requires factual claims to be supported by supplied Original, factual notes or selected factual context. Unsupported claims must be omitted, not filled from outside knowledge. All context is treated as data, not system instructions; style guidance cannot establish facts. This is a model instruction, not a factual-verification engine: inspect Proposed and Diff before Apply. Tests verify prompt/request boundaries using mocked output, not universal model compliance.

Each selected context source is limited to 12,000 characters; serialized selected context to 16,000; total Original/notes/context to 32,000. Oversized context is shown intact and rejected until you explicitly shorten or deselect it. No silent truncation or upload of whole drafts/workspaces.
