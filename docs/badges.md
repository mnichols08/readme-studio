# Badge Studio

Open Badge Studio from the header, or from a saved builder section to preselect that section. Unsaved builder edits should be saved before opening the studio. Logo search uses catalog names, slugs, categories and aliases; custom Simple Icons slugs are also editable. Presets are suggestions, including static Build/Deployment examples; they do not validate live status.

Choose label, message, label/message colors (named or hex), logo/logo color, style, link and meaningful alt text. Light/dark pairs use GitHub-compatible picture/source markup. The main colors control the light variant. Copy Markdown or HTML; plain badges need no HTML. Duplicate creates an editable copy in the composer; insert each desired copy explicitly. Reset starts a fresh badge.

Insertion never replaces a text selection. It appends to a selected badge row or section, or inserts at the remembered cursor. Appending to a non-badge section preserves its generated source as editable custom Markdown. Undo restores the prior draft. Manual Markdown stays available.

Preview images contact Shields.io directly and may fail offline. Generation is local and exports ordinary Markdown/HTML with no README Studio runtime. Shields and Simple Icons provide the badge service and logo names; this app does not proxy them or guarantee GitHub rendering parity.

References: [Shields static badge options and encoding](https://shields.io/badges/static-badge), [Simple Icons](https://simpleicons.org/).

## Collections

Collections live in the local workspace independently of drafts. Create one from Badge Studio, start from an editable collection starter, or save a stack category. In Collections, edit the name, reorder/edit/duplicate/remove badges with buttons, then **Save collection**. Import validates version 1 JSON and assigns a new ID and unique name. Export collection is independent of README export. Changes remain temporary until saved; export is available if browser storage fails.

Choose plain HTML row, centered row, picture wrappers, or a Markdown category heading. Preview desktop, narrow or mobile wrapping; only the first 20 images are previewed for large collections, while export includes all badges. Search supports collection names, badge labels, logos and catalog aliases.

Inserting into a README copies the markup. Inserting through a saved stack block copies badge settings into that stack. Future collection edits never rewrite existing drafts. Save pending stack edits before opening collections.
