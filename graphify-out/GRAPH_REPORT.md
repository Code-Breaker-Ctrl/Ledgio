# Graph Report - Ledgio  (2026-11-07)

## Corpus Check
- 159 files · ~412,256 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 16, .woff2 7, (none) 3)

## Summary
- 3573 nodes · 8145 edges · 186 communities (148 shown, 38 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 740 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `718f5c3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- supabase.min.js
- chart.min.js
- P
- app.min.js
- app-c2-v1.min.js
- app.js
- js
- Na
- t
- log
- tn
- setupEventListeners
- Jt
- landing-mobile.js
- landing-mobile-b3-v1.js
- landing-mobile-b3-v1.min.js
- landing-mobile.min.js
- o
- getUserId
- n
- _n
- startupPhase1_LocalPaint
- getUserId
- income.js
- income.min.js
- s
- setupEventListeners
- startupPhase1_LocalPaint
- constructor
- loans.js
- loans.min.js
- Ro
- updateSummary
- categories.js
- categories.min.js
- send
- startupPhase1_LocalPaint
- vault.js
- vault.min.js
- l
- Ledgio
- expenses-p3a-v1.js
- expenses-p3a-v1.min.js
- goals.js
- goals.min.js
- expenses.js
- expenses-c2-v1.min.js
- expenses.min.js
- n
- landing.js
- landing-b3-v1.min.js
- sync-engine.js
- sync-engine.min.js
- landing-b3-v2.js
- landing-b3-v2.min.js
- Ho
- checkAndApplyRecurringSalary
- setupEventListeners
- Ss
- .update
- .notifyPlugins
- updateSummary
- sn
- landing.min.js
- ._computeLabelItems
- audit_c1.js
- pwa-installer.js
- pwa-installer.min.js
- updateSummary
- initDesktopExperience
- tickNumber
- gen_hero_ascii.js
- hero-ascii-b3-v2.js
- hero-ascii-b3-v2.min.js
- tickNumber
- tickNumber
- tickNumber
- Landing Page v2 Architecture & Implementation Plan
- steps
- manifest.json
- auth.js
- auth-c1-v1.min.js
- auth.min.js
- hero-ascii.js
- hero-ascii-b3-v1.js
- hero-ascii-b3-v1.min.js
- hero-ascii.min.js
- initHeroLedgerTitle
- initHeroLedgerTitle
- initHeroLedgerTitle
- initHeroLedgerTitle
- initHeroLedgerTitle
- As
- .draw
- xt
- 3. Static Code Analysis & Multi-Layer Root Causes
- renderSection
- Mobile-Only UI Redesign & Desktop Parity Guard
- Ledgio v2 Design System — "Halftone Ledger"
- initMotionTour
- initMotionTour
- initMotionTour
- initMotionTour
- initMotionTour
- initDesktopExperience
- hs
- Rn
- 📋 Database Schema Summary
- openSyncDiagnosticsModal
- executeCurrencyChange
- on
- openLeftoverGoalPicker
- check_unstyled.js
- executeCurrencyChange
- executeCurrencyChange
- initClosingAscii
- initClosingAscii
- initClosingAscii
- initClosingAscii
- initClosingAscii
- initClosingAscii
- initHeroPreviewSidebar
- initHeroPreviewSidebar
- initHeroPreviewSidebar
- initHeroPreviewSidebar
- initHeroPreviewSidebar
- wa
- g
- Antigravity prompt — dead-code cleanup (CSS first, then app.js fallbacks)
- auth_art_motion.js
- serve.js
- checkAndApplyRecurringSalary
- startupPhase3_CloudSyncAndBackground
- escapeHtml
- initDesktopExperience
- initDesktopExperience
- tickNumber
- initDesktopExperience
- Phase C1 — auth and legal pages
- Phase P3a Performance Audit Report (v1.11.11)
- request
- Antigravity prompt — TestSprite follow-ups (Oct 25 run)
- _startAutoRefresh
- Phase B3 — measured continuation
- loadStatViewPreferences
- Reference Study: screen.movie Landing Page Architecture & Motion Language
- Phase C2 — verification complete; performance gate failed
- ref_fs
- auth-art-v1.js
- initMobileMenu
- initMobileMenu
- initMobileMenu
- initMobileMenu
- initMobileMenu
- initScrollDrivenProductWindow
- initScrollDrivenProductWindow
- initScrollDrivenProductWindow

## God Nodes (most connected - your core abstractions)
1. `tn` - 131 edges
2. `P()` - 83 edges
3. `setupEventListeners()` - 79 edges
4. `setupEventListeners()` - 79 edges
5. `setupEventListeners()` - 79 edges
6. `J()` - 67 edges
7. `js` - 58 edges
8. `_returnResult()` - 53 edges
9. `t()` - 49 edges
10. `s()` - 44 edges

## Surprising Connections (you probably didn't know these)
- `8. Claim Verification (Code Traced)` --references--> `updateSummary()`  [INFERRED]
  docs/ui/landing-v2/PLAN.md → assets/js/app.js
- `8. Claim Verification (Code Traced)` --references--> `openLeftoverGoalPicker()`  [INFERRED]
  docs/ui/landing-v2/PLAN.md → assets/js/app.js
- `Full Audit Table` --references--> `select()`  [INFERRED]
  docs/security/innerhtml-audit.md → assets/vendor/supabase.min.js
- `B. Record Loan / Debt Modal (Bottom Sheet on Mobile)` --references--> `order()`  [INFERRED]
  docs/ui/mobile-redesign/README.md → assets/vendor/supabase.min.js
- `saveData()` --indirect_call--> `state()`  [INFERRED]
  assets/js/app-c2-v1.min.js → assets/vendor/supabase.min.js

## Import Cycles
- None detected.

## Communities (186 total, 38 thin omitted)

### Community 0 - "supabase.min.js"
Cohesion: 0.01
Nodes (105): add(), appendParams(), applyTransformOptsToQuery(), ar(), assertFieldSize(), _binaryDecode(), binaryEncode(), _binaryEncodeUserBroadcastPush() (+97 more)

### Community 1 - "chart.min.js"
Cohesion: 0.03
Nodes (82): addElements(), ai(), as(), at(), b(), beforeDatasetDraw(), beforeDatasetsDraw(), beforeDraw() (+74 more)

### Community 2 - "P"
Cohesion: 0.07
Nodes (108): _acquireLock(), _adminDeletePasskey(), _adminListPasskeys(), _approveAuthorization(), _authenticate(), _autoRefreshTokenTick(), _callRefreshToken(), _challenge() (+100 more)

### Community 3 - "app.min.js"
Cohesion: 0.02
Nodes (12): destroyChartInstance(), getCategoryMeta(), navigateTo(), renderAllExpenses(), renderBudgets(), renderCategoryChart(), renderExpenses(), renderGoals() (+4 more)

### Community 4 - "app-c2-v1.min.js"
Cohesion: 0.02
Nodes (7): computeNetWorthData(), getLoanDetails(), getStatViewsStorageKey(), loadStatViewPreferences(), sanitizeStatView(), saveStatViewPreferences(), toggleSummaryCard()

### Community 5 - "app.js"
Cohesion: 0.02
Nodes (6): getStatViewsStorageKey(), loadStatViewPreferences(), sanitizeStatView(), saveStatViewPreferences(), toggleSummaryCard(), RFC-4122

### Community 6 - "js"
Cohesion: 0.06
Nodes (11): Bn(), _calculateBarValuePixels(), getLabelAndValue(), initialize(), jn(), js, g(), Ls() (+3 more)

### Community 7 - "Na"
Cohesion: 0.08
Nodes (19): afterInit(), Ba(), Ca(), f(), generateLabels(), ho(), ki(), lo() (+11 more)

### Community 8 - "t"
Cohesion: 0.05
Nodes (50): At(), br(), Cr(), createBucket(), createIndex(), createSignedUploadUrl(), createSignedUrl(), createSignedUrls() (+42 more)

### Community 9 - "log"
Cohesion: 0.08
Nodes (50): _cancelPendingDisconnect(), channel(), clearHeartbeats(), connect(), connectionState(), connectWithFallback(), disconnect(), flushSendBuffer() (+42 more)

### Community 10 - "tn"
Cohesion: 0.07
Nodes (4): kn(), qn(), tn, xr()

### Community 11 - "setupEventListeners"
Cohesion: 0.10
Nodes (44): applyDarkMode(), broadcastSyncEvent(), checkAndApplyRecurringSalary(), createInitialState(), deterministicOpeningId(), enqueueMutation(), getCategoriesCacheKey(), getIncomeEntriesStorageKey() (+36 more)

### Community 12 - "Jt"
Cohesion: 0.07
Nodes (14): ce(), de, en, he(), It(), Jt, kt(), mt() (+6 more)

### Community 13 - "landing-mobile.js"
Cohesion: 0.10
Nodes (37): clearActiveSceneTimers(), ensureMasterClockRunning(), formatRupees(), handleBreakpoint(), initMobileBottomTabs(), initMobileDemoCarousel(), executeScene1Payoff(), executeScene2Payoff() (+29 more)

### Community 14 - "landing-mobile-b3-v1.js"
Cohesion: 0.10
Nodes (37): clearActiveSceneTimers(), ensureMasterClockRunning(), formatRupees(), handleBreakpoint(), initMobileBottomTabs(), initMobileDemoCarousel(), executeScene1Payoff(), executeScene2Payoff() (+29 more)

### Community 15 - "landing-mobile-b3-v1.min.js"
Cohesion: 0.10
Nodes (37): clearActiveSceneTimers(), ensureMasterClockRunning(), formatRupees(), handleBreakpoint(), initMobileBottomTabs(), initMobileDemoCarousel(), executeScene1Payoff(), executeScene2Payoff() (+29 more)

### Community 16 - "landing-mobile.min.js"
Cohesion: 0.10
Nodes (37): clearActiveSceneTimers(), ensureMasterClockRunning(), formatRupees(), handleBreakpoint(), initMobileBottomTabs(), initMobileDemoCarousel(), executeScene1Payoff(), executeScene2Payoff() (+29 more)

### Community 17 - "o"
Cohesion: 0.07
Nodes (20): a(), aa(), Ae(), afterDatasetsUpdate(), determineDataLimits(), Di(), g(), Gs() (+12 more)

### Community 18 - "getUserId"
Cohesion: 0.11
Nodes (36): broadcastSyncEvent(), closeEditProfileModal(), createInitialState(), deterministicOpeningId(), enqueueMutation(), formatRelativeSyncTime(), getCategoriesCacheKey(), getDeadLetterKey() (+28 more)

### Community 19 - "n"
Cohesion: 0.07
Nodes (22): ao(), ca, co(), da(), Do(), et(), getCenterPoint(), ha() (+14 more)

### Community 20 - "_n"
Cohesion: 0.09
Nodes (7): fn(), gn(), _n, xn(), Ye(), yn(), ue()

### Community 21 - "startupPhase1_LocalPaint"
Cohesion: 0.10
Nodes (36): applyDarkMode(), computeIsAdmin(), createPhase3SafetyBackup(), fetchLatestAnnouncement(), getActiveSectionName(), hasLiveSession(), init(), initChartResizeObservers() (+28 more)

### Community 22 - "getUserId"
Cohesion: 0.11
Nodes (35): broadcastSyncEvent(), closeEditProfileModal(), createInitialState(), deterministicOpeningId(), enqueueMutation(), formatRelativeSyncTime(), getCategoriesCacheKey(), getDeadLetterKey() (+27 more)

### Community 23 - "income.js"
Cohesion: 0.13
Nodes (29): addIncome(), deleteIncomeEntry(), deterministicOpeningId(), deterministicUuid(), editIncomeEntry(), generateId(), getCurrentCycleRange(), getIncomeEntriesStorageKey() (+21 more)

### Community 24 - "income.min.js"
Cohesion: 0.13
Nodes (28): addIncome(), deleteIncomeEntry(), deterministicOpeningId(), deterministicUuid(), editIncomeEntry(), generateId(), getCurrentCycleRange(), getIncomeEntriesStorageKey() (+20 more)

### Community 25 - "s"
Cohesion: 0.07
Nodes (22): bo, De(), getPixelForTick(), getPixelForValue(), H(), _i(), ii(), j() (+14 more)

### Community 26 - "setupEventListeners"
Cohesion: 0.09
Nodes (30): addGoalDeposit(), broadcastAnnouncement(), closeSyncDiagnosticsModal(), copySyncDiagnostics(), escapeHtml(), generateSyncDiagnosticsReport(), getDeadLetterQueue(), getGoalProgress() (+22 more)

### Community 27 - "startupPhase1_LocalPaint"
Cohesion: 0.11
Nodes (33): applyDarkMode(), computeIsAdmin(), getActiveSectionName(), getEffectiveUserName(), hasLiveSession(), init(), initChartResizeObservers(), initInactivityTimer() (+25 more)

### Community 28 - "constructor"
Cohesion: 0.06
Nodes (33): constructor(), et(), _getPayloadRecords(), _handleTokenChanged(), Hn(), _initRealtimeClient(), _initSupabaseAuthClient(), inPendingSyncState() (+25 more)

### Community 29 - "loans.js"
Cohesion: 0.18
Nodes (28): closeDeleteLoanModal(), closeLoanHistoryModal(), closeLoanModal(), closeRenamePersonModal(), closeSettlementModal(), createLoan(), deleteLoan(), escapeHtml() (+20 more)

### Community 30 - "loans.min.js"
Cohesion: 0.18
Nodes (28): closeDeleteLoanModal(), closeLoanHistoryModal(), closeLoanModal(), closeRenamePersonModal(), closeSettlementModal(), createLoan(), deleteLoan(), escapeHtml() (+20 more)

### Community 31 - "Ro"
Cohesion: 0.09
Nodes (9): Bi(), buildTicks(), Ci(), Fi(), init(), mo(), Ro, zi() (+1 more)

### Community 32 - "updateSummary"
Cohesion: 0.09
Nodes (29): chartAlpha(), chartColor(), computeNetWorthData(), destroyChartInstance(), expensesThisMonth(), formatCurrency(), formatCurrencyNoDecimals(), getCategoryMeta() (+21 more)

### Community 33 - "categories.js"
Cohesion: 0.24
Nodes (27): closeCustomCategoryModal(), closeReassignCategoryModal(), deleteCategory(), deleteCustomCategory(), ensureValidCategoryId(), executeCategoryReassignment(), generateCategoryId(), getAllCategories() (+19 more)

### Community 34 - "categories.min.js"
Cohesion: 0.24
Nodes (27): closeCustomCategoryModal(), closeReassignCategoryModal(), deleteCategory(), deleteCustomCategory(), ensureValidCategoryId(), executeCategoryReassignment(), generateCategoryId(), getAllCategories() (+19 more)

### Community 35 - "send"
Cohesion: 0.08
Nodes (29): ajax(), batchSend(), cancelRefEvent(), cancelTimeout(), canPush(), close(), closeAndRetry(), destroy() (+21 more)

### Community 36 - "startupPhase1_LocalPaint"
Cohesion: 0.13
Nodes (27): closeSyncDiagnosticsModal(), computeIsAdmin(), getEffectiveUserName(), hasLiveSession(), init(), initChartResizeObservers(), initInactivityTimer(), initVaultVisibilityAutoLock() (+19 more)

### Community 37 - "vault.js"
Cohesion: 0.18
Nodes (24): authenticateWithBiometrics(), base64UrlToBuffer(), bufferToBase64Url(), checkBiometricSupport(), enrollBiometrics(), generateSalt(), getVaultStorageKey(), handleNumpadKey() (+16 more)

### Community 38 - "vault.min.js"
Cohesion: 0.18
Nodes (24): authenticateWithBiometrics(), base64UrlToBuffer(), bufferToBase64Url(), checkBiometricSupport(), enrollBiometrics(), generateSalt(), getVaultStorageKey(), handleNumpadKey() (+16 more)

### Community 39 - "l"
Cohesion: 0.12
Nodes (18): _calculateBarIndexPixels(), _getAxis(), _getAxisCount(), getFirstScaleIdForIndexAxis(), getMaxOverflow(), _getRuler(), _getStackCount(), _getStackIndex() (+10 more)

### Community 40 - "Ledgio"
Cohesion: 0.07
Nodes (25): Exhaustive innerHTML Codebase Audit, Per-File Distribution Summary, 🌍 12 currencies, light & dark, 📸 A quick look, 🏷️ Categories & spending limits, 🤝 Contributing, 📊 Dashboard at a glance, 💻 Development (+17 more)

### Community 41 - "expenses-p3a-v1.js"
Cohesion: 0.18
Nodes (24): addExpense(), closeEditModal(), createActionButtons(), deleteBudget(), deleteExpense(), expensesThisMonth(), generateUUID(), getBudgetsSpendingMap() (+16 more)

### Community 42 - "expenses-p3a-v1.min.js"
Cohesion: 0.18
Nodes (24): addExpense(), closeEditModal(), createActionButtons(), deleteBudget(), deleteExpense(), expensesThisMonth(), generateUUID(), getBudgetsSpendingMap() (+16 more)

### Community 43 - "goals.js"
Cohesion: 0.21
Nodes (23): addGoalDeposit(), closeDeleteGoalModal(), closeDepositModal(), closeGoalModal(), createGoal(), deleteGoal(), fireConfetti(), generateId() (+15 more)

### Community 44 - "goals.min.js"
Cohesion: 0.21
Nodes (23): addGoalDeposit(), closeDeleteGoalModal(), closeDepositModal(), closeGoalModal(), createGoal(), deleteGoal(), fireConfetti(), generateId() (+15 more)

### Community 45 - "expenses.js"
Cohesion: 0.19
Nodes (23): addExpense(), closeEditModal(), createActionButtons(), deleteBudget(), deleteExpense(), expensesThisMonth(), generateUUID(), getBudgetsSpendingMap() (+15 more)

### Community 46 - "expenses-c2-v1.min.js"
Cohesion: 0.19
Nodes (23): addExpense(), closeEditModal(), createActionButtons(), deleteBudget(), deleteExpense(), expensesThisMonth(), generateUUID(), getBudgetsSpendingMap() (+15 more)

### Community 47 - "expenses.min.js"
Cohesion: 0.19
Nodes (23): addExpense(), closeEditModal(), createActionButtons(), deleteBudget(), deleteExpense(), expensesThisMonth(), generateUUID(), getBudgetsSpendingMap() (+15 more)

### Community 48 - "n"
Cohesion: 0.10
Nodes (25): ai(), clone(), gr(), _hydrateSessionUser(), invoke(), n(), c(), i() (+17 more)

### Community 49 - "landing.js"
Cohesion: 0.13
Nodes (16): initAll(), handleDesktopBreakpoint(), initAmbientBackground(), initAppearObserver(), initCountUpDemos(), initDemoVisibilityObservers(), initFaqAccordion(), initHeadingStreaming() (+8 more)

### Community 50 - "landing-b3-v1.min.js"
Cohesion: 0.13
Nodes (16): initAll(), handleDesktopBreakpoint(), initAmbientBackground(), initAppearObserver(), initCountUpDemos(), initDemoVisibilityObservers(), initFaqAccordion(), initHeadingStreaming() (+8 more)

### Community 51 - "sync-engine.js"
Cohesion: 0.17
Nodes (18): adoptCloudRecord(), attachAuthStateListener(), configure(), enqueueMutation(), generateId(), getDeadLetterKey(), getDeadLetterQueue(), getLastSyncKey() (+10 more)

### Community 52 - "sync-engine.min.js"
Cohesion: 0.17
Nodes (18): adoptCloudRecord(), attachAuthStateListener(), configure(), enqueueMutation(), generateId(), getDeadLetterKey(), getDeadLetterQueue(), getLastSyncKey() (+10 more)

### Community 53 - "landing-b3-v2.js"
Cohesion: 0.14
Nodes (16): initAll(), handleDesktopBreakpoint(), initAmbientBackground(), initAppearObserver(), initCountUpDemos(), initDemoVisibilityObservers(), initFaqAccordion(), initHeadingStreaming() (+8 more)

### Community 54 - "landing-b3-v2.min.js"
Cohesion: 0.14
Nodes (16): initAll(), handleDesktopBreakpoint(), initAmbientBackground(), initAppearObserver(), initCountUpDemos(), initDemoVisibilityObservers(), initFaqAccordion(), initHeadingStreaming() (+8 more)

### Community 55 - "Ho"
Cohesion: 0.15
Nodes (6): Bo(), _generate(), _getTimestampsForTable(), Ho, nt(), Vo()

### Community 56 - "checkAndApplyRecurringSalary"
Cohesion: 0.12
Nodes (22): addGoalDeposit(), checkAndApplyRecurringSalary(), escapeHtml(), getCurrentCycleRange(), getCycleSalaryDate(), getGoalProgress(), getLocalDateString(), handleAccountEmailChange() (+14 more)

### Community 57 - "setupEventListeners"
Cohesion: 0.12
Nodes (19): broadcastAnnouncement(), closeSyncDiagnosticsModal(), copySyncDiagnostics(), generateSyncDiagnosticsReport(), getDeadLetterQueue(), getEffectiveUserName(), mapErrorToUserMessage(), navigateTo() (+11 more)

### Community 58 - "Ss"
Cohesion: 0.11
Nodes (15): Be(), bs(), ct(), Fs(), ge(), ks(), ms(), pe() (+7 more)

### Community 60 - ".notifyPlugins"
Cohesion: 0.14
Nodes (4): dt(), ke(), Pn(), Sn()

### Community 61 - "updateSummary"
Cohesion: 0.15
Nodes (20): chartAlpha(), chartColor(), destroyChartInstance(), expensesThisMonth(), formatCurrency(), formatCurrencyNoDecimals(), getCategoryMeta(), getLocalCurrentMonthString() (+12 more)

### Community 63 - "landing.min.js"
Cohesion: 0.18
Nodes (14): initAll(), handleDesktopBreakpoint(), initAmbientBackground(), initAppearObserver(), initCountUpDemos(), initDemoVisibilityObservers(), initFaqAccordion(), initHeadingStreaming() (+6 more)

### Community 65 - "audit_c1.js"
Cohesion: 0.14
Nodes (17): assert, delay(), evaluate(), fs, http, mime, navigate(), out (+9 more)

### Community 66 - "pwa-installer.js"
Cohesion: 0.24
Nodes (12): applyStandaloneUI(), buildAnalyticsPayload(), checkInstalledState(), getDevicePlatform(), getDeviceType(), initInstallButtons(), isStandaloneApp(), logAppAnalytics() (+4 more)

### Community 67 - "pwa-installer.min.js"
Cohesion: 0.24
Nodes (12): applyStandaloneUI(), buildAnalyticsPayload(), checkInstalledState(), getDevicePlatform(), getDeviceType(), initInstallButtons(), isStandaloneApp(), logAppAnalytics() (+4 more)

### Community 68 - "updateSummary"
Cohesion: 0.17
Nodes (16): computeNetWorthData(), expensesThisMonth(), formatCurrency(), formatCurrencyNoDecimals(), getLoanDetails(), getLocalCurrentMonthString(), getTrendMonthRange(), incomeThisMonth() (+8 more)

### Community 69 - "initDesktopExperience"
Cohesion: 0.13
Nodes (12): formatINR(), initCategoryInspector(), initChartScrubbing(), handleScrub(), initDesktopExperience(), initInteractiveDonut(), clearHighlight(), setMonth() (+4 more)

### Community 70 - "tickNumber"
Cohesion: 0.16
Nodes (14): clearDesktopInterval(), formatINR(), initChartScrubbing(), handleScrub(), initHeroDashboardLiveFeed(), addLiveRow(), getNextDistinctItem(), initInteractiveDonut() (+6 more)

### Community 71 - "gen_hero_ascii.js"
Cohesion: 0.12
Nodes (14): bs, cells, cs, { execFileSync }, fileSizeKb, fileStats, fs, outJs (+6 more)

### Community 72 - "hero-ascii-b3-v2.js"
Cohesion: 0.33
Nodes (13): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+5 more)

### Community 73 - "hero-ascii-b3-v2.min.js"
Cohesion: 0.33
Nodes (13): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+5 more)

### Community 74 - "tickNumber"
Cohesion: 0.17
Nodes (13): clearDesktopInterval(), formatINR(), initChartScrubbing(), handleScrub(), initHeroDashboardLiveFeed(), addLiveRow(), getNextDistinctItem(), initInteractiveDonut() (+5 more)

### Community 75 - "tickNumber"
Cohesion: 0.17
Nodes (13): clearDesktopInterval(), formatINR(), initChartScrubbing(), handleScrub(), initHeroDashboardLiveFeed(), addLiveRow(), getNextDistinctItem(), initInteractiveDonut() (+5 more)

### Community 76 - "tickNumber"
Cohesion: 0.17
Nodes (13): clearDesktopInterval(), formatINR(), initChartScrubbing(), handleScrub(), initHeroDashboardLiveFeed(), addLiveRow(), getNextDistinctItem(), initInteractiveDonut() (+5 more)

### Community 77 - "Landing Page v2 Architecture & Implementation Plan"
Cohesion: 0.13
Nodes (14): 1. Vision & Creative Direction, 2. Shared Rules (Governing Phases 1, 2, and 3), 3. Structural Breakdown & Section Flow, 4. Visual Assets & Screenshot Capture Plan, 5. Typography & Theme System, 6. Motion & Accessibility Inventory, 7. Performance Budget, 8. Claim Verification (Code Traced) (+6 more)

### Community 78 - "steps"
Cohesion: 0.13
Nodes (14): jobs, runtime-gate, name, on, pull_request, workflow_dispatch, branches, name (+6 more)

### Community 79 - "manifest.json"
Cohesion: 0.13
Nodes (14): background_color, categories, description, display, display_override, icons, id, name (+6 more)

### Community 80 - "auth.js"
Cohesion: 0.25
Nodes (10): checkAuth(), getClient(), handleAuthRedirect(), isAuthRejection(), isOnline(), isRealUserIdentity(), isUuid(), markAuthReady() (+2 more)

### Community 81 - "auth-c1-v1.min.js"
Cohesion: 0.25
Nodes (10): checkAuth(), getClient(), handleAuthRedirect(), isAuthRejection(), isOnline(), isRealUserIdentity(), isUuid(), markAuthReady() (+2 more)

### Community 82 - "auth.min.js"
Cohesion: 0.25
Nodes (10): checkAuth(), getClient(), handleAuthRedirect(), isAuthRejection(), isOnline(), isRealUserIdentity(), isUuid(), markAuthReady() (+2 more)

### Community 83 - "hero-ascii.js"
Cohesion: 0.33
Nodes (12): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+4 more)

### Community 84 - "hero-ascii-b3-v1.js"
Cohesion: 0.33
Nodes (12): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+4 more)

### Community 85 - "hero-ascii-b3-v1.min.js"
Cohesion: 0.33
Nodes (12): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+4 more)

### Community 86 - "hero-ascii.min.js"
Cohesion: 0.33
Nodes (12): bootstrap(), debounce(), drawStatic(), handleResize(), hash2(), init(), initCellState(), isOverlappingText() (+4 more)

### Community 87 - "initHeroLedgerTitle"
Cohesion: 0.26
Nodes (14): cancelDesktopRaf(), initHeroLedgerTitle(), drawFrame(), initCutePips(), onHeroPointerLeave(), onHeroPointerMove(), onPointerDown(), onPointerEnter() (+6 more)

### Community 88 - "initHeroLedgerTitle"
Cohesion: 0.26
Nodes (14): cancelDesktopRaf(), initHeroLedgerTitle(), drawFrame(), initCutePips(), onHeroPointerLeave(), onHeroPointerMove(), onPointerDown(), onPointerEnter() (+6 more)

### Community 89 - "initHeroLedgerTitle"
Cohesion: 0.26
Nodes (14): cancelDesktopRaf(), initHeroLedgerTitle(), drawFrame(), initCutePips(), onHeroPointerLeave(), onHeroPointerMove(), onPointerDown(), onPointerEnter() (+6 more)

### Community 90 - "initHeroLedgerTitle"
Cohesion: 0.26
Nodes (14): cancelDesktopRaf(), initHeroLedgerTitle(), drawFrame(), initCutePips(), onHeroPointerLeave(), onHeroPointerMove(), onPointerDown(), onPointerEnter() (+6 more)

### Community 91 - "initHeroLedgerTitle"
Cohesion: 0.26
Nodes (14): cancelDesktopRaf(), initHeroLedgerTitle(), drawFrame(), initCutePips(), onHeroPointerLeave(), onHeroPointerMove(), onPointerDown(), onPointerEnter() (+6 more)

### Community 95 - "3. Static Code Analysis & Multi-Layer Root Causes"
Cohesion: 0.14
Nodes (13): 1. Executive Summary & Symptom, 2. Experimental Data & Headless Emulation Analysis, 3. Static Code Analysis & Multi-Layer Root Causes, 4. Multi-Layer Resolution Strategy, 5. Update (2026-10-17): bug still seen on device after v1.4.91, Root Cause 1: Missing `minimum-scale=1.0` in Viewport Metas, Root Cause 2: Viewport Meta Content Mutation is Ignored by Blink, Root Cause 3: `max-width: 100vw !important` Creates Horizontal Overflow (+5 more)

### Community 96 - "renderSection"
Cohesion: 0.15
Nodes (13): createPhase3SafetyBackup(), fetchLatestAnnouncement(), loadAccountSecurityInfo(), migrateLocalCategoriesToCloud(), renderAllExpenses(), renderBudgets(), renderExpenses(), renderGoals() (+5 more)

### Community 97 - "Mobile-Only UI Redesign & Desktop Parity Guard"
Cohesion: 0.15
Nodes (12): order(), 1. Overview, 2. Redesigned Components (Mobile Only <= 768px), 3. Desktop & Tablet-Landscape Parity Rules, 4. Automated Visual Parity Guard, 5. Verification Commands, A. Dashboard Stat Cards, B. Record Loan / Debt Modal (Bottom Sheet on Mobile) (+4 more)

### Community 98 - "Ledgio v2 Design System — "Halftone Ledger""
Cohesion: 0.15
Nodes (12): 1. Color System (Tokens), 2. Typography Scale, 3. Spacing & Spatial Scale, 4. Radii & Surface Depth, 5. Signature Motifs, 6. Motion & Performance Budgets, 7. Do / Don't Checklist, Ambient Atmosphere Glows (+4 more)

### Community 99 - "initMotionTour"
Cohesion: 0.24
Nodes (12): clearDesktopTimeout(), clearAllTimers(), initMotionTour(), clearS1(), clearS2(), clearS3(), resetS1(), resetS2() (+4 more)

### Community 100 - "initMotionTour"
Cohesion: 0.24
Nodes (12): clearDesktopTimeout(), clearAllTimers(), initMotionTour(), clearS1(), clearS2(), clearS3(), resetS1(), resetS2() (+4 more)

### Community 101 - "initMotionTour"
Cohesion: 0.24
Nodes (12): clearDesktopTimeout(), clearAllTimers(), initMotionTour(), clearS1(), clearS2(), clearS3(), resetS1(), resetS2() (+4 more)

### Community 102 - "initMotionTour"
Cohesion: 0.24
Nodes (12): clearDesktopTimeout(), clearAllTimers(), initMotionTour(), clearS1(), clearS2(), clearS3(), resetS1(), resetS2() (+4 more)

### Community 103 - "initMotionTour"
Cohesion: 0.24
Nodes (12): clearDesktopTimeout(), clearAllTimers(), initMotionTour(), clearS1(), clearS2(), clearS3(), resetS1(), resetS2() (+4 more)

### Community 104 - "initDesktopExperience"
Cohesion: 0.17
Nodes (8): initCategoryInspector(), initDesktopExperience(), initHeroSpotlightAndTilt(), initManifestoScrollIllumination(), initPaperCardsEmeraldSpotlight(), initPaperInteractions(), initPullThePlugDemo(), initPwaCard()

### Community 107 - "📋 Database Schema Summary"
Cohesion: 0.17
Nodes (11): 1. `profiles`, 2. `expenses`, 3. `budgets`, 4. `app_analytics`, 🗄️ Architecture Overview, 📋 Database Schema Summary, Ledgio — Backend & Database Layer, Option A: Fresh Database Installation (+3 more)

### Community 108 - "openSyncDiagnosticsModal"
Cohesion: 0.18
Nodes (11): closeEditProfileModal(), copySyncDiagnostics(), formatRelativeSyncTime(), generateSyncDiagnosticsReport(), getDeadLetterKey(), getDeadLetterQueue(), getLastSyncKey(), getSyncQueueKey() (+3 more)

### Community 109 - "executeCurrencyChange"
Cohesion: 0.33
Nodes (11): convertAmount(), executeCurrencyChange(), fetchLiveExchangeRates(), formatSampleCurrency(), getActiveSectionName(), getExchangeRate(), getSyncQueue(), hasExistingLedgerData() (+3 more)

### Community 110 - "on"
Cohesion: 0.29
Nodes (3): an(), on, rn()

### Community 111 - "openLeftoverGoalPicker"
Cohesion: 0.22
Nodes (10): addGoalDeposit(), getCycleSalaryDate(), getGoalProgress(), getLocalDateString(), hasExpenseToday(), openGoalModalWithLeftover(), openLeftoverGoalPicker(), sanitizeColor() (+2 more)

### Community 112 - "check_unstyled.js"
Cohesion: 0.20
Nodes (8): allowedSystemClasses, cssFiles, definedClasses, fs, htmlFiles, path, rootDir, unstyledByFile

### Community 113 - "executeCurrencyChange"
Cohesion: 0.42
Nodes (9): convertAmount(), executeCurrencyChange(), fetchLiveExchangeRates(), formatSampleCurrency(), getExchangeRate(), getSyncQueue(), hasExistingLedgerData(), promptCurrencyChange() (+1 more)

### Community 114 - "executeCurrencyChange"
Cohesion: 0.42
Nodes (9): convertAmount(), executeCurrencyChange(), fetchLiveExchangeRates(), formatSampleCurrency(), getExchangeRate(), getSyncQueue(), hasExistingLedgerData(), promptCurrencyChange() (+1 more)

### Community 115 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 116 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 117 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 118 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 119 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 120 - "initClosingAscii"
Cohesion: 0.39
Nodes (7): initClosingAscii(), buildCells(), computeAvoidanceRects(), loop(), renderFrame(), resize(), startLoop()

### Community 121 - "initHeroPreviewSidebar"
Cohesion: 0.33
Nodes (6): initHeroPreviewSidebar(), addSubTimer(), pointCursorAt(), reSyncCursor(), stepTour(), safeDesktopTimeout()

### Community 122 - "initHeroPreviewSidebar"
Cohesion: 0.36
Nodes (7): initHeroPreviewSidebar(), addSubTimer(), pointCursorAt(), reSyncCursor(), stepTour(), updateHud(), safeDesktopTimeout()

### Community 123 - "initHeroPreviewSidebar"
Cohesion: 0.36
Nodes (7): initHeroPreviewSidebar(), addSubTimer(), pointCursorAt(), reSyncCursor(), stepTour(), updateHud(), safeDesktopTimeout()

### Community 124 - "initHeroPreviewSidebar"
Cohesion: 0.33
Nodes (6): initHeroPreviewSidebar(), addSubTimer(), pointCursorAt(), reSyncCursor(), stepTour(), safeDesktopTimeout()

### Community 125 - "initHeroPreviewSidebar"
Cohesion: 0.33
Nodes (6): initHeroPreviewSidebar(), addSubTimer(), pointCursorAt(), reSyncCursor(), stepTour(), safeDesktopTimeout()

### Community 126 - "wa"
Cohesion: 0.31
Nodes (3): configure(), start(), wa

### Community 127 - "g"
Cohesion: 0.25
Nodes (9): ee(), g(), h(), _isPKCECallback(), Kr(), m(), Ur(), wr() (+1 more)

### Community 128 - "Antigravity prompt — dead-code cleanup (CSS first, then app.js fallbacks)"
Cohesion: 0.22
Nodes (8): Antigravity prompt — dead-code cleanup (CSS first, then app.js fallbacks), Build, version, commits, Out of scope (don't do), Report back with, Step 0 — before anything, Step 1 — dead rules in `assets/css/styles.css` (biggest win), Step 2 — dead rules in `assets/css/dashboard.css` (small), Step 3 — dead fallback copies in `assets/js/app.js` (careful)

### Community 129 - "auth_art_motion.js"
Cohesion: 0.22
Nodes (4): assert, document, fs, vm

### Community 130 - "serve.js"
Cohesion: 0.22
Nodes (6): fs, http, MIME_TYPES, path, ROOT, server

### Community 131 - "checkAndApplyRecurringSalary"
Cohesion: 0.32
Nodes (8): checkAndApplyRecurringSalary(), getCurrentCycleRange(), getCycleSalaryDate(), getLocalDateString(), hasExpenseToday(), saveSyncQueue(), updateCycleRangePreview(), updateDailyNudgeUI()

### Community 132 - "startupPhase3_CloudSyncAndBackground"
Cohesion: 0.25
Nodes (8): broadcastAnnouncement(), createPhase3SafetyBackup(), fetchLatestAnnouncement(), loadAccountSecurityInfo(), mapErrorToUserMessage(), migrateLocalCategoriesToCloud(), showAnnouncementBanner(), startupPhase3_CloudSyncAndBackground()

### Community 133 - "escapeHtml"
Cohesion: 0.25
Nodes (8): escapeHtml(), getCurrentCycleRange(), handleAccountEmailChange(), handleAccountPasswordChange(), loadTelemetryStats(), populateDropdowns(), updateCycleRangePreview(), updateIncomePreview()

### Community 134 - "initDesktopExperience"
Cohesion: 0.25
Nodes (6): initCategoryInspector(), initDesktopExperience(), initManifestoScrollIllumination(), initPaperInteractions(), initPullThePlugDemo(), initPwaCard()

### Community 135 - "initDesktopExperience"
Cohesion: 0.25
Nodes (6): initCategoryInspector(), initDesktopExperience(), initManifestoScrollIllumination(), initPaperInteractions(), initPullThePlugDemo(), initPwaCard()

### Community 136 - "tickNumber"
Cohesion: 0.36
Nodes (8): clearDesktopInterval(), initHeroDashboardLiveFeed(), addLiveRow(), getNextDistinctItem(), tickNumber(), formatVal(), step(), p()

### Community 137 - "initDesktopExperience"
Cohesion: 0.25
Nodes (6): initCategoryInspector(), initDesktopExperience(), initManifestoScrollIllumination(), initPaperInteractions(), initPullThePlugDemo(), initPwaCard()

### Community 138 - "Phase C1 — auth and legal pages"
Cohesion: 0.25
Nodes (7): Delivered, Measurement conditions, Phase C1 — auth and legal pages, Preview, Raw five-run values, Verification, Visual critique and hardware limits

### Community 139 - "Phase P3a Performance Audit Report (v1.11.11)"
Cohesion: 0.25
Nodes (7): 1. Landing 1440 Regression Verification (Draft vs B3 vs Candidate), 2. Landing Performance (C2 Baseline vs Candidate), 3. Auth Pages LCP / CLS (C2 Baseline vs Candidate), 4. Dashboard View Switch Long Tasks (Legacyfull vs Candidate, 1440px), 5. Gate Verification Summary, Phase P3a Performance Audit Report (v1.11.11), Protocol & Methodology

### Community 140 - "request"
Cohesion: 0.38
Nodes (6): fetchRequest(), parseJSON(), request(), xdomainRequest(), xhrRequest(), APP_SHELL

### Community 141 - "Antigravity prompt — TestSprite follow-ups (Oct 25 run)"
Cohesion: 0.29
Nodes (6): Antigravity prompt — TestSprite follow-ups (Oct 25 run), Constraints, Fix 1 — landing demo "Record Expense" button does nothing when clicked (TestSprite: "Dashboard reflects added expense in overview"), Fix 2 — "Transactions" label counts expenses only (TestSprite: "Add an income transaction"), Fix 3 — make the pay-cycle setting reachable from the income card (TestSprite: "Set salary cycle from dashboard income form" + the 2 blocked recurring-salary tests), Verify and report

### Community 142 - "_startAutoRefresh"
Cohesion: 0.53
Nodes (6): dispose(), _handleVisibilityChange(), _onVisibilityChanged(), _removeVisibilityChangedCallback(), _startAutoRefresh(), _stopAutoRefresh()

### Community 143 - "Phase B3 — measured continuation"
Cohesion: 0.33
Nodes (5): Baseline / draft / final, Changes and diagnosis, Checks and limits, Method and evidence, Phase B3 — measured continuation

### Community 144 - "loadStatViewPreferences"
Cohesion: 0.50
Nodes (5): getStatViewsStorageKey(), loadStatViewPreferences(), sanitizeStatView(), saveStatViewPreferences(), toggleSummaryCard()

### Community 145 - "Reference Study: screen.movie Landing Page Architecture & Motion Language"
Cohesion: 0.40
Nodes (4): 1. Overview & Verified Architecture, 2. Component Design & Spacing, 3. Motion System & Entrance Rules, Reference Study: screen.movie Landing Page Architecture & Motion Language

### Community 146 - "Phase C2 — verification complete; performance gate failed"
Cohesion: 0.40
Nodes (4): Checks, Decisions / scope, Phase C2 — verification complete; performance gate failed, Required performance measurement

### Community 147 - "ref_fs"
Cohesion: 0.50
Nodes (3): fs, gateHoverTargeted(), splitSelectors()

### Community 149 - "initMobileMenu"
Cohesion: 0.83
Nodes (4): initMobileMenu(), applyWillChange(), closeMenu(), openMenu()

### Community 150 - "initMobileMenu"
Cohesion: 0.83
Nodes (4): initMobileMenu(), applyWillChange(), closeMenu(), openMenu()

### Community 151 - "initMobileMenu"
Cohesion: 0.83
Nodes (4): initMobileMenu(), applyWillChange(), closeMenu(), openMenu()

### Community 152 - "initMobileMenu"
Cohesion: 0.83
Nodes (4): initMobileMenu(), applyWillChange(), closeMenu(), openMenu()

### Community 153 - "initMobileMenu"
Cohesion: 0.83
Nodes (4): initMobileMenu(), applyWillChange(), closeMenu(), openMenu()

### Community 154 - "initScrollDrivenProductWindow"
Cohesion: 1.00
Nodes (3): initScrollDrivenProductWindow(), onScroll(), updateWindowTransform()

### Community 155 - "initScrollDrivenProductWindow"
Cohesion: 1.00
Nodes (3): initScrollDrivenProductWindow(), onScroll(), updateWindowTransform()

### Community 156 - "initScrollDrivenProductWindow"
Cohesion: 1.00
Nodes (3): initScrollDrivenProductWindow(), onScroll(), updateWindowTransform()

## Knowledge Gaps
- **2 isolated node(s):** `RFC-4122`, `RFC-1321`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 842 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `state()` connect `getUserId` to `supabase.min.js`, `setupEventListeners`, `getUserId`, `setupEventListeners`, `setupEventListeners`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `setupEventListeners()` (e.g. with `closeBroadcastModal()` and `toggleDarkMode()`) actually correct?**
  _`setupEventListeners()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4122`, `RFC-1321` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabase.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.014170854271356784 - nodes in this community are weakly interconnected._
- **Why does `d()` connect `.update` to `chart.min.js`, `tickNumber`, `Na`, `tickNumber`, `tickNumber`, `tickNumber`, `tickNumber`, `tn`, `on`, `n`, `Ho`, `.notifyPlugins`, `sn`, `Ro`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `setupEventListeners()` (e.g. with `closeBroadcastModal()` and `toggleDarkMode()`) actually correct?**
  _`setupEventListeners()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `chart.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.029670776317572145 - nodes in this community are weakly interconnected._