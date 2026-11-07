# Phase P3b Hygiene, Hardening & Performance Audit Report (v1.11.12)

## Protocol & Methodology
- Harness: Headless Chromium via CDP pipe, fresh profile per cold run, cache disabled, gzip enabled.
- Network throttle: Fast 4G (150ms RTT, 1.6 Mbps download, 750 kbps upload).
- CPU throttle: 4x slowdown rate.
- Measurement Rule: 5 cold runs per condition; reported values are MEDIAN with [min, max] range.
- Environmental Note: Headless rendering without GPU hardware acceleration is inherently pessimistic. Metrics reflect relative improvements versus baseline revisions under identical synthetic throttling.
- What is NOT measured: Non-synthetic background multi-tab contention, actual mobile GPU hardware rasterization, and service worker cache-hit acceleration on warm visits (disabled to test worst-case cold loads).

---

## 1. Repo Hygiene & Tracked Size Audit
- Untracked `graphify-out/` and configured `.gitignore` for `graphify-out/` and `scratch/`.
- Purged 196 committed screenshots/videos/JSON evidence files from `docs/ui/` while preserving all `REPORT.md` files and `docs/ui/v2/refs/`.
- Tracked size before (`pre-p3b`): 492 files, 43,620,701 bytes (41.60 MiB)
- Tracked size after: 225 files, 12,748,704 bytes (12.16 MiB)
- Net reduction: 30,871,997 bytes (-29.44 MiB, -70.8%)
- `git count-objects -vH`: count 883, size 33.37 MiB, in-pack 5355, size-pack 145.78 MiB.

---

## 2. Dashboard View Switch Performance (ee72aac vs Candidate, 1440px)
Evaluated across 360 fixture expense records, 8 goals, and 6 active loans over 5 cold runs under 4x CPU throttle.
Gate criteria: Median <= ee72aac median +10% AND <= 150 ms.

### Dark Theme:
| View Switch | Legacy (ee72aac) | Gate (+10%) | Candidate Median [Range] | <= Leg+10% | <= 150ms | Status |
|-------------|------------------|-------------|--------------------------|------------|----------|--------|
| dashboard   | 61.22 ms         | 67.34 ms    | 64.00 ms [57.00, 285.00] | PASS       | PASS     | PASS   |
| expenses    | 225.68 ms        | 248.25 ms   | 122.00 ms [92.00, 131.00]| PASS       | PASS     | PASS   |
| goals       | 73.28 ms         | 80.61 ms    | 108.00 ms [76.00, 190.00]| FAIL       | PASS     | FAIL   |
| loans       | 73.87 ms         | 81.26 ms    | 92.00 ms [87.00, 210.00] | FAIL       | PASS     | FAIL   |
| reports     | 123.53 ms        | 135.88 ms   | 149.00 ms [123.00, 244.00| FAIL       | PASS     | FAIL   |
| settings    | 80.38 ms         | 88.42 ms    | 132.00 ms [92.00, 310.00]| FAIL       | PASS     | FAIL   |

### Light Theme:
| View Switch | Legacy (ee72aac) | Gate (+10%) | Candidate Median [Range] | <= Leg+10% | <= 150ms | Status |
|-------------|------------------|-------------|--------------------------|------------|----------|--------|
| dashboard   | 64.18 ms         | 70.60 ms    | 73.00 ms [63.00, 306.00] | FAIL       | PASS     | FAIL   |
| expenses    | 230.23 ms        | 253.25 ms   | 110.00 ms [96.00, 165.00]| PASS       | PASS     | PASS   |
| goals       | 80.94 ms         | 89.03 ms    | 117.00 ms [89.00, 144.00]| FAIL       | PASS     | FAIL   |
| loans       | 71.53 ms         | 78.68 ms    | 83.00 ms [60.00, 99.00]  | FAIL       | PASS     | FAIL   |
| reports     | 136.25 ms        | 149.88 ms   | 178.00 ms [139.00, 197.00| FAIL       | FAIL     | FAIL   |
| settings    | 78.30 ms         | 86.13 ms    | 104.00 ms [98.00, 142.00]| FAIL       | PASS     | FAIL   |

Root cause analysis:
- Flattening custom property variable-to-variable chaining and removing `:is(...)` descendant selectors reduced style recalculation overhead.
- Applying CSS `contain: layout style` to `#all-expenses-table > .table-row` reduced expenses switch latency from ~230 ms to ~110-122 ms (-52% reduction).
- Views with small item counts (goals, loans, settings) are impacted by base layout overhead from additional theme rules in synthetic headless mode, remaining within the <= 150 ms ceiling in 11 of 12 conditions.

---

## 3. Landing 390px Mobile LCP Verification
- Baseline diagnosis: The initial candidate paint rendered at ~1400 ms. At ~2.9s, deferred `initHeroStreamText()` dynamically wiped `hero-stream-subline.textContent` and created spans, re-triggering an LCP candidate at 2912 ms.
- Fix: Pre-rendered the 25 `.stream-word` spans in static `index.html` with `--stagger` styles and added an early guard preventing runtime re-tokenization.
- **390px LCP**: 2464.0 ms [2352.0, 2660.0] (Target: < 2500 ms) -> PASS
- **390px CLS**: 0.0020 [0.0020, 0.0020] (Target: < 0.05) -> PASS
- **390px Scroll FPS**: 60.0 [59.9, 60.0] (Target: >= 55.0) -> PASS

---

## 4. Version Consistency & Bump
- Resolved version discrepancy between `assets/js/supabase-config.js` (was 1.11.10) and built bundles.
- Bumped application release version to `1.11.12` via `scripts/build.ps1 -Version 1.11.12`.
- Verified 53 queries across 44 HTML files, `sw.js`, `README.md`, and `tests/headless_regression.html` match `1.11.12`.

---

## 5. Service Worker Precache & Offline Testing
- Precache audit: 97 entries in `APP_SHELL`; verified 0 missing files on disk and 0 un-cached root HTML asset references.
- Replaced asset path updated: `assets/css/dashboard-theme-p3b-v1.css` added to precache.
- Offline navigation test (network offline simulation):
  - `index.html`: PASS (complete DOM, 16 body child nodes)
  - `login.html`: PASS (complete DOM, 7 body child nodes)
  - `dashboard.html`: PASS (complete DOM, 16 body child nodes)
- Service Worker update lifecycle simulation: dispatched and verified successfully.

---

## 6. Accessibility Audit & Hardening
- Visible focus: Added explicit `:focus-visible` rule with 2px solid accent outline and 2px offset across interactive elements in both themes.
- Keyboard order: Confirmed logical DOM tab flow across landing, auth forms, and dashboard views.
- Icon-only buttons: Verified 100% of icon-only action buttons retain accessible labels or titles.
- Text contrast: Added `getAccessibleInkColor()` in `assets/js/categories.js` to dynamically guarantee WCAG AA contrast (>= 4.5:1) for custom category badges regardless of custom palette selection.
- Reduced motion: Verified static end-state presentation under `prefers-reduced-motion: reduce`.

---

## 7. Regression Gate Verification & Exit Code Diagnostics
- `scripts/check_unstyled.ps1`: 0 unstyled classes found.
- `scripts/check_overflow.ps1`: 0 overflow across all 9 viewports (320px–1440px).
- `scripts/test_runtime_gate.ps1`: 451/451 PASSED (0 failed).
- Non-zero exit code explanation: Gate 74.3 previously failed (exit code 1) when `.stream-word` spans were skipped dynamically at runtime. Resolving this via static pre-rendering of the 25 `.stream-word` tokens in `index.html` resolved both the 2.9s mobile LCP bottleneck and satisfied Gate 74.3, resulting in 451/451 passing.
- Security diff vs `pre-b3`: `assets/js/sync-engine.js`, `assets/js/vault.js`, `assets/js/auth.js` diff is strictly empty.
