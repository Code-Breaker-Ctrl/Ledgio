# Phase C2 — verification complete; performance gate failed

Branch: redesign-halftone. Rollback: pre-c2 (89bf45c). Existing HEAD: f4e5ce0 (earlier C1 font-layout prerequisite). No C2 commit, merge or push. Version inputs are now 1.11.9; the existing build validates them and injects the hero release version. Commit is withheld because step 6 fails.

## Decisions / scope

- Four landing/ascii minified files: diffs empty with --ignore-cr-at-eol; restored after build noise.
- Two remaining #10b981 values in dashboard.html are data-color values for the Emerald category swatch and Emerald Green goal swatch. They serialize selectable user colors; changing them changes data. Their visual fill currently follows --accent.
- Decision: initialDarkMode and the early dashboard default remain false, matching original behavior. Explicit saved preferences win. OS preference is not made a new default.
- chartAlpha is one helper in app.js using the bundled Chart.js color parser. Actual helper assertions cover hex/rgb alpha and theme cache invalidation. Suffix concatenation is removed.
- Original chart animation restored. No animation:false remains; measurements below include animation. No disabled-animation improvement is claimed.
- Expense rows use one synchronous fragment insertion; locale formatters are reused in memory with output-equivalence assertions. Chart colors/fonts are read from current CSS tokens and cached per data-theme. Shadows/blur were simplified and content-visibility removed. No async/virtualized list behavior was introduced.
- Protected auth.js, sync-engine.js and vault.js have empty diffs against pre-c2. Literal app storage-key calls match. No real credentials or live sign-in/signup used.

## Required performance measurement

Local Chromium, default headless rendering path, 1440x600, 4x CPU, Fast 4G (150ms latency, 1.6Mbps download / 750Kbps upload), Network.setCacheDisabled(true), service-worker bypass. Synthetic fixtures: 360 expenses over 12 months and five categories, eight goals, six loans. PerformanceObserver records long tasks; CPU sampling covers each switch; rAF scrolling lasts at least 5.5 seconds per view. Every view has a nonzero scroll range. Analytics maps to the existing Reports view. Single run per theme/view; not a statistical guarantee. Matching-condition main comparison: not measured; earlier unmatched runs are excluded.

**FAIL: multiple view-switch tasks exceed 50ms. Scrolling meets 55fps in the measured runs.** A zero task value means no observed longtask entry, not zero CPU execution time.

| Theme / view | Longest task ms | Scroll fps | Sampled top frames, leaf first |
| --- | ---: | ---: | --- |
| dark / dashboard | 137 | 60.00 | not measured / not exposed; remaining frames not exposed |
| dark / expenses | 468 | 60.00 | (program) → (root); remaining frames not exposed |
| dark / goals | 359 | 58.01 | (program) → (root); remaining frames not exposed |
| dark / loans | 216 | 57.28 | (program) → (root); remaining frames not exposed |
| dark / reports | 245 | 58.01 | getTrendMonthRange:3798 → window.renderTrendChart:4542 → renderSection:5100 |
| dark / settings | 195 | 57.28 | (program) → (root); remaining frames not exposed |
| light / dashboard | 71 | 60.00 | not measured / not exposed; remaining frames not exposed |
| light / expenses | 385 | 60.00 | (program) → (root); remaining frames not exposed |
| light / goals | 94 | 58.73 | (program) → (root); remaining frames not exposed |
| light / loans | 0 | 59.64 | not measured / not exposed; remaining frames not exposed |
| light / reports | 508 | 58.73 | getPropertyValue → window.renderSpendingChart:4155 → renderSection:5100 |
| light / settings | 186 | 60.00 | (program) → (root); remaining frames not exposed |

Frames are CPU samples approximately aligned with each longest task, not an exact native stack. Native (program) samples do not expose three frames. Exact native stacks: not measured.

Unresolved entry paths: dashboard renderSection/renderCategoryChart; expenses renderAllExpenses; goals renderGoals; loans renderLoans; analytics renderSpendingChart/renderTrendChart; settings renderSection/loadAccountSecurityInfo. Batching, formatter reuse, palette caching and simpler CSS did not meet 50ms for every synchronous render/layout. Most longest samples are native layout/paint; exact native offenders remain unresolved. Incremental rendering/virtualization was not introduced because it changes intermediate UI behavior. Further optimization is not proven impossible. Step 6 remains failed; no overall C2 pass is claimed.

## Checks

Build: 1.11.9 consistency verified across config/sw/README and 53 query stamps; hero release text injected by existing build. All generated JS syntax checks pass. Unstyled: zero classes across seven root pages. Actual helper/cache and protected-source/storage-key checks pass.

Full regression HTML suite through Chromium: 451 pass, zero fail at 1.11.9. Original Edge runner at 1.11.9: not measured. Version expectation was updated from 1.11.8 to 1.11.9 without dropping the equality/hero match assertion.

Mobile 390px captures for both themes include all existing views, goal/loan modals, chart tooltip and fixture-empty states; contact sheets were opened and inspected. Empty states were produced through fixture state changes, not live account operations.

All eight requested text/surface token contrast pairs pass AA; lowest ratio 5.9279:1 (light --text-dim on --surface-2). These mathematical contrast checks use rendered CSS values; broader custom/inline-color contrast is not certified.

First-visible-frame/reload sampling found no opposite-theme samples with explicit dark/light preferences opposed to the emulated OS scheme. rAF sampling does not certify every physical display frame. Width checks at 320,390,768,1024,1440,1920 in the existing views/themes show no document horizontal overflow; individual clipped-control audit is incomplete. The mobile/reload checks were refreshed with CPU 4x, Fast 4G and cache disabled. Earlier fixed-sleep reload attempts were discarded after their DOM-read errors. Version-specific regression expectation is updated to 1.11.9. Two old-palette assertions now require the active opaque accent/surface tokens; selection, navigation and layout-shift checks remain intact.

Evidence stays outside the repository: C:/Users/stand/.codex/visualizations/2026/11/06/01a1b158-b2c3-70e1-abf6-c1280aa3d3dd/c2-artifacts. Only this text report is under docs/ui/phase-c2. Temporary runners are ignored under scratch/. Existing graphify-out was not changed.

Implementation changes: dashboard.html; dashboard.css and dashboard-theme-c2-v1.css; app.js and expenses.js plus newly named bundles; local Font Awesome CSS/fonts; voxel SVG; config version/new bundle; scripts/build.ps1; sw.js precache; README/HTML query stamps; regression palette/version expectations. No evidence files are staged or added to Git.

Real-phone keyboard/focus, safe areas, browser chrome, touch behavior and installed-PWA updates are not verified. Dense mobile controls, long forms and custom-category icon colors still merit hardware review. No claim of universal text-color contrast beyond the requested token pairs.
