# Example provenance and export review

Structured documentation builders label every non-empty command or code example as **Verified**, **User-confirmed** or **Placeholder**. New examples start as Placeholder. Verified requires a short verification note or evidence; that note stays in the local block settings and is not copied into the README.

The generated Markdown places a portable HTML comment immediately before the code fence:

````markdown
<!-- readme-studio-example: user-confirmed -->

```sh
npm test
```
````

The marker is inert ordinary Markdown/HTML. It does not install, execute, fetch or validate anything. Manual and imported Markdown is never run, and unmarked legacy examples are not silently classified or rewritten.

## Copy and export review

**Copy Markdown** and **Export README** inspect only these markers in the current Source. Verified and User-confirmed examples proceed normally. Placeholder, malformed or truncated marker results open a read-only review before the exact Source can be copied or exported anyway. The review is tied to the current Source; an edit makes it stale and requires a new check.

Inspection is bounded to 750,000 UTF-8 bytes and 500 markers. Marker-looking text inside a code fence is code, not provenance. The review never changes Source, builder metadata or Undo history.
