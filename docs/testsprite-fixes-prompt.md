# Antigravity prompt — TestSprite follow-ups (Oct 25 run)

Context: a TestSprite E2E run against https://ledgio.pages.dev reported 40 pass / 3 fail / 3 blocked. I triaged each failure against the code. **None is a data or sync bug.** Expenses and income save and recompute correctly, and the deployed build is not stale. **Ignore TestSprite's own "root cause / fix" text.** Its suggestions to redeploy, clear the CDN, merge income into the expense ledger, or add a pay-cycle field to the income form are wrong for this app. Make only the three fixes below.

## Fix 1 — landing demo "Record Expense" button does nothing when clicked (TestSprite: "Dashboard reflects added expense in overview")

The test never reached the dashboard. It clicked **SCENE 01 → Record Expense** in the landing page's motion demo (`index.html:941`). The four demo action buttons are real `<button>`s that look clickable, but none of them has a click handler:
- `#scene1-submit-btn` (`index.html:941`)
- `#scene2-action-btn` (`:1006`)
- `#scene3-add-btn` (`:1055`)
- `#scene4-repay-btn` (`:1137`)

They change only when the auto-play cursor animation (`runSceneTimeline`, `assets/js/landing.js:623`) "presses" them. Scene 1 is also tagged "Real Action" (`index.html:931`). So a visitor or a test that clicks during the animation gets no response.

- In `landing.js`, next to the tab click wiring (`~line 865`), add a click listener on each of the four buttons. It should: call `clearSceneTimeouts()`, hide the fake cursor, then call `renderFinalState(idx)` (`landing.js:448`), which already applies the end state (for scene 1 that's ₹1,200 Groceries, Safe-to-Spend ₹36,350, the "Kirana store • Groceries" row, and the toast). Then reset `startTime = performance.now()` so the auto-advance timer restarts from the click. Clicking again must not add duplicate rows. `renderFinalState` already guards scene 1 with `.tx-added-row`; check that scenes 2–4 have the same guard and add it if missing.
- Change the scene 1 tag text from "Real Action" to "Try it". Change nothing else about the demo's visuals.
- Check the mobile landing too (`landing-mobile.js`). If it has equivalent fake buttons, apply the same treatment. If not, say so.

## Fix 2 — "Transactions" label counts expenses only (TestSprite: "Add an income transaction")

- `dashboard.html:873` (dashboard category card) and `dashboard.html:1100` (Reports month card) show a **Transactions** label. Its value comes from `dashboard-category-count` (`app.js:4155`) and `reports-month-count` (`app.js:4391`), and both count **expenses only**. After adding income, the user sees "Transactions 0" and assumes the income was lost.
- Change both labels to **Expenses** (the label text only, not the ids or the count logic).
- Do not merge income into the expense ledger. Income History is the income ledger by design.

## Fix 3 — make the pay-cycle setting reachable from the income card (TestSprite: "Set salary cycle from dashboard income form" + the 2 blocked recurring-salary tests)

- The pay-cycle start day and recurring salary already exist in Settings (`#cycle-salary-card`, `dashboard.html:1218`; `#cycle-start-day-select`, line 1237; `#recurring-salary-toggle`, line 1256; handlers at `app.js:6306`/`6318`). The test only looked in the dashboard income form. It never enabled recurring salary, so there was no salary entry to edit or delete.
- **Do not** add a pay-cycle control to the income form, because that would duplicate state.
- Add a small muted text link under the "Add Money" button (`dashboard.html:~818`, above the Income History section): `Pay cycle & recurring salary →`. Use `<button type="button" id="income-cycle-settings-link">` styled as a link with existing CSS vars. On click, call the existing `navigateTo('#settings')` (`app.js:5402`), then `document.getElementById('cycle-salary-card')?.scrollIntoView({behavior:'smooth', block:'start'})`. Bind it where the other income-card listeners are bound.

## Constraints

- Edit source files only, then run `scripts/build.ps1` to regenerate the `.min.js` / `.min.css` files. It must pass (version parity, asset checks, `node --check`).
- No version bump, no new dependencies, no new innerHTML with user data.
- One commit per fix, conventional messages (`fix(landing): …`, `fix(ui): …`). **No Co-Authored-By lines. Do not push.**

## Verify and report

- For each fix, give the file:line changed and a screenshot at desktop and 390px width.
- Check by hand:
  - On the landing page, click Record Expense mid-animation. The ₹1,200 row, Safe-to-Spend ₹36,350, and the toast appear at once, and a second click adds no duplicate row. Do the same for scenes 2–4.
  - On the dashboard, add income. The category card reads "Expenses 0".
  - Click the new link. Settings opens, scrolled to the pay-cycle card.
- Paste the `scripts/build.ps1` output.
