# Antigravity prompt — dead-code cleanup (CSS first, then app.js fallbacks)

Role: pragmatic senior engineer. Goal: delete code that provably never runs or matches. **This is a deletion job, not a redesign.** Nothing a user sees may change.

## Step 0 — before anything

1. You already have an uncommitted edit: `assets/css/dashboard.css` (+ `.min.css`), which moves `overscroll-behavior` into `.table-responsive`. Finish or commit it on its own first, as `fix(dashboard): …`. Don't mix it into the cleanup commits.
2. Record a baseline: run `scripts/test_runtime_gate.ps1` and save the pass/fail count. **The suite has ~342 `Gate` checks, not 39.** Every gate that passes now must still pass at the end.
3. Take baseline screenshots at desktop 1440 and 390px width, light and dark: `index.html`, `login.html`, `signup.html`, `reset-password.html`, `privacy.html`, `terms.html`, and `dashboard.html` (Dashboard, Expenses, Reports, Loans, Goals and Settings tabs, plus one open modal). Save them under `docs/ui/refactor/before/`.

## Step 1 — dead rules in `assets/css/styles.css` (biggest win)

Measured: **221 of the 348 classes in `styles.css` appear nowhere** in any `*.html` or non-minified `assets/js/*.js`. They're mostly the old landing v1/v2 sections, left behind when the landing moved to `landing.css`.

These sections are entirely or almost entirely dead (line numbers approximate):
- `03 / Feature Carousel` (~1528–1736)
- `05 / Real Numbers Stats` (~1975–2055)
- `07 / Transparency Philosophy` (~2164–2234)
- `Hero Section` (~957–1057)
- `Hero Phone Mockup` (~1058–1340)
- `Highlight / Architecture Badges Strip` (~1341–1427)
- `Manifesto` (~4705–4805)
- `Pinned Walkthrough` (~4806–5071)
- `Interactive Tabbed Showcase` (~5072–5393)
- large parts of `Glassmorphic Navbar`, `LANDING PAGE V2` and `Comprehensive Responsive Mobile System`

**Rule for deleting (apply per rule, not per section):**
- A rule can go only if **every selector in its selector list** requires at least one class that appears nowhere in the source. Such a selector can never match.
- If a selector list is mixed, delete just the dead selectors and keep the rule.
- Delete an `@media` / `@supports` block only when it ends up empty.
- Keep every rule that has no class in it (element, id, `:root` or attribute selectors), and keep every `@keyframes` that a surviving rule still references.

**How to decide "appears nowhere":** build the set of every identifier-like token (`[A-Za-z][\w-]*`) in all `*.html` and `assets/js/*.js` (excluding `.min.js`). A class is dead if it's not in that set. Then, before deleting, grep the JS for class names built at runtime (`'prefix-' +`, `` `prefix-${…}` ``, `classList.add(` with variables, `className =` with concatenation). Keep any dead-looking class whose prefix gets built that way. One known case to check: something builds names with `section-`. Find out whether that produces ids or classes before deleting any `.section-*` rule.

- Don't touch `landing.css`.
- If a "dead" class turns out to come from a vendor (Font Awesome `fa-*`, Chart.js), keep it.

## Step 2 — dead rules in `assets/css/dashboard.css` (small)

Use the same method. Measured unused classes:
- `amount-text`, `badge-action-btn`, `budget-card`, `filter-btn`, `filter-group`, `goal-options-btn`
- `hero-amount-input`, `income-chips-wrapper`, `label-required`, `loan-options-btn`
- `modal-body`, `modal-header`, `neutral`, `overview-card-header`, `overview-val`
- `stat-amount`, `stat-value`, `tab-btn`, `tappable`
- `transaction-item`, `transaction-row`, `transaction-table`

Check each against runtime-built names first, as in Step 1.

**Do not** merge or reorder the 73 `@media (hover: hover) and (pointer: fine)` blocks. Moving them changes cascade order, and after gzip it saves almost nothing.

## Step 3 — dead fallback copies in `assets/js/app.js` (careful)

`app.js` hands about 120 functions off to the modules (`window.LedgioIncome ? … : fallback`). A few still carry a full copy of the module's logic, for example `getCurrentCycleRange` at `app.js:238`, a 45-line copy of `income.js:164`. `dashboard.html:2464-2475` loads every module with `defer` before `app.js`, so those copies never run in the app.

- List every hand-off that has a **multi-line** fallback body.
- For each one, grep `tests/headless_regression.html` for that function and the module it hands off to. The suite deliberately deletes module functions to exercise fallbacks (for example `delete win.LedgioIncome.md5` at ~7785).
- **Keep any fallback a gate exercises.**
- Shrink each remaining fallback to the one-line form the file already uses for the others: `return window.LedgioX ? window.LedgioX.fn(...) : <same neutral value as the siblings>`.
- Don't create a shared helpers file. Don't dedupe `getLocalDateString` / `formatCurrency` / `escapeHtml` across modules: each module is self-contained on purpose. `formatCurrency` already uses `toLocaleString`, so leave it alone.

## Out of scope (don't do)

- `sync-engine.js`, Supabase SQL/RLS, the localStorage layer.
- Moving `dashboard.html`'s ~540 inline styles into classes.
- New dependencies or new files, except the screenshot folders.
- In `dashboard.html`, remove only markup that's provably dead: an element nothing references by id or class, and that's permanently hidden with no JS path that shows it. List each one with proof. If you're not sure, leave it.

## Build, version, commits

- Run `scripts/build.ps1` after each step. It must pass.
- **Bump the version once at the end** (patch bump, in every place `build.ps1` checks: `?v=` query strings, `sw.js`, `supabase-config.js`, `README.md`), because the asset contents change.
- One commit per step: `refactor(css): remove dead landing-v1 rules from styles.css`, `refactor(css): remove dead rules from dashboard.css`, `refactor(app): collapse dead module fallbacks`, then `chore(release): vX.Y.Z`.
- **No Co-Authored-By lines. Do not push.**

## Report back with

1. Line counts before and after for `styles.css`, `dashboard.css` and `app.js`, plus `.min` byte sizes before and after.
2. The list of classes you deleted, and the list of "unused" classes you **kept**, each with the reason.
3. Every app.js fallback you collapsed, and every one you kept, with the gate that uses it.
4. `test_runtime_gate.ps1` totals before and after (they must be equal or better), and the `build.ps1` output.
5. Screenshots under `docs/ui/refactor/after/`, taken the same way as the baseline. Name any pair that differs at all. Expected result: no visible difference. If you couldn't take screenshots, say so plainly. Don't report the visual check as passed.
