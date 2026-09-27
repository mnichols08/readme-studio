# Contributor checks

Use Node 22.12+ and `npm ci`. No environment variables, credentials, backend, or Rust toolchain are required for the application.

```sh
npm test
npx playwright install chromium firefox webkit
npm run test:browser        # Chromium for a quick workflow pass
npm run test:browser:all    # all three engines before release
npm run build
npm run test:static         # production assets and Worker, root + subpath
npm run format:check
```

`npm run dev` starts Vite. Browser tests own port 4317 and refuse to reuse another server. `README_STUDIO_TEST_PORT` can select a different test port. Do not edit application files while browser tests are running: Vite reloads can invalidate an in-flight test. On Windows, a broken custom npm script shell can be overridden with `npm_config_script_shell=C:\Windows\System32\cmd.exe`.

`npm run format` formats application, scripts, tests, and release documentation. Fixtures are deliberately excluded: their whitespace and malicious or malformed markup are test inputs. User-owned `roadmap.md` is excluded too. Fixture descriptions are in [tests/fixtures/README.md](../tests/fixtures/README.md).

GitHub calls and remote images are mocked in workflow tests. Performance tests seed a large editor document, dispatch a normal input event, then measure a real incremental keyboard edit. Measurements are attached as JSON artifacts; generous completion checks are preferable to millisecond thresholds. Playwright bulk `fill()` of very large strings can measure native insertion/tracing overhead rather than application handling. Do not mistake that for a render benchmark.

Release branches run Chromium, Firefox, and WebKit in CI; other branches run Chromium. Only Chromium captures documentation screenshots so engines do not overwrite each other's artifacts. Failure traces are uploaded by CI. These automated checks complement manual keyboard, touch, and assistive-technology review; they do not certify accessibility.

`npm audit` is useful when its registry endpoint is available. If an audit request fails, report the failed check rather than treating it as a clean result. Prefer a verified advisory fix over unrelated major dependency upgrades.

Project tests cover legacy migration, pure layouts, portable packs, GitHub field ownership, explicit link-check failure classification, and advisory Health rules. `tests/browser/projects.spec.js` covers the user workflows in all three engines, including 10/25/50-project showcases and deferred screenshots. Project pack and GitHub fixtures are inline and deliberately omit authentication.

Visual tests cover pure theme resolution, explicit ownership, XML escaping, deterministic banners, GitHub-safe styling, portable visual libraries, backup recovery and collision handling. `tests/browser/visual.spec.js` covers theme/banner/section/preset workflows, offline gallery use, storage failure and synchronized app/preview light-dark controls across the release browser matrix. Portable visual fixtures are inline and contain no personal content.

Component tests cover versioned models, field interpolation, insertion, exact source, safe embeds, pack collision modes, preset fallback, ownership and undo/detachment. Browser workflows include a fresh isolated browser context for pack portability, failed storage writes, explicit diff confirmation, widget/badge form reopening, keyboard controls and a 200-snippet catalog with bounded cards. Avoid clearing storage followed by reload as a portability test: pagehide intentionally flushes the active workspace.
