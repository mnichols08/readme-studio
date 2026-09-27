# Local SVG banners

Banner Builder generates self-contained SVG locally. There are no remote fonts/images, scripts, foreignObject elements, AI calls, or upload requests. Fonts use the viewer's system sans-serif/monospace stack; exact font metrics vary by browser and GitHub's image renderer.

Enter a name, primary title, subtitle, website/handle, optional metadata line, and meaningful alt text. Suggest alt from name and title is editable. Text fields and dimensions are bounded. Width supports 320–1600px; height supports 120–600px. Profile Wide, Compact Header, Repository Header, and Custom sizes are available. Long text is fitted into the available width; very compact banners work best with fewer lines.

Choose minimal, terminal, grid, constellation-inspired, gradient, geometric, code-lines, or monochrome decoration. A stable seed reproduces the same decorative geometry for the same configuration. Border/accent and alignment are optional. Palette defaults come from the active README theme; individual palette edits become explicit overrides. Use active theme palette resets those overrides. Changing a theme updates stored theme-owned banner palette values, not already-downloaded files.

Generate light, dark, or both variants. Preview light/dark at desktop or 320px width. Download SVG assets downloads the selected variants; individual file buttons are available if your browser limits multiple downloads. Copy SVG source copies the previewed variant. Clipboard failures leave selectable source text. Save banner settings stores the configuration in the current draft without inserting content.

The default output is `banner-light.svg` and `banner-dark.svg` with a relative `assets/` path in picture markup. Edit the filename base and relative asset folder if needed. **Download these files and commit them to your profile repository.** Insert banner markup appends ordinary Markdown/HTML and saves the banner configuration as one undoable draft change. Local SVG previews work immediately; README image links work after you commit the assets. No automatic publishing or regeneration of committed files occurs.
