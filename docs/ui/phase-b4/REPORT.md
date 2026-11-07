# Phase B4: Humanized Landing Redesign Report

## 1. Preconditions & Hygiene
- Branch: `redesign-halftone` (verified, never pushed or merged to `main`).
- Starting Tag: `pre-b4` verified at commit `3d93ad9`.
- Sensitive Diff: `git diff pre-b3 -- assets/js/auth.js assets/js/sync-engine.js assets/js/vault.js` returned completely empty (zero changes).
- Service Worker & Precache: Updated `sw.js` cache to include `landing-b4-v1.min.css`, `dash-desktop-b4-v1.webp`, `dash-mobile-b4-v1.webp`, and `reports-desktop-b4-v1.webp`.
- Evidence & Temp Files: Benchmarks and scratch scripts strictly outside repo (`scratch/` gitignored).

## 2. Hallmark Floor Rules Audit (F1–F16)
- F1 (Tokenized Colors & Fonts): PASS. Zero literal colors or font families below :root in `landing-b4-v1.css`, `tokens.css`, and critical inline CSS.
- F2 (No transition: all, transform/opacity only): PASS. All transitions target specific properties; zero animated width/height/top/left.
- F3 (Pure Roman h1): PASS. "Know where your money went." has zero single italic words.
- F4 (overflow-x: clip): PASS. `html` and `body` use `overflow-x: clip`; no `hidden`, no `100vw`.
- F5 (minmax(0, 1fr) grid tracks): PASS. All grid track declarations and display heading break-word rules verified.
- F6 (Instant :focus-visible): PASS. Instant visible focus ring on all buttons, links, inputs, and toggles.
- F7 (prefers-reduced-motion fallback): PASS. Verified static end states on all animated elements; content fully accessible without JS.
- F8 (Zero fake metrics/logos/testimonials): PASS. Removed mock marketing counts and invented claims.
- F9 (No eyebrows, body face labels): PASS. Section motifs converted to aria-hidden visual bars; labels use body face in untracked sentence case.
- F10 (No middle-dot meta, no glued arrows): PASS. Clean release pill with single bullet, zero glued arrow typography.
- F11 (No cards in cards, no mac dots): PASS. Removed fake OS window chrome (`.mac-dots`); flattened child motion elements to panels.
- F12 (Hero word limits): PASS. Headline is 6 words ("Know where your money went."), subtitle is 11 words ("Track what you spend locally on your phone without bank logins."). Fits above fold at 1280x800.
- F13 (Word budget per screen): PASS. Hero contains only headline, sentence, and 2 action triggers.
- F14 (Capped centered container): PASS. Max-width containers with growing gutters at 1920px.
- F15 (Hallmark stamp line 1): PASS. Both unminified and minified CSS files lead with `/* Hallmark: ... */`.
- F16 (Sloplint Floor Tier Clean): PASS. `node sloplint.mjs index.html --tier floor` reports: 0 FAIL, 0 REFLEX, 0 WARN.

## 3. Product Imagery
Captured native dark-mode product screenshots with real seeded fixture data:
- `assets/img/dash-desktop-b4-v1.webp`: 37,596 bytes (Budget <= 80 KB)
- `assets/img/dash-mobile-b4-v1.webp`: 40,848 bytes (Budget <= 80 KB)
- `assets/img/reports-desktop-b4-v1.webp`: 31,104 bytes (Budget <= 80 KB)
Replaced mock SVG/canvas illustration containers in `#problem` and `#feature-04` with real WebP imagery with explicit dimensions and `loading="lazy"`.

## 4. Copy Diff & Cut Proposals
- `COPY-DIFF.md`: Complete before/after audit across all 13 sections. All corporate buzzwords ("seamless", "powerful", "effortless", "unlock") stripped. Added honest offline storage disclaimer and founder motivation placeholder in `#problem`.
- `PROPOSALS.md`: Documented 4 structural pruning recommendations for owner review (interactive simulator consolidation, feature deep-dive narrative grouping, OS chrome retirement, FAQ trimming) while keeping all 13 sections intact in `index.html`.

## 5. Mechanical & Gate Verification
- Build & Version: v1.11.13 consistent across `supabase-config-p3a-v1.js`, `sw.js`, `README.md`, HTML asset strings, and hero pill.
- `check_unstyled.ps1`: 0 unstyled classes across all 7 HTML files (1,594 unique CSS classes verified).
- `check_overflow.ps1`: PASSED all 9 viewports (320px, 360px, 375px, 390px, 412px, 430px, 768px, 1024px, 1440px) with 0 overflow and 0 clipped elements.
- `test_runtime_gate.ps1`: 451 / 451 gates PASSED (0 failed). Full scroll continuous FPS: 60.3 fps (Target >= 55 fps).
- Sloplint: 0 FAIL on `index.html`.
