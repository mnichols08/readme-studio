# Visual themes

Visual Theme Studio sets draft-specific defaults for generated content. GitHub controls the page background, fonts, link colors, and rendering; themes do not recolor GitHub. Export is ordinary Markdown/HTML with no stylesheet or Studio runtime.

Choose GitHub, Monochrome, Nord, Dracula, Catppuccin, Solarized, Terminal, Workshop, or Custom. Edit hex fields or color pickers, badge style/backgrounds/logo treatment, heading accents, divider defaults, and whether to prefer theme-aware pictures. Browse light/dark samples without modifying the draft. Contrast warnings are advisory approximations.

Apply visual theme updates only fields that are absent or still owned by the prior theme. Existing explicit badge colors remain explicit. Badge Studio offers Use theme defaults and Use custom colors. Editing a badge field marks it explicit, including edits to the same value. Reset to theme defaults replaces builder-owned visual overrides after confirmation. Neither mode changes project prose or Custom Markdown. Apply is one undoable operation. Draft JSON/workspace backups retain the theme and derived-field records; old drafts need no migration or automatic rewrite. Reusable libraries are separate from draft selection: applying a saved theme copies settings into the draft; editing or deleting that saved theme does not change other drafts.

Palette adaptations reference [Nord](https://www.nordtheme.com/docs/colors-and-palettes/), [Dracula](https://draculatheme.com/spec), [Catppuccin Latte/Mocha](https://catppuccin.com/palette/), and [Solarized](https://ethanschoonover.com/solarized/). These are palette-inspired defaults, not proprietary visual assets or a claim of exact theme parity. Monochrome, Terminal and Workshop are local palette choices. The GitHub preset is a GitHub-like neutral/blue palette, not a mechanism to style GitHub itself.

## Reusable presets and packs

Open **Visual presets** for the local gallery and saved library. Save current theme, Save banner preset, or Save visual bundle using the Preset name field. Select a saved entry to review, rename (using Preset name), duplicate, delete, or export it. Theme Studio can also save its current working theme; Banner Builder can save its current visual settings separately from its draft content.

A theme contains palette, badge defaults, heading/divider styles, and picture preferences. Banner presets contain only dimensions, alignment, decoration, seed, light/dark mode, palette, border and accent choices. A visual bundle combines both. They exclude README content, banner identity/text, alt text, filenames, asset folders and generated SVG assets. Applying a bundle keeps the target draft's banner text and asset paths.

Review preset shows badge defaults, heading style, divider style and banner palette/style. **Apply to theme-derived settings only** is the default. **Reset builder-owned visual overrides** requires confirmation. Both preserve project prose and Custom Markdown. Document application is undoable; library management is separate from document undo. Export a pack before deleting library entries.

Export preset creates a version-1 `readme-studio-theme`, `readme-studio-banner-preset`, or `readme-studio-visual-preset` JSON file. Export theme pack contains saved themes; Export visual pack includes all three saved categories. Built-in cards remain available without importing or saving them. Import accepts JSON files or pasted JSON, validates first, previews counts, and appends only after confirmation. Files are limited to 2 MB; each category supports 100 saved entries. Duplicate IDs receive fresh IDs; names receive numbered suffixes. Unsupported versions, missing theme fields, invalid colors, unsafe names, CSS/SVG/HTML/script payloads and event properties are rejected. Unknown non-executable fields are omitted by normalization.

All-drafts backups include this versioned visual library. Merge preserves both copies on collisions; replace requires the existing workspace confirmation. Damaged libraries enter recovery without overwriting original storage; valid entries can be salvaged. Failed storage writes are visible and leave the saved library unchanged.

Gallery previews use local SVG and sample markup, with named light/dark choices. They do not contact third parties. Contrast guidance is advisory, not a WCAG certification. The app's light/dark toggle synchronizes the README preview including picture sources. The preview toggle can subsequently override preview mode independently; neither setting changes exported Markdown.
