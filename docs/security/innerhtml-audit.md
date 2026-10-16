# Exhaustive innerHTML Codebase Audit

Generated mechanically via `git grep -n "innerHTML"`.
Total verified lines: **131** across all non-minified application source files.

### Per-File Distribution Summary

| Source File | innerHTML Occurrences | Status |
| :--- | :---: | :---: |
| `assets/js/app.js` | 66 | Verified 100% |
| `assets/js/categories.js` | 5 | Verified 100% |
| `assets/js/expenses.js` | 13 | Verified 100% |
| `assets/js/goals.js` | 8 | Verified 100% |
| `assets/js/income.js` | 6 | Verified 100% |
| `assets/js/loans.js` | 9 | Verified 100% |
| `assets/js/pwa-installer.js` | 7 | Verified 100% |
| `assets/js/vault.js` | 8 | Verified 100% |
| `index.html` | 9 | Verified 100% |

---

### Full Audit Table

| # | `file:line` | Target Element | Interpolated / Dynamic Expressions | Origin of Values | Sanitization / Escaping | Static? |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: |
| 1 | `assets/js/app.js:755` | `btn` | `${count > 0 ? `Offline (${count}` | Queue length and dead-letter length numeric counts | Numeric integer count | No |
| 2 | `assets/js/app.js:760` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 3 | `assets/js/app.js:764` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 4 | `assets/js/app.js:769` | `btn` | `${count > 0 ? `Syncing (${count}` | Queue length and dead-letter length numeric counts | Numeric integer count | No |
| 5 | `assets/js/app.js:773` | `btn` | `${deadLetter.length}`<br>`${deadLetter.length > 1 ? 's' : ''}` | Queue length and dead-letter length numeric counts | Numeric integer count | No |
| 6 | `assets/js/app.js:777` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 7 | `assets/js/app.js:1777` | `netStatusEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 8 | `assets/js/app.js:1783` | `cloudStatusEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 9 | `assets/js/app.js:1800` | `queueListEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 10 | `assets/js/app.js:1823` | `queueListEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 11 | `assets/js/app.js:1831` | `dlListEl` | `${idx}` | Dead-letter sync items (item name, note, person, amounts, technical error messages) | `escapeHtml(itemName)`, `escapeHtml(amountText)`, `escapeHtml(action)`, `escapeHtml(table)`, `escapeHtml(targetLabel)`, `escapeHtml(timeLabel)`, `escapeHtml(errText)` | No |
| 12 | `assets/js/app.js:1952` | `dlListEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 13 | `assets/js/app.js:1975` | `subtitle` | `${escapeHtml(firstName)}` | Profile greeting user first name (profiles table / session user metadata) | `escapeHtml(firstName)` | No |
| 14 | `assets/js/app.js:2157` | `authBadgeEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 15 | `assets/js/app.js:2167` | `authBadgeEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 16 | `assets/js/app.js:2183` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 17 | `assets/js/app.js:2191` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 18 | `assets/js/app.js:2199` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 19 | `assets/js/app.js:2209` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 20 | `assets/js/app.js:2218` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 21 | `assets/js/app.js:2225` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 22 | `assets/js/app.js:2233` | `feedback` | `${escapeHtml(newEmail)}` | User new email input from account modal | `escapeHtml(newEmail)` | No |
| 23 | `assets/js/app.js:2241` | `feedback` | `${escapeHtml(errMsg)}` | Server auth error message returned by Supabase Auth API | `escapeHtml(errMsg)` / `escapeHtml(msg)` | No |
| 24 | `assets/js/app.js:2247` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 25 | `assets/js/app.js:2263` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 26 | `assets/js/app.js:2269` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 27 | `assets/js/app.js:2277` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 28 | `assets/js/app.js:2289` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 29 | `assets/js/app.js:2298` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 30 | `assets/js/app.js:2307` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 31 | `assets/js/app.js:2316` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 32 | `assets/js/app.js:2324` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 33 | `assets/js/app.js:2338` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 34 | `assets/js/app.js:2343` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 35 | `assets/js/app.js:2350` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 36 | `assets/js/app.js:2361` | `feedback` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 37 | `assets/js/app.js:2373` | `feedback` | `${escapeHtml(msg)}` | Server auth error message returned by Supabase Auth API | `escapeHtml(errMsg)` / `escapeHtml(msg)` | No |
| 38 | `assets/js/app.js:2379` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 39 | `assets/js/app.js:2700` | `subtitleEl` | `${escapeHtml(oldCur)}`<br>`${escapeHtml(newCur)}` | Old currency and new currency codes from currency switch select | `escapeHtml(oldCur)`, `escapeHtml(newCur)` | No |
| 40 | `assets/js/app.js:3006` | `incomeEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 41 | `assets/js/app.js:3010` | `incomeEl` | `${incColor}` | Calculated savings rate and expense rate percentages & CSS color variables | Numeric integer / percentage (`savingsRateVal%`, `spendPctOfIncome%`) & CSS color variables | No |
| 42 | `assets/js/app.js:3015` | `incomeEl` | `${incColor}`<br>`${savingsRateVal}` | Calculated savings rate and expense rate percentages & CSS color variables | Numeric integer / percentage (`savingsRateVal%`, `spendPctOfIncome%`) & CSS color variables | No |
| 43 | `assets/js/app.js:3044` | `lifetimeEl` | `${qualifier}` | Sub-line qualifier text and formatted total earned / total spent lifetime figures | Predefined qualifier string literals & `escapeHtml(earnedFormatted)`, `escapeHtml(spentFormatted)` | No |
| 44 | `assets/js/app.js:3047` | `lifetimeEl` | `${qualifier}`<br>`${escapeHtml(earnedFormatted)}` | Sub-line qualifier text and formatted total earned / total spent lifetime figures | Predefined qualifier string literals & `escapeHtml(earnedFormatted)`, `escapeHtml(spentFormatted)` | No |
| 45 | `assets/js/app.js:3053` | `lifetimeEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 46 | `assets/js/app.js:3090` | `expensesEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 47 | `assets/js/app.js:3093` | `expensesEl` | `${expColorVar}` | Calculated savings rate and expense rate percentages & CSS color variables | Numeric integer / percentage (`savingsRateVal%`, `spendPctOfIncome%`) & CSS color variables | No |
| 48 | `assets/js/app.js:3098` | `expensesEl` | `${expColorVar}`<br>`${spendPctOfIncome}` | Calculated savings rate and expense rate percentages & CSS color variables | Numeric integer / percentage (`savingsRateVal%`, `spendPctOfIncome%`) & CSS color variables | No |
| 49 | `assets/js/app.js:3123` | `spendPctEl` | `${qualifier}` | Sub-line qualifier text and formatted total earned / total spent lifetime figures | Predefined qualifier string literals & `escapeHtml(earnedFormatted)`, `escapeHtml(spentFormatted)` | No |
| 50 | `assets/js/app.js:3126` | `spendPctEl` | `${qualifier}`<br>`${escapeHtml(spentFormatted)}` | Sub-line qualifier text and formatted total earned / total spent lifetime figures | Predefined qualifier string literals & `escapeHtml(earnedFormatted)`, `escapeHtml(spentFormatted)` | No |
| 51 | `assets/js/app.js:3132` | `spendPctEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 52 | `assets/js/app.js:4523` | `listEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 53 | `assets/js/app.js:4614` | `el` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 54 | `assets/js/app.js:4628` | `catFilter` | `${allOpts}` | Filter dropdown options (categories, distinct expense months, cycle reset days) | `escapeHtml(m)` for dates, `escapeHtml(c.name)` for categories, integer loop for cycle days | No |
| 55 | `assets/js/app.js:4639` | `moFilter` | `${escapeHtml(m)}`<br>`${escapeHtml(m)}` | Filter dropdown options (categories, distinct expense months, cycle reset days) | `escapeHtml(m)` for dates, `escapeHtml(c.name)` for categories, integer loop for cycle days | No |
| 56 | `assets/js/app.js:4673` | `cycleSelect` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 57 | `assets/js/app.js:4674` | `recurringDaySelect` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 58 | `assets/js/app.js:4844` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 59 | `assets/js/app.js:4941` | `platformContainer` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 60 | `assets/js/app.js:4965` | `platformContainer` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 61 | `assets/js/app.js:5752` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 62 | `assets/js/app.js:5754` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 63 | `assets/js/app.js:6314` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 64 | `assets/js/app.js:6319` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 65 | `assets/js/app.js:6336` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 66 | `assets/js/app.js:6341` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 67 | `assets/js/categories.js:347` | `el` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 68 | `assets/js/categories.js:361` | `catFilter` | `${allOpts}` | Built-in categories & user custom categories from state | `categoriesBridge.escapeHtml(c.name)` for values & labels, `categoriesBridge.escapeHtml(k)` | No |
| 69 | `assets/js/categories.js:380` | `container` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 70 | `assets/js/categories.js:384` | `container` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 71 | `assets/js/categories.js:630` | `select` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 72 | `assets/js/expenses.js:470` | `editBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 73 | `assets/js/expenses.js:476` | `delBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 74 | `assets/js/expenses.js:545` | `list` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 75 | `assets/js/expenses.js:552` | `list` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 76 | `assets/js/expenses.js:565` | `icon` | `${expensesBridge.sanitizeIcon(cat.icon, 'fa-tag')}` | Expense item category icon | `expensesBridge.sanitizeIcon(cat.icon, 'fa-tag')` | No |
| 77 | `assets/js/expenses.js:624` | `tbody` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 78 | `assets/js/expenses.js:627` | `tbody` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 79 | `assets/js/expenses.js:674` | `list` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 80 | `assets/js/expenses.js:680` | `list` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 81 | `assets/js/expenses.js:709` | `title` | `${safeCatIcon}`<br>`${safeCatColor}`<br>`${expensesBridge.escapeHtml(cat.label)}` | Budget item category label, icon, and color | `expensesBridge.escapeHtml(cat.label)`, `sanitizeIcon()`, `sanitizeColor()` | No |
| 82 | `assets/js/expenses.js:716` | `amounts` | `${expensesBridge.formatCurrency(spent)}`<br>`${expensesBridge.formatCurrency(limit)}` | Budget amounts (spent, limit, remaining) & percentages | Numeric integer / percentage & `formatCurrency()` | No |
| 83 | `assets/js/expenses.js:723` | `delBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 84 | `assets/js/expenses.js:747` | `footer` | `${pct}`<br>`${expensesBridge.formatCurrency(Math.max(0, limit - spent))}` | Budget amounts (spent, limit, remaining) & percentages | Numeric integer / percentage & `formatCurrency()` | No |
| 85 | `assets/js/goals.js:207` | `grid` | `${state.goals.length === 0 ? 'No savings goals yet' : 'No goals match this filter'}`<br>`${goalsBridge.escapeHtml(emptyDesc)}` | Goals filter state & empty description string | `goalsBridge.escapeHtml(emptyDesc)` | No |
| 86 | `assets/js/goals.js:223` | `grid` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 87 | `assets/js/goals.js:685` | `titleEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 88 | `assets/js/goals.js:709` | `titleEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 89 | `assets/js/goals.js:792` | `historyList` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 90 | `assets/js/goals.js:794` | `historyList` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 91 | `assets/js/goals.js:843` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 92 | `assets/js/goals.js:850` | `submitBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 93 | `assets/js/income.js:555` | `listEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 94 | `assets/js/income.js:637` | `listEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 95 | `assets/js/income.js:675` | `previewBox` | `${isStealth ? 'stealth-masked' : ''}`<br>`${incomeBridge.formatCurrency(resultingTotal)}` | Income adjustment / balance preview amounts & colors | Numeric `formatCurrency()`, constant CSS variables, `sign` literal | No |
| 96 | `assets/js/income.js:687` | `previewBox` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 97 | `assets/js/income.js:693` | `previewBox` | `${isStealth ? 'stealth-masked' : ''}`<br>`${deltaColor}`<br>`${sign}`<br>`${deltaFormatted}` | Income adjustment / balance preview amounts & colors | Numeric `formatCurrency()`, constant CSS variables, `sign` literal | No |
| 98 | `assets/js/income.js:742` | `previewBox` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 99 | `assets/js/loans.js:111` | `datalist` | `${escapeHtml(n)}` | Unique person names from loans state | `escapeHtml(n)` | No |
| 100 | `assets/js/loans.js:369` | `container` | `${state.loans.length === 0 ? 'No loans or debts yet' : 'No records found'}`<br>`${escapeHtml(emptyDesc)}` | Loans state count & activeLoansFilter text | Ternary string & `escapeHtml(emptyDesc)` | No |
| 101 | `assets/js/loans.js:384` | `container` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 102 | `assets/js/loans.js:418` | `titleEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 103 | `assets/js/loans.js:438` | `titleEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 104 | `assets/js/loans.js:1044` | `titleEl` | `${escapeHtml(loan.person_name)}` | Selected loan record person_name | `escapeHtml(loan.person_name)` | No |
| 105 | `assets/js/loans.js:1051` | `subtitleEl` | `${dirText}`<br>`${stealth ? 'stealth-masked' : ''}`<br>`${escapeHtml(pStr)}`<br>`${stealth ? 'stealth-masked' : ''}`<br>`${escapeHtml(oStr)}` | Loan direction text & principal / outstanding strings | Direction literal & `escapeHtml(pStr)`, `escapeHtml(oStr)` via `formatCurrency()` | No |
| 106 | `assets/js/loans.js:1060` | `listEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 107 | `assets/js/loans.js:1062` | `listEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 108 | `assets/js/pwa-installer.js:40` | `pill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 109 | `assets/js/pwa-installer.js:397` | `modal` | `${guideContent}` | Static button markup | Static markup (inherently safe) | No |
| 110 | `assets/js/pwa-installer.js:470` | `element` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 111 | `assets/js/pwa-installer.js:472` | `clickedBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 112 | `assets/js/pwa-installer.js:492` | `clickedBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 113 | `assets/js/pwa-installer.js:557` | `offlineIndicator` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 114 | `assets/js/pwa-installer.js:561` | `offlineIndicator` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 115 | `assets/js/vault.js:356` | `badge` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 116 | `assets/js/vault.js:361` | `badge` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 117 | `assets/js/vault.js:393` | `stealthBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 118 | `assets/js/vault.js:397` | `stealthBtn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 119 | `assets/js/vault.js:610` | `title` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 120 | `assets/js/vault.js:760` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 121 | `assets/js/vault.js:764` | `btn` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 122 | `assets/js/vault.js:962` | `noteEl` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 123 | `index.html:1018` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 124 | `index.html:1028` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 125 | `index.html:1038` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 126 | `index.html:1048` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 127 | `index.html:1058` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 128 | `index.html:1068` | `simStatusPill` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 129 | `index.html:1237` | `landingThemeToggle` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 130 | `index.html:1240` | `landingThemeToggle` | (None - static string) | Hardcoded markup string | Static markup (inherently safe) | Yes |
| 131 | `index.html:1275` | `copyright` | `${new Date().getFullYear()}` | System year (new Date().getFullYear()) | Numeric integer | No |

---
*Audit verified automatically by `scripts/verify_innerhtml_audit.ps1` against live codebase.*