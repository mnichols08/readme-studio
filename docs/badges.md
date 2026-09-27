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

## Dynamic providers

Open Dynamic badge helpers in Badge Studio. Search by provider or category, enter the configuration, and choose Generate dynamic badge. Typing performs no API requests. The generated badge can be styled, linked, paired for dark mode, and saved to a collection. Label/message fields are hidden because the provider supplies them. Cache seconds is optional and Shields may enforce a higher minimum. Repository suggestions from import/autofill metadata require explicit selection; a profile repository suggestion does not establish that it exists.

| Helper                                           | Inputs                                                      | Suggested destination                             |
| ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------- |
| GitHub stars/forks/issues/license/latest release | owner/repository                                            | matching repository page                          |
| GitHub Actions                                   | owner/repository, workflow file/name, optional branch/event | workflow Actions page                             |
| npm version/monthly downloads                    | package or @scope/package                                   | npm package page                                  |
| crates.io version/total downloads                | crate name                                                  | crates.io crate page                              |
| PyPI version                                     | package                                                     | PyPI project page                                 |
| Docker version/pulls                             | user/repository; _/name for official images                 | Docker Hub image page                             |
| Netlify                                          | site ID (UUID)                                              | Netlify dashboard; override with your project URL |
| Custom endpoint                                  | public HTTP(S) JSON endpoint                                | endpoint; override as needed                      |

These are URL helpers, not service validators. No workflow existence or badge value is guaranteed. An image can load while containing a provider error message; inspect it. No authentication, proxy or draft upload is involved. Preview requests disclose the configured repository/package/endpoint URL to Shields and normal network metadata to image providers. For custom endpoint badges, Shields fetches the public endpoint; never enter secrets. Offline generation still works, while remote images may fail.

Provider references: [GitHub Actions](https://shields.io/badges/git-hub-actions-workflow-status), [npm](https://shields.io/badges/npm-version), [crates.io](https://shields.io/badges/crates-io-version), [Docker](https://shields.io/badges/docker-image-version), [Netlify](https://shields.io/badges/netlify), [JSON endpoint schema](https://shields.io/badges/endpoint-badge).
