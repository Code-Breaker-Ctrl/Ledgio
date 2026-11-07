# Phase B3 — uncommitted; gates failed

Precondition checked: dashboard.css/dashboard.html were clean; HEAD d54c96e was a phase C2 WIP commit. Branch remains redesign-halftone. No tag, commit, push or merge was made. Version inputs/build are 1.11.10. Existing graphify-out was left untouched.

## Changes

Decorative section pills became inline mono eyebrows. Why/steps grids use a wide card plus two stacked cards; feature sections alternate left/right emphasis, with bounded desktop width and varied spans. Existing expense/progress demo markup gains dashboard component classes/styles. Existing row-insertion, budget, goal and chart interactions remain; desktop scene timelines no longer auto-repeat. Progress fills use transforms. Mobile feed inserts once and automatic scene cycling stops at its last scene. Manual demo controls remain.

Looping CSS decoration, glows and backdrop blur were removed; closing ASCII is static. The existing hero ASCII data/layer remains and pauses repainting during scroll. Main stylesheets now block initial rendering to prevent the critical/final hero-layout mismatch; the hero image has explicit dimensions. All static page text was compared with HEAD and matches after normalizing the required release version. No sections or claims were added.

Canonical landing CSS/JS sources changed; new production assets are landing-b3-v1.min.css, landing-b3-v1.min.js, landing-mobile-b3-v1.js/.min.js, hero-ascii-b3-v1.js/.min.js, closing-ascii-b3-v1.js/.min.js and supabase-config-b3-v1.min.js. HTML, build outputs and SW precache use the new names. Config/README/SW and HTML query stamps were bumped for build consistency. Dashboard HTML changed only for version/config references; dashboard styling/runtime were not redesigned. Auth/sync/vault sources have empty diffs against initial HEAD.

## Measured budgets — FAIL

Local Chromium, 4x CPU, Fast 4G (150ms latency, 1.6Mbps down / 750Kbps up), cache disabled; raw local HTTP responses without transport compression. External requests are blocked. Each section is scrolled for at least 5.5s. PerformanceObserver records LCP candidates, CLS and long tasks; rAF measures frame rate. Single cold load per width, not a repeatability guarantee. The self-hosted icon stylesheet/fonts add transfer cost compared with the baseline whose external icon requests were blocked.

| Width | LCP ms / element | Whole-run CLS | Largest task ms |
| --- | --- | ---: | ---: |
| 1440 | 7960 / hero-art-img | 0.016854 | 381 |
| 1920 | 5104 / hero-art-img | 0.004008 | 139 |
| 390 | 5132 / hero-art-img | 0.367882 | 123 |

LCP fails <2500ms at every width. CLS passes <0.05 on desktop but fails on mobile. Long tasks fail <50ms at every width. Blocking CSS stabilized desktop layout but has an unacceptable cold-load cost in this test. This draft does not meet the requested performance budgets.

| Section | 1440 fps | 1920 fps | 390 fps |
| --- | ---: | ---: | ---: |
| hero | 41.33 | 57.10 | 58.19 |
| problem | 59.10 | 59.10 | 59.82 |
| steps | 53.29 | 58.37 | 60.00 |
| features | 40.06 | 59.10 | 56.74 |
| feature-01 | 53.88 | 60.00 | 59.10 |
| feature-02 | 45.14 | 59.64 | 59.64 |
| feature-03 | 52.75 | 59.64 | 60.00 |
| feature-04 | 57.10 | 59.46 | 59.64 |
| feature-05 | 59.82 | 60.00 | 59.46 |
| offline-demo | 60.00 | 60.00 | 58.55 |
| simulator | 60.00 | 59.64 | 60.00 |
| faq | 60.00 | 59.46 | 60.00 |
| closing-cta | 60.00 | 59.82 | 60.00 |

The 1440px hero, steps, features container and feature-01/02/03 fail 55fps. The other measured section/width pairs meet the frame-rate floor. No overall performance pass is claimed.

## Other verification / failures

- Build/version/asset checks and all generated JS syntax checks pass. check_unstyled reports zero unstyled classes across seven pages.
- Full regression: 449 pass / 2 fail. Gate 70.4 requires the removed 32px sheet / 20px pill blur and WebKit blur. Gate 70.5 requires the removed 2px overlay blur and large sheet shadows. Assertions were not weakened to hide those failures. Regression does not meet >=451 passing.
- Captures at 1440/1920/390 were reviewed through external contact sheets, with native-size desktop samples. At 1920 content is bounded rather than stretched. The tall feature demos still leave sparse editorial space; mobile remains long/dense. This is not final visual approval.
- Expense-entry assertion: one inserted row, stable amount/bar after an additional wait; no automatic replay in that sample. Desktop reduced-motion goal assertion reaches the static 50% end state. Exhaustive reduced-motion verification across every interactive control is not measured.
- Document width does not overflow at the three tested widths. Deep-link hashes reach the requested target IDs, but sampled target geometry was not aligned after the short wait; anchor alignment and browser back/forward restoration are not certified.
- Static page-copy comparison and protected-source diffs pass. No real credentials or live auth actions used.

Evidence: C:/Users/stand/.codex/visualizations/2026/11/06/01a1b158-b2c3-70e1-abf6-c1280aa3d3dd/b3-artifacts. Screenshots, JSON and temporary runners remain outside tracked files; only this report is added under docs/ui/phase-b3. No universal accessibility, production-compressed-network, real-phone keyboard/safe-area/touch or installed-PWA claim is made.
