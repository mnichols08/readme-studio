# Fixture conventions

- `profile-readme.md`: banner/picture preamble, badges, HTML details, fenced examples, relative assets, and widgets.
- `repository-readme.md`: documentation links, screenshot, code, table, and nested heading.
- `messy-readme.md`: comments, unusual heading levels, repeated sections, duplicate embeds, and raw HTML.
- `merge-current.md` / `merge-remote.md`: aliases, changed bodies, duplicates, and unmatched content.
- `malicious-readme.md`: active HTML, unsafe URL schemes, event attributes, SVG, malformed nesting, and application CSS-class attempts. This is inert test data; never render it without the production sanitizer.

Tests also construct empty, image-only, Unicode, BOM, CRLF/mixed-line-ending, huge-heading, and 100/250 KB inputs directly. Preserve fixture source and line endings when a test requires exact round-tripping. Do not bulk-format these files. Security checks verify both sanitized preview behavior and unchanged source/export.
