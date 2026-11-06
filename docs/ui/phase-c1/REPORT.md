# Phase C1 — auth and legal pages

Version **1.11.8**. Work is confined to `redesign-halftone`; C2 has not started. Local rollback tag: `pre-c` (`ee72aacccc90b1cb53761fb48950839eb5ec44dc`). Main was fetched and the branch rebased onto `origin/main` before committing; main was already an ancestor.

## Delivered

- Login, signup and reset-password: 55/45 desktop split, reused voxel artwork, two decorative animations, aligned step glints, surface form cards, local SVG icon masks, aqua actions and focus rings, 16px inputs, larger control targets. Mobile uses a static 100px gradient banner. Motion pauses off-screen/hidden and is static under reduced motion.
- Privacy and terms: fixed rounded navigation, responsive wrapping, readable measure, 1.7 line height, mono section headings, underlined aqua body links.
- Existing text, IDs, data hooks, form/input attributes and link destinations preserved. Password visibility, recovery switching, validations, loading and redirects retain their existing handlers. Auth JS edits change presentation colors only. Vault and sync source match `pre-c` after normalizing checkout line endings.
- Self-hosted Inter and Geist Mono; CDN font/icon links removed from the five pages. PWA/favicon files unchanged. Manifest theme/background and page theme-color are `#020405`.
- Changed production bundles have new filenames: `styles-c1-v1.min.css`, `auth-c1-v1.min.js`, `supabase-config-c1-v1.min.js`. Build outputs and service-worker precache entries follow those names. Version/query stamps updated across the build-checked files. Existing immutable bundles remain available.
- No new `!important` declarations in the new page stylesheet; one obsolete declaration removed from the shared styles.

## Verification

- Existing fixture runtime suite through Chromium: **451 passed, 0 failed**; [raw checks](runtime.json). The original Edge runner was also exercised: its first full run passed 450 checks and failed the existing Gate 56.1 landing-animation payoff timing assertion. The clean retry passed **451/451** in the original Edge runner. No assertion or timing threshold was changed.
- Original `check_overflow.ps1`: **all 9 widths passed**, including clipped-content detection on the landing page. C1 pages separately pass 320, 360, 390, 768, 1024, 1440 and 1920px; [layout values](layout.json).
- `check_unstyled` strengthened to cover all seven root pages: **0 unstyled classes**. Build/version/asset checks and `node --check` pass. `node tests/auth_art_motion.js` verifies pause/resume when hidden/off-screen.
- Rendered labels, helper text, legal body text and links pass 4.5:1 contrast. [Measured pairs and ratios](contrast-and-interaction.json). Password toggle, recovery/back action, both saved-theme paths and reduced motion checked locally.
- [Hook comparison](hooks.json) checks existing IDs, form/input attributes and URL destinations against `pre-c`.
- **42 required screenshots**, every file >20KB and every MD5 unique: [manifest](screenshots.json). Auth pages have default, focused-input, validation-error and fixture-loading captures at 1440, 1024 and 390px. Legal pages have no forms/loading/error states, so those states are not fabricated. Full-page desktop captures, recovery capture, contact sheets and contrast zoom crops are included. Every required capture was reviewed through contact sheets, with native-size samples and contrast crops opened separately.
- The older security-table audit is already stale on `pre-c`: its table lists 131 occurrences while the exact grep scope finds 160. No audit gate was weakened and that unrelated table was not rewritten.

## Measurement conditions

Local Chromium headless, 1440×1100, **4× CPU**, **Fast 4G** (150ms latency, 1.6Mbps download, 750Kbps upload), cache disabled, five runs per page per revision. Main baseline: `211acc0cba83b30769af1e918c406954b2ce8d16`. PerformanceObserver records every LCP candidate with its element/classes/URL, CLS and individual long-task start/duration values in [performance-raw.json](performance-raw.json).

External requests are blocked equally on both revisions. The PWA installer and service-worker registration are excluded from this rendering benchmark to avoid the existing controller-change auto-reload interrupting a run. These are local rendering measurements, not live-site or real-phone measurements. No credentials, live login or live signup were used. State screenshots use an injected local fixture client whose auth promises remain pending.

## Visual critique and hardware limits

The preserved preview card is still denser and more promotional than the form. At 1024px the right column is narrow, and signup becomes a long scrolling form on phones. The legal nav wraps into a compact rounded block on narrow screens rather than staying a one-line desktop pill. The heading weight remains visually heavy. The dark upper artwork is intentionally quiet but can feel sparse on a tall desktop.

A real phone must confirm keyboard/input zoom, focus visibility with the keyboard open, browser-toolbar resizing, safe areas, touch hover/press behavior, OLED near-black readability and installed-PWA startup/update behavior. Headless emulation cannot certify those. Live recovery links and real OAuth/account operations were deliberately not exercised.

## Preview

Branch preview: [login](https://redesign-halftone.ledgio.pages.dev/login.html), [signup](https://redesign-halftone.ledgio.pages.dev/signup.html), [reset-password](https://redesign-halftone.ledgio.pages.dev/reset-password.html), [privacy](https://redesign-halftone.ledgio.pages.dev/privacy.html), [terms](https://redesign-halftone.ledgio.pages.dev/terms.html). Preview availability is checked after the branch push; these are the branch alias URLs, not a production deployment. C2 remains stopped until the owner says **go C2**.

## Raw five-run values

LCP and longest-task values are milliseconds; CLS is unitless. All five runs are listed in run order. A longest-task value of 0 means no observed task exceeded 50ms. LCP candidates and every individual long task are retained in the raw JSON.

| Revision / page | LCP (5 runs) | CLS (5 runs) | Longest task (5 runs) |
| --- | --- | --- | --- |
| main / login | 1180, 960, 992, 1036, 1220 | 0.007141, 0.000000, 0.000000, 0.000000, 0.023394 | 0, 51, 52, 0, 65 |
| main / signup | 2056, 1012, 1048, 1028, 1052 | 0.000000, 0.000000, 0.000000, 0.000000, 0.000000 | 97, 0, 0, 0, 0 |
| main / reset-password | 992, 1388, 1056, 972, 992 | 0.000000, 0.000000, 0.000000, 0.000000, 0.000000 | 54, 83, 70, 76, 0 |
| main / privacy | 1012, 832, 844, 872, 836 | 0.000000, 0.000000, 0.000000, 0.000000, 0.000000 | 0, 0, 0, 0, 0 |
| main / terms | 844, 816, 1192, 840, 864 | 0.000000, 0.000000, 0.000000, 0.000000, 0.000000 | 0, 0, 0, 0, 0 |
| branch / login | 2412, 2400, 2392, 2396, 976 | 0.002144, 0.002144, 0.002144, 0.002144, 0.002144 | 61, 70, 0, 59, 67 |
| branch / signup | 2404, 2396, 2384, 2404, 2452 | 0.000334, 0.000334, 0.000334, 0.000334, 0.109438 | 81, 77, 80, 88, 101 |
| branch / reset-password | 924, 916, 2220, 908, 2212 | 0.000086, 0.000086, 0.000086, 0.000086, 0.000086 | 0, 62, 0, 53, 0 |
| branch / privacy | 904, 1108, 928, 1124, 1372 | 0.030347, 0.030347, 0.030347, 0.030347, 0.030347 | 184, 201, 67, 59, 74 |
| branch / terms | 932, 924, 920, 932, 916 | 0.019492, 0.019492, 0.019492, 0.019492, 0.019492 | 156, 50, 50, 51, 54 |

Median LCP comparison:

| Page | Main | C1 |
| --- | ---: | ---: |
| login | 1036ms | 2396ms |
| signup | 1048ms | 2404ms |
| reset-password | 992ms | 924ms |
| privacy | 844ms | 1108ms |
| terms | 844ms | 924ms |

The desktop artwork becomes the LCP element on many auth runs and makes login/signup slower than main. Signup also recorded one CLS outlier above 0.1. Startup long tasks over 50ms remain; C1 does not establish a universal performance improvement. The full unfiltered values above are the evidence, including slower runs. No C2 dashboard performance budget is claimed here.
