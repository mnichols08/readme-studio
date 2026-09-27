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
