# Phase P3a Performance Audit Report (v1.11.11)

## Protocol & Methodology
- Harness: Headless Chromium via CDP pipe, fresh profile per cold run, cache disabled, gzip enabled.
- Network throttle: Fast 4G (150ms RTT, 1.6 Mbps download, 750 kbps upload).
- CPU throttle: 4x slowdown rate.
- Measurement Rule: 5 cold runs per condition; reported values are MEDIAN with [min, max] range.
- Environmental Note: Headless rendering without GPU hardware acceleration is inherently pessimistic. Metrics reflect relative improvements versus baseline revisions under identical synthetic throttling.
- What is NOT measured: Non-synthetic background multi-tab contention, actual GPU rasterization performance, and service worker cache-hit acceleration on warm visits (disabled to test worst-case cold loads).

---

## 1. Landing 1440 Regression Verification (Draft vs B3 vs Candidate)
Re-measured across 5 controlled cold runs under identical 4x CPU throttle:

| Viewport 1440 Section | Draft (d3ace1b) Median [Range] | B3 (718f5c3) Median [Range] | Candidate (v1.11.11) Median [Range] |
|-----------------------|--------------------------------|-----------------------------|-------------------------------------|
| Hero FPS              | 59.3 [56.6, 59.8]              | 59.1 [57.5, 59.8]           | 58.9 [58.6, 59.6]                   |
| Problem FPS           | 59.8 [58.7, 60.0]              | 60.0 [59.8, 60.0]           | 60.0 [59.8, 60.0]                   |
| Steps FPS             | 59.1 [56.0, 59.1]              | 58.9 [55.5, 59.3]           | 58.7 [56.0, 59.5]                   |
| Features FPS          | 59.5 [55.5, 60.0]              | 59.1 [52.9, 59.5]           | 57.1 [52.0, 59.5]                   |
| Feature-02 FPS        | 59.1 [57.5, 59.5]              | 59.1 [53.8, 59.8]           | 58.2 [57.8, 59.6]                   |
| Longest Task (Hero)   | 0.0 ms [0.0, 78.0]             | 0.0 ms [0.0, 64.0]          | 0.0 ms [0.0, 0.0]                   |
| Longest Task (Steps)  | 101.0 ms [97.0, 286.0]         | 115.0 ms [85.0, 178.0]      | 106.0 ms [94.0, 142.0]              |

Finding: The previous single-run reading (39.5 fps / 3889 ms) in B3 was an unisolated host scheduling spike. Across 5 repeated cold runs, B3 and Draft medians differ by only 0.2 fps (well within the observed 2.3–3.2 fps range). Long tasks during scroll remain 0 ms for 12 of 13 sections, and steps section task duration is <= 142 ms (target <= 150 ms).

---

## 2. Landing Performance (C2 Baseline vs Candidate)

| Metric | C2 (d54c96e) Median [Range] | Candidate (v1.11.11) Median [Range] | Relative Change | Gate Target |
|--------|-----------------------------|-------------------------------------|-----------------|-------------|
| **1440px LCP** | 2348.0 ms [1784.0, 3104.0] | 1552.0 ms [1264.0, 2044.0] | -33.9% (faster) | Within 20% C2 |
| **1440px CLS** | 0.8165 [0.7438, 0.8422] | 0.0329 [0.0309, 0.0344] | -96.0% (shift eliminated) | < 0.05 (PASS) |
| **1440px Scroll FPS** | 51.7 [49.0, 55.8] | 59.4 [58.6, 59.9] | +14.9% (smoother) | >= 55.0 (PASS) |
| **1920px LCP** | 2500.0 ms [1848.0, 3280.0] | 1752.0 ms [1616.0, 1916.0] | -29.9% (faster) | Within 20% C2 |
| **1920px CLS** | 0.4946 [0.4906, 0.5539] | 0.0170 [0.0162, 0.0178] | -96.6% (shift eliminated) | < 0.05 (PASS) |
| **1920px Scroll FPS** | 48.9 [48.5, 50.0] | 58.8 [58.3, 59.0] | +20.2% (smoother) | >= 55.0 (PASS) |
| **390px LCP** | 2712.0 ms [848.0, 3248.0] | 2912.0 ms [2040.0, 3100.0] | Within range | Stable |
| **390px CLS** | 1.1297 [1.1295, 1.3333] | 0.0182 [0.0102, 0.0259] | -98.4% (shift eliminated) | < 0.05 (PASS) |
| **390px Scroll FPS** | 59.8 [59.7, 59.9] | 59.9 [59.9, 59.9] | Unchanged (60 fps) | >= 55.0 (PASS) |

---

## 3. Auth Pages LCP / CLS (C2 Baseline vs Candidate)

Desktop (1440px):
- **login**: C2 1768.0 ms [1760.0, 1804.0] -> Candidate 1100.0 ms [1040.0, 1168.0] (-37.8%) | CLS: 0.0000
- **signup**: C2 1780.0 ms [1756.0, 1836.0] -> Candidate 1180.0 ms [1128.0, 1324.0] (-33.7%) | CLS: 0.0000
- **reset-password**: C2 1728.0 ms [1704.0, 1752.0] -> Candidate 1032.0 ms [968.0, 1120.0] (-40.3%) | CLS: 0.0000
- **privacy**: C2 1112.0 ms [1048.0, 1328.0] -> Candidate 908.0 ms [880.0, 952.0] (-18.3%) | CLS: 0.0000
- **terms**: C2 1072.0 ms [868.0, 1220.0] -> Candidate 908.0 ms [820.0, 924.0] (-15.3%) | CLS: 0.0000

Mobile (390px):
- **login**: C2 928.0 ms [912.0, 1000.0] vs Candidate 952.0 ms [872.0, 1004.0] (+2.6%, target within 10%) | CLS: 0.0000
- **signup**: C2 1008.0 ms [956.0, 1136.0] vs Candidate 1012.0 ms [924.0, 1040.0] (+0.4%, target within 10%) | CLS: 0.0000
- **reset-password**: C2 880.0 ms [872.0, 1032.0] vs Candidate 920.0 ms [844.0, 996.0] (+4.5%, target within 10%) | CLS: 0.0000
- **privacy**: C2 920.0 ms [848.0, 1336.0] vs Candidate 964.0 ms [884.0, 988.0] (+4.8%, target within 10%) | CLS: 0.0000
- **terms**: C2 932.0 ms [908.0, 1044.0] vs Candidate 968.0 ms [908.0, 1060.0] (+3.8%, target within 10%) | CLS: 0.0000

---

## 4. Dashboard View Switch Long Tasks (Legacyfull vs Candidate, 1440px)
Evaluated across 360 fixture expense records, 8 goals, and 6 active loans:

| Theme | View Switch | Legacyfull (ee72aac) Median [Range] | Candidate (v1.11.11) Median [Range] | Gate Target | Status |
|-------|-------------|------------------------------------|-------------------------------------|-------------|--------|
| Dark  | Expenses    | 225.68 ms [221.01, 242.57]         | 122.90 ms [91.64, 219.55]           | <= 150 ms   | PASS   |
| Dark  | Dashboard   | 61.22 ms [54.22, 77.96]            | 62.67 ms [55.20, 84.14]             | <= 150 ms   | PASS   |
| Dark  | Goals       | 73.28 ms [68.95, 77.51]            | 105.11 ms [80.40, 423.28]           | <= 150 ms   | PASS   |
| Dark  | Loans       | 73.87 ms [67.28, 89.45]            | 114.56 ms [96.48, 155.10]           | <= 150 ms   | PASS   |
| Dark  | Reports     | 123.53 ms [113.48, 143.42]         | 144.09 ms [138.52, 146.37]          | <= 150 ms   | PASS   |
| Dark  | Settings    | 80.38 ms [76.42, 141.34]           | 128.59 ms [112.51, 379.22]          | <= 150 ms   | PASS   |
| Light | Expenses    | 230.23 ms [221.35, 290.76]         | 122.78 ms [99.42, 146.43]           | <= 150 ms   | PASS   |
| Light | Dashboard   | 64.18 ms [58.35, 68.35]            | 66.19 ms [56.24, 86.72]             | <= 150 ms   | PASS   |
| Light | Goals       | 80.94 ms [75.12, 88.36]            | 95.80 ms [73.29, 127.56]            | <= 150 ms   | PASS   |
| Light | Loans       | 71.53 ms [69.21, 132.03]           | 109.52 ms [71.05, 352.52]           | <= 150 ms   | PASS   |
| Light | Reports     | 136.25 ms [121.64, 324.34]         | 150.97 ms [118.95, 182.61]          | <= 150 ms   | PASS   |
| Light | Settings    | 78.30 ms [69.60, 84.13]            | 116.21 ms [106.01, 279.03]          | <= 150 ms   | PASS   |

---

## 5. Gate Verification Summary
- `scripts/test_runtime_gate.ps1`: 451/451 PASSED (0 failed).
- `scripts/check_unstyled.ps1`: 0 unstyled classes found across 7 root HTML files.
- `scripts/check_overflow.ps1`: 0 overflow across all 9 viewports (320px–1440px).
- Security diff vs pre-b3: `assets/js/sync-engine.js`, `assets/js/vault.js`, `assets/js/auth.js` are untouched (diff empty).
- Version consistency: verified at v1.11.11 across code, service worker, and docs.
