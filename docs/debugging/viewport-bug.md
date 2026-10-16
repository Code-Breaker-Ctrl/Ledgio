# Root Cause Analysis: Mobile 980px Viewport Anomaly After Login

## 1. Executive Summary & Symptom
- **Symptom**: On mobile devices (Android Chrome, Chromium WebView, installed PWA), navigating from `login.html` to `dashboard.html` (via `window.location.replace('dashboard.html')`) frequently results in the dashboard rendering at a desktop layout width (~980px) scaled down to fit the phone screen (`visualViewport.scale ~ 0.38-0.42`), resulting in miniature text.
- **Key Clue**: The CSS classes `is-mobile-device` and `force-mobile-layout` were attached to `<html>`, but the layout viewport remained desktop-sized until a manual browser refresh (`Ctrl+R` or pull-to-refresh).
- **Duration**: Present since initial project development.

---

## 2. Experimental Data & Headless Emulation Analysis
A diagnostic test harness (`tests/test_viewport_repro.html`) executed via headless Edge (`scripts/diagnose_viewport.ps1`) at 390x844:
```
[poll_300ms_complete] win: 390x844 | de.clientW: 375 | de.scrollW: 375 | body.scrollW: 375 | vv.scale: 1 | offenders: 0
```
### Why Headless Desktop Chromium Did Not Exhibit the Shrink-to-Fit Bug
- Headless Chromium on desktop OS platforms without active Chrome DevTools Protocol (CDP) `Emulation.setDeviceMetricsOverride(mobile: true)` executes the desktop viewport pipeline.
- On Android, Chromium includes a mobile-specific layout heuristic in Blink (`viewport_data.cc` and `render_view_impl.cc`):
  1. When navigating between documents (`location.replace`), if the new document layout calculation perceives an element extending beyond the viewport or if `minimum-scale` is not locked at `1.0`, Blink activates the shrink-to-fit heuristic.
  2. The layout viewport expands to the default fallback (`980px`), and `visualViewport.scale` drops to `screen.width / 980`.

---

## 3. Static Code Analysis & Multi-Layer Root Causes

### Root Cause 1: Missing `minimum-scale=1.0` in Viewport Metas
- In `dashboard.html`, `login.html`, and `signup.html`, the tag was:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover, interactive-widget=resizes-content">
  ```
  And in `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```
- **Mechanism**: Neither specified `minimum-scale=1.0`. The default minimum-scale in Blink is `0.25` or `0.1`. When Blink's shrink-to-fit heuristic engages on Android, it scales down uninhibited. Setting `minimum-scale=1.0` establishes a hard lower bound preventing shrink-to-fit zoom-out while preserving `maximum-scale=5.0` for accessibility pinch-zoom.

### Root Cause 2: Viewport Meta Content Mutation is Ignored by Blink
- Existing logic in `dashboard.html` (lines 82-85) and `app.js` (lines 6735-6738):
  ```javascript
  const vpMeta = document.querySelector('meta[name="viewport"]');
  if (vpMeta) {
    vpMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover, interactive-widget=resizes-content');
  }
  ```
- **Mechanism**: The string passed to `setAttribute` was identical to the static HTML attribute already parsed. In Blink, mutating an element attribute with an identical string value is a no-op; the layout engine does not dispatch a viewport recomputation pass.
- **Fix**: The existing `<meta>` node must be physically removed (`vpMeta.remove()`) and a fresh `<meta name="viewport">` element inserted into `<head>`. If scale remains `< 0.95`, toggling `initial-scale=1.0001` then back to `1.0` in `requestAnimationFrame` forces Blink to recompute layout viewport.

### Root Cause 3: `max-width: 100vw !important` Creates Horizontal Overflow
- In `dashboard.html` (line 41) and `login.html` (line 36):
  ```css
  html, body {
    overflow-x: clip !important;
    max-width: 100vw !important;
  }
  ```
- **Mechanism**: In CSS specifications, `100vw` equals 100% of the viewport width including the vertical scrollbar. When a page has vertical content, `100vw` exceeds the viewport's client width by the scrollbar thickness (15-17px on desktop, dynamic on mobile overlay scrollbars during layout). This creates subpixel or layout overflow triggering Android Chrome's shrink-to-fit.
- **Fix**: Use `max-width: 100% !important; overflow-x: clip !important; overflow-x: hidden !important;`.

### Root Cause 4: Off-Canvas Sidebar Geometry & Hidden Overlays
- In `dashboard.css`, `#sidebar` is positioned off-canvas on mobile using `transform: translateX(-100%)` with `width: 280px`.
- **Mechanism**: Without `contain: paint` or `visibility: hidden` when closed, transformed off-canvas bounding boxes can contribute to layout scrollWidth during initial paint transitions before media query animations complete.
- **Fix**: Add `contain: paint` to `#sidebar:not(.open)` and ensure `#toast-container` / modals have strict `max-width: 100%` and `overflow: hidden`.

### Root Cause 5: Missing Event Lifecycles (`pageshow`, `bfcache`, `visibilitychange`)
- Viewport verification previously only ran at inline script execution (0ms) and `startupPhase1_LocalPaint()`.
- **Mechanism**: Navigating between cached pages (BFCache) or waking from sleep emits `pageshow` (with `event.persisted`) and `visibilitychange`. If the layout viewport was invalidated during backgrounding, no guard was attached to restore it.
- **Fix**: Attach the viewport self-healing engine to `DOMContentLoaded`, `load`, `pageshow`, `visibilitychange`, `orientationchange`, and `+300ms`.

### Root Cause 6: Lack of Automated One-Time Self-Heal Fallback
- Manual reload always resolved the symptom because it forced a complete top-level navigation layout cycle.
- **Fix**: When `navigateToDashboard()` in `auth.js` triggers, stamp `sessionStorage.setItem('ledgio_login_redirect', '1')`. If after running the dynamic meta rebuild guard on dashboard mount the viewport remains anomalous (`innerWidth > 768` on mobile), immediately consume the flag and invoke `location.reload()`. This provides a guaranteed self-healing fallback that can never loop.

---

## 4. Multi-Layer Resolution Strategy

| Layer | Component | Implementation |
|---|---|---|
| **Layer 1: Zoom Floor** | Viewport Metas | Add `minimum-scale=1.0` across `index.html`, `login.html`, `signup.html`, `dashboard.html` |
| **Layer 2: Overflow Elimination** | CSS Layout | Replace `100vw` with `100%`, add `overflow-x: clip` + `hidden`, `contain: paint` for closed mobile sidebar |
| **Layer 3: DOM Rebuild Guard** | Unified Helper | Node remove/append + `1.0001` scale toggle on scale < 0.95 or doc clientWidth > screen.width * 1.15 |
| **Layer 4: Self-Heal Fallback** | Login Flow | `sessionStorage` flag `ledgio_login_redirect` + 1-time `location.reload()` fallback |
| **Layer 5: Service Worker & bfcache** | PWA & Lifecycle | Clean navigation caching in `sw.js`, `pageshow` handling, version bump to `1.4.91` |
| **Layer 6: Consolidation** | DRY Architecture | Single consolidated `window.__ledgio_ensureMobileViewport()` in head script, invoked by `app.js` |

---

## 5. Update (2026-10-17): bug still seen on device after v1.4.91

- **Observed:** the tiny desktop-sized view still appeared right after login (empty ₹0.00 state) on an Android phone running the v1.4.91 code.
- **Defect in the v1.4.91 fallback:** the reload only ran when the `ledgio_login_redirect` flag was set, and the `load` check deleted the flag whenever the page looked fine at that instant. An anomaly appearing after `load` (e.g. during first-login hydration) was never healed.
- **v1.4.92 change:** the dashboard checks for the anomaly at DOMContentLoaded, load, pageshow, visibilitychange, orientationchange, resize (first 10s) and at 300ms/1s/2.5s/5s/10s. It reloads when the viewport is wider than 768px *and* more than 15% wider than the screen for the current orientation (so landscape phones are unaffected). There is at most one reload per 20s (`sessionStorage.ledgio_vp_reload_at`), so it cannot loop.
- **Diagnostics:** every detection is appended to `localStorage.ledgio_vp_anomaly_log` (last 10 entries: time, trigger, action, innerWidth, screen width, clientWidth, scrollWidth, visualViewport scale, navigation type, referrer, SW-controlled, widest elements). The `?debugviewport=1` overlay prints this log. The root cause is still unconfirmed; this log is how to confirm it.
