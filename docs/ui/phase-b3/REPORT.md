# Phase B3 — measured continuation

Branch: redesign-halftone. Rollback tag pre-b3 points to d54c96e. Draft checkpoint: d3ace1b. Version remains 1.11.10. Final outcome: WIP; performance gates remain failing, including a regressed 1440px long-task peak. No push or merge.

## Method and evidence

One cold load at each requested width per revision, Chromium headless, CPU 4x, cache disabled, Fast 4G harness settings: 150ms latency, 1.6Mbps down / 750Kbps up. Local HTTP now gzip-compresses responses; this is not a Cloudflare deployment test. PerformanceObserver collects LCP, non-input CLS/source rectangles and long tasks; each section scrolls for at least 5.5 seconds with rAF FPS and CPU sampling. CLS/tasks below cover startup and the whole scroll run, including setup/captures; CPU sampling adds profiling overhead. LCP is the last candidate before the first section scroll. These are single runs, not repeatability claims.

Baseline was measured in a detached temporary worktree at d54c96e. Its CDN Font Awesome 6.4.0 URL is mirrored to the same-version local 6.4.0 bundle in the server response; filesystem code remains unchanged. Both revisions otherwise block external requests and SW/PWA background work. Earlier raw-response numbers, the missing-icon baseline, and mixed intermediate diagnostic runs are excluded from comparison.

Evidence: C:/Users/stand/.codex/visualizations/2026/11/06/01a1b158-b2c3-70e1-abf6-c1280aa3d3dd/b3-compressed (JSON, profiles, trace, screenshots); runtime suite evidence is in sibling b3-artifacts/runtime.json.

## Baseline / draft / final

| Width | LCP ms B / D / F | CLS B / D / F | Largest task ms B / D / F |
|---|---|---|---|
| 1440 | 5312.00 / 4484.00 / 4200.00 | 0.685278 / 0.012846 / 0.030325 | 2074.00 / 998.00 / 3889.00 |
| 1920 | 2772.00 / 3212.00 / 1276.00 | 0.607963 / 0.005599 / 0.017635 | 961.00 / 364.00 / 221.00 |
| 390 | 6268.00 / 3204.00 / 2716.00 | 1.012473 / 0.104568 / 0.042384 | 421.00 / 186.00 / 494.00 |

FPS triplets are baseline / draft / final. Final task triplet is the longest task during each section window at 1440 / 1920 / 390; zero means no >=50ms Long Tasks API entry, not zero CPU work.

| Section | FPS 1440 B/D/F | FPS 1920 B/D/F | FPS 390 B/D/F | Final task ms 1440/1920/390 |
|---|---|---|---|---|
| hero | 5.34/59.64/39.52 | 11.21/58.92/48.58 | 51.48/59.28/59.10 | 149.00/92.00/113.00 |
| problem | 45.50/60.00/55.65 | 57.83/60.00/60.00 | 58.56/60.00/60.00 | 0.00/0.00/0.00 |
| steps | 58.55/57.28/46.41 | 59.28/59.28/57.28 | 59.64/60.00/60.00 | 339.00/135.00/0.00 |
| features | 48.76/57.83/44.05 | 50.21/59.46/56.01 | 51.12/60.00/60.00 | 218.00/56.00/0.00 |
| feature-01 | 52.39/60.00/53.66 | 57.83/59.64/59.10 | 59.46/60.00/59.82 | 0.00/0.00/0.00 |
| feature-02 | 54.20/58.92/44.23 | 58.19/56.01/56.20 | 57.65/60.00/60.00 | 104.00/0.00/0.00 |
| feature-03 | 46.04/59.82/51.48 | 48.04/56.92/57.47 | 54.75/59.82/60.00 | 84.00/54.00/0.00 |
| feature-04 | 55.29/54.75/55.11 | 40.79/58.37/59.28 | 52.75/60.00/60.00 | 123.00/0.00/0.00 |
| feature-05 | 56.20/60.00/58.92 | 42.60/59.82/60.00 | 57.65/60.00/60.00 | 0.00/0.00/0.00 |
| offline-demo | 57.65/60.00/59.64 | 43.51/58.55/60.00 | 56.76/60.00/60.00 | 0.00/0.00/0.00 |
| simulator | 58.37/60.00/60.00 | 41.88/58.73/60.00 | 56.92/60.00/60.00 | 0.00/0.00/0.00 |
| faq | 28.65/60.00/60.00 | 10.27/60.00/60.00 | 56.38/60.00/60.00 | 52.00/50.00/0.00 |
| closing-cta | 27.83/60.00/60.00 | 9.22/59.28/60.00 | 57.28/59.64/60.00 | 0.00/0.00/0.00 |

## Changes and diagnosis

Final hero CSS was extracted from matching final stylesheet rules, replacing the old centered/boxed critical layout. Final sheets load non-blocking and critical layout rules retire after all apply; font-face declarations persist through that handoff, but cold-run resource timing still shows duplicate font fetches; this remains unresolved. The skip link is positioned before CSS arrives. Hero image preloads are media-gated and high priority on desktop and phone; the image has explicit dimensions. Only Inter, Instrument Serif and the two Geist weights used in the hero are font-preloaded. Hero font faces use font-display:block to reduce fallback wrapping changes. Font Awesome remains because landing uses its icons; its private-use glyph rules are excluded from critical CSS until the complete local icon stylesheet/font faces load. Icon boxes reserve width; subtitle word wrappers retain inline wrapping.

Shared CSS content-visibility guessed steps/FAQ/footer heights; the landing override renders them normally for stable anchors. The draft shift observer identified mobile-hero-app, ambient bloom and trust tags during font/icon readiness (largest mobile entry 0.09322), plus smaller numeric/demo shifts. Explicit icon geometry, stable subtitle metrics and matched critical layout address the large shift. See raw final sources for remaining shifts; no unmeasured claim that every source vanished.

CPU sampling identified onScroll -> classList operations and updateWindowTransform -> offsetHeight, plus hero tick -> fillText and closing resize. Nav now uses observer geometry and changes its class only across the threshold. Decorative product scroll and camera zoom are removed; the automatic guided tour stops after one pass. ASCII glyphs are raster-cached, sampled at lower density, DPR-capped and stop after assembling; pointer interaction and visibility pauses remain. Closing drawing waits until visible. A diagnostic rendering trace also exposed full-document Layout (2782.99ms) and UpdateLayoutTree work; this trace is diagnostic, not the final timing table. Font Awesome glyph rules without faces were removed from critical CSS after that trace.

Regression gates 70.4/70.5 now assert no backdrop blur/heavy shadow while preserving scrim, border and transparency fallback, with explanatory comments. Native hash navigation uses immediate scrolling; tablet feature panels stack to resolve measured 1024px clipping. Existing production v1 bundles are preserved; new landing/ASCII v2 names, HTML, build mapping and SW precache are updated. New v2 source files carry the fixes; existing draft asset filenames remain byte-for-byte unchanged.

## Checks and limits

Deep-link/navigation target <=8px: PASS; back/forward restoration: PASS. Exact errors are in anchors.json.
Critical-only/final sampled hero geometry with the same explicitly loaded fonts: maximum measured rectangle delta 0.000px. Screenshots captured at all requested widths.
Regression: 451 passing / 0 failing. Build/version consistency, generated JS syntax, copy preservation, observer/glyph-cache/tour assertions and check_unstyled passed. check_overflow: PASS.
Auth, sync-engine and vault source/production bundles have empty diffs vs pre-b3. All newly referenced v2 files exist in SW precache. No real account credentials used.

Physical-phone scrolling, Safari, installed-PWA behavior and production Cloudflare timings: not measured. Accessibility beyond existing regression assertions and this landing-only scope: not measured. Exact final long-task call stacks: not measured; CPU samples and the diagnostic native rendering trace are retained. Performance budgets remain failing where listed.

Final failed gates: LCP 1440, long tasks 1440, long tasks 1920, LCP 390, long tasks 390, FPS hero 1440, FPS hero 1920, FPS steps 1440, FPS features 1440, FPS feature-01 1440, FPS feature-02 1440, FPS feature-03 1440.
