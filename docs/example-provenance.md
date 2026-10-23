# Example provenance and export review

Structured documentation builders and Code Sample blocks label every non-empty command or code example as **Verified**, **User-confirmed** or **Placeholder**. New examples start as Placeholder. Verified requires a short verification note or evidence; that note stays in the local block settings and is not copied into the README. Editing example text resets an earlier claim to Placeholder so evidence cannot remain attached to different content.

The generated Markdown places a portable HTML comment immediately before the code fence:

````markdown
<!-- readme-studio-example: user-confirmed -->

```sh
npm test
```
````

The marker is inert ordinary Markdown/HTML. It does not install, execute, fetch or validate anything. Manual and imported Markdown is never run, and unmarked legacy examples are not silently classified or rewritten.

## Copy and export review

Whole-document, section-form and saved-block **Copy Markdown** actions plus **Export README** inspect fenced examples and their immediately preceding markers in the current Source. Verified and User-confirmed examples proceed normally. Placeholder, unclassified, invalid, orphaned, duplicated or truncated results open a read-only review before the exact Source can be copied or exported anyway. The review is tied to the current Source; an edit makes it stale and requires a new check.

Inspection is bounded to 750,000 UTF-8 bytes and 500 classified examples or structural findings. Marker-looking text inside a code fence is code, not provenance. The review never changes Source, builder metadata or Undo history.
