# Mobile-Only UI Redesign & Desktop Parity Guard

## 1. Overview
This directory documents the mobile-first UI redesign of Ledgio's core surfaces (Dashboard stat cards, "Record Loan / Debt" modal, and Reports analytics) across mobile viewports (360px, 390px, 430px, 768px), while strictly guarding desktop (1440px) and tablet-landscape (1024px) visual parity against commit `202d5b5`.

All mobile modifications are scoped within `@media (max-width: 768px)` in `assets/css/dashboard.css` and `assets/css/styles.css`. Desktop markup and desktop rendering remain strictly identical.

---

## 2. Redesigned Components (Mobile Only <= 768px)

### A. Dashboard Stat Cards
- **Header Row**: Compact icon chip + label on a single line (`white-space: nowrap`) to eliminate wasted vertical space.
- **Mode Toggle**: Prominent segmented pill `% | ₹` in the card top-right corner with a >= 44x44px touch target area, clear active state highlighting, subtle 150ms transitions, and `aria-pressed`/`role="switch"` semantics. Ambiguous refresh icon removed on mobile.
- **Value & Qualifier**: Value sized with `clamp()` and `font-variant-numeric: tabular-nums` to prevent overflow in negative or >100% states. Single-line qualifier with text truncation (`ellipsis`) and full text accessible via `title`. Muted single-line lifetime total footer.
- **Stealth Mode**: Preserved password masking (`••••`) without layout shifts.

### B. Record Loan / Debt Modal (Bottom Sheet on Mobile)
- **Bottom Sheet Architecture**: Transformed into a bottom sheet anchored to the viewport bottom with rounded top corners, grab handle, max-height `92dvh`, backdrop tap to dismiss, and smooth slide-up animation.
- **Hero Amount Input**: Amount placed at top with a prominent centered `₹` currency prefix badge embedded cleanly inside the input wrapper (`.hero-amount-wrapper`).
- **Direction Pills**: Short labels on mobile ("I Lent", "I Borrowed") using `.mobile-only` / `.desktop-only` text spans.
- **Field Reordering**: Powered by CSS flexbox `order` and `.loan-amount-date-row { display: contents !important; }` without mutating desktop DOM order.
- **Sticky Footer**: Cancel and Save buttons pinned to the bottom sheet footer with >= 44px touch heights.

### C. Reports Section
- **Month Navigator**: Prominent arrow touch targets (>= 44x44px), swipe gesture support (`touchstart`/`touchend` delta detection), and clean current month display.
- **Category Breakdown Chart**: Donut chart resized with sticky legend underneath; tap-to-focus on donut segment highlights corresponding legend item.
- **Monthly Trend Chart**: Horizontally scrollable container with SVG target budget/goal reference line and sticky left axis.
- **Empty & Overflow States**: Clean empty state graphics and vertical scrolling for >6 categories.

---

## 3. Desktop & Tablet-Landscape Parity Rules

1. **Zero Desktop Markup Regressions**:
   - Desktop viewports (> 768px) retain the full original markup and copy in `dashboard.html`:
     - Direction labels: `"I Lent (They owe me)"` / `"I Borrowed (I owe them)"`
     - Paid-by toggle: `"They paid for me directly"`
     - Original 2-column grid layout for Principal Amount and Date.
     - Notes label: `"Notes / Reason (Optional)"`.
2. **CSS Scoping**:
   - All mobile adjustments reside inside `@media (max-width: 768px)`.
   - Currency prefix (`.hero-currency-prefix`) is `display: none` by default and only displayed on mobile inside the relative input wrapper.
   - `.pwa-install-btn span` text label hiding is scoped strictly to `@media (max-width: 480px)` (preserving tablet/desktop install button styling).

---

## 4. Automated Visual Parity Guard

To prevent silent desktop or tablet-landscape regressions in CI and local development, an automated visual parity guard script is provided:

### Script: `scripts/verify_desktop_parity.ps1`
- Compares every `*_1440.png` (desktop) and `*_1024.png` (tablet landscape) screenshot in `docs/ui/mobile-redesign/after/` against baseline screenshots in `docs/ui/mobile-redesign/before/` (captured at commit `202d5b5`).
- Uses high-speed 32-bit ARGB Direct Memory Access via C# `Bitmap.LockBits` (executing full 1440x900 comparisons in <15ms).
- Sub-pixel anti-aliasing tolerance is applied to ignore minor font rasterization jitter while strictly catching any layout, positioning, or copy changes.
- **Threshold**: Fails with exit code `1` if any screenshot exceeds `0.1%` pixel difference.

### Running the Parity Guard:
```powershell
# Run standalone parity check
powershell -ExecutionPolicy Bypass -File scripts\verify_desktop_parity.ps1

# Capture after screenshots and auto-run parity verification
powershell -ExecutionPolicy Bypass -File scripts\capture_mobile_redesign_screenshots.ps1 -Stage after
```

---

## 5. Verification Commands
Before any release or commit touching UI styles or markup:
1. `powershell -File scripts\build.ps1`
2. `powershell -File scripts\verify_innerhtml_audit.ps1` (131/131 matched)
3. `powershell -File scripts\test_runtime_gate.ps1` (279/279 passed)
4. `powershell -File scripts\verify_desktop_parity.ps1` (Diff <= 0.1% on all desktop/tablet viewports)
