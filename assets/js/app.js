'use strict';

(function() {
  const CATEGORIES = {
    food: { label: 'Food & Dining', icon: 'fa-utensils', color: '#ef4444' },
    transport: { label: 'Transport', icon: 'fa-car', color: '#f97316' },
    housing: { label: 'Housing', icon: 'fa-home', color: '#8b5cf6' },
    entertainment: { label: 'Entertainment', icon: 'fa-film', color: '#ec4899' },
    shopping: { label: 'Shopping', icon: 'fa-shopping-bag', color: '#06b6d4' },
    health: { label: 'Health', icon: 'fa-heartbeat', color: '#22c55e' },
    education: { label: 'Education', icon: 'fa-graduation-cap', color: '#3b82f6' },
    bills: { label: 'Bills & Utilities', icon: 'fa-file-invoice-dollar', color: '#eab308' },
    savings: { label: 'Savings', icon: 'fa-piggy-bank', color: '#14b8a6' },
    other: { label: 'Other', icon: 'fa-ellipsis-h', color: '#64748b' }
  };
  
  // Sanitization & Security Utilities (SEC-01 & SEC-02)
  const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;
  const FA_ICON_REGEX = /^fa-[a-z0-9-]+$/;

  function sanitizeColor(color, fallback = '#3b82f6') {
    if (typeof color === 'string' && HEX_COLOR_REGEX.test(color.trim())) {
      return color.trim();
    }
    return fallback;
  }

  function sanitizeIcon(icon, fallback = 'fa-tag') {
    if (typeof icon === 'string' && FA_ICON_REGEX.test(icon.trim())) {
      return icon.trim();
    }
    return fallback;
  }

  // Category Metadata Resolution (delegated to window.LedgioCategories)
  function getCategoryMeta(keyOrName) {
    return window.LedgioCategories ? window.LedgioCategories.getCategoryMeta(keyOrName) : { id: 'other', ...CATEGORIES.other, isCustom: false };
  }

  function getAllCategories(includeHidden = false) {
    return window.LedgioCategories ? window.LedgioCategories.getAllCategories(includeHidden) : [];
  }

  function getCategoryExpenseCount(catOrKey) {
    return window.LedgioCategories ? window.LedgioCategories.getCategoryExpenseCount(catOrKey) : 0;
  }

  // User-Scoped Storage Helpers
  let currentUser = null;

  function getUserId() {
    if (currentUser?.id) return currentUser.id;
    const storedId = localStorage.getItem('sb_user_id');
    if (storedId) return storedId;
    return 'default_user';
  }

  function getStorageKey() {
    return `smartBudgetData_${getUserId()}`;
  }

  function getIncomeEntriesStorageKey() {
    return `ledgio_income_entries_${getUserId()}`;
  }

  // Local Date Helpers (Prevent UTC date shift bugs)
  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLocalCurrentMonthString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Deterministic opening entry UUID (delegated to window.LedgioIncome)
  function deterministicOpeningId(userId) {
    return window.LedgioIncome ? window.LedgioIncome.deterministicOpeningId(userId) : '';
  }

  const CURRENCY_SYMBOLS = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ ',
    SGD: 'S$',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    SAR: '﷼ ',
    BDT: '৳',
    NPR: 'रू '
  };

  const CURRENCY_LOCALES = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'en-US',
    GBP: 'en-US',
    AED: 'en-US',
    SGD: 'en-US',
    CAD: 'en-US',
    AUD: 'en-US',
    JPY: 'en-US',
    SAR: 'en-US',
    BDT: 'en-US',
    NPR: 'en-US'
  };

  // Resolve shared Supabase singleton client (getSupabaseClient is the sole createClient factory)
  let supabase = window.supabaseClient || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);

  function getClient() {
    if (!supabase) {
      supabase = window.supabaseClient || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
    }
    return supabase;
  }

  // Phase 6: Income Ledger State & Storage Bridge
  let legacyIncome = 0;
  let hasPulledIncomeEntries = false;

  function loadIncomeEntries() {
    return window.LedgioIncome ? window.LedgioIncome.loadIncomeEntries() : [];
  }

  function saveIncomeEntries() {
    return window.LedgioIncome ? window.LedgioIncome.saveIncomeEntries() : null;
  }

  // Phase 7: Categories Cache & Roaming Bridge (delegated to window.LedgioCategories)
  function getCategoriesCacheKey(userId = null) {
    return window.LedgioCategories ? window.LedgioCategories.getCategoriesCacheKey(userId) : `ledgio_categories_cache_${userId || getUserId()}`;
  }

  function saveCategoriesCache() {
    return window.LedgioCategories ? window.LedgioCategories.saveCategoriesCache() : null;
  }

  function loadCategoriesCache(userId = null) {
    return window.LedgioCategories ? window.LedgioCategories.loadCategoriesCache(userId) : { customCategories: [], hiddenBuiltins: [] };
  }

  // Testing and Development Environment Detection (SEC-06)
  const isDevOrTest = Boolean(
    typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0' ||
      window.location.hostname === '' ||
      window.location.protocol === 'file:' ||
      new URLSearchParams(window.location.search).get('test') === 'true' ||
      window.__LEDGIO_TEST_MODE__ === true ||
      localStorage.getItem('ledgio_test_mode') === 'true'
    )
  );

  function totalIncome() {
    return window.LedgioIncome ? window.LedgioIncome.totalIncome() : 0;
  }

  function incomeThisMonth() {
    return window.LedgioIncome ? window.LedgioIncome.incomeThisMonth() : 0;
  }

  function expensesThisMonth() {
    return window.LedgioExpenses ? window.LedgioExpenses.expensesThisMonth() : 0;
  }

  function spendPercent(optRemaining, optLifetimeExpenses) {
    return window.LedgioExpenses ? window.LedgioExpenses.spendPercent(optRemaining, optLifetimeExpenses) : null;
  }

  function createInitialState(parsed = {}) {
    const uid = getUserId();
    const s = {
      version: 2,
      resetEpoch: typeof parsed.resetEpoch === 'number' ? parsed.resetEpoch : getResetEpoch(uid),
      get income() {
        return totalIncome();
      },
      set income(val) {
        if (isDevOrTest) {
          s._incomeOverride = Number(val) || 0;
        }
        legacyIncome = Number(val) || 0;
      },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      budgets: (parsed.budgets && typeof parsed.budgets === 'object') ? parsed.budgets : {},
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      goal_deposits: Array.isArray(parsed.goal_deposits) ? parsed.goal_deposits : [],
      loans: Array.isArray(parsed.loans) ? parsed.loans : [],
      loan_settlements: Array.isArray(parsed.loan_settlements) ? parsed.loan_settlements : [],
      income_entries: Array.isArray(parsed.income_entries) ? parsed.income_entries : loadIncomeEntries(),
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : (Array.isArray(parsed.custom_categories) ? parsed.custom_categories : loadCategoriesCache().customCategories),
      hiddenBuiltins: Array.isArray(parsed.hiddenBuiltins) ? parsed.hiddenBuiltins : (Array.isArray(parsed.hidden_builtins) ? parsed.hidden_builtins : loadCategoriesCache().hiddenBuiltins),
      settings: {
        currency: parsed.settings?.currency || 'INR',
        darkMode: Boolean(parsed.settings?.darkMode)
      }
    };
    return s;
  }

  let state = createInitialState();

  // Admin Identification & Role Calculation
  function computeIsAdmin() {
    if (isDevOrTest && window.__ledgio_overrideAdmin !== undefined) {
      return Boolean(window.__ledgio_overrideAdmin);
    }
    const adminIds = window.LEDGIO_ADMIN_USER_IDS || [];
    const uid = getUserId();
    return adminIds.includes(uid);
  }

  let isAdmin = computeIsAdmin();

  function updateAdminUI() {
    isAdmin = computeIsAdmin();

    const badge = document.getElementById('admin-badge-chip');
    if (badge) badge.style.display = isAdmin ? 'inline-flex' : 'none';

    const broadcastMenuBtn = document.getElementById('menu-broadcast-announcement-btn');
    if (broadcastMenuBtn) broadcastMenuBtn.style.display = isAdmin ? 'flex' : 'none';

    const broadcastCard = document.getElementById('admin-broadcast-card');
    if (broadcastCard) broadcastCard.style.display = isAdmin ? 'block' : 'none';

    const telemetryCard = document.getElementById('analytics-telemetry-card');
    if (telemetryCard) telemetryCard.style.display = isAdmin ? 'block' : 'none';
  }

  if (isDevOrTest) {
    window.__ledgio_setAdminForTesting = function(val) {
      window.__ledgio_overrideAdmin = (val === null || val === undefined) ? undefined : Boolean(val);
      isAdmin = computeIsAdmin();
      updateAdminUI();
      return isAdmin;
    };
  }
  window.isAdminUser = () => computeIsAdmin();

  // Pure Error Tiering Function (Reassuring, Jargon-Free for Users)
  function mapErrorToUserMessage(error) {
    if (!error) return "Some data couldn't reach your backup — it's safe on this device";
    let errStr = '';
    if (typeof error === 'string') {
      errStr = error;
    } else if (typeof error === 'object') {
      errStr = error.message || error.details || error.hint || error.error_description || JSON.stringify(error);
    }
    const lower = (errStr || '').toLowerCase();

    // Network / timeout / offline
    if (/network|timeout|fetch|offline|connection|abort|econnrefused|failed to fetch/i.test(lower)) {
      return "Couldn't reach the cloud — will retry automatically";
    }

    // Schema / server errors / SQL / postgrest
    if (/schema|relation|column|table|42p01|42703|syntax|server|500|502|503|504|internal|pgrst|postgrest|upsert|violates|not found|does not exist/i.test(lower)) {
      return "Cloud backup needs an app update — your data is safe on this device";
    }

    // Other
    return "Some data couldn't reach your backup — it's safe on this device";
  }
  window.mapErrorToUserMessage = mapErrorToUserMessage;
  
  function isQuotaExceededError(error) {
    if (!error) return false;
    return Boolean(
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      String(error.message || '').toLowerCase().includes('quota')
    );
  }
  window.isQuotaExceededError = isQuotaExceededError;

  let chartInstances = {
    category: null,
    spending: null,
    trend: null
  };

  // Phase 2: Private Vault & Security State
  let vaultConfig = {
    pinEnabled: false,
    pinHash: null,
    pinSalt: null,
    stealthMode: false,
    autoLockTimeout: 3,
    biometricEnabled: false,
    biometricCredentialId: null
  };
  let isVaultLocked = false;
  let isStealthModeActive = false;
  // Persistent per-card view preferences (Device-local only: ledgio_stat_views_<userId>)
  function getStatViewsStorageKey(userId = getUserId()) {
    return `ledgio_stat_views_${userId}`;
  }

  function sanitizeStatView(val) {
    return val === 'percent' ? 'percent' : 'number';
  }

  function loadStatViewPreferences(userId = getUserId()) {
    try {
      const raw = localStorage.getItem(getStatViewsStorageKey(userId));
      if (!raw) return { income: 'number', expenses: 'number' };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { income: 'number', expenses: 'number' };
      }
      return {
        income: sanitizeStatView(parsed.income),
        expenses: sanitizeStatView(parsed.expenses)
      };
    } catch (e) {
      return { income: 'number', expenses: 'number' };
    }
  }

  function saveStatViewPreferences(modes, userId = getUserId()) {
    try {
      const payload = {
        income: sanitizeStatView(modes?.income),
        expenses: sanitizeStatView(modes?.expenses)
      };
      localStorage.setItem(getStatViewsStorageKey(userId), JSON.stringify(payload));
    } catch (e) {
      // Storage access failure (e.g., quota exceeded / private mode) - in-memory state continues
    }
  }

  // Interactive summary cards mode (defaults to 'number' per user choice)
  let summaryCardModes = {
    income: 'number',
    expenses: 'number'
  };

  function toggleSummaryCard(type) {
    if (type !== 'income' && type !== 'expenses') return;
    summaryCardModes[type] = summaryCardModes[type] === 'number' ? 'percent' : 'number';
    saveStatViewPreferences(summaryCardModes);
    const cardEl = document.getElementById(type === 'income' ? 'summary-income-card' : 'summary-expenses-card');
    if (cardEl) {
      cardEl.classList.add('toggling');
      updateSummary();
      setTimeout(() => {
        cardEl.classList.remove('toggling');
      }, 150);
    } else {
      updateSummary();
    }
  }

  let failedPinAttempts = 0;
  let lockoutTimestamp = 0;
  let lastActivityTimestamp = Date.now();
  let currentEnteredPin = '';
  let setupPinStep = 1;
  let setupTempPin = '';
  let lastLockKeyTime = 0;
  let lastLockKey = '';
  let isVerifyingPin = false;
  let isChangingPin = false;
  let isSettingUpPin = false;
  let lastSetupKeyTime = 0;
  let lastSetupKey = '';

  // =========================================================================
  // Phase 3: Offline-First Sync Engine Bridge (extracted to sync-engine.js)
  // =========================================================================
  let isSyncProcessing = false;
  let isWaitingForNetwork = false;
  let isSignInRequired = false;

  window.getUserId = getUserId;

  if (window.LedgioSyncEngine && typeof window.LedgioSyncEngine.configure === 'function') {
    window.LedgioSyncEngine.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      getSupabaseClient: () => supabase,
      saveData: (trackUndo) => saveData(trackUndo),
      saveIncomeEntries: () => saveIncomeEntries(),
      saveCategoriesCache: () => saveCategoriesCache(),
      updateSyncStatusUI: () => updateSyncStatusUI(),
      broadcastSyncEvent: (type, payload) => broadcastSyncEvent(type, payload),
      showToast: (msg, type) => showToast(msg, type),
      isQuotaExceededError: (e) => isQuotaExceededError(e),
      pullRemoteChanges: () => pullRemoteChanges(),
      onSyncStateChange: ({ processing, waiting, signInRequired } = {}) => {
        if (processing !== undefined) isSyncProcessing = processing;
        if (waiting !== undefined) isWaitingForNetwork = waiting;
        if (signInRequired !== undefined) isSignInRequired = signInRequired;
      }
    });
  }

  // Phase 7b: Multi-Device Reset Epoch Subsystem
  function getResetEpochStorageKey(userId) {
    return `ledgio_reset_epoch_${userId || getUserId()}`;
  }

  function getResetEpoch(userId) {
    try {
      const raw = localStorage.getItem(getResetEpochStorageKey(userId));
      const num = parseInt(raw, 10);
      return (!isNaN(num) && num >= 0) ? num : 0;
    } catch (e) {
      return 0;
    }
  }

  function setResetEpoch(epoch, userId) {
    try {
      const val = Math.max(0, parseInt(epoch, 10) || 0);
      localStorage.setItem(getResetEpochStorageKey(userId), String(val));
      return val;
    } catch (e) {
      return 0;
    }
  }

  function incrementResetEpoch(userId) {
    const cur = getResetEpoch(userId);
    const next = cur + 1;
    setResetEpoch(next, userId);
    return next;
  }

  // Phase 3 Cross-Tab Real-Time Sync Bus (BroadcastChannel)
  let syncBus = null;
  try {
    if ('BroadcastChannel' in window) {
      syncBus = new BroadcastChannel('ledgio_sync_bus');
      syncBus.onmessage = (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        // Ensure message belongs to currently active account
        if (msg.payload?.userId && msg.payload.userId !== getUserId()) return;

        const currentLocalEpoch = getResetEpoch(getUserId());
        const msgEpoch = typeof msg.payload?.resetEpoch === 'number'
          ? msg.payload.resetEpoch
          : (typeof msg.payload?.epoch === 'number' ? msg.payload.epoch : 0);

        // VECTOR A GATE: Drop stale messages from tabs running older reset epoch
        if (msgEpoch < currentLocalEpoch) {
          console.info(`[SyncBus] Dropping stale message (${msg.type}) with epoch ${msgEpoch} < current local epoch ${currentLocalEpoch}`);
          return;
        }

        // If another tab executed a reset with higher epoch, adopt new epoch and wipe local state!
        if (msgEpoch > currentLocalEpoch) {
          console.info(`[SyncBus] Remote reset epoch detected (${msgEpoch} > ${currentLocalEpoch}). Synchronizing epoch and clearing local state.`);
          setResetEpoch(msgEpoch, getUserId());
          saveSyncQueue([]);
          saveDeadLetterQueue([]);
          localStorage.removeItem(getIncomeEntriesStorageKey());
          localStorage.removeItem(getCategoriesCacheKey());
          try { localStorage.removeItem('ledgio_income_pulled_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem('ledgio_legacy_income_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem('ledgio_last_sync_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem(getVaultStorageKey()); } catch (e) {}
          try { localStorage.removeItem('ledgio_vault_default_user'); } catch (e) {}
          legacyIncome = 0;
          state = createInitialState({ income_entries: [], customCategories: [], hiddenBuiltins: [] });
          saveIncomeEntries();
          saveCategoriesCache();
          saveData(false);
          populateDropdowns();
          refreshUI();
          renderCustomCategoriesList();
          updateSyncStatusUI();
          if (msg.type === 'RESET_EXECUTED') return;
        }

        if (msg.type === 'RESET_EXECUTED') {
          saveSyncQueue([]);
          saveDeadLetterQueue([]);
          localStorage.removeItem(getIncomeEntriesStorageKey());
          localStorage.removeItem(getCategoriesCacheKey());
          try { localStorage.removeItem('ledgio_income_pulled_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem('ledgio_legacy_income_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem('ledgio_last_sync_' + getUserId()); } catch (e) {}
          try { localStorage.removeItem(getVaultStorageKey()); } catch (e) {}
          try { localStorage.removeItem('ledgio_vault_default_user'); } catch (e) {}
          legacyIncome = 0;
          state = createInitialState({ income_entries: [], customCategories: [], hiddenBuiltins: [] });
          saveIncomeEntries();
          saveCategoriesCache();
          saveData(false);
          populateDropdowns();
          refreshUI();
          renderCustomCategoriesList();
          updateSyncStatusUI();
          return;
        }

        if (msg.type === 'STATE_UPDATED') {
          if (msg.payload?.state) {
            state = Object.assign(state, msg.payload.state);

            // MANDATORY (Amendment 5): Cross-tab handlers must WRITE received state to localStorage so newly opened tabs inherit it
            const userKey = getStorageKey();
            try {
              localStorage.setItem(userKey, JSON.stringify(state));
              saveIncomeEntries();
              saveCategoriesCache();
              const uid = getUserId();
              if (state.settings?.darkMode !== undefined) {
                const isDark = Boolean(state.settings.darkMode);
                localStorage.setItem('sb_dark_mode_' + uid, isDark ? 'true' : 'false');
                localStorage.setItem('ledgio_theme', isDark ? 'dark' : 'light');
                applyDarkMode();
              }
              if (state.settings?.currency) {
                localStorage.setItem('ledgio_currency', state.settings.currency);
              }
            } catch (err) {
              console.error('Error persisting cross-tab state update:', err);
              if (isQuotaExceededError(err)) {
                showToast('Local storage full — export your data or remove old records', 'error');
              }
            }

            populateDropdowns();
            refreshUI();
            renderCustomCategoriesList();
            updateSyncStatusUI();
          }
        } else if (msg.type === 'STEALTH_TOGGLED') {
          if (typeof msg.payload?.isStealth === 'boolean') {
            toggleStealthMode(msg.payload.isStealth, false);
          }
        } else if (msg.type === 'QUEUE_MUTATION') {
          updateSyncStatusUI();
        }
      };
    }
  } catch (e) {
    console.warn('BroadcastChannel sync unavailable:', e);
  }

  function broadcastSyncEvent(type, payload = {}) {
    if (!syncBus) return;
    try {
      const activeEpoch = getResetEpoch(payload.userId || getUserId());
      syncBus.postMessage({
        type,
        payload: {
          resetEpoch: activeEpoch,
          ...payload
        },
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('Could not post sync bus message:', e);
    }
  }

  function getSyncQueueKey(userId) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.getSyncQueueKey(userId || getUserId()) : `ledgio_sync_queue_${userId || getUserId()}`;
  }

  function getDeadLetterKey(userId) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.getDeadLetterKey(userId || getUserId()) : `ledgio_dead_letter_${userId || getUserId()}`;
  }

  function getLastSyncKey(userId) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.getLastSyncKey(userId || getUserId()) : `ledgio_last_sync_${userId || getUserId()}`;
  }

  function getSyncQueue() {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.getSyncQueue() : [];
  }

  function saveSyncQueue(queue) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.saveSyncQueue(queue) : null;
  }

  function getDeadLetterQueue() {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.getDeadLetterQueue() : [];
  }

  function saveDeadLetterQueue(dl) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.saveDeadLetterQueue(dl) : null;
  }

  function hasLiveSession() {
    return Boolean(supabase && currentUser && currentUser.id);
  }

  // Session Auto-Recovery: Attempts to re-establish a Supabase auth session
  // when the app is online with a valid client but no live session (e.g. after
  // a Supabase outage or token expiry that left the app stuck in "Local Only").
  let _sessionRecoveryInFlight = false;

  // Checks whether an error is a definitive auth rejection (tokens are dead)
  // vs a transient network/service error (Supabase down, timeout, DNS, etc.).
  function isAuthRejection(err) {
    if (!err) return false;
    const status = err.status || err.__isAuthError;
    // Supabase auth errors come with status 400/401/403 and __isAuthError=true
    if (status === 400 || status === 401 || status === 403 || err.__isAuthError === true) {
      return true;
    }
    // Check message for known auth rejection patterns
    const msg = (err.message || '').toLowerCase();
    const authPatterns = ['invalid refresh token', 'refresh token not found',
      'token expired', 'token is expired', 'invalid token', 'session not found',
      'user not found', 'token has been revoked'];
    return authPatterns.some(p => msg.includes(p));
  }

  async function tryRecoverSession() {
    // Only attempt recovery when conditions make sense
    if (!supabase || !navigator.onLine || hasLiveSession() || _sessionRecoveryInFlight) return false;
    _sessionRecoveryInFlight = true;
    try {
      // 1. Try getSession first (uses persisted refresh token)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        currentUser = sessionData.session.user;
        localStorage.setItem('sb_user_id', sessionData.session.user.id);
        isSignInRequired = false;
        if (window.LedgioSyncEngine) window.LedgioSyncEngine.isSignInRequired = false;
        console.log('[Ledgio Sync] Session recovered via getSession');
        updateSyncStatusUI();
        return true;
      }
      // 2. If getSession failed, try refreshing the session explicitly
      if (sessionErr || !sessionData?.session) {
        // If getSession itself failed with a network error, don't escalate
        if (sessionErr && !isAuthRejection(sessionErr)) {
          console.log('[Ledgio Sync] Session recovery skipped — Supabase unreachable:', sessionErr.message);
          return false;
        }

        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshData?.session?.user) {
          currentUser = refreshData.session.user;
          localStorage.setItem('sb_user_id', refreshData.session.user.id);
          isSignInRequired = false;
          if (window.LedgioSyncEngine) window.LedgioSyncEngine.isSignInRequired = false;
          console.log('[Ledgio Sync] Session recovered via refreshSession');
          updateSyncStatusUI();
          return true;
        }
        // 3. Only flag "sign in required" if it's a real auth rejection,
        //    NOT a network/service outage (Supabase down, timeout, etc.)
        if (refreshErr && localStorage.getItem('sb_auth') === 'true') {
          if (isAuthRejection(refreshErr)) {
            console.warn('[Ledgio Sync] Session recovery failed — tokens revoked/expired:', refreshErr.message);
            isSignInRequired = true;
            if (window.LedgioSyncEngine) window.LedgioSyncEngine.isSignInRequired = true;
            updateSyncStatusUI();
          } else {
            // Transient failure (Supabase outage, DNS, timeout) — stay Local Only, retry later
            console.log('[Ledgio Sync] Session recovery deferred — service unavailable:', refreshErr.message);
          }
        }
      }
      return false;
    } catch (err) {
      // Catch-all for fetch/network exceptions — stay Local Only silently
      console.warn('[Ledgio Sync] Session recovery error (will retry):', err?.message || err);
      return false;
    } finally {
      _sessionRecoveryInFlight = false;
    }
  }

  function routeToLogin() {
    if (typeof window.__ledgio_routeToLoginOverride === 'function') {
      window.__ledgio_routeToLoginOverride();
      return;
    }
    window.location.href = 'login.html';
  }

  function updateSyncStatusUI() {
    const btn = document.getElementById('sync-status-btn');
    const queue = getSyncQueue();
    const deadLetter = getDeadLetterQueue();
    const isOnline = navigator.onLine;
    const isLive = hasLiveSession();
    const isSignInReq = Boolean(isSignInRequired || queue.some(m => m && (m.status === 'sign in required' || m.status === 'sign in again')));

    if (btn) {
      btn.classList.remove('online', 'offline', 'syncing', 'local-only');
      btn.removeAttribute('data-action');

      if (!isOnline) {
        btn.classList.add('offline');
        const count = queue.length;
        btn.innerHTML = `<i class="fas fa-bolt"></i> <span id="sync-status-text">${count > 0 ? `Offline (${count})` : 'Offline'}</span>`;
        btn.setAttribute('title', 'You are currently offline');
      } else if (isSignInReq) {
        btn.classList.add('offline');
        btn.setAttribute('data-action', 'login');
        btn.innerHTML = `<i class="fas fa-lock"></i> <span id="sync-status-text">Sign in required</span>`;
        btn.setAttribute('title', 'Authentication expired — click to sign in');
      } else if (!isLive) {
        btn.classList.add('local-only');
        btn.innerHTML = `<i class="fas fa-hard-drive"></i> <span id="sync-status-text">Local Only</span>`;
        btn.setAttribute('title', 'Operating in local mode — changes saved on this device');
      } else if (isSyncProcessing || queue.length > 0) {
        btn.classList.add('syncing');
        const count = queue.length;
        btn.innerHTML = `<i class="fas fa-arrows-rotate fa-spin"></i> <span id="sync-status-text">${count > 0 ? `Syncing (${count})` : 'Syncing...'}</span>`;
        btn.setAttribute('title', 'Syncing changes to cloud');
      } else if (deadLetter.length > 0) {
        btn.classList.add('offline');
        btn.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <span id="sync-status-text">${deadLetter.length} Issue${deadLetter.length > 1 ? 's' : ''}</span>`;
        btn.setAttribute('title', `${deadLetter.length} sync issue${deadLetter.length > 1 ? 's' : ''} require attention`);
      } else {
        btn.classList.add('online');
        btn.innerHTML = `<i class="fas fa-circle-check"></i> <span id="sync-status-text">Cloud Synced</span>`;
        btn.setAttribute('title', 'All data backed up to cloud');
      }
    }

    // Keep dropdown sync state row in lockstep
    const syncDot = document.getElementById('dropdown-sync-dot');
    const syncText = document.getElementById('dropdown-sync-text');
    if (syncDot && syncText) {
      syncDot.className = 'status-dot';
      if (!isOnline) {
        syncDot.classList.add('offline');
        const count = queue.length;
        syncText.textContent = count > 0 ? `🔴 Offline (${count})` : '🔴 Offline';
      } else if (isSignInReq) {
        syncDot.classList.add('offline');
        const count = queue.length;
        syncText.textContent = count > 0 ? `🔒 Sign in required (${count})` : '🔒 Sign in required';
      } else if (!isLive) {
        syncDot.classList.add('local-only');
        syncText.textContent = '💾 Local Only';
      } else if (isSyncProcessing || queue.length > 0) {
        syncDot.classList.add('syncing');
        const count = queue.length;
        syncText.textContent = count > 0 ? `🟡 Syncing (${count})` : '🟡 Syncing...';
      } else if (deadLetter.length > 0) {
        syncDot.classList.add('offline');
        syncText.textContent = `⚠️ ${deadLetter.length} Issue${deadLetter.length > 1 ? 's' : ''}`;
      } else {
        syncDot.classList.add('online');
        syncText.textContent = '🟢 Cloud Synced';
      }
    }
  }

  function enqueueMutation(table, action, data) {
    return window.LedgioSyncEngine ? window.LedgioSyncEngine.enqueueMutation(table, action, data) : null;
  }

  async function processSyncQueue(force = false) {
    return window.LedgioSyncEngine ? await window.LedgioSyncEngine.processSyncQueue(force) : undefined;
  }

  function getResetTombstoneKey() {
    return `ledgio_pending_cloud_reset_${getUserId()}`;
  }

  async function processCloudResetTombstone() {
    if (!supabase || !currentUser || !navigator.onLine) return;
    const tombstoneKey = getResetTombstoneKey();
    let rawTombstone = localStorage.getItem(tombstoneKey);
    if (!rawTombstone && getUserId() !== 'default_user') {
      rawTombstone = localStorage.getItem('ledgio_pending_cloud_reset_default_user');
      if (rawTombstone) {
        try {
          localStorage.removeItem('ledgio_pending_cloud_reset_default_user');
          localStorage.setItem(tombstoneKey, rawTombstone);
        } catch (e) {}
      }
    }
    if (!rawTombstone) return;

    let tombstoneObj = null;
    try {
      tombstoneObj = JSON.parse(rawTombstone);
    } catch (e) {}

    const targetEpoch = (tombstoneObj && typeof tombstoneObj.resetEpoch === 'number')
      ? tombstoneObj.resetEpoch
      : (getResetEpoch(currentUser.id) || 1);

    try {
      console.info('🪦 [Reset Tombstone] Processing pending cloud wipe for user:', currentUser.id, 'epoch:', targetEpoch);

      /* EXTEND_RESET_CASCADE_HERE */
      // a. DELETE all rows from relational tables for this user in Supabase
      const { error: expErr } = await supabase.from('expenses').delete().eq('user_id', currentUser.id);
      if (expErr) throw expErr;

      const { error: bgErr } = await supabase.from('budgets').delete().eq('user_id', currentUser.id);
      if (bgErr) throw bgErr;

      const { error: depErr } = await supabase.from('goal_deposits').delete().eq('user_id', currentUser.id);
      if (depErr) console.warn('[Tombstone] goal_deposits delete warning:', depErr);

      const { error: goalErr } = await supabase.from('goals').delete().eq('user_id', currentUser.id);
      if (goalErr) console.warn('[Tombstone] goals delete warning:', goalErr);

      const { error: settleErr } = await supabase.from('loan_settlements').delete().eq('user_id', currentUser.id);
      if (settleErr) console.warn('[Tombstone] loan_settlements delete warning:', settleErr);

      const { error: loanErr } = await supabase.from('loans').delete().eq('user_id', currentUser.id);
      if (loanErr) console.warn('[Tombstone] loans delete warning:', loanErr);

      const { error: incErr } = await supabase.from('income_entries').delete().eq('user_id', currentUser.id);
      if (incErr) console.warn('[Tombstone] income_entries delete warning:', incErr);

      const { error: catErr } = await supabase.from('user_categories').delete().eq('user_id', currentUser.id);
      if (catErr) console.warn('[Tombstone] user_categories delete warning:', catErr);

      // b. UPDATE profiles: income = 0, hidden_builtins = [], reset_epoch = targetEpoch (keep currency/full_name)
      const profileUpdates = {
        income: 0,
        hidden_builtins: [],
        reset_epoch: targetEpoch,
        updated_at: new Date().toISOString()
      };
      const { error: profErr } = await supabase.from('profiles').update(profileUpdates).eq('id', currentUser.id);
      if (profErr) {
        if (profErr.message && profErr.message.includes('reset_epoch')) {
          console.warn('[Tombstone] profiles.reset_epoch column missing, updating without reset_epoch');
          await supabase.from('profiles').update({
            income: 0,
            hidden_builtins: [],
            updated_at: new Date().toISOString()
          }).eq('id', currentUser.id);
        } else {
          throw profErr;
        }
      }

      try {
        await supabase.auth.updateUser({ data: { income: 0 } });
      } catch (e) {}

      // c. Remove the tombstone and affirm local epoch
      localStorage.removeItem(tombstoneKey);
      setResetEpoch(targetEpoch, currentUser.id);
      console.info('🪦 [Reset Tombstone] Cloud wipe complete and tombstone removed');
    } catch (err) {
      console.error('Failed executing cloud reset tombstone, will retry on next connection:', err);
    }
  }

  // Phase 7 Migration Bridge: One-time push of pre-existing local categories & hidden builtins (delegated to window.LedgioCategories)
  async function migrateLocalCategoriesToCloud() {
    return window.LedgioCategories ? await window.LedgioCategories.migrateLocalCategoriesToCloud() : null;
  }

  // Pull remote changes from Supabase and merge via Last-Write-Wins (Amendment 3)
  async function pullRemoteChanges() {
    if (!supabase || !currentUser || !navigator.onLine) return;

    // Safety guard: if a cloud reset is pending execution, do not pull/resurrect remote records
    if (localStorage.getItem(getResetTombstoneKey())) return;

    try {
      // 0. Fetch remote user profile to check reset_epoch BEFORE pulling any records
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      const localEpoch = getResetEpoch(currentUser.id);
      const remoteEpoch = (profile && typeof profile.reset_epoch === 'number') ? profile.reset_epoch : 0;

      // RESET EPOCH GATE:
      // Case A: Remote epoch > Local epoch -> Another device/session performed a reset!
      if (remoteEpoch > localEpoch) {
        console.info(`[Sync Engine] Remote reset signal detected (remote epoch ${remoteEpoch} > local epoch ${localEpoch}). Wiping local data.`);
        setResetEpoch(remoteEpoch, currentUser.id);
        saveSyncQueue([]);
        saveDeadLetterQueue([]);
        localStorage.removeItem(getIncomeEntriesStorageKey());
        localStorage.removeItem(getCategoriesCacheKey());
        try { localStorage.removeItem('ledgio_income_pulled_' + currentUser.id); } catch (e) {}
        try { localStorage.removeItem('ledgio_legacy_income_' + currentUser.id); } catch (e) {}
        try { localStorage.removeItem('ledgio_last_sync_' + currentUser.id); } catch (e) {}
        try { localStorage.removeItem(getVaultStorageKey()); } catch (e) {}
        try { localStorage.removeItem('ledgio_vault_default_user'); } catch (e) {}
        legacyIncome = 0;
        state = createInitialState({ income_entries: [], customCategories: [], hiddenBuiltins: [] });
        saveIncomeEntries();
        saveCategoriesCache();
        saveData(false);
      } else if (remoteEpoch < localEpoch) {
        // Case B: Local epoch > Remote epoch -> This device performed a reset not yet synced to cloud
        console.info(`[Sync Engine] Local reset epoch higher than remote (${localEpoch} > ${remoteEpoch}). Preserving local reset, preventing remote resurrection.`);
        await processCloudResetTombstone();
        return;
      }

      // 0b. Run one-time category migration bridge if needed
      await migrateLocalCategoriesToCloud();

      // 1. Process remote user profile settings
      if (profile) {
        const queue = getSyncQueue();
        const hasPendingProfileMutation = queue.some(m => m.table === 'profiles');

        if (!hasPendingProfileMutation) {
          if (profile.full_name) {
            localStorage.setItem('sb_username', profile.full_name);
            localStorage.setItem('sb_user_name', profile.full_name);
            updateUserDisplayNames(profile.full_name);
          }
          if (profile.currency) state.settings.currency = profile.currency;
          if (profile.dark_mode !== undefined && profile.dark_mode !== null) {
            state.settings.darkMode = Boolean(profile.dark_mode);
          }
          if (typeof profile.income === 'number' && !isNaN(profile.income)) {
            legacyIncome = profile.income > 0 ? profile.income : 0;
            try {
              if (legacyIncome > 0) {
                localStorage.setItem('ledgio_legacy_income_' + currentUser.id, String(profile.income));
              } else {
                localStorage.removeItem('ledgio_legacy_income_' + currentUser.id);
              }
            } catch (e) {}
          }
          if (Array.isArray(profile.hidden_builtins)) {
            const hasPendingProfile = queue.some(m => m.table === 'profiles' && m.data?.hidden_builtins !== undefined);
            if (!hasPendingProfile) {
              state.hiddenBuiltins = profile.hidden_builtins;
              saveCategoriesCache();
            }
          }
        }
      }

      // 2. Fetch remote expenses
      const { data: remoteExpenses, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false });

      if (!expErr && remoteExpenses) {
        const queue = getSyncQueue();
        const pendingExpenseMutations = queue.filter(m => m.table === 'expenses');
        const pendingExpenseUpsertIds = new Set(pendingExpenseMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingExpenseDeleteIds = new Set(pendingExpenseMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const localExpMap = new Map((state.expenses || []).map(e => [e.id, e]));
        const nextExpenses = [];

        remoteExpenses.forEach(re => {
          if (pendingExpenseDeleteIds.has(re.id)) return; // Dropped if local pending DELETE exists

          const localExp = localExpMap.get(re.id);
          const remoteTime = re.updated_at ? new Date(re.updated_at).getTime() : (re.created_at ? new Date(re.created_at).getTime() : 0);
          const localTime = localExp ? (localExp.updatedAt ? new Date(localExp.updatedAt).getTime() : (localExp.createdAt ? new Date(localExp.createdAt).getTime() : 0)) : 0;

          if (localExp && pendingExpenseUpsertIds.has(re.id) && localTime >= remoteTime) {
            nextExpenses.push(localExp);
          } else {
            nextExpenses.push({
              id: re.id,
              name: re.name,
              amount: parseFloat(re.amount) || 0,
              category: re.category || 'other',
              date: re.date,
              createdAt: re.created_at,
              updatedAt: re.updated_at || re.created_at
            });
          }
          localExpMap.delete(re.id);
        });

        // Retain local expenses that were added offline and are still pending sync to Supabase
        localExpMap.forEach(le => {
          if (pendingExpenseUpsertIds.has(le.id) && !pendingExpenseDeleteIds.has(le.id)) {
            nextExpenses.push(le);
          }
        });

        state.expenses = nextExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      // 3. Fetch remote budgets
      const { data: remoteBudgets, error: bgErr } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', currentUser.id);

      if (!bgErr && remoteBudgets) {
        const queue = getSyncQueue();
        const pendingBudgetMutations = queue.filter(m => m.table === 'budgets');
        const pendingUpsertCats = new Set(pendingBudgetMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.category));
        const pendingDeleteCats = new Set(pendingBudgetMutations.filter(m => m.action === 'DELETE').map(m => m.data?.category));

        const nextBudgets = {};

        // Retain local budgets only if there is a pending local UPSERT mutation awaiting sync
        if (state.budgets) {
          Object.keys(state.budgets).forEach(cat => {
            if (pendingUpsertCats.has(cat) && !pendingDeleteCats.has(cat)) {
              nextBudgets[cat] = state.budgets[cat];
            }
          });
        }

        // Apply remote budgets from Supabase (pruning anything deleted, unless local pending mutation exists)
        remoteBudgets.forEach(b => {
          if (!pendingDeleteCats.has(b.category)) {
            if (!pendingUpsertCats.has(b.category)) {
              nextBudgets[b.category] = parseFloat(b.monthly_limit) || 0;
            }
          }
        });

        state.budgets = nextBudgets;
      }

      // 4. Fetch remote goals
      const { data: remoteGoals, error: goalErr } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!goalErr && remoteGoals) {
        const queue = getSyncQueue();
        const pendingGoalMutations = queue.filter(m => m.table === 'goals');
        const pendingGoalUpsertIds = new Set(pendingGoalMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingGoalDeleteIds = new Set(pendingGoalMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const localGoalMap = new Map((state.goals || []).map(g => [g.id, g]));
        const nextGoals = [];

        remoteGoals.forEach(rg => {
          if (pendingGoalDeleteIds.has(rg.id)) return;

          const localGoal = localGoalMap.get(rg.id);
          const remoteTime = rg.updated_at ? new Date(rg.updated_at).getTime() : (rg.created_at ? new Date(rg.created_at).getTime() : 0);
          const localTime = localGoal ? (localGoal.updated_at ? new Date(localGoal.updated_at).getTime() : (localGoal.created_at ? new Date(localGoal.created_at).getTime() : 0)) : 0;

          if (localGoal && pendingGoalUpsertIds.has(rg.id) && localTime >= remoteTime) {
            nextGoals.push(localGoal);
          } else {
            nextGoals.push({
              id: rg.id,
              user_id: rg.user_id,
              name: rg.name,
              target_amount: parseFloat(rg.target_amount) || 0,
              target_date: rg.target_date || null,
              category: rg.category || 'general',
              color: rg.color || '#10b981',
              icon: rg.icon || 'fa-bullseye',
              notes: rg.notes || '',
              created_at: rg.created_at,
              updated_at: rg.updated_at || rg.created_at
            });
          }
          localGoalMap.delete(rg.id);
        });

        localGoalMap.forEach(lg => {
          if (pendingGoalUpsertIds.has(lg.id) && !pendingGoalDeleteIds.has(lg.id)) {
            nextGoals.push(lg);
          }
        });

        state.goals = nextGoals;
      }

      // 5. Fetch remote goal_deposits (First-class records, naturally additive)
      const { data: remoteDeposits, error: depErr } = await supabase
        .from('goal_deposits')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (!depErr && remoteDeposits) {
        const queue = getSyncQueue();
        const pendingDepMutations = queue.filter(m => m.table === 'goal_deposits');
        const pendingDepUpsertIds = new Set(pendingDepMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingDepDeleteIds = new Set(pendingDepMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const pendingGoalDeleteIds = new Set(queue.filter(m => m.table === 'goals' && m.action === 'DELETE').map(m => m.data?.id));
        const localDepMap = new Map((state.goal_deposits || []).map(d => [d.id, d]));
        const nextDeposits = [];

        remoteDeposits.forEach(rd => {
          if (pendingDepDeleteIds.has(rd.id) || pendingGoalDeleteIds.has(rd.goal_id)) return;

          const localDep = localDepMap.get(rd.id);
          const remoteTime = rd.updated_at ? new Date(rd.updated_at).getTime() : (rd.created_at ? new Date(rd.created_at).getTime() : 0);
          const localTime = localDep ? (localDep.updated_at ? new Date(localDep.updated_at).getTime() : (localDep.created_at ? new Date(localDep.created_at).getTime() : 0)) : 0;

          if (localDep && pendingDepUpsertIds.has(rd.id) && localTime >= remoteTime) {
            nextDeposits.push(localDep);
          } else {
            nextDeposits.push({
              id: rd.id,
              goal_id: rd.goal_id,
              user_id: rd.user_id,
              amount: parseFloat(rd.amount) || 0,
              deposit_date: rd.deposit_date,
              note: rd.note || '',
              created_at: rd.created_at,
              updated_at: rd.updated_at || rd.created_at
            });
          }
          localDepMap.delete(rd.id);
        });

        localDepMap.forEach(ld => {
          if (pendingDepUpsertIds.has(ld.id) && !pendingDepDeleteIds.has(ld.id)) {
            nextDeposits.push(ld);
          }
        });

        const validGoalIds = new Set((state.goals || []).map(g => g.id));
        state.goal_deposits = nextDeposits.filter(d => validGoalIds.has(d.goal_id));
      }

      // 6. Fetch remote loans (Phase 5: Loans & Debts)
      const { data: remoteLoans, error: loanErr } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('loan_date', { ascending: false });

      if (!loanErr && remoteLoans) {
        const queue = getSyncQueue();
        const pendingLoanMutations = queue.filter(m => m.table === 'loans');
        const pendingLoanUpsertIds = new Set(pendingLoanMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingLoanDeleteIds = new Set(pendingLoanMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const localLoanMap = new Map((state.loans || []).map(l => [l.id, l]));
        const nextLoans = [];

        remoteLoans.forEach(rl => {
          if (pendingLoanDeleteIds.has(rl.id)) return;

          const localLoan = localLoanMap.get(rl.id);
          const remoteTime = rl.updated_at ? new Date(rl.updated_at).getTime() : (rl.created_at ? new Date(rl.created_at).getTime() : 0);
          const localTime = localLoan ? (localLoan.updated_at ? new Date(localLoan.updated_at).getTime() : (localLoan.created_at ? new Date(localLoan.created_at).getTime() : 0)) : 0;

          if (localLoan && pendingLoanUpsertIds.has(rl.id) && localTime >= remoteTime) {
            nextLoans.push(localLoan);
          } else {
            nextLoans.push({
              id: rl.id,
              user_id: rl.user_id,
              person_name: rl.person_name,
              direction: rl.direction,
              principal: parseFloat(rl.principal) || 0,
              loan_date: rl.loan_date,
              notes: rl.notes || '',
              kind: rl.kind || 'cash',
              created_at: rl.created_at,
              updated_at: rl.updated_at || rl.created_at
            });
          }
          localLoanMap.delete(rl.id);
        });

        localLoanMap.forEach(ll => {
          if (pendingLoanUpsertIds.has(ll.id) && !pendingLoanDeleteIds.has(ll.id)) {
            nextLoans.push(ll);
          }
        });

        state.loans = nextLoans;
      }

      // 7. Fetch remote loan_settlements (Phase 5: First-class additive settlement records)
      const { data: remoteSettlements, error: settleErr } = await supabase
        .from('loan_settlements')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (!settleErr && remoteSettlements) {
        const queue = getSyncQueue();
        const pendingSettleMutations = queue.filter(m => m.table === 'loan_settlements');
        const pendingSettleUpsertIds = new Set(pendingSettleMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingSettleDeleteIds = new Set(pendingSettleMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const pendingLoanDeleteIds = new Set(queue.filter(m => m.table === 'loans' && m.action === 'DELETE').map(m => m.data?.id));
        const localSettleMap = new Map((state.loan_settlements || []).map(s => [s.id, s]));
        const nextSettlements = [];

        remoteSettlements.forEach(rs => {
          if (pendingSettleDeleteIds.has(rs.id) || pendingLoanDeleteIds.has(rs.loan_id)) return;

          const localSettle = localSettleMap.get(rs.id);
          const remoteTime = rs.updated_at ? new Date(rs.updated_at).getTime() : (rs.created_at ? new Date(rs.created_at).getTime() : 0);
          const localTime = localSettle ? (localSettle.updated_at ? new Date(localSettle.updated_at).getTime() : (localSettle.created_at ? new Date(localSettle.created_at).getTime() : 0)) : 0;

          if (localSettle && pendingSettleUpsertIds.has(rs.id) && localTime >= remoteTime) {
            nextSettlements.push(localSettle);
          } else {
            nextSettlements.push({
              id: rs.id,
              loan_id: rs.loan_id,
              user_id: rs.user_id,
              amount: parseFloat(rs.amount) || 0,
              settle_date: rs.settle_date,
              note: rs.note || '',
              created_at: rs.created_at,
              updated_at: rs.updated_at || rs.created_at
            });
          }
          localSettleMap.delete(rs.id);
        });

        localSettleMap.forEach(ls => {
          if (pendingSettleUpsertIds.has(ls.id) && !pendingSettleDeleteIds.has(ls.id)) {
            nextSettlements.push(ls);
          }
        });

        const validLoanIds = new Set((state.loans || []).map(l => l.id));
        state.loan_settlements = nextSettlements.filter(s => validLoanIds.has(s.loan_id));
      }

      // 8. Fetch remote income_entries (Phase 6: Dated Income Events Ledger)
      const { data: remoteIncome, error: incErr } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('entry_date', { ascending: false });

      if (incErr) {
        console.warn('[Sync Engine] Error fetching remote income_entries:', incErr);
      }

      if (!incErr && Array.isArray(remoteIncome)) {
        hasPulledIncomeEntries = true;
        try {
          localStorage.setItem('ledgio_income_pulled_' + currentUser.id, 'true');
        } catch (e) {}

        const queue = getSyncQueue();
        const pendingIncMutations = queue.filter(m => m.table === 'income_entries');
        const pendingIncUpsertIds = new Set(pendingIncMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingIncDeleteIds = new Set(pendingIncMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));
        const localIncMap = new Map((state.income_entries || []).map(e => [e.id, e]));
        const nextEntries = [];

        remoteIncome.forEach(re => {
          if (pendingIncDeleteIds.has(re.id)) return;

          const localEntry = localIncMap.get(re.id);
          const remoteTime = re.updated_at ? new Date(re.updated_at).getTime() : (re.created_at ? new Date(re.created_at).getTime() : 0);
          const localTime = localEntry ? (localEntry.updated_at ? new Date(localEntry.updated_at).getTime() : (localEntry.created_at ? new Date(localEntry.created_at).getTime() : 0)) : 0;

          if (localEntry && pendingIncUpsertIds.has(re.id) && localTime >= remoteTime) {
            nextEntries.push(localEntry);
          } else {
            nextEntries.push({
              id: re.id,
              user_id: re.user_id,
              amount: parseFloat(re.amount) || 0,
              entry_date: re.entry_date,
              type: re.type,
              note: re.note || '',
              loan_id: re.loan_id || null,
              settlement_id: re.settlement_id || null,
              created_at: re.created_at,
              updated_at: re.updated_at || re.created_at
            });
          }
          localIncMap.delete(re.id);
        });

        localIncMap.forEach(le => {
          if (pendingIncUpsertIds.has(le.id) && !pendingIncDeleteIds.has(le.id)) {
            nextEntries.push(le);
          }
        });

        state.income_entries = nextEntries;
        saveIncomeEntries();

        // OPENING ENTRY SAFETY (critical):
        // Only if NO 'opening' entry exists for this user AND legacy income > 0
        const hasOpening = state.income_entries.some(e => e.type === 'opening');
        const hasPendingOpening = pendingIncMutations.some(m => m.action === 'UPSERT' && m.data?.type === 'opening');

        if (!hasOpening && !hasPendingOpening && legacyIncome > 0) {
          const openingId = deterministicOpeningId(currentUser.id);
          const openingEntry = {
            id: openingId,
            user_id: currentUser.id,
            amount: legacyIncome,
            entry_date: getLocalDateString(),
            type: 'opening',
            note: 'Opening balance',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          state.income_entries.push(openingEntry);
          saveIncomeEntries();
          enqueueMutation('income_entries', 'UPSERT', openingEntry);
        }
      }

      // 7. Fetch remote user_categories
      const { data: remoteCategories, error: catErr } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });

      if (!catErr && Array.isArray(remoteCategories)) {
        const queue = getSyncQueue();
        const pendingCatMutations = queue.filter(m => m.table === 'user_categories');
        const pendingCatUpsertIds = new Set(pendingCatMutations.filter(m => m.action === 'UPSERT').map(m => m.data?.id));
        const pendingCatDeleteIds = new Set(pendingCatMutations.filter(m => m.action === 'DELETE').map(m => m.data?.id));

        const localCatMap = new Map((state.customCategories || []).map(c => [c.id, c]));
        const nextCustomCategories = [];

        remoteCategories.forEach(rc => {
          if (pendingCatDeleteIds.has(rc.id)) return;

          const localCat = localCatMap.get(rc.id);
          const remoteTime = rc.updated_at ? new Date(rc.updated_at).getTime() : (rc.created_at ? new Date(rc.created_at).getTime() : 0);
          const localTime = localCat ? (localCat.updated_at ? new Date(localCat.updated_at).getTime() : (localCat.updatedAt ? new Date(localCat.updatedAt).getTime() : (localCat.createdAt ? new Date(localCat.createdAt).getTime() : 0))) : 0;

          if (localCat && pendingCatUpsertIds.has(rc.id) && localTime >= remoteTime) {
            nextCustomCategories.push(localCat);
          } else {
            nextCustomCategories.push({
              id: rc.id,
              name: rc.name,
              color: rc.color || '#3b82f6',
              icon: rc.icon || 'fa-tag',
              isCustom: true,
              createdAt: rc.created_at,
              updatedAt: rc.updated_at,
              created_at: rc.created_at,
              updated_at: rc.updated_at
            });
          }
          localCatMap.delete(rc.id);
        });

        localCatMap.forEach(lc => {
          if (pendingCatUpsertIds.has(lc.id) && !pendingCatDeleteIds.has(lc.id)) {
            nextCustomCategories.push(lc);
          }
        });

        state.customCategories = nextCustomCategories;
        saveCategoriesCache();
      }

      saveData();
      populateDropdowns();
      renderCustomCategoriesList();
      refreshUI();
      try {
        localStorage.setItem(getLastSyncKey(), new Date().toISOString());
      } catch (e) {}
    } catch (err) {
      console.warn('[Sync Engine] Error pulling remote changes:', err);
    }
  }

  function migrateDefaultUserData(newUserId) {
    if (!newUserId || newUserId === 'default_user') return;

    try {
      // 1. Sync Queue migration
      const defaultQueueKey = 'ledgio_sync_queue_default_user';
      const targetQueueKey = `ledgio_sync_queue_${newUserId}`;
      const defaultQueueRaw = localStorage.getItem(defaultQueueKey);

      if (defaultQueueRaw) {
        let defaultQueue = [];
        try {
          const parsed = JSON.parse(defaultQueueRaw);
          if (Array.isArray(parsed)) defaultQueue = parsed;
        } catch (e) {}

        if (defaultQueue.length > 0) {
          let targetQueue = [];
          const targetRaw = localStorage.getItem(targetQueueKey);
          if (targetRaw) {
            try {
              const parsed = JSON.parse(targetRaw);
              if (Array.isArray(parsed)) targetQueue = parsed;
            } catch (e) {}
          }

          const existingIds = new Set(targetQueue.map(m => m.id));
          defaultQueue.forEach(item => {
            if (!item) return;
            // Rewrite user_id in mutation data payload to newUserId
            if (item.data && typeof item.data === 'object') {
              if (item.data.user_id === 'default_user' || !item.data.user_id) {
                item.data.user_id = newUserId;
              }
            }
            if (!existingIds.has(item.id)) {
              targetQueue.push(item);
              existingIds.add(item.id);
            }
          });

          localStorage.setItem(targetQueueKey, JSON.stringify(targetQueue));
        }
        localStorage.removeItem(defaultQueueKey);
      }

      // 2. Dead-letter queue migration
      const defaultDlKey = 'ledgio_dead_letter_default_user';
      const targetDlKey = `ledgio_dead_letter_${newUserId}`;
      const defaultDlRaw = localStorage.getItem(defaultDlKey);
      if (defaultDlRaw) {
        let defaultDl = [];
        try {
          const parsed = JSON.parse(defaultDlRaw);
          if (Array.isArray(parsed)) defaultDl = parsed;
        } catch (e) {}

        if (defaultDl.length > 0) {
          let targetDl = [];
          const targetRaw = localStorage.getItem(targetDlKey);
          if (targetRaw) {
            try {
              const parsed = JSON.parse(targetRaw);
              if (Array.isArray(parsed)) targetDl = parsed;
            } catch (e) {}
          }
          const existingIds = new Set(targetDl.map(d => d.id));
          defaultDl.forEach(item => {
            if (item && !existingIds.has(item.id)) {
              targetDl.push(item);
              existingIds.add(item.id);
            }
          });
          localStorage.setItem(targetDlKey, JSON.stringify(targetDl));
        }
        localStorage.removeItem(defaultDlKey);
      }

      // 3. Local budget data migration (smartBudgetData_default_user -> smartBudgetData_<newUserId>)
      const defaultDataKey = 'smartBudgetData_default_user';
      const targetDataKey = `smartBudgetData_${newUserId}`;
      const defaultDataRaw = localStorage.getItem(defaultDataKey);

      if (defaultDataRaw) {
        const targetDataRaw = localStorage.getItem(targetDataKey);
        if (!targetDataRaw) {
          // Target user has no existing local store, adopt default store directly
          localStorage.setItem(targetDataKey, defaultDataRaw);
        } else {
          // Merge default user expenses into target user store
          try {
            const defData = JSON.parse(defaultDataRaw);
            const tgtData = JSON.parse(targetDataRaw);
            if (defData && tgtData && Array.isArray(defData.expenses)) {
              const tgtExpenses = Array.isArray(tgtData.expenses) ? tgtData.expenses : [];
              const tgtExpIds = new Set(tgtExpenses.map(e => e.id));
              defData.expenses.forEach(e => {
                if (e && !tgtExpIds.has(e.id)) {
                  tgtExpenses.push(e);
                  tgtExpIds.add(e.id);
                }
              });
              tgtData.expenses = tgtExpenses;
              localStorage.setItem(targetDataKey, JSON.stringify(tgtData));
            }
          } catch (e) {
            console.warn('Could not merge default_user data into target store:', e);
          }
        }
        localStorage.removeItem(defaultDataKey);
      }

      // 4. Income entries migration
      const defaultIncomeKey = 'ledgio_income_entries_default_user';
      const targetIncomeKey = `ledgio_income_entries_${newUserId}`;
      const defaultIncomeRaw = localStorage.getItem(defaultIncomeKey);
      if (defaultIncomeRaw) {
        const targetIncomeRaw = localStorage.getItem(targetIncomeKey);
        if (!targetIncomeRaw) {
          localStorage.setItem(targetIncomeKey, defaultIncomeRaw);
        } else {
          try {
            const defEntries = JSON.parse(defaultIncomeRaw);
            const tgtEntries = JSON.parse(targetIncomeRaw);
            if (Array.isArray(defEntries) && Array.isArray(tgtEntries)) {
              const tgtEntryIds = new Set(tgtEntries.map(e => e.id));
              defEntries.forEach(entry => {
                if (entry && !tgtEntryIds.has(entry.id)) {
                  tgtEntries.push(entry);
                  tgtEntryIds.add(entry.id);
                }
              });
              localStorage.setItem(targetIncomeKey, JSON.stringify(tgtEntries));
            }
          } catch (e) {}
        }
        localStorage.removeItem(defaultIncomeKey);
      }

      // 5. Reset epoch migration
      const defaultEpochKey = 'ledgio_reset_epoch_default_user';
      const targetEpochKey = `ledgio_reset_epoch_${newUserId}`;
      const defaultEpochRaw = localStorage.getItem(defaultEpochKey);
      if (defaultEpochRaw) {
        const defEpoch = parseInt(defaultEpochRaw, 10) || 0;
        const targetEpoch = parseInt(localStorage.getItem(targetEpochKey), 10) || 0;
        localStorage.setItem(targetEpochKey, String(Math.max(defEpoch, targetEpoch)));
        localStorage.removeItem(defaultEpochKey);
      }
    } catch (err) {
      console.warn('Error during default_user migration:', err);
    }
  }

  // Subscribe to Supabase auth state transitions to maintain session validity and trigger queue drain
  if (!supabase && typeof window.getSupabaseClient === 'function') {
    supabase = window.getSupabaseClient();
  }
  if (supabase && supabase.auth && typeof supabase.auth.onAuthStateChange === 'function') {
    try {
      supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          currentUser = session.user;
          localStorage.setItem('sb_user_id', session.user.id);
          migrateDefaultUserData(session.user.id);
          updateSyncStatusUI();
          updateUserProfileDropdownContent();
          if (navigator.onLine) {
            processSyncQueue();
          }
        } else if (event === 'SIGNED_OUT') {
          // Transient sign-out must not purge local ledger data or clear session unless explicit logout
          const isExplicitSignOut = sessionStorage.getItem('just_logged_out') === 'true' || localStorage.getItem('sb_auth') !== 'true';
          if (isExplicitSignOut) {
            currentUser = null;
            updateSyncStatusUI();
            updateUserProfileDropdownContent();
          } else {
            console.warn('[Ledgio Auth] Transient SIGNED_OUT event ignored in app.js to preserve local session stability.');
          }
        }
      });
    } catch (e) {
      console.warn('Could not attach onAuthStateChange in app.js:', e);
    }
  }

  // Phase 1: Pure Synchronous Local State Hydration (0ms Local-First)
  function loadLocalState() {
    const uid = getUserId();
    const localEpoch = getResetEpoch(uid);
    const tombstoneKey = getResetTombstoneKey();
    const hasPendingReset = Boolean(localStorage.getItem(tombstoneKey));
    const userKey = getStorageKey();
    const localData = localStorage.getItem(userKey);
    const globalTheme = localStorage.getItem('ledgio_theme');
    const directDark = localStorage.getItem('sb_dark_mode_' + uid);
    const globalCurrency = localStorage.getItem('ledgio_currency');

    let initialDarkMode = false;
    if (globalTheme) {
      initialDarkMode = (globalTheme === 'dark');
    } else if (directDark !== null) {
      initialDarkMode = (directDark === 'true');
    }

    let initialCurrency = globalCurrency || 'INR';

    // Seed legacyIncome from user-scoped cached legacy key
    const cachedLegacy = parseFloat(localStorage.getItem('ledgio_legacy_income_' + uid));
    if (!isNaN(cachedLegacy) && cachedLegacy > 0) {
      legacyIncome = cachedLegacy;
    }

    // Reset epoch check: stale-epoch data must NOT paint; adopt reset (empty) state
    if (hasPendingReset) {
      legacyIncome = 0;
      try { localStorage.removeItem(getIncomeEntriesStorageKey()); } catch (e) {}
      try { localStorage.removeItem(getCategoriesCacheKey()); } catch (e) {}
      try { localStorage.removeItem('ledgio_legacy_income_' + uid); } catch (e) {}
      state = createInitialState({
        resetEpoch: localEpoch,
        income_entries: [],
        customCategories: [],
        hiddenBuiltins: [],
        settings: {
          currency: initialCurrency,
          darkMode: initialDarkMode
        }
      });
    } else if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const parsedEpoch = typeof parsed.resetEpoch === 'number' ? parsed.resetEpoch : 0;
        if (parsedEpoch < localEpoch) {
          // Stale epoch data! Stale data must NOT paint; adopt empty reset state per epoch rules
          legacyIncome = 0;
          try { localStorage.removeItem(getIncomeEntriesStorageKey()); } catch (e) {}
          try { localStorage.removeItem(getCategoriesCacheKey()); } catch (e) {}
          try { localStorage.removeItem('ledgio_legacy_income_' + uid); } catch (e) {}
          state = createInitialState({
            resetEpoch: localEpoch,
            income_entries: [],
            customCategories: [],
            hiddenBuiltins: [],
            settings: {
              currency: initialCurrency,
              darkMode: initialDarkMode
            }
          });
        } else {
          if (typeof parsed.income === 'number' && !isNaN(parsed.income) && parsed.income > 0) {
            legacyIncome = parsed.income;
            try { localStorage.setItem('ledgio_legacy_income_' + uid, String(parsed.income)); } catch (e) {}
          }
          if (parsed.resetEpoch === undefined) {
            parsed.resetEpoch = localEpoch;
          }
          state = createInitialState(parsed);
        }
      } catch (e) {
        console.error('Error parsing local state', e);
        state = createInitialState({ resetEpoch: localEpoch });
      }
    } else {
      state = createInitialState({
        resetEpoch: localEpoch,
        settings: { 
          currency: initialCurrency, 
          darkMode: initialDarkMode 
        }
      });
    }

    // Remove legacy un-scoped data key to avoid data bleed between accounts
    try {
      localStorage.removeItem('smartBudgetData');
    } catch (e) {}
  }

  // Full asynchronous data load (backward compatible)
  async function loadData() {
    loadLocalState();
    if (supabase && currentUser && navigator.onLine) {
      try {
        updateAdminUI();
        await processCloudResetTombstone();
        await processSyncQueue();
        await pullRemoteChanges();
      } catch (err) {
        console.warn('Cloud sync error during loadData:', err);
      }
    }

    saveData();
    applyDarkMode();
    refreshUI();
    updateSyncStatusUI();
    updateAdminUI();
  }

  function saveData(broadcast = true) {
    const key = getStorageKey();
    const uid = getUserId();
    try {
      const clone = { ...state };
      delete clone.income;
      delete clone.income_entries;
      delete clone._incomeOverride;
      clone.resetEpoch = getResetEpoch(uid);
      localStorage.setItem(key, JSON.stringify(clone));
    } catch (err) {
      console.error('Failed saving local state to localStorage:', err);
      if (isQuotaExceededError(err)) {
        showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
    saveIncomeEntries();
    saveCategoriesCache();
    if (legacyIncome > 0) {
      try {
        localStorage.setItem('ledgio_legacy_income_' + uid, String(legacyIncome));
      } catch (e) {}
    }
    const isDark = Boolean(state.settings?.darkMode);
    try {
      localStorage.setItem('sb_dark_mode_' + uid, isDark ? 'true' : 'false');
      localStorage.setItem('ledgio_theme', isDark ? 'dark' : 'light');
      if (state.settings?.currency) {
        localStorage.setItem('ledgio_currency', state.settings.currency);
      }
    } catch (e) {
      console.warn('Failed saving preferences to localStorage:', e);
      if (isQuotaExceededError(e)) {
        showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
    if (broadcast) {
      broadcastSyncEvent('STATE_UPDATED', {
        state,
        userId: uid
      });
    }
  }

  // Phase 3 Sync Diagnostics Hub Modal Controllers
  function formatRelativeSyncTime(isoString) {
    if (!isoString) return 'Never';
    const ms = Date.now() - new Date(isoString).getTime();
    if (isNaN(ms) || ms < 0) return 'Just now';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(isoString).toLocaleDateString();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function openSyncDiagnosticsModal() {
    closeEditProfileModal();
    const modal = document.getElementById('sync-diagnostics-modal');
    if (!modal) return;

    // Show modal immediately so it is guaranteed to open even if inner rendering encounters an issue
    modal.style.display = 'flex';
    isAdmin = computeIsAdmin();

    try {
      const netStatusEl = document.getElementById('diag-network-status');
      const cloudStatusEl = document.getElementById('diag-cloud-status');
      const lastSyncEl = document.getElementById('diag-last-sync-time');
      const queueCountEl = document.getElementById('diag-queue-count');
      const queueBreakdownEl = document.getElementById('sync-queue-breakdown');
      const queueListEl = document.getElementById('queue-items-list');
      const dlBreakdownEl = document.getElementById('sync-deadletter-breakdown');
      const dlListEl = document.getElementById('deadletter-items-list');

      const isOnline = navigator.onLine;
      const isCloudConnected = Boolean(supabase && currentUser);
      const queue = getSyncQueue();
      const deadLetter = getDeadLetterQueue();
      const lastSync = localStorage.getItem(getLastSyncKey());

      // Temporary Console Diagnostics per user request
      console.info('🛰️ [Sync Diagnostics Modal Opened]', {
        userId: getUserId(),
        queueLength: queue.length,
        deadLetterCount: deadLetter.length,
        deadLetterItems: deadLetter,
        syncQueueKey: getSyncQueueKey(),
        deadLetterKey: getDeadLetterKey()
      });

      const modalTitleEl = document.getElementById('sync-modal-title');
      const modalSubEl = document.getElementById('sync-modal-subtitle');
      if (!isAdmin) {
        if (modalTitleEl) modalTitleEl.textContent = 'Backup Needs Attention';
        if (modalSubEl) modalSubEl.textContent = 'Your data is safe on this device — some items are waiting to reach the cloud';
      } else {
        if (modalTitleEl) modalTitleEl.textContent = 'Cloud Sync & Storage Health';
        if (modalSubEl) modalSubEl.textContent = 'Real-time synchronization status with encrypted cloud';
      }

      if (netStatusEl) {
        netStatusEl.innerHTML = isOnline
          ? `<i class="fas fa-wifi" style="color:#10b981;"></i> Online`
          : `<i class="fas fa-plane" style="color:#f43f5e;"></i> Offline`;
      }

      if (cloudStatusEl) {
        cloudStatusEl.innerHTML = isCloudConnected
          ? `<i class="fas fa-cloud-check" style="color:#10b981;"></i> Connected`
          : `<i class="fas fa-hard-drive" style="color:#f59e0b;"></i> Local Only`;
      }

      if (lastSyncEl) {
        lastSyncEl.textContent = formatRelativeSyncTime(lastSync);
      }

      if (queueCountEl) {
        queueCountEl.textContent = `${queue.length} pending`;
      }

      // Pending Queue Rendering (Defensive)
      if (queueBreakdownEl && queueListEl) {
        if (queue.length > 0) {
          queueBreakdownEl.style.display = 'block';
          queueListEl.innerHTML = queue.map((m, idx) => {
            if (!m || typeof m !== 'object') return '';
            const action = m.action || 'MUTATION';
            const actionClass = String(action).toLowerCase();
            const table = m.table || 'record';
            let target = '';
            if (m.data && typeof m.data === 'object') {
              target = m.data.name || m.data.category || (m.data.id ? `ID: ${String(m.data.id).substring(0, 8)}...` : '');
            }
            if (!target) target = table;
            const time = formatRelativeSyncTime(m.timestamp);
            return `
              <div class="queue-item-row">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="queue-item-badge ${escapeHtml(actionClass)}">${escapeHtml(action)}</span>
                  <span><strong>${escapeHtml(table)}</strong>: ${escapeHtml(target)}</span>
                </div>
                <span style="font-size:0.7rem;color:var(--color-text-muted);">${escapeHtml(time)}</span>
              </div>
            `;
          }).join('');
        } else {
          queueBreakdownEl.style.display = 'none';
          queueListEl.innerHTML = '';
        }
      }

      // Dead Letter Rendering with Defensive Access & Error Recovery
      if (dlBreakdownEl && dlListEl) {
        if (deadLetter.length > 0) {
          dlBreakdownEl.style.display = 'block';
          dlListEl.innerHTML = deadLetter.map((m, idx) => {
            if (!m || typeof m !== 'object') {
              if (!isAdmin) {
                return `
                  <div class="deadletter-item-row">
                    <div class="deadletter-item-top">
                      <span>📌 Unreadable item — saved on device, backup pending</span>
                      <div class="deadletter-actions-group">
                        <button class="btn-mini discard" data-dl-action="discard" data-idx="${idx}">Discard</button>
                      </div>
                    </div>
                  </div>
                `;
              }
              return `
                <div class="deadletter-item-row">
                  <div class="deadletter-item-top">
                    <span><strong>Corrupted Item #${idx + 1}</strong></span>
                    <div class="deadletter-actions-group">
                      <button class="btn-mini discard" data-dl-action="discard" data-idx="${idx}">Discard</button>
                    </div>
                  </div>
                  <div class="deadletter-error-text">Item structure unreadable</div>
                </div>
              `;
            }

            const itemId = m.id || `dl_${idx}`;
            const action = m.action || 'MUTATION';
            const table = m.table || 'record';

            let targetLabel = '';
            if (m.data && typeof m.data === 'object') {
              targetLabel = m.data.name || m.data.category || m.data.note || (m.data.id ? `ID: ${String(m.data.id).substring(0, 8)}...` : '');
            }
            if (!targetLabel) targetLabel = table;

            let errText = 'Sync failed after 5 attempts';
            if (m.lastError) {
              if (typeof m.lastError === 'string') {
                errText = m.lastError;
              } else if (typeof m.lastError === 'object') {
                errText = m.lastError.message || m.lastError.details || JSON.stringify(m.lastError);
              }
            }

            const timeLabel = formatRelativeSyncTime(m.failedAt || m.timestamp);

            if (!isAdmin) {
              let itemName = 'Item';
              let amountText = '';
              if (m.data && typeof m.data === 'object') {
                if (table === 'income_entries' || m.table === 'income_entries') {
                  itemName = (m.data.note && String(m.data.note).trim()) ? String(m.data.note).trim() : 'Income entry';
                  if (m.data.amount !== undefined && m.data.amount !== null && !isNaN(Number(m.data.amount))) {
                    const rawAmt = Number(m.data.amount);
                    const sign = rawAmt >= 0 ? '+' : '−';
                    amountText = ` (${sign}${formatCurrency(Math.abs(rawAmt), true)})`;
                  }
                } else if (table === 'loan_settlements' || m.table === 'loan_settlements') {
                  const linkedLoan = (state?.loans || []).find(l => l.id === m.data.loan_id);
                  const person = linkedLoan ? linkedLoan.person_name : (m.data.person_name || '');
                  const note = (m.data.note && String(m.data.note).trim()) ? String(m.data.note).trim() : '';
                  if (person && note) {
                    itemName = `Settlement — ${person} (${note})`;
                  } else if (person) {
                    itemName = `Settlement — ${person}`;
                  } else if (note) {
                    itemName = `Settlement (${note})`;
                  } else {
                    itemName = 'Loan settlement';
                  }
                  if (m.data.amount !== undefined && m.data.amount !== null && !isNaN(Number(m.data.amount))) {
                    amountText = ` (${formatCurrency(Math.abs(Number(m.data.amount)), true)})`;
                  }
                } else if (table === 'loans' || m.table === 'loans') {
                  const person = (m.data.person_name && String(m.data.person_name).trim()) ? String(m.data.person_name).trim() : '';
                  const dir = m.data.direction === 'borrowed' ? 'Borrowed from' : 'Lent to';
                  itemName = person ? `${dir} ${person}` : 'Loan record';
                  if (m.data.principal !== undefined && m.data.principal !== null && !isNaN(Number(m.data.principal))) {
                    amountText = ` (${formatCurrency(Math.abs(Number(m.data.principal)), true)})`;
                  }
                } else {
                  itemName = m.data.name || m.data.description || m.data.category || m.data.person_name || 'Item';
                  if (m.data.amount !== undefined && m.data.amount !== null && !isNaN(Number(m.data.amount))) {
                    amountText = ` (${formatCurrency(Math.abs(Number(m.data.amount)), true)})`;
                  }
                }
              }
              return `
                <div class="deadletter-item-row" data-dl-id="${escapeHtml(itemId)}">
                  <div class="deadletter-item-top">
                    <span>📌 ${escapeHtml(itemName)}${escapeHtml(amountText)} — saved on device, backup pending</span>
                    <div class="deadletter-actions-group">
                      <button class="btn-mini retry" data-dl-action="retry" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Retry backup">Retry</button>
                      <button class="btn-mini discard" data-dl-action="discard" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Discard backup">Discard</button>
                    </div>
                  </div>
                </div>
              `;
            }

            return `
              <div class="deadletter-item-row" data-dl-id="${escapeHtml(itemId)}">
                <div class="deadletter-item-top">
                  <span><strong>${escapeHtml(action)} ${escapeHtml(table)}</strong> (${escapeHtml(targetLabel)})</span>
                  <div class="deadletter-actions-group">
                    <button class="btn-mini retry" data-dl-action="retry" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Retry sync">Retry</button>
                    <button class="btn-mini discard" data-dl-action="discard" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Discard mutation">Discard</button>
                  </div>
                </div>
                <div style="font-size: 0.675rem; color: var(--color-text-muted); margin-top: 2px;">Failed ${escapeHtml(timeLabel)} • ${m.retries || 5} retries exhausted</div>
                <details style="margin-top: 4px;">
                  <summary style="cursor: pointer; font-size: 0.75rem; color: var(--color-primary); font-weight: 500;">Technical details</summary>
                  <div class="deadletter-error-text" style="margin-top: 4px; font-family: monospace; font-size: 0.72rem;">${escapeHtml(errText)}</div>
                </details>
              </div>
            `;
          }).join('');
        } else {
          dlBreakdownEl.style.display = 'none';
          dlListEl.innerHTML = '';
        }
      }
    } catch (renderErr) {
      console.error('Error rendering Sync Diagnostics Modal contents:', renderErr);
    }
  }

  function closeSyncDiagnosticsModal() {
    const modal = document.getElementById('sync-diagnostics-modal');
    if (modal) modal.style.display = 'none';
  }

  // Profile Chip Dropdown Menu & Edit Profile Controllers
  function updateUserDisplayNames(username) {
    if (!username) return;
    const firstName = username.trim().split(/\s+/)[0];
    const subtitle = document.getElementById('header-subtitle');
    if (subtitle) {
      const nameSpan = document.getElementById('header-subtitle-name');
      if (nameSpan) {
        nameSpan.textContent = `${firstName}!`;
      } else {
        subtitle.innerHTML = `<span class="greeting-prefix">Welcome back, </span><span id="header-subtitle-name">${escapeHtml(firstName)}!</span>`;
      }
    }
    document.querySelectorAll('.user-name-text').forEach(el => {
      el.textContent = username;
    });
    const dropdownNameText = document.getElementById('dropdown-user-name-text');
    if (dropdownNameText) {
      dropdownNameText.textContent = username;
    } else {
      const dropdownName = document.getElementById('dropdown-user-name');
      if (dropdownName) {
        dropdownName.textContent = username;
      }
    }
    updateAdminUI();

    const parts = username.trim().split(/\s+/);
    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    document.querySelectorAll('.user-avatar').forEach(el => {
      el.textContent = initials || 'LU';
    });
  }

  function getEffectiveUserName() {
    const storedName = localStorage.getItem('sb_username') || localStorage.getItem('sb_user_name');
    const userMeta = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name;
    const emailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : '';
    return storedName || userMeta || (emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : 'Ledgio User');
  }

  function updateUserProfileDropdownContent() {
    const dropdown = document.getElementById('user-profile-dropdown');
    if (!dropdown) return;

    const username = getEffectiveUserName();
    const email = (hasLiveSession() && currentUser?.email) ? currentUser.email : 'Local Profile';

    const nameTextEl = document.getElementById('dropdown-user-name-text');
    if (nameTextEl) {
      nameTextEl.textContent = username;
    } else {
      const nameEl = document.getElementById('dropdown-user-name');
      if (nameEl) nameEl.textContent = username;
    }
    updateAdminUI();

    const emailEl = document.getElementById('dropdown-user-email');
    if (emailEl) emailEl.textContent = email;

    const parts = username.trim().split(/\s+/);
    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    const avatarEl = document.getElementById('dropdown-user-avatar');
    if (avatarEl) avatarEl.textContent = initials || 'LU';

    // Update compact Sync state row via authoritative updater
    updateSyncStatusUI();

    // Update compact Vault state row
    const vaultIcon = document.getElementById('dropdown-vault-icon');
    const vaultText = document.getElementById('dropdown-vault-text');
    const isVaultProtected = Boolean(vaultConfig && vaultConfig.pinEnabled && vaultConfig.pinHash);

    if (vaultIcon && vaultText) {
      if (isVaultProtected) {
        vaultIcon.className = 'fas fa-shield-halved';
        vaultIcon.style.color = '#10b981';
        vaultText.textContent = '🔒 PIN Protected';
      } else {
        vaultIcon.className = 'fas fa-unlock';
        vaultIcon.style.color = '#f59e0b';
        vaultText.textContent = '🔓 No PIN Set';
      }
    }
  }

  function toggleUserProfileDropdown(open = null) {
    const dropdown = document.getElementById('user-profile-dropdown');
    const chipBtn = document.getElementById('user-profile-btn');
    if (!dropdown || !chipBtn) return;

    const isOpen = open !== null ? open : !dropdown.classList.contains('open');
    if (isOpen) {
      updateUserProfileDropdownContent();
      dropdown.classList.add('open');
      chipBtn.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.classList.remove('open');
      chipBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function openEditProfileModal() {
    closeSyncDiagnosticsModal();
    const modal = document.getElementById('edit-profile-modal');
    const nameInput = document.getElementById('edit-profile-name-input');
    const emailInput = document.getElementById('edit-profile-email-input');
    if (!modal) return;

    const currentName = getEffectiveUserName();
    const currentEmail = currentUser?.email || 'Local Account (Offline)';

    if (nameInput) nameInput.value = currentName;
    if (emailInput) emailInput.value = currentEmail;

    modal.style.display = 'flex';
    setTimeout(() => nameInput?.focus(), 50);
  }

  function closeEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveProfileEdit() {
    const nameInput = document.getElementById('edit-profile-name-input');
    const newName = nameInput ? nameInput.value.trim() : '';
    if (!newName) {
      showToast('Please enter a valid display name', 'error');
      return;
    }

    localStorage.setItem('sb_username', newName);
    localStorage.setItem('sb_user_name', newName);
    updateUserDisplayNames(newName);

    const uid = currentUser?.id || getUserId();
    if (uid && uid !== 'default_user') {
      enqueueMutation('profiles', 'UPSERT', {
        id: uid,
        full_name: newName,
        updated_at: new Date().toISOString()
      });
    }

    if (currentUser) {
      try {
        await supabase.auth.updateUser({
          data: { full_name: newName }
        });
      } catch (e) {
        console.warn('Could not update auth user metadata:', e);
      }
    }

    saveData();
    closeEditProfileModal();
    loadAccountSecurityInfo();
    showToast('Profile updated successfully', 'success');
  }

  // Account & Security Management Controller
  async function loadAccountSecurityInfo() {
    const emailEl = document.getElementById('account-current-email');
    const usernameEl = document.getElementById('account-current-username');
    const authBadgeEl = document.getElementById('account-auth-badge');
    if (!emailEl && !usernameEl) return;

    let sessionUser = currentUser;
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          sessionUser = session.user;
          currentUser = session.user;
          updateAdminUI();
        }
      } catch (err) {
        console.warn('[Account & Security] Error fetching session:', err);
      }
    }
    updateAdminUI();

    if (sessionUser && sessionUser.email) {
      if (emailEl) emailEl.textContent = sessionUser.email;
      
      const metaName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;
      const emailPrefix = sessionUser.email.split('@')[0];
      const displayName = metaName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      if (usernameEl) usernameEl.textContent = displayName;

      if (authBadgeEl) {
        authBadgeEl.innerHTML = '<i class="fas fa-circle-check"></i> Authenticated';
        authBadgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
        authBadgeEl.style.color = '#10b981';
        authBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      }
    } else {
      const storedName = localStorage.getItem('sb_username') || localStorage.getItem('sb_user_name') || 'Local User';
      if (emailEl) emailEl.textContent = 'Local Account (Not linked to Supabase)';
      if (usernameEl) usernameEl.textContent = storedName;
      if (authBadgeEl) {
        authBadgeEl.innerHTML = '<i class="fas fa-circle-exclamation"></i> Local Storage Only';
        authBadgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
        authBadgeEl.style.color = '#f59e0b';
        authBadgeEl.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }
    }
  }

  async function handleAccountEmailChange() {
    const input = document.getElementById('new-email-input');
    const feedback = document.getElementById('change-email-feedback');
    const submitBtn = document.getElementById('btn-update-account-email');
    if (!input || !feedback) return;

    feedback.style.display = 'none';
    feedback.className = 'account-feedback-msg';
    feedback.innerHTML = '';

    const newEmail = input.value.trim().toLowerCase();

    // Online-only check: never queue auth ops in sync queue
    if (!navigator.onLine) {
      showToast('Email changes need an internet connection', 'warning');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-wifi-slash"></i> Email changes need an internet connection. Please reconnect and try again.';
      feedback.style.display = 'flex';
      return;
    }

    if (!supabase) {
      showToast('Authentication service is not configured', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Authentication service is not configured.';
      feedback.style.display = 'flex';
      return;
    }

    // Client Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail || !emailRegex.test(newEmail)) {
      showToast('Please enter a valid email address', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> Please enter a valid email address.';
      feedback.style.display = 'flex';
      return;
    }

    const currentEmail = currentUser?.email?.toLowerCase();
    if (currentEmail && newEmail === currentEmail) {
      showToast('New email must be different from current email', 'warning');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> New email address is the same as your current email.';
      feedback.style.display = 'flex';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    }

    try {
      const { data, error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      feedback.className = 'account-feedback-msg success';
      feedback.innerHTML = `<i class="fas fa-paper-plane"></i> Confirmation link sent to <strong>${escapeHtml(newEmail)}</strong> — check your inbox to confirm. The change applies after confirmation.`;
      feedback.style.display = 'flex';
      input.value = '';
      showToast('Confirmation link sent. Check your inbox to confirm.', 'info');
    } catch (err) {
      console.warn('[Account & Security] Email change failed:', err);
      const errMsg = err?.message || 'Failed to update email address. Please try again.';
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(errMsg)}`;
      feedback.style.display = 'flex';
      showToast(errMsg, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Update Email';
      }
    }
  }

  async function handleAccountPasswordChange() {
    const currentPwInput = document.getElementById('current-password-input');
    const newPwInput = document.getElementById('new-password-input');
    const confirmPwInput = document.getElementById('confirm-password-input');
    const feedback = document.getElementById('change-password-feedback');
    const submitBtn = document.getElementById('btn-update-account-password');

    if (!currentPwInput || !newPwInput || !confirmPwInput || !feedback) return;

    feedback.style.display = 'none';
    feedback.className = 'account-feedback-msg';
    feedback.innerHTML = '';

    // Online-only gate: never queue auth ops in sync queue
    if (!navigator.onLine) {
      showToast('Password changes need an internet connection', 'warning');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-wifi-slash"></i> Password changes need an internet connection. Please reconnect and try again.';
      feedback.style.display = 'flex';
      return;
    }

    if (!supabase) {
      showToast('Authentication service is not configured', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Authentication service is not configured.';
      feedback.style.display = 'flex';
      return;
    }

    const currentPassword = currentPwInput.value;
    const newPassword = newPwInput.value;
    const confirmPassword = confirmPwInput.value;

    if (!currentPassword) {
      showToast('Please enter your current password', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> Please enter your current password.';
      feedback.style.display = 'flex';
      currentPwInput.focus();
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      showToast('New password must be at least 8 characters long', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> New password must be at least 8 characters long.';
      feedback.style.display = 'flex';
      newPwInput.focus();
      return;
    }

    if (newPassword === currentPassword) {
      showToast('New password must be different from current password', 'warning');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> New password must be different from your current password.';
      feedback.style.display = 'flex';
      newPwInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> New passwords do not match.';
      feedback.style.display = 'flex';
      confirmPwInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    }

    try {
      // Step 1: Re-authenticate current credentials to verify ownership
      const userEmail = currentUser?.email;
      if (userEmail) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword
        });

        if (verifyErr) {
          feedback.className = 'account-feedback-msg error';
          feedback.innerHTML = '<i class="fas fa-circle-exclamation"></i> Current password is incorrect. Please try again.';
          feedback.style.display = 'flex';
          showToast('Current password is incorrect', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-shield-check"></i> Update Password';
          }
          return;
        }
      }

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
      }

      // Step 2: Update password via Supabase Auth
      const { data, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) throw updateErr;

      feedback.className = 'account-feedback-msg success';
      feedback.innerHTML = '<i class="fas fa-circle-check"></i> Password updated successfully. Your session is active.';
      feedback.style.display = 'flex';
      
      currentPwInput.value = '';
      newPwInput.value = '';
      confirmPwInput.value = '';

      showToast('Password updated', 'success');
    } catch (err) {
      console.warn('[Account & Security] Password update error:', err);
      const msg = err?.message || 'Failed to update password. Please try again.';
      feedback.className = 'account-feedback-msg error';
      feedback.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(msg)}`;
      feedback.style.display = 'flex';
      showToast(msg, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-shield-check"></i> Update Password';
      }
    }
  }

  // Utilities
  function generateId() {
    return crypto.randomUUID();
  }

  function formatCurrency(value, bypassStealth = false) {
    if (isStealthModeActive && !bypassStealth) {
      return '••••••';
    }
    const curr = state.settings?.currency || 'INR';
    return formatSampleCurrency(value, curr);
  }

  // =========================================================================
  // Dynamic Currency Conversion & Live Exchange Rate Engine
  // =========================================================================
  const DEFAULT_CURRENCY = 'INR';

  // Accurate Bundled Baseline Rates relative to INR (1 INR = X Foreign Currency)
  const EXCHANGE_RATES_BASE_INR = {
    INR: 1.0,
    USD: 0.01053,     // 1 USD ≈ 95.00 INR (live baseline fallback)
    EUR: 0.00909,     // 1 EUR ≈ 110.00 INR
    GBP: 0.00782,     // 1 GBP ≈ 127.80 INR
    AED: 0.03867,     // 1 AED ≈ 25.86 INR
    SGD: 0.01375,     // 1 SGD ≈ 72.70 INR
    CAD: 0.01462,     // 1 CAD ≈ 68.40 INR
    AUD: 0.01594,     // 1 AUD ≈ 62.70 INR
    JPY: 1.6320,      // 1 JPY ≈ 0.61 INR
    SAR: 0.03951,     // 1 SAR ≈ 25.31 INR
    BDT: 1.2850,      // 1 BDT ≈ 0.78 INR
    NPR: 1.6000       // 1 NPR ≈ 0.625 INR
  };

  let activeExchangeRates = Object.assign({}, EXCHANGE_RATES_BASE_INR);
  let ratesCache = {
    rates: Object.assign({}, EXCHANGE_RATES_BASE_INR),
    timestamp: 0,
    source: 'bundled'
  };

  // Load cached rates from localStorage
  try {
    const rawCache = localStorage.getItem('ledgio_exchange_rates_cache');
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (parsed && parsed.rates && typeof parsed.rates === 'object' && parsed.rates.USD) {
        ratesCache = {
          rates: Object.assign({}, EXCHANGE_RATES_BASE_INR, parsed.rates),
          timestamp: Number(parsed.timestamp) || 0,
          source: parsed.source || 'cached'
        };
        activeExchangeRates = Object.assign({}, ratesCache.rates);
      }
    }
  } catch (e) {}

  function updateRatesFreshnessUI() {
    const freshnessText = document.getElementById('rates-freshness-text');
    if (!freshnessText) return;

    const isOnline = navigator.onLine;
    const ts = ratesCache.timestamp;

    if (ts && ts > 0) {
      const dateObj = new Date(ts);
      const dateFormatted = dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      if (isOnline) {
        freshnessText.textContent = `Rates updated: ${dateFormatted}`;
      } else {
        freshnessText.textContent = `Offline — using saved rates from ${dateFormatted}`;
      }
    } else {
      if (isOnline) {
        freshnessText.textContent = 'Using bundled baseline rates';
      } else {
        freshnessText.textContent = 'Offline — using bundled baseline rates';
      }
    }
  }

  async function fetchLiveExchangeRates(force = false) {
    const now = Date.now();
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    // Check if cache is still valid and not forcing
    if (!force && ratesCache.timestamp && (now - ratesCache.timestamp < TWELVE_HOURS)) {
      updateRatesFreshnessUI();
      return;
    }

    if (!navigator.onLine) {
      updateRatesFreshnessUI();
      return;
    }

    let freshRates = null;
    let sourceName = '';

    // 1. Primary Endpoint: open.er-api.com
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://open.er-api.com/v6/latest/INR', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && typeof data.rates === 'object') {
          freshRates = {};
          Object.keys(EXCHANGE_RATES_BASE_INR).forEach(cur => {
            if (typeof data.rates[cur] === 'number') {
              freshRates[cur] = data.rates[cur];
            }
          });
          sourceName = 'open.er-api.com';
        }
      }
    } catch (err) {
      console.warn('[Ledgio Currency] Primary endpoint failed, attempting secondary fallback...', err);
    }

    // 2. Secondary Fallback Endpoint: jsdelivr Fawaz Ahmed currency API
    if (!freshRates || !freshRates.USD) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.inr && typeof data.inr === 'object') {
            freshRates = {};
            Object.keys(EXCHANGE_RATES_BASE_INR).forEach(cur => {
              const lower = cur.toLowerCase();
              if (typeof data.inr[lower] === 'number') {
                freshRates[cur] = data.inr[lower];
              }
            });
            sourceName = 'jsdelivr-currency-api';
          }
        }
      } catch (err) {
        console.warn('[Ledgio Currency] Secondary fallback endpoint failed:', err);
      }
    }

    // 3. Process and Cache Rates
    if (freshRates && freshRates.USD) {
      freshRates.INR = 1.0;
      activeExchangeRates = Object.assign({}, EXCHANGE_RATES_BASE_INR, freshRates);
      ratesCache = {
        rates: freshRates,
        timestamp: Date.now(),
        source: sourceName
      };
      try {
        localStorage.setItem('ledgio_exchange_rates_cache', JSON.stringify(ratesCache));
      } catch (e) {}

      // Sanity-check: convert ₹86,500 -> USD with live rate and log to console
      const sanityUsd = convertAmount(86500, 'INR', 'USD');
      const usdRate = getExchangeRate('INR', 'USD');
      console.log(`[Ledgio Currency] Live rates synchronized (${sourceName}). Sanity check: ₹86,500 = $${sanityUsd} (Rate: 1 INR = ${usdRate} USD)`);
    } else {
      console.log('[Ledgio Currency] Retaining current cached/bundled rates.');
    }

    updateRatesFreshnessUI();
  }

  function getExchangeRate(fromCur, toCur) {
    const fromRate = activeExchangeRates[fromCur] || EXCHANGE_RATES_BASE_INR[fromCur] || 1;
    const toRate = activeExchangeRates[toCur] || EXCHANGE_RATES_BASE_INR[toCur] || 1;
    return toRate / fromRate;
  }

  function convertAmount(amount, fromCur, toCur) {
    if (fromCur === toCur) return Number(amount) || 0;
    const rate = getExchangeRate(fromCur, toCur);
    const converted = Number(amount) * rate;
    if (toCur === 'JPY') {
      return Math.round(converted);
    }
    return Math.round(converted * 100) / 100;
  }

  let pendingCurrencyChange = null;

  function hasExistingLedgerData() {
    const hasIncome = Boolean(state.income && state.income > 0);
    const hasExpenses = Boolean(state.expenses && state.expenses.length > 0);
    const hasBudgets = Boolean(state.budgets && Object.keys(state.budgets).some(k => state.budgets[k] > 0));
    return hasIncome || hasExpenses || hasBudgets;
  }

  function formatSampleCurrency(value, currency) {
    const cur = currency || 'INR';
    const symbol = CURRENCY_SYMBOLS[cur] || `${cur} `;
    const num = Number(value) || 0;
    const isNegative = num < 0;
    const absVal = Math.abs(num);
    const fractionDigits = (cur === 'JPY' ? 0 : 2);
    // Standardize all currencies: '.' decimal separator, symbol prefixed.
    // Use 'en-IN' for Indian Rupee lakh/crore grouping, 'en-US' for standard international 3-digit grouping.
    const groupingLocale = (cur === 'INR' ? 'en-IN' : 'en-US');

    try {
      const numStr = absVal.toLocaleString(groupingLocale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      });
      return `${isNegative ? '-' : ''}${symbol}${numStr}`;
    } catch {
      return `${isNegative ? '-' : ''}${symbol}${absVal.toFixed(fractionDigits)}`;
    }
  }

  async function promptCurrencyChange(newCur, sourceSelect) {
    const oldCur = state.settings?.currency || DEFAULT_CURRENCY;
    if (oldCur === newCur) return;

    // Destructive Action Gate (Amendment 2): Block if sync queue is non-empty
    if (getSyncQueue().length > 0) {
      showToast('Sync pending — convert after your changes are backed up', 'warning');
      if (sourceSelect) sourceSelect.value = oldCur;
      return;
    }

    // Refresh live rates before showing modal so the rate and calculation are 100% current
    if (navigator.onLine) {
      try {
        await fetchLiveExchangeRates(true);
      } catch (e) {}
    }

    if (!hasExistingLedgerData()) {
      executeCurrencyChange(oldCur, newCur, false);
      return;
    }

    pendingCurrencyChange = {
      oldCur,
      newCur,
      sourceSelect
    };

    const modal = document.getElementById('currency-convert-modal');
    if (!modal) {
      executeCurrencyChange(oldCur, newCur, true);
      return;
    }

    const rate = getExchangeRate(oldCur, newCur);
    const rateText = `1 ${oldCur} = ${rate >= 1 ? rate.toFixed(4) : rate.toFixed(6)} ${newCur}`;

    const sampleOld = (state.income && state.income > 0) ? state.income : 50000;
    const sampleNew = convertAmount(sampleOld, oldCur, newCur);

    const oldFormatted = formatSampleCurrency(sampleOld, oldCur);
    const newFormatted = formatSampleCurrency(sampleNew, newCur);

    const subtitleEl = document.getElementById('convert-modal-subtitle');
    const rateEl = document.getElementById('convert-rate-text');
    const oldEl = document.getElementById('convert-example-old');
    const newEl = document.getElementById('convert-example-new');

    if (subtitleEl) subtitleEl.innerHTML = `Switch ledger from <strong>${escapeHtml(oldCur)}</strong> to <strong>${escapeHtml(newCur)}</strong>?`;
    if (rateEl) rateEl.textContent = rateText;
    if (oldEl) oldEl.textContent = oldFormatted;
    if (newEl) newEl.textContent = newFormatted;

    modal.style.display = 'flex';
  }

  async function executeCurrencyChange(oldCur, newCur, shouldConvertValues) {
    if (shouldConvertValues && getSyncQueue().length > 0) {
      showToast('Sync pending — convert after your changes are backed up', 'warning');
      const quickSelect = document.getElementById('quick-currency-select');
      const settingsSelect = document.getElementById('currency-select');
      if (quickSelect) quickSelect.value = oldCur;
      if (settingsSelect) settingsSelect.value = oldCur;
      return;
    }

    const rate = getExchangeRate(oldCur, newCur);
    const rateText = `1 ${oldCur} ≈ ${rate >= 1 ? rate.toFixed(2) : rate.toFixed(4)} ${newCur}`;

    if (shouldConvertValues && oldCur !== newCur) {
      if (state.income_entries && state.income_entries.length > 0) {
        state.income_entries.forEach(e => {
          if (e.amount) {
            e.amount = convertAmount(e.amount, oldCur, newCur);
            e.updated_at = new Date().toISOString();
          }
        });
        saveIncomeEntries();
      } else if (legacyIncome) {
        legacyIncome = convertAmount(legacyIncome, oldCur, newCur);
      }
      if (state.expenses && state.expenses.length > 0) {
        state.expenses.forEach(exp => {
          if (exp.amount) {
            exp.amount = convertAmount(exp.amount, oldCur, newCur);
          }
        });
      }
      if (state.budgets) {
        Object.keys(state.budgets).forEach(cat => {
          if (state.budgets[cat]) {
            state.budgets[cat] = convertAmount(state.budgets[cat], oldCur, newCur);
          }
        });
      }
    }

    state.settings.currency = newCur;
    try {
      localStorage.setItem('ledgio_currency', newCur);
    } catch (e) {}

    const quickSelect = document.getElementById('quick-currency-select');
    const settingsSelect = document.getElementById('currency-select');
    if (quickSelect) quickSelect.value = newCur;
    if (settingsSelect) settingsSelect.value = newCur;
    updateCurrencyPreview(newCur);

    saveData();

    const uid = currentUser?.id || getUserId();
    if (uid && uid !== 'default_user') {
      enqueueMutation('profiles', 'UPSERT', {
        id: uid,
        currency: newCur,
        updated_at: new Date().toISOString()
      });
    }

    if (shouldConvertValues) {
      if (state.income_entries && state.income_entries.length > 0) {
        state.income_entries.forEach(e => {
          enqueueMutation('income_entries', 'UPSERT', e);
        });
      }
      if (state.expenses && state.expenses.length > 0) {
        state.expenses.forEach(e => {
          enqueueMutation('expenses', 'UPSERT', {
            id: e.id,
            user_id: uid,
            name: e.name,
            amount: e.amount,
            category: e.category,
            date: e.date,
            updated_at: new Date().toISOString()
          });
        });
      }
      if (state.budgets) {
        Object.keys(state.budgets).forEach(cat => {
          enqueueMutation('budgets', 'UPSERT', {
            user_id: uid,
            category: cat,
            monthly_limit: state.budgets[cat],
            updated_at: new Date().toISOString()
          });
        });
      }
    }

    refreshUI();

    const toastMsg = shouldConvertValues
      ? `Converted ledger to ${newCur} (${rateText})`
      : `Currency changed to ${newCur}`;
    showToast(toastMsg, 'success');

    const modal = document.getElementById('currency-convert-modal');
    if (modal) modal.style.display = 'none';
    pendingCurrencyChange = null;
  }

  // UI Utilities
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'fas fa-check-circle text-success' : 
                     type === 'error' ? 'fas fa-exclamation-circle text-danger' : 
                     'fas fa-info-circle text-primary';
    
    const text = document.createElement('span');
    text.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showConfirm(message) {
    if (isDevOrTest && typeof window.showConfirm === 'function' && window.showConfirm !== showConfirm) {
      return window.showConfirm(message);
    }
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const msgEl = document.getElementById('confirm-message');
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');
      
      if (!modal) {
        resolve(confirm(message));
        return;
      }
      
      if (msgEl) msgEl.textContent = message;
      modal.style.display = 'flex';
      
      const cleanUp = () => {
        modal.style.display = 'none';
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
      };
      
      const onYes = () => { cleanUp(); resolve(true); };
      const onNo = () => { cleanUp(); resolve(false); };
      
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }
  window.showConfirm = showConfirm;

  function openEditModal(expenseId) {
    return window.LedgioExpenses ? window.LedgioExpenses.openEditModal(expenseId) : null;
  }

  // Calculation & Summaries
  function updateSummary() {
    const totalExpenses = (state.expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const totalInc = totalIncome();
    const remaining = totalInc - totalExpenses;
    const savingsRate = totalInc > 0 ? ((remaining / totalInc) * 100).toFixed(1) : 0;
    
    const remainingEl = document.getElementById('summary-remaining');
    const savingsEl = document.getElementById('summary-savings-rate');
    
    const expThisMonth = expensesThisMonth();
    const incThisMonth = incomeThisMonth();

    // -----------------------------------------------------------------
    // 1. Income Card (Tap-to-Toggle: % of income spent ↔ ₹ this month)
    // -----------------------------------------------------------------
    const incomeCard = document.getElementById('summary-income-card');
    const incomeEl = document.getElementById('summary-income');
    const lifetimeEl = document.getElementById('summary-income-lifetime');

    let incomeSpentPct = 0;
    if (incThisMonth > 0) {
      incomeSpentPct = Math.round((expThisMonth / incThisMonth) * 100);
    } else if (expThisMonth > 0) {
      incomeSpentPct = 100;
    }

    let incColorVar = 'var(--color-success, #10b981)';
    if (incomeSpentPct > 75 || remaining < 0) {
      incColorVar = 'var(--color-danger, #f43f5e)';
    } else if (incomeSpentPct >= 50) {
      incColorVar = 'var(--color-warning, #f59e0b)';
    }

    const incomeMode = summaryCardModes.income || 'number';

    if (incomeEl) {
      if (incomeMode === 'percent') {
        if (isStealthModeActive) {
          incomeEl.innerHTML = `<span class="stealth-masked" style="color: ${incColorVar}; font-weight: 700;">••% spent</span>`;
          incomeEl.classList.add('stealth-masked');
        } else {
          incomeEl.innerHTML = `<span style="color: ${incColorVar}; font-weight: 700;">${incomeSpentPct}% spent</span>`;
          incomeEl.classList.remove('stealth-masked');
        }
      } else {
        incomeEl.style.color = '';
        if (isStealthModeActive) {
          incomeEl.textContent = '••••••';
          incomeEl.classList.add('stealth-masked');
        } else {
          incomeEl.textContent = formatCurrency(incThisMonth);
          incomeEl.classList.remove('stealth-masked');
        }
      }
    }

    if (lifetimeEl) {
      if (incomeMode === 'percent') {
        if (isStealthModeActive) {
          lifetimeEl.innerHTML = `This month: <span class="stealth-masked">••••••</span> · Lifetime: <span class="stealth-masked">••••••</span>`;
          lifetimeEl.classList.add('stealth-masked');
        } else {
          lifetimeEl.textContent = `This month: ${formatCurrency(incThisMonth)} · Lifetime: ${formatCurrency(totalInc)}`;
          lifetimeEl.classList.remove('stealth-masked');
        }
      } else {
        if (isStealthModeActive) {
          lifetimeEl.innerHTML = `Lifetime: <span class="stealth-masked">••••••</span>`;
          lifetimeEl.classList.add('stealth-masked');
        } else {
          lifetimeEl.textContent = `Lifetime: ${formatCurrency(totalInc)}`;
          lifetimeEl.classList.remove('stealth-masked');
        }
      }
    }

    if (incomeCard) {
      incomeCard.setAttribute('aria-label', incomeMode === 'percent'
        ? 'Income, showing percentage. Tap to show amount'
        : 'Income, showing amount. Tap to show percentage'
      );
      incomeCard.setAttribute('title', incomeMode === 'percent'
        ? 'Tap to show amount in rupees'
        : 'Tap to show percentage'
      );
    }

    // -----------------------------------------------------------------
    // 2. Expenses Card (Tap-to-Toggle: % used ↔ ₹ this month spent)
    // -----------------------------------------------------------------
    const expensesCard = document.getElementById('summary-expenses-card');
    const expensesEl = document.getElementById('summary-expenses');
    const spendPctEl = document.getElementById('summary-expenses-spend-percent');

    const spendPct = spendPercent(remaining, totalExpenses);
    const roundedPct = (spendPct === null || isNaN(spendPct)) ? 0 : Math.round(spendPct);

    let expColorVar = 'var(--color-success, #10b981)';
    let expStatusLabel = 'Low';
    if (remaining < 0 || roundedPct > 75) {
      expColorVar = 'var(--color-danger, #f43f5e)';
      expStatusLabel = 'High';
    } else if (roundedPct >= 50) {
      expColorVar = 'var(--color-warning, #f59e0b)';
      expStatusLabel = 'Moderate';
    }

    const expensesMode = summaryCardModes.expenses || 'number';

    if (expensesEl) {
      if (expensesMode === 'percent') {
        if (spendPct === null && remaining <= 0 && totalExpenses <= 0) {
          expensesEl.innerHTML = `<span style="color: var(--color-text-muted);">0%</span>`;
          expensesEl.classList.remove('stealth-masked');
        } else if (isStealthModeActive) {
          expensesEl.innerHTML = `<span class="stealth-masked" style="color: ${expColorVar}; font-weight: 700;">••%</span>`;
          expensesEl.classList.add('stealth-masked');
        } else {
          expensesEl.innerHTML = `<span style="color: ${expColorVar}; font-weight: 700;">${roundedPct}%</span>`;
          expensesEl.classList.remove('stealth-masked');
        }
      } else {
        expensesEl.style.color = '';
        if (isStealthModeActive) {
          expensesEl.textContent = '••••••';
          expensesEl.classList.add('stealth-masked');
        } else {
          expensesEl.textContent = formatCurrency(expThisMonth);
          expensesEl.classList.remove('stealth-masked');
        }
      }
    }

    if (spendPctEl) {
      if (spendPct === null && remaining <= 0 && totalExpenses <= 0) {
        spendPctEl.style.display = 'none';
        spendPctEl.textContent = '';
      } else {
        spendPctEl.style.display = 'block';
        if (expensesMode === 'percent') {
          if (isStealthModeActive) {
            spendPctEl.innerHTML = `Lifetime: <span class="stealth-masked">••••••</span>`;
            spendPctEl.classList.add('stealth-masked');
          } else {
            spendPctEl.textContent = `Lifetime: ${formatCurrency(totalExpenses)}`;
            spendPctEl.classList.remove('stealth-masked');
          }
        } else {
          if (isStealthModeActive) {
            spendPctEl.innerHTML = `Lifetime: <span class="stealth-masked">••••••</span> · <span class="stealth-masked" style="color: ${expColorVar}; font-weight: 600;">••%</span> of available funds used`;
            spendPctEl.classList.add('stealth-masked');
          } else {
            spendPctEl.innerHTML = `Lifetime: ${formatCurrency(totalExpenses)} · <span style="color: ${expColorVar}; font-weight: 600;">${roundedPct}%</span> of available funds used <span style="color: ${expColorVar}; font-weight: 600;">(${expStatusLabel})</span>`;
            spendPctEl.classList.remove('stealth-masked');
          }
        }
      }
    }

    if (expensesCard) {
      expensesCard.setAttribute('aria-label', expensesMode === 'percent'
        ? 'Expenses, showing percentage. Tap to show amount'
        : 'Expenses, showing amount. Tap to show percentage'
      );
      expensesCard.setAttribute('title', expensesMode === 'percent'
        ? 'Tap to show amount in rupees'
        : 'Tap to show percentage'
      );
    }

    if (remainingEl) {
      remainingEl.textContent = formatCurrency(remaining);
      remainingEl.className = remaining >= 0 ? 'text-success' : 'text-danger';
      if (isStealthModeActive) remainingEl.classList.add('stealth-masked');
      else remainingEl.classList.remove('stealth-masked');
    }
    if (savingsEl) {
      savingsEl.textContent = isStealthModeActive ? '••%' : `${savingsRate}%`;
    }
    
    updateIncomePreview();
    updateLeftoverPromptUI(remaining);
    renderIncomeHistory();
    if (!isPhase1Painting) {
      updateDailyNudgeUI();
    }
    updateNetWorthUI();
  }

  // Net Worth Calculation Engine
  function computeNetWorthData() {
    const totalExpenses = (state.expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const availableBalance = (parseFloat(state.income) || 0) - totalExpenses;

    let totalOutstandingLent = 0;
    let totalOutstandingBorrowed = 0;

    (state.loans || []).forEach(loan => {
      const details = getLoanDetails(loan);
      if (loan.direction === 'lent') {
        totalOutstandingLent += details.outstanding;
      } else if (loan.direction === 'borrowed') {
        totalOutstandingBorrowed += details.outstanding;
      }
    });

    const netWorth = availableBalance + totalOutstandingLent - totalOutstandingBorrowed;

    return {
      netWorth,
      availableBalance,
      totalOutstandingLent,
      totalOutstandingBorrowed
    };
  }

  function updateNetWorthUI() {
    const data = computeNetWorthData();
    const cardEl = document.getElementById('net-worth-card');
    const valEl = document.getElementById('net-worth-val');
    const cashEl = document.getElementById('net-worth-cash');
    const lentEl = document.getElementById('net-worth-lent');
    const borrowedEl = document.getElementById('net-worth-borrowed');
    const loansNetWorthEl = document.getElementById('loans-net-worth-val');

    const isPositive = data.netWorth >= 0;

    if (cardEl) {
      if (isPositive) {
        cardEl.classList.add('positive');
        cardEl.classList.remove('negative');
      } else {
        cardEl.classList.add('negative');
        cardEl.classList.remove('positive');
      }
    }

    if (valEl) {
      valEl.textContent = formatCurrency(data.netWorth);
      valEl.className = isPositive ? 'net-worth-val text-success' : 'net-worth-val text-danger';
      if (isStealthModeActive) valEl.classList.add('stealth-masked');
      else valEl.classList.remove('stealth-masked');
    }

    if (cashEl) {
      cashEl.textContent = formatCurrency(data.availableBalance);
      if (isStealthModeActive) cashEl.classList.add('stealth-masked');
      else cashEl.classList.remove('stealth-masked');
    }

    if (lentEl) {
      lentEl.textContent = formatCurrency(data.totalOutstandingLent);
      if (isStealthModeActive) lentEl.classList.add('stealth-masked');
      else lentEl.classList.remove('stealth-masked');
    }

    if (borrowedEl) {
      borrowedEl.textContent = formatCurrency(data.totalOutstandingBorrowed);
      if (isStealthModeActive) borrowedEl.classList.add('stealth-masked');
      else borrowedEl.classList.remove('stealth-masked');
    }

    if (loansNetWorthEl) {
      loansNetWorthEl.textContent = formatCurrency(data.netWorth);
      if (isStealthModeActive) loansNetWorthEl.classList.add('stealth-masked');
      else loansNetWorthEl.classList.remove('stealth-masked');
    }
  }

  // Phase 5 Daily In-App Expense Nudge System
  let isPhase1Painting = false;
  function hasExpenseToday() {
    if (!Array.isArray(state.expenses) || state.expenses.length === 0) return false;
    const localToday = getLocalDateString();
    const isoToday = new Date().toISOString().split('T')[0];
    return state.expenses.some(exp => exp.date === localToday || exp.date === isoToday);
  }

  function updateDailyNudgeUI() {
    const banner = document.getElementById('daily-nudge-banner');
    if (!banner) return;

    // 1. If an expense IS logged today -> banner never shows
    if (hasExpenseToday()) {
      banner.style.display = 'none';
      return;
    }

    // 2. Only show after 12:00 PM (avoid nagging in the morning)
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      banner.style.display = 'none';
      return;
    }

    const todayStr = getLocalDateString();
    const todayDismissKey = `ledgio_nudge_dismissed_${todayStr}`;

    // 3. Clean up stale date keys to prevent localStorage leaks
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ledgio_nudge_dismissed_') && k !== todayDismissKey) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}

    // 4. Check if already dismissed today
    if (localStorage.getItem(todayDismissKey) === 'true') {
      banner.style.display = 'none';
      return;
    }

    // 5. All conditions met: display banner
    banner.style.display = 'flex';
  }

  window.updateDailyNudgeUI = updateDailyNudgeUI;

  function createActionButtons(id) {
    return window.LedgioExpenses ? window.LedgioExpenses.createActionButtons(id) : null;
  }

  function renderExpenses() {
    return window.LedgioExpenses ? window.LedgioExpenses.renderExpenses() : null;
  }

  function renderAllExpenses() {
    return window.LedgioExpenses ? window.LedgioExpenses.renderAllExpenses() : null;
  }

  async function deleteBudget(category) {
    return window.LedgioExpenses ? await window.LedgioExpenses.deleteBudget(category) : null;
  }

  function renderBudgets() {
    return window.LedgioExpenses ? window.LedgioExpenses.renderBudgets() : null;
  }

  // ==========================================================================
  // User-Defined Custom Categories Controller (delegated to window.LedgioCategories)
  // ==========================================================================
  function renderCustomCategoriesList() {
    return window.LedgioCategories ? window.LedgioCategories.renderCustomCategoriesList() : null;
  }

  function openCustomCategoryModal(editId = null) {
    return window.LedgioCategories ? window.LedgioCategories.openCustomCategoryModal(editId) : null;
  }

  function closeCustomCategoryModal() {
    return window.LedgioCategories ? window.LedgioCategories.closeCustomCategoryModal() : null;
  }

  function saveCustomCategory() {
    return window.LedgioCategories ? window.LedgioCategories.saveCustomCategory() : null;
  }

  function openReassignCategoryModal(sourceCat, expenseCount) {
    return window.LedgioCategories ? window.LedgioCategories.openReassignCategoryModal(sourceCat, expenseCount) : null;
  }

  function closeReassignCategoryModal() {
    return window.LedgioCategories ? window.LedgioCategories.closeReassignCategoryModal() : null;
  }

  function populateReassignTargetDropdown() {
    return window.LedgioCategories ? window.LedgioCategories.populateReassignTargetDropdown() : null;
  }

  function updateReassignConfirmationCopy() {
    return window.LedgioCategories ? window.LedgioCategories.updateReassignConfirmationCopy() : null;
  }

  function handleReassignInlineCreate() {
    return window.LedgioCategories ? window.LedgioCategories.handleReassignInlineCreate() : null;
  }

  function executeCategoryReassignment(sourceCatId, targetVal) {
    return window.LedgioCategories ? window.LedgioCategories.executeCategoryReassignment(sourceCatId, targetVal) : null;
  }

  function deleteCategory(catId, targetCatIdOrName = null) {
    return window.LedgioCategories ? window.LedgioCategories.deleteCategory(catId, targetCatIdOrName) : null;
  }

  function deleteCustomCategory(catId, targetCatIdOrName = null) {
    return window.LedgioCategories ? window.LedgioCategories.deleteCustomCategory(catId, targetCatIdOrName) : null;
  }

  function restoreDefaultCategories() {
    return window.LedgioCategories ? window.LedgioCategories.restoreDefaultCategories() : null;
  }

  // Chart Rendering
  let reportsSelectedMonthKey = null;

  function getTrendMonthRange() {
    const monthKeys = [];
    const monthLabels = [];
    const fullLabels = [];
    const today = new Date();
    const todayYear  = today.getFullYear();
    const todayMonth = today.getMonth(); // 0-indexed

    for (let i = 5; i >= 0; i--) {
      let m = todayMonth - i;
      let y = todayYear;
      if (m < 0) { m += 12; y -= 1; }
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = new Date(y, m, 1).toLocaleString('default', { month: 'short', year: 'numeric' });
      const fullLabel = new Date(y, m, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
      monthKeys.push(key);
      monthLabels.push(label);
      fullLabels.push(fullLabel);
    }
    return { monthKeys, monthLabels, fullLabels };
  }

  function setReportsSelectedMonth(key) {
    const { monthKeys } = getTrendMonthRange();
    if (!key || !monthKeys.includes(key)) {
      reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
    } else {
      reportsSelectedMonthKey = key;
    }
    if (typeof window.renderSpendingChart === 'function') {
      window.renderSpendingChart();
    }
    updateTrendChartHighlight();
  }

  function updateTrendChartHighlight() {
    const canvas = document.getElementById('trend-chart');
    if (!canvas || !chartInstances.trend) return;
    const { monthKeys } = getTrendMonthRange();
    if (!reportsSelectedMonthKey || !monthKeys.includes(reportsSelectedMonthKey)) {
      reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
    }
    const selectedIdx = monthKeys.indexOf(reportsSelectedMonthKey);

    const ctx = canvas.getContext('2d');
    const height = canvas.offsetHeight || 240;

    const selectedGradient = ctx.createLinearGradient(0, 0, 0, height);
    selectedGradient.addColorStop(0, '#10b981');
    selectedGradient.addColorStop(1, 'rgba(16, 185, 129, 0.4)');

    const dimmedGradient = ctx.createLinearGradient(0, 0, 0, height);
    dimmedGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    dimmedGradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

    const bgColors = monthKeys.map((k, i) => (i === selectedIdx ? selectedGradient : dimmedGradient));
    const borderColors = monthKeys.map((k, i) => (i === selectedIdx ? '#6366f1' : 'transparent'));
    const borderWidths = monthKeys.map((k, i) => (i === selectedIdx ? 2.5 : 0));

    if (chartInstances.trend.data?.datasets?.[0]) {
      chartInstances.trend.data.datasets[0].backgroundColor = bgColors;
      chartInstances.trend.data.datasets[0].borderColor = borderColors;
      chartInstances.trend.data.datasets[0].borderWidth = borderWidths;
      chartInstances.trend.update('none');
    }
  }

  // Bulletproof Chart Instance Management & Cleanup
  function destroyChartInstance(key, canvasTarget) {
    if (chartInstances[key]) {
      try {
        if (typeof chartInstances[key].setActiveElements === 'function') {
          chartInstances[key].setActiveElements([]);
        }
        if (chartInstances[key].tooltip && typeof chartInstances[key].tooltip.setActiveElements === 'function') {
          chartInstances[key].tooltip.setActiveElements([], { x: 0, y: 0 });
        }
        chartInstances[key].stop();
        chartInstances[key].destroy();
      } catch (e) {
        console.warn('[Ledgio] Error destroying chart ' + key, e);
      }
      chartInstances[key] = null;
    }

    const c = typeof canvasTarget === 'string' ? document.getElementById(canvasTarget) : canvasTarget;
    if (c) {
      try {
        if (typeof Chart !== 'undefined' && Chart.getChart) {
          const orphan = Chart.getChart(c);
          if (orphan) {
            orphan.stop();
            orphan.destroy();
          }
        }
      } catch (e) {}
      try {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, c.width, c.height);
        }
      } catch (e) {}
    }

    if (key === 'category') {
      const centerEl = document.getElementById('category-center-label');
      if (centerEl) centerEl.style.display = 'none';
    }
  }

  let chartResizeObserver = null;
  function initChartResizeObservers() {
    if (typeof ResizeObserver === 'undefined') return;
    if (chartResizeObserver) {
      chartResizeObserver.disconnect();
    }

    let resizeDebounce = null;

    chartResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!target) continue;
        const width = target.clientWidth || (entry.contentRect && entry.contentRect.width);
        const height = target.clientHeight || (entry.contentRect && entry.contentRect.height);

        // If target or parent section is hidden, client dimensions will be 0
        if (!width || !height) continue;

        let chart = null;
        if (target.id === 'trend-chart-container') chart = chartInstances.trend;
        else if (target.id === 'spending-chart-container') chart = chartInstances.spending;
        else if (target.id === 'category-chart-container') chart = chartInstances.category;

        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      }

      // Secondary debounced pass to sync hit detection with final settled geometry
      clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(() => {
        ['trend', 'spending', 'category'].forEach(key => {
          const chart = chartInstances[key];
          if (chart && chart.canvas && chart.canvas.offsetParent !== null && typeof chart.resize === 'function') {
            chart.resize();
            chart.update('none');
          }
        });
      }, 100);
    });

    ['category-chart-container', 'spending-chart-container', 'trend-chart-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        chartResizeObserver.observe(el);
      }
    });
  }

  function renderCategoryChart() {
    const canvas = document.getElementById('category-chart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') return;
    
    destroyChartInstance('category', canvas);

    const titleEl = document.getElementById('dashboard-category-chart-title');
    if (titleEl) {
      titleEl.textContent = 'Expenses by Category — This Month';
    }

    const emptyEl = document.getElementById('category-chart-empty');
    const centerLabelEl = document.getElementById('category-center-label');
    const centerSubEl = document.getElementById('category-center-sub');
    const centerValEl = document.getElementById('dashboard-category-center-total');

    const sumTotalEl = document.getElementById('dashboard-category-total');
    const sumTopCatEl = document.getElementById('dashboard-category-top-cat');
    const sumCountEl = document.getElementById('dashboard-category-count');

    // Timezone-immune current month key ('YYYY-MM')
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthExpenses = (state.expenses || []).filter(e => e.date && e.date.slice(0, 7) === currentMonthKey);
    const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const txCount = monthExpenses.length;

    // Apply summary row numbers
    if (sumTotalEl) {
      sumTotalEl.textContent = formatCurrency(monthTotal);
      if (isStealthModeActive) sumTotalEl.classList.add('stealth-masked');
      else sumTotalEl.classList.remove('stealth-masked');
    }
    if (sumCountEl) {
      sumCountEl.textContent = txCount;
    }

    if (monthExpenses.length === 0) {
      canvas.style.display = 'none';
      if (centerLabelEl) centerLabelEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (sumTopCatEl) sumTopCatEl.textContent = '—';
      return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (centerLabelEl) centerLabelEl.style.display = 'flex';
    if (centerSubEl) centerSubEl.textContent = 'This Month';
    if (centerValEl) {
      centerValEl.textContent = formatCurrency(monthTotal);
      if (isStealthModeActive) centerValEl.classList.add('stealth-masked');
      else centerValEl.classList.remove('stealth-masked');
    }
    
    const catMap = {};
    monthExpenses.forEach(e => {
      const meta = getCategoryMeta(e.category);
      const label = meta.label || 'Other';
      if (!catMap[label]) {
        catMap[label] = { amount: 0, color: meta.color };
      }
      catMap[label].amount += e.amount;
    });
    
    let topCatLabel = '—';
    let maxCatAmount = -1;
    const labels = [];
    const data = [];
    const bgColors = [];
    
    Object.entries(catMap).forEach(([label, info]) => {
      labels.push(label);
      data.push(info.amount);
      bgColors.push(info.color);
      if (info.amount > maxCatAmount) {
        maxCatAmount = info.amount;
        topCatLabel = label;
      }
    });

    if (sumTopCatEl) sumTopCatEl.textContent = topCatLabel;

    // Theme-aware color reads
    const isDark       = document.documentElement.getAttribute('data-theme') === 'dark';
    const rootStyle    = getComputedStyle(document.documentElement);
    const mutedColor   = rootStyle.getPropertyValue('--color-text-muted').trim() || '#71717a';
    const borderColor  = isDark ? 'rgba(255, 255, 255, 0.15)' : '#27272a';

    const categoryCenterLabelSyncPlugin = {
      id: 'categoryCenterLabelSync',
      afterDraw(chart) {
        const centerEl = document.getElementById('category-center-label');
        if (!centerEl) return;
        const meta = chart.getDatasetMeta(0);
        if (meta && meta.data && meta.data.length > 0) {
          const x = meta.data[0].x;
          const y = meta.data[0].y;
          centerEl.style.left = `${Math.round(x)}px`;
          centerEl.style.top = `${Math.round(y)}px`;
          centerEl.style.transform = 'translate(-50%, -50%)';
          centerEl.style.display = 'flex';
        }
      }
    };

    chartInstances.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 0
        }]
      },
      plugins: [categoryCenterLabelSyncPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, activeElements) => {
          if (!window.matchMedia('(hover: hover)').matches) return; // desktop pointer only
          const subEl = document.getElementById('category-center-sub');
          const valEl = document.getElementById('dashboard-category-center-total');
          if (!subEl || !valEl) return;

          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            const catLabel = chartInstances.category?.data?.labels?.[idx] || '';
            const catVal = chartInstances.category?.data?.datasets?.[0]?.data?.[idx] || 0;
            subEl.textContent = catLabel;
            valEl.textContent = formatCurrency(catVal);
          } else {
            subEl.textContent = 'This Month';
            valEl.textContent = formatCurrency(monthTotal);
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 10 },
              color: mutedColor
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#18181b',
            titleColor: '#fafafa',
            bodyColor:  '#a1a1aa',
            borderColor: borderColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => `  ${formatCurrency(item.raw)}`
            }
          }
        },
        cutout: '68%'
      }
    });

    if (!canvas.__ledgio_mouseleave_attached) {
      canvas.__ledgio_mouseleave_attached = true;
      canvas.addEventListener('mouseleave', () => {
        const subEl = document.getElementById('category-center-sub');
        const valEl = document.getElementById('dashboard-category-center-total');
        if (subEl) subEl.textContent = 'This Month';
        if (valEl) valEl.textContent = formatCurrency(monthTotal);

        if (chartInstances.category && typeof chartInstances.category.setActiveElements === 'function') {
          chartInstances.category.setActiveElements([]);
          if (chartInstances.category.tooltip && typeof chartInstances.category.tooltip.setActiveElements === 'function') {
            chartInstances.category.tooltip.setActiveElements([], { x: 0, y: 0 });
          }
          chartInstances.category.update('none');
        }
      });
    }
  }

  window.renderSpendingChart = function() {
    const canvas = document.getElementById('spending-chart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') return;

    destroyChartInstance('spending', canvas);

    const { monthKeys, fullLabels } = getTrendMonthRange();
    if (!reportsSelectedMonthKey || !monthKeys.includes(reportsSelectedMonthKey)) {
      reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
    }
    const selectedIdx = monthKeys.indexOf(reportsSelectedMonthKey);
    const monthFullLabel = fullLabels[selectedIdx] || reportsSelectedMonthKey;

    // 1. Update Card Title
    const titleEl = document.getElementById('reports-spending-title');
    if (titleEl) {
      titleEl.textContent = 'Spending by Category';
    }

    // 2. Update Stepper Controls
    const stepperLabel = document.getElementById('reports-month-stepper-label');
    if (stepperLabel) stepperLabel.textContent = monthFullLabel;

    const prevBtn = document.getElementById('reports-prev-month-btn');
    if (prevBtn) {
      const isOldest = (selectedIdx <= 0);
      prevBtn.disabled = isOldest;
      prevBtn.style.opacity = isOldest ? '0.35' : '1';
      prevBtn.style.cursor = isOldest ? 'not-allowed' : 'pointer';
    }

    const nextBtn = document.getElementById('reports-next-month-btn');
    if (nextBtn) {
      const isNewest = (selectedIdx >= monthKeys.length - 1);
      nextBtn.disabled = isNewest;
      nextBtn.style.opacity = isNewest ? '0.35' : '1';
      nextBtn.style.cursor = isNewest ? 'not-allowed' : 'pointer';
    }

    const resetLatestBtn = document.getElementById('reports-reset-latest-btn');
    if (resetLatestBtn) {
      const isNewest = (selectedIdx >= monthKeys.length - 1);
      resetLatestBtn.style.opacity = isNewest ? '0' : '1';
      resetLatestBtn.style.pointerEvents = isNewest ? 'none' : 'auto';
      resetLatestBtn.style.cursor = isNewest ? 'default' : 'pointer';
      resetLatestBtn.setAttribute('aria-hidden', isNewest ? 'true' : 'false');
      if (isNewest) {
        resetLatestBtn.setAttribute('tabindex', '-1');
      } else {
        resetLatestBtn.removeAttribute('tabindex');
      }
    }

    // 3. Filter expenses for this selected month
    const monthExpenses = (state.expenses || []).filter(e => e.date && e.date.slice(0, 7) === reportsSelectedMonthKey);

    // 4. Update Summary Row
    const totalSpent = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const txCount = monthExpenses.length;

    const totalEl = document.getElementById('reports-month-total');
    if (totalEl) {
      totalEl.textContent = formatCurrency(totalSpent);
      if (isStealthModeActive) totalEl.classList.add('stealth-masked');
      else totalEl.classList.remove('stealth-masked');
    }

    const countEl = document.getElementById('reports-month-count');
    if (countEl) {
      countEl.textContent = txCount;
    }

    const emptyEl = document.getElementById('spending-empty-state');
    const emptyMsgEl = document.getElementById('spending-empty-msg');

    if (monthExpenses.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (emptyMsgEl) emptyMsgEl.textContent = `No expenses in ${monthFullLabel}`;

      const topCatEl = document.getElementById('reports-month-top-cat');
      if (topCatEl) topCatEl.textContent = '—';
      return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // 5. Build category breakdown
    const catMap = {};
    monthExpenses.forEach(e => {
      const meta = getCategoryMeta(e.category);
      const label = meta.label || 'Other';
      if (!catMap[label]) {
        catMap[label] = { amount: 0, color: meta.color };
      }
      catMap[label].amount += e.amount;
    });

    let topCatLabel = '—';
    let maxCatAmount = -1;
    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(catMap).forEach(([label, info]) => {
      labels.push(label);
      data.push(info.amount);
      bgColors.push(info.color);
      if (info.amount > maxCatAmount) {
        maxCatAmount = info.amount;
        topCatLabel = label;
      }
    });

    const topCatEl = document.getElementById('reports-month-top-cat');
    if (topCatEl) topCatEl.textContent = topCatLabel;

    // Theme-aware color reads
    const isDark       = document.documentElement.getAttribute('data-theme') === 'dark';
    const rootStyle    = getComputedStyle(document.documentElement);
    const mutedColor   = rootStyle.getPropertyValue('--color-text-muted').trim() || '#71717a';
    const borderColor  = isDark ? 'rgba(255, 255, 255, 0.15)' : '#27272a';
    const isMobile     = window.matchMedia('(max-width: 768px)').matches;

    chartInstances.spending = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: isMobile ? { top: 6, bottom: 6, left: 10, right: 10 } : { top: 0, bottom: 0, left: 0, right: 0 }
        },
        plugins: {
          legend: {
            position: isMobile ? 'bottom' : 'right',
            labels: {
              color: mutedColor,
              boxWidth: 12,
              font: { size: isMobile ? 10 : 11 },
              padding: isMobile ? 8 : 10
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#18181b',
            titleColor: '#fafafa',
            bodyColor:  '#a1a1aa',
            borderColor: borderColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => `  ${formatCurrency(item.raw)}`
            }
          }
        }
      }
    });

    if (!canvas.__ledgio_mouseleave_attached) {
      canvas.__ledgio_mouseleave_attached = true;
      canvas.addEventListener('mouseleave', () => {
        if (chartInstances.spending && typeof chartInstances.spending.setActiveElements === 'function') {
          chartInstances.spending.setActiveElements([]);
          if (chartInstances.spending.tooltip && typeof chartInstances.spending.tooltip.setActiveElements === 'function') {
            chartInstances.spending.tooltip.setActiveElements([], { x: 0, y: 0 });
          }
          chartInstances.spending.update('none');
        }
      });
    }
  };

  window.renderTrendChart = function() {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') return;

    destroyChartInstance('trend', canvas);

    const { monthKeys, monthLabels, fullLabels } = getTrendMonthRange();
    if (!reportsSelectedMonthKey || !monthKeys.includes(reportsSelectedMonthKey)) {
      reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
    }
    const selectedIdx = monthKeys.indexOf(reportsSelectedMonthKey);
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    const monthMap = {};
    monthKeys.forEach((key, idx) => {
      monthMap[key] = { label: monthLabels[idx], total: 0 };
    });

    state.expenses.forEach(e => {
      const key = (e.date || '').slice(0, 7); // raw 'YYYY-MM' prefix
      if (monthMap[key]) {
        monthMap[key].total += (e.amount || 0);
      }
    });

    const labels = monthLabels;
    const data   = monthKeys.map(k => monthMap[k].total);

    // Theme-aware color reads
    const isDark      = document.documentElement.getAttribute('data-theme') === 'dark';
    const rootStyle   = getComputedStyle(document.documentElement);
    const mutedColor  = rootStyle.getPropertyValue('--color-text-muted').trim() || '#71717a';
    const gridColor   = rootStyle.getPropertyValue('--color-border').trim() || '#e4e4e7';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : '#27272a';

    const ctx = canvas.getContext('2d');
    const height = canvas.offsetHeight || 240;

    const selectedGradient = ctx.createLinearGradient(0, 0, 0, height);
    selectedGradient.addColorStop(0, '#10b981');
    selectedGradient.addColorStop(1, 'rgba(16, 185, 129, 0.4)');

    const dimmedGradient = ctx.createLinearGradient(0, 0, 0, height);
    dimmedGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    dimmedGradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

    const bgColors = monthKeys.map((k, i) => (i === selectedIdx ? selectedGradient : dimmedGradient));
    const borderColors = monthKeys.map((k, i) => (i === selectedIdx ? '#6366f1' : 'transparent'));
    const borderWidths = monthKeys.map((k, i) => (i === selectedIdx ? 2.5 : 0));

    const tooltipPlugin = {
      enabled: true,
      backgroundColor: '#18181b',
      titleColor: '#fafafa',
      bodyColor:  '#a1a1aa',
      borderColor: borderColor,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      displayColors: false,
      callbacks: {
        title: (items) => {
          const idx = items[0]?.dataIndex;
          return (fullLabels && fullLabels[idx]) || items[0]?.label || '';
        },
        label: (item) => `  ${formatCurrency(item.raw)}`
      }
    };

    chartInstances.trend = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Expenses',
          data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: borderWidths,
          borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: 'bottom',
          barPercentage: isMobile ? 0.6 : 0.5,
          categoryPercentage: isMobile ? 0.85 : 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const clickedIndex = elements[0].index;
            if (clickedIndex >= 0 && clickedIndex < monthKeys.length) {
              setReportsSelectedMonth(monthKeys[clickedIndex]);
            }
          }
        },
        onHover: (event, elements) => {
          if (event.native && event.native.target) {
            event.native.target.style.cursor = (elements && elements.length > 0) ? 'pointer' : 'default';
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltipPlugin
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: mutedColor,
              font: { size: isMobile ? 10 : 11 },
              autoSkip: false,
              maxRotation: 0,
              callback: function(val) {
                const l = this.getLabelForValue ? this.getLabelForValue(val) : monthLabels[val];
                return (isMobile && l) ? l.split(' ')[0] : l;
              }
            },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: mutedColor,
              font: { size: isMobile ? 10 : 11 },
              maxTicksLimit: isMobile ? 5 : 8,
              callback: (val) => formatCurrency(val)
            },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });

    if (!canvas.__ledgio_mouseleave_attached) {
      canvas.__ledgio_mouseleave_attached = true;
      canvas.addEventListener('mouseleave', () => {
        if (chartInstances.trend && typeof chartInstances.trend.setActiveElements === 'function') {
          chartInstances.trend.setActiveElements([]);
          if (chartInstances.trend.tooltip && typeof chartInstances.trend.tooltip.setActiveElements === 'function') {
            chartInstances.trend.tooltip.setActiveElements([], { x: 0, y: 0 });
          }
          chartInstances.trend.update('none');
        }
      });
    }
  };

  // Actions (Cloud & Local Sync) - Delegated to window.LedgioExpenses
  async function addExpense() {
    return window.LedgioExpenses ? await window.LedgioExpenses.addExpense() : null;
  }

  async function saveEdit() {
    return window.LedgioExpenses ? await window.LedgioExpenses.saveEdit() : null;
  }

  async function deleteExpense(id) {
    return window.LedgioExpenses ? await window.LedgioExpenses.deleteExpense(id) : null;
  }

  // Phase 6: Income Ledger Engine (delegated to window.LedgioIncome)
  function addIncome(amount, dateStr, note) {
    return window.LedgioIncome ? window.LedgioIncome.addIncome(amount, dateStr, note) : null;
  }

  function setBalance(target) {
    return window.LedgioIncome ? window.LedgioIncome.setBalance(target) : null;
  }

  function isLoanAdjustment(entry) {
    return window.LedgioIncome ? window.LedgioIncome.isLoanAdjustment(entry) : false;
  }

  async function deleteIncomeEntry(id) {
    return window.LedgioIncome ? await window.LedgioIncome.deleteIncomeEntry(id) : false;
  }

  function editIncomeEntry(id, opts = {}) {
    return window.LedgioIncome ? window.LedgioIncome.editIncomeEntry(id, opts) : null;
  }

  function renderIncomeHistory() {
    return window.LedgioIncome ? window.LedgioIncome.renderIncomeHistory() : null;
  }

  function updateLeftoverPromptUI(optRemaining) {
    const promptEl = document.getElementById('leftover-quick-action');
    const amountEl = document.getElementById('leftover-amount-text');
    if (!promptEl) return;

    const totalExpenses = (state.expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const remaining = (optRemaining !== undefined) ? optRemaining : (totalIncome() - totalExpenses);

    const currentMonthKey = getLocalCurrentMonthString();
    const dismissKey = `ledgio_leftover_dismissed_${currentMonthKey}`;

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ledgio_leftover_dismissed_') && k !== dismissKey) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}

    const isDismissed = localStorage.getItem(dismissKey) === 'true';

    if (remaining <= 0 || isDismissed) {
      promptEl.style.display = 'none';
      return;
    }

    promptEl.style.display = 'flex';
    if (amountEl) {
      if (isStealthModeActive) {
        amountEl.textContent = '₹••••••';
        amountEl.classList.add('stealth-masked');
      } else {
        amountEl.textContent = formatCurrency(remaining);
        amountEl.classList.remove('stealth-masked');
      }
    }
  }

  function openLeftoverGoalPicker(amount) {
    const modal = document.getElementById('leftover-goal-picker-modal');
    const amountEl = document.getElementById('leftover-picker-amount');
    const listEl = document.getElementById('leftover-goals-list');
    if (!modal || !listEl) return;

    if (amountEl) {
      if (isStealthModeActive) {
        amountEl.textContent = '₹••••••';
        amountEl.classList.add('stealth-masked');
      } else {
        amountEl.textContent = formatCurrency(amount);
        amountEl.classList.remove('stealth-masked');
      }
    }

    const goals = Array.isArray(state?.goals) ? state.goals : [];
    if (goals.length === 0) {
      modal.style.display = 'none';
      openGoalModalWithLeftover(amount);
      return;
    }

    listEl.innerHTML = goals.map(goal => {
      const progress = getGoalProgress(goal);
      const color = sanitizeColor(goal.color, '#10b981');
      const icon = sanitizeIcon(goal.icon, 'fa-bullseye');

      return `
        <div class="leftover-goal-item" data-goal-id="${escapeHtml(goal.id)}" role="button" tabindex="0">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <div style="width: 34px; height: 34px; border-radius: 8px; background: ${color}18; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0;">
              <i class="fas ${escapeHtml(icon)}"></i>
            </div>
            <div style="min-width: 0; flex: 1;">
              <strong style="font-size: 0.875rem; color: var(--color-text); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(goal.name)}</strong>
              <div style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 6px;">
                <span class="${isStealthModeActive ? 'stealth-masked' : ''}">${formatCurrency(progress.current)}</span> /
                <span class="${isStealthModeActive ? 'stealth-masked' : ''}">${formatCurrency(progress.target)}</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm leftover-deposit-target-btn" data-goal-id="${escapeHtml(goal.id)}" style="font-size: 0.775rem; padding: 6px 12px; font-weight: 600; white-space: nowrap; flex-shrink: 0;">
            Deposit
          </button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.leftover-deposit-target-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const goalId = btn.dataset.goalId;
        if (!goalId) return;
        modal.style.display = 'none';
        addGoalDeposit(goalId, amount, getLocalDateString(), 'Leftover savings deposit', false, true);
        showToast(`Deposited ${formatCurrency(amount)} leftover into goal!`, 'success');
      });
    });

    listEl.querySelectorAll('.leftover-goal-item').forEach(itemEl => {
      itemEl.addEventListener('click', (e) => {
        const goalId = itemEl.dataset.goalId;
        if (!goalId) return;
        modal.style.display = 'none';
        addGoalDeposit(goalId, amount, getLocalDateString(), 'Leftover savings deposit', false, true);
        showToast(`Deposited ${formatCurrency(amount)} leftover into goal!`, 'success');
      });
    });

    modal.style.display = 'flex';
  }

  function openGoalModalWithLeftover(amount) {
    return window.LedgioGoals ? window.LedgioGoals.openGoalModalWithLeftover(amount) : null;
  }

  function getFilteredExpenses() {
    return window.LedgioExpenses ? window.LedgioExpenses.getFilteredExpenses() : [];
  }

  async function setBudget(category, limit) {
    return window.LedgioExpenses ? await window.LedgioExpenses.setBudget(category, limit) : false;
  }

  function setupExpensesEventListeners() {
    return window.LedgioExpenses ? window.LedgioExpenses.setupExpensesEventListeners() : null;
  }

  // Populate UI
  function populateDropdowns() {
    if (window.LedgioCategories && typeof window.LedgioCategories.populateCategoryDropdowns === 'function') {
      window.LedgioCategories.populateCategoryDropdowns();
    } else {
      const hidden = Array.isArray(state?.hiddenBuiltins) ? state.hiddenBuiltins : [];
      const builtInOpts = Object.entries(CATEGORIES)
        .filter(([k]) => !hidden.includes(k))
        .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
        .join('');

      const customList = (Array.isArray(state?.customCategories) ? state.customCategories : [])
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const customOpts = customList
        .map(c => `<option value="${escapeHtml(c.name)}">✎ ${escapeHtml(c.name)}</option>`)
        .join('');

      const allOpts = builtInOpts + (customOpts ? customOpts : '');
      
      ['expense-category-select', 'edit-expense-category', 'budget-category-select', 'settlement-category-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const prevVal = el.value;
          el.innerHTML = allOpts;
          if (prevVal && Array.from(el.options).some(o => o.value === prevVal)) {
            el.value = prevVal;
          } else if (id === 'settlement-category-select') {
            if (Array.from(el.options).some(o => o.value === 'Other')) {
              el.value = 'Other';
            }
          }
        }
      });
      
      const catFilter = document.getElementById('category-filter');
      if (catFilter) {
        const prevFilter = catFilter.value;
        catFilter.innerHTML = `<option value="">All Categories</option>${allOpts}`;
        if (prevFilter && Array.from(catFilter.options).some(o => o.value === prevFilter)) {
          catFilter.value = prevFilter;
        }
      }
    }
    
    const moFilter = document.getElementById('month-filter');
    if (moFilter) {
      const months = new Set(state.expenses.map(e => e.date.slice(0, 7)));
      const sortedMonths = Array.from(months).sort().reverse();
      moFilter.innerHTML = '<option value="">All Time</option>' + 
        sortedMonths.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    }
    
    const incInput = document.getElementById('income-input');
    if (incInput) {
      const incMode = window.LedgioIncome ? window.LedgioIncome.getIncomeMode() : 'add';
      if (incMode === 'set') {
        incInput.value = state.income || '';
      } else {
        incInput.value = '';
      }
    }
    updateIncomePreview();
    
    const cur = state.settings?.currency || 'INR';
    const curSelect = document.getElementById('currency-select');
    if (curSelect) curSelect.value = cur;
    
    const quickCurSelect = document.getElementById('quick-currency-select');
    if (quickCurSelect) quickCurSelect.value = cur;
    
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) darkToggle.checked = state.settings.darkMode;
  }

  // Income Mode & Calculations (delegated to window.LedgioIncome)
  function getIncomeMode() {
    return window.LedgioIncome ? window.LedgioIncome.getIncomeMode() : 'add';
  }

  function updateIncomePreview() {
    return window.LedgioIncome ? window.LedgioIncome.updateIncomePreview() : null;
  }

  function setIncomeMode(mode) {
    return window.LedgioIncome ? window.LedgioIncome.setIncomeMode(mode) : null;
  }

  function setupIncomeEventListeners() {
    return window.LedgioIncome ? window.LedgioIncome.setupIncomeEventListeners() : null;
  }

  // Navigation & Lazy Section Rendering
  const renderedSections = new Set(['dashboard']);

  function getActiveSectionName() {
    const activeSec = document.querySelector('.page-section.active');
    if (activeSec && activeSec.id) {
      return activeSec.id.replace('section-', '');
    }
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    return hash || 'dashboard';
  }

  function renderSection(sectionName) {
    if (!sectionName) return;
    renderedSections.add(sectionName);
    switch (sectionName) {
      case 'dashboard':
        updateSummary();
        renderExpenses();
        renderCategoryChart();
        requestAnimationFrame(() => {
          if (chartInstances.category && typeof chartInstances.category.resize === 'function') {
            chartInstances.category.resize();
          }
        });
        break;
      case 'expenses':
        renderAllExpenses();
        break;
      case 'budget':
        renderBudgets();
        break;
      case 'goals':
        renderGoals();
        break;
      case 'loans':
        renderLoans();
        break;
      case 'reports':
        if (typeof window.renderSpendingChart === 'function') window.renderSpendingChart();
        if (typeof window.renderTrendChart === 'function') window.renderTrendChart();
        requestAnimationFrame(() => {
          if (chartInstances.spending && typeof chartInstances.spending.resize === 'function') {
            chartInstances.spending.resize();
          }
          if (chartInstances.trend && typeof chartInstances.trend.resize === 'function') {
            chartInstances.trend.resize();
          }
        });
        break;
      case 'settings':
        updateRatesFreshnessUI();
        loadAccountSecurityInfo();
        if (isAdmin) {
          loadTelemetryStats();
        }
        break;
    }
  }

  const desktopTitleMap = {
    dashboard: 'Dashboard',
    expenses: 'Expenses Ledger',
    budget: 'Monthly Budgets',
    goals: 'Savings Goals',
    loans: 'Loans & Debts',
    reports: 'Financial Reports',
    settings: 'App Preferences'
  };

  const mobileTitleMap = {
    dashboard: 'Dashboard',
    expenses: 'Expenses',
    budget: 'Budget',
    goals: 'Goals',
    loans: 'Loans',
    reports: 'Reports',
    settings: 'Settings'
  };

  function updateHeaderTitle(targetSection) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const currentHash = window.location.hash || '#dashboard';
    const sectionName = targetSection || currentHash.replace('#', '') || 'dashboard';
    const titleEl = document.getElementById('header-title');
    if (titleEl) {
      titleEl.textContent = (isMobile ? mobileTitleMap[sectionName] : desktopTitleMap[sectionName]) || 'Dashboard';
    }
  }

  function navigateTo(hash) {
    const sectionName = hash.replace('#', '') || 'dashboard';
    
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const target = link.getAttribute('href').replace('#', '');
      link.classList.toggle('active', target === sectionName);
    });
    
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${sectionName}`);
    });
    
    updateHeaderTitle(sectionName);
    
    renderSection(sectionName);
  }

  // Dark Mode & Live Preview System
  function applyDarkMode() {
    const isDark = Boolean(state.settings.darkMode);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    try {
      localStorage.setItem('ledgio_theme', isDark ? 'dark' : 'light');
      localStorage.setItem('sb_dark_mode_' + getUserId(), isDark ? 'true' : 'false');
    } catch (e) {}
    
    const btn = document.getElementById('dark-mode-btn');
    if (btn) {
      btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) {
      darkToggle.checked = isDark;
    }

    // Sync Visual Theme Cards
    const cardLight = document.getElementById('theme-card-light');
    const cardDark = document.getElementById('theme-card-dark');
    if (cardLight && cardDark) {
      cardLight.classList.toggle('active', !isDark);
      cardDark.classList.toggle('active', isDark);
    }
  }

  function updateCurrencyPreview(curr) {
    const previewEl = document.getElementById('currency-preview-badge');
    if (!previewEl) return;
    const cur = curr || state.settings?.currency || 'INR';
    const sampleVal = (cur === 'JPY' ? 250000 : 2500);
    previewEl.textContent = `Preview: ${formatSampleCurrency(sampleVal, cur)}`;
  }

  async function toggleDarkMode() {
    state.settings.darkMode = !state.settings.darkMode;
    applyDarkMode();
    saveData();
    
    if (supabase && currentUser) {
      try {
        await supabase.from('profiles').update({ 
          dark_mode: state.settings.darkMode,
          updated_at: new Date().toISOString()
        }).eq('id', currentUser.id);
      } catch (e) {}
      try {
        await supabase.auth.updateUser({
          data: { darkMode: state.settings.darkMode }
        });
      } catch (e) {}
    }

    if (document.getElementById('section-dashboard').classList.contains('active')) {
      renderCategoryChart();
    } else if (document.getElementById('section-reports').classList.contains('active')) {
      window.renderSpendingChart();
      window.renderTrendChart();
    }
  }

  async function loadTelemetryStats() {
    if (!isAdmin || !supabase) return;
    try {
      // 1. Total installs
      const { count: installCount } = await supabase
        .from('app_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'app_install');

      // 2. Total launches & sessions
      const { count: launchCount, data: launchData } = await supabase
        .from('app_analytics')
        .select('platform, display_mode')
        .eq('event_type', 'app_launch');

      // 3. Registered profiles / users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Update counters in UI
      const installEl = document.getElementById('stat-total-installs');
      if (installEl) installEl.textContent = (installCount !== null && installCount !== undefined) ? installCount : '0';

      const launchEl = document.getElementById('stat-total-launches');
      if (launchEl) launchEl.textContent = (launchCount !== null && launchCount !== undefined) ? launchCount : '0';

      const userEl = document.getElementById('stat-total-users');
      if (userEl) userEl.textContent = (userCount !== null && userCount !== undefined) ? userCount : '1';

      if (launchData && launchData.length > 0) {
        const standaloneCount = launchData.filter(d => d.display_mode === 'standalone').length;
        const ratio = Math.round((standaloneCount / launchData.length) * 100);
        const ratioEl = document.getElementById('stat-app-ratio');
        if (ratioEl) ratioEl.textContent = `${ratio}% App`;

        // Platform breakdown
        const platforms = {};
        launchData.forEach(d => {
          const p = d.platform || 'Other';
          platforms[p] = (platforms[p] || 0) + 1;
        });

        const platformContainer = document.getElementById('platform-breakdown-container');
        if (platformContainer) {
          platformContainer.innerHTML = Object.entries(platforms).map(([plat, count]) => {
            const pct = Math.round((count / launchData.length) * 100);
            const iconMap = {
              'Windows': 'fa-brands fa-windows',
              'Android': 'fa-brands fa-android',
              'iOS': 'fa-brands fa-apple',
              'macOS': 'fa-brands fa-apple',
              'Linux': 'fa-brands fa-linux'
            };
            const icon = iconMap[plat] || 'fa-solid fa-desktop';
            return `
              <div style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--color-card); border:1px solid var(--color-border); border-radius:20px; font-size:0.75rem; font-weight:600;">
                <i class="${icon}"></i>
                <span>${plat}:</span>
                <span style="color:var(--color-primary);">${count} (${pct}%)</span>
              </div>
            `;
          }).join('');
        }
      } else {
        const ratioEl = document.getElementById('stat-app-ratio');
        if (ratioEl) ratioEl.textContent = '100% Web';
        const platformContainer = document.getElementById('platform-breakdown-container');
        if (platformContainer) {
          platformContainer.innerHTML = `<span style="font-size: 0.8rem; color: var(--color-text-muted);">No sessions recorded yet.</span>`;
        }
      }
    } catch (err) {
      console.warn('Telemetry load note:', err);
    }
  }

  function refreshUI(targetSection = null) {
    updateSummary();
    applyDarkMode();
    updateCurrencyPreview(state.settings?.currency);
    const curSelect = document.getElementById('currency-select');
    if (curSelect && state.settings?.currency) {
      curSelect.value = state.settings.currency;
    }

    if (targetSection) {
      renderSection(targetSection);
      return;
    }

    const active = getActiveSectionName();
    renderSection(active);

    renderedSections.forEach(sec => {
      if (sec !== active) {
        renderSection(sec);
      }
    });

    requestAnimationFrame(() => {
      ['category', 'spending', 'trend'].forEach(k => {
        const chart = chartInstances[k];
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    });
  }

  // =========================================================================
  // Phase 2: Private Vault, Device PIN Lock & Privacy Shield Implementation
  // =========================================================================

  function getVaultStorageKey() {
    return `ledgio_vault_${getUserId()}`;
  }

  function loadVaultConfig() {
    try {
      const raw = localStorage.getItem(getVaultStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        vaultConfig = Object.assign(vaultConfig, parsed);
        vaultConfig.biometricEnabled = Boolean(parsed.biometricEnabled && parsed.biometricCredentialId);
        vaultConfig.biometricCredentialId = parsed.biometricCredentialId || null;
      } else {
        vaultConfig.biometricEnabled = false;
        vaultConfig.biometricCredentialId = null;
      }
      const storedStealth = localStorage.getItem(`ledgio_stealth_${getUserId()}`);
      if (storedStealth !== null) {
        isStealthModeActive = (storedStealth === 'true');
      } else if (vaultConfig.stealthMode) {
        isStealthModeActive = true;
      }
    } catch (e) {
      console.warn('Error loading vault config:', e);
    }
  }

  function saveVaultConfig() {
    try {
      localStorage.setItem(getVaultStorageKey(), JSON.stringify(vaultConfig));
      localStorage.setItem(`ledgio_stealth_${getUserId()}`, isStealthModeActive ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving vault config:', e);
      if (isQuotaExceededError(e)) {
        showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
  }

  async function hashPin(pin, salt) {
    const combined = `${pin}:${salt}:ledgio_vault_v2`;
    if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
    }
    // Fallback hash for non-secure contexts (e.g. plain HTTP local testing)
    let hash = 5381;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) + hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }

  function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // WebAuthn Biometric Authenticator Helpers
  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBuffer(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function checkBiometricSupport() {
    try {
      if (window.PublicKeyCredential && 
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return Boolean(available);
      }
    } catch (e) {
      console.warn('[Ledgio Vault] Biometric check error:', e);
    }
    return false;
  }

  async function enrollBiometrics() {
    if (!vaultConfig.pinEnabled || !vaultConfig.pinHash) {
      showToast('Please set a 4-digit PIN first as your primary passkey', 'warning');
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = getUserId() || 'ledgio_vault_user';
      const userBytes = new TextEncoder().encode(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'Ledgio Vault',
            id: window.location.hostname
          },
          user: {
            id: userBytes,
            name: (typeof currentUser !== 'undefined' && currentUser?.email) ? currentUser.email : 'ledgio_user',
            displayName: 'Ledgio Vault User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'discouraged'
          },
          timeout: 60000
        }
      });

      if (credential && credential.rawId) {
        const credId = bufferToBase64Url(credential.rawId);
        vaultConfig.biometricEnabled = true;
        vaultConfig.biometricCredentialId = credId;
        saveVaultConfig();
        updateVaultSettingsUI();
        showToast('Fingerprint unlock enrolled successfully', 'success');
        return true;
      }
    } catch (err) {
      console.warn('[Ledgio Vault] Biometric enrollment error:', err);
      vaultConfig.biometricEnabled = false;
      vaultConfig.biometricCredentialId = null;
      saveVaultConfig();
      updateVaultSettingsUI();
      if (err.name === 'NotAllowedError') {
        showToast('Biometric setup was cancelled', 'info');
      } else {
        showToast('Device biometric sensor unavailable or error occurred', 'error');
      }
    }
    return false;
  }

  async function authenticateWithBiometrics() {
    if (!vaultConfig.biometricEnabled || !vaultConfig.biometricCredentialId) return false;
    if (Date.now() < lockoutTimestamp) {
      showToast('PIN cooldown active. Please wait.', 'error');
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const credBuffer = base64UrlToBuffer(vaultConfig.biometricCredentialId);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: credBuffer,
            type: 'public-key',
            transports: ['internal']
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (assertion) {
        console.log('[Ledgio Vault] Biometric unlock successful.');
        failedPinAttempts = 0;
        lockoutTimestamp = 0;
        hideLockScreen();
        showToast('🔒 Private Vault Unlocked with Biometrics', 'success');
        return true;
      }
    } catch (err) {
      console.warn('[Ledgio Vault] Biometric verification error:', err);
      if (err.name !== 'NotAllowedError') {
        showToast('Biometric verification failed. Please enter your PIN.', 'info');
      }
    }
    return false;
  }

  function updateVaultSettingsUI() {
    const badge = document.getElementById('vault-status-badge');
    const pinToggle = document.getElementById('vault-pin-toggle');
    const changePinRow = document.getElementById('change-pin-row');
    const stealthToggle = document.getElementById('vault-stealth-toggle');
    const autoLockSelect = document.getElementById('auto-lock-select');
    const biometricRow = document.getElementById('vault-biometric-row');
    const biometricToggle = document.getElementById('vault-biometric-toggle');
    const biometricHint = document.getElementById('vault-biometric-hint');

    const isVaultProtected = Boolean(vaultConfig && vaultConfig.pinEnabled && vaultConfig.pinHash);

    if (badge) {
      if (isVaultProtected) {
        badge.innerHTML = '<i class="fas fa-lock"></i> Vault Protected';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      } else {
        badge.innerHTML = '<i class="fas fa-unlock"></i> Unprotected';
        badge.style.background = 'rgba(244, 63, 94, 0.12)';
        badge.style.color = '#f43f5e';
        badge.style.borderColor = 'rgba(244, 63, 94, 0.25)';
      }
    }

    if (pinToggle) pinToggle.checked = isVaultProtected;
    if (changePinRow) changePinRow.style.display = isVaultProtected ? 'flex' : 'none';
    if (stealthToggle) stealthToggle.checked = Boolean(isStealthModeActive);
    if (autoLockSelect) autoLockSelect.value = String(vaultConfig.autoLockTimeout);

    // Biometric Row handling
    if (biometricRow && biometricToggle) {
      biometricRow.style.display = 'flex';
      const noteEl = document.getElementById('vault-biometric-note');
      if (!isVaultProtected) {
        biometricToggle.checked = false;
        biometricToggle.disabled = false;
        if (biometricHint) biometricHint.textContent = 'Set a 4-digit PIN first to enable';
        if (noteEl) noteEl.style.display = 'none';
      } else {
        biometricToggle.disabled = false;
        biometricToggle.checked = Boolean(vaultConfig.biometricEnabled && vaultConfig.biometricCredentialId);
        if (biometricHint) biometricHint.textContent = 'Unlock with your device sensor (PIN required)';
      }
    }

    const stealthBtn = document.getElementById('stealth-mode-btn');
    if (stealthBtn) {
      if (isStealthModeActive) {
        stealthBtn.classList.add('active');
        stealthBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        stealthBtn.setAttribute('title', 'Unmask Balances');
      } else {
        stealthBtn.classList.remove('active');
        stealthBtn.innerHTML = '<i class="fas fa-eye"></i>';
        stealthBtn.setAttribute('title', 'Mask Balances (Stealth Mode)');
      }
    }

    // Always sync the profile dropdown status row
    updateUserProfileDropdownContent();
  }

  async function showLockScreen() {
    if (!vaultConfig.pinEnabled || !vaultConfig.pinHash) return;
    isVaultLocked = true;
    currentEnteredPin = '';
    isVerifyingPin = false;

    updatePinDots('lock');
    document.documentElement.classList.add('vault-locked');

    const modal = document.getElementById('vault-lock-modal');
    if (modal) modal.style.display = 'flex';

    // Biometric button visibility on lock screen
    const bioContainer = document.getElementById('vault-biometric-container');
    if (bioContainer) {
      if (vaultConfig.biometricEnabled && vaultConfig.biometricCredentialId) {
        const isBioSupported = await checkBiometricSupport();
        bioContainer.style.display = isBioSupported ? 'block' : 'none';
      } else {
        bioContainer.style.display = 'none';
      }
    }

    const errBanner = document.getElementById('lock-error-msg');
    if (errBanner) {
      if (Date.now() < lockoutTimestamp) {
        const remainingSec = Math.ceil((lockoutTimestamp - Date.now()) / 1000);
        const errText = document.getElementById('lock-error-text');
        if (errText) errText.textContent = `Too many failed attempts. Cooldown: ${remainingSec}s`;
        errBanner.style.display = 'flex';
      } else {
        errBanner.style.display = 'none';
      }
    }
  }

  function hideLockScreen() {
    isVaultLocked = false;
    currentEnteredPin = '';
    isVerifyingPin = false;
    updatePinDots('lock');
    document.documentElement.classList.remove('vault-locked');
    const modal = document.getElementById('vault-lock-modal');
    if (modal) modal.style.display = 'none';
  }

  function updatePinDots(modalType) {
    const dotsContainer = document.getElementById(modalType === 'setup' ? 'setup-pin-dots' : 'lock-pin-dots');
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < currentEnteredPin.length) {
        dot.classList.add('filled');
        dot.classList.remove('error');
      } else {
        dot.classList.remove('filled');
        dot.classList.remove('error');
      }
    });
  }

  async function handleNumpadKey(key, modalType) {
    if (modalType === 'lock') {
      if (isVerifyingPin) return;

      const now = Date.now();
      if (key === lastLockKey && (now - lastLockKeyTime) < 120) {
        return;
      }
      lastLockKey = key;
      lastLockKeyTime = now;

      if (Date.now() < lockoutTimestamp) {
        const remainingSec = Math.ceil((lockoutTimestamp - Date.now()) / 1000);
        showToast(`Cooldown active. Please wait ${remainingSec}s`, 'error');
        return;
      }

      if (key === 'clear') {
        currentEnteredPin = '';
        updatePinDots('lock');
        return;
      }
      if (key === 'backspace') {
        currentEnteredPin = currentEnteredPin.slice(0, -1);
        updatePinDots('lock');
        return;
      }
      if (/^[0-9]$/.test(key) && currentEnteredPin.length < 4) {
        currentEnteredPin += key;
        updatePinDots('lock');
        if (currentEnteredPin.length === 4) {
          await verifyLockPin();
        }
      }
    } else if (modalType === 'setup') {
      if (isSettingUpPin) return;

      const now = Date.now();
      if (key === lastSetupKey && (now - lastSetupKeyTime) < 120) {
        return;
      }
      lastSetupKey = key;
      lastSetupKeyTime = now;

      if (key === 'clear') {
        currentEnteredPin = '';
        updatePinDots('setup');
        return;
      }
      if (key === 'backspace') {
        currentEnteredPin = currentEnteredPin.slice(0, -1);
        updatePinDots('setup');
        return;
      }
      if (/^[0-9]$/.test(key) && currentEnteredPin.length < 4) {
        currentEnteredPin += key;
        updatePinDots('setup');
        if (currentEnteredPin.length === 4) {
          await handleSetupPinInput();
        }
      }
    }
  }

  async function verifyLockPin() {
    if (isVerifyingPin) return;
    isVerifyingPin = true;

    try {
      if (!vaultConfig.pinSalt || !vaultConfig.pinHash) {
        isVerifyingPin = false;
        hideLockScreen();
        return;
      }

      const computedHash = await hashPin(currentEnteredPin, vaultConfig.pinSalt);
      if (computedHash === vaultConfig.pinHash) {
        failedPinAttempts = 0;
        isVerifyingPin = false;
        hideLockScreen();
        showToast('🔒 Private Vault Unlocked', 'success');
      } else {
        failedPinAttempts++;
        const dotsContainer = document.getElementById('lock-pin-dots');
        if (dotsContainer) {
          dotsContainer.classList.add('shake');
          dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
          setTimeout(() => {
            dotsContainer.classList.remove('shake');
          }, 400);
        }

        const errBanner = document.getElementById('lock-error-msg');
        const errText = document.getElementById('lock-error-text');

        if (failedPinAttempts >= 5) {
          lockoutTimestamp = Date.now() + 30000;
          if (errText) errText.textContent = 'Too many attempts. Cooldown for 30s.';
          if (errBanner) errBanner.style.display = 'flex';
          showToast('Too many attempts. Cooldown for 30s', 'error');
        } else {
          if (errText) errText.textContent = `Incorrect PIN (${5 - failedPinAttempts} attempts left).`;
          if (errBanner) errBanner.style.display = 'flex';
          showToast(`Incorrect PIN (${5 - failedPinAttempts} attempts left)`, 'error');
        }

        setTimeout(() => {
          currentEnteredPin = '';
          updatePinDots('lock');
          isVerifyingPin = false;
        }, 700);
      }
    } catch (err) {
      console.error('[Vault] Verification error:', err);
      showToast('Error verifying PIN. Please try again.', 'error');
      currentEnteredPin = '';
      updatePinDots('lock');
      isVerifyingPin = false;
    }
  }

  function openSetupPinModal(isChanging = false) {
    isChangingPin = Boolean(isChanging && vaultConfig.pinHash && vaultConfig.pinSalt);
    setupPinStep = isChangingPin ? 0 : 1;
    setupTempPin = '';
    currentEnteredPin = '';
    isSettingUpPin = false;
    updatePinDots('setup');

    const modal = document.getElementById('set-pin-modal');
    const title = document.getElementById('set-pin-title');
    const instruction = document.getElementById('set-pin-instruction');
    const errBanner = document.getElementById('setup-error-msg');

    if (title) {
      title.innerHTML = isChangingPin 
        ? '<i class="fas fa-key" style="color:#10b981;"></i> Change 4-Digit PIN' 
        : '<i class="fas fa-key" style="color:#10b981;"></i> Set 4-Digit PIN';
    }
    if (instruction) {
      instruction.textContent = isChangingPin 
        ? 'Enter your current 4-digit PIN' 
        : 'Step 1 of 2: Choose a 4-digit security PIN';
    }
    if (errBanner) errBanner.style.display = 'none';
    if (modal) modal.style.display = 'flex';
  }

  async function handleSetupPinInput() {
    if (isSettingUpPin) return;
    isSettingUpPin = true;

    try {
      if (setupPinStep === 0) {
        // Verifying current PIN before allowing PIN change
        const currentHash = await hashPin(currentEnteredPin, vaultConfig.pinSalt);
        if (currentHash === vaultConfig.pinHash) {
          setupPinStep = 1;
          currentEnteredPin = '';
          updatePinDots('setup');
          const instruction = document.getElementById('set-pin-instruction');
          if (instruction) instruction.textContent = 'Step 1 of 2: Enter new 4-digit PIN';
          const errBanner = document.getElementById('setup-error-msg');
          if (errBanner) errBanner.style.display = 'none';
          isSettingUpPin = false;
        } else {
          const dotsContainer = document.getElementById('setup-pin-dots');
          if (dotsContainer) {
            dotsContainer.classList.add('shake');
            dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
            setTimeout(() => dotsContainer.classList.remove('shake'), 400);
          }
          const errBanner = document.getElementById('setup-error-msg');
          const errText = document.getElementById('setup-error-text');
          if (errText) errText.textContent = 'Incorrect current PIN. Please try again.';
          if (errBanner) errBanner.style.display = 'flex';
          showToast('Incorrect current PIN', 'error');

          setTimeout(() => {
            currentEnteredPin = '';
            updatePinDots('setup');
            isSettingUpPin = false;
          }, 700);
        }
      } else if (setupPinStep === 1) {
        setupTempPin = currentEnteredPin;
        setupPinStep = 2;
        currentEnteredPin = '';
        updatePinDots('setup');
        const instruction = document.getElementById('set-pin-instruction');
        if (instruction) instruction.textContent = 'Step 2 of 2: Re-enter new PIN to confirm';
        isSettingUpPin = false;
      } else if (setupPinStep === 2) {
        if (currentEnteredPin === setupTempPin) {
          const newSalt = generateSalt();
          const newHash = await hashPin(currentEnteredPin, newSalt);
          vaultConfig.pinEnabled = true;
          vaultConfig.pinHash = newHash;
          vaultConfig.pinSalt = newSalt;
          saveVaultConfig();
          updateVaultSettingsUI();

          const modal = document.getElementById('set-pin-modal');
          if (modal) modal.style.display = 'none';
          const wasChanging = isChangingPin;
          isChangingPin = false;
          setupPinStep = 1;
          setupTempPin = '';
          currentEnteredPin = '';
          isSettingUpPin = false;
          showToast(wasChanging ? '✅ Vault PIN changed successfully!' : '✅ 4-Digit Device PIN successfully enabled!', 'success');
        } else {
          const dotsContainer = document.getElementById('setup-pin-dots');
          if (dotsContainer) {
            dotsContainer.classList.add('shake');
            dotsContainer.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
            setTimeout(() => dotsContainer.classList.remove('shake'), 400);
          }
          const errBanner = document.getElementById('setup-error-msg');
          const errText = document.getElementById('setup-error-text');
          if (errText) errText.textContent = 'PINs did not match. Please try again.';
          if (errBanner) errBanner.style.display = 'flex';

          setTimeout(() => {
            setupPinStep = 1;
            setupTempPin = '';
            currentEnteredPin = '';
            updatePinDots('setup');
            const instruction = document.getElementById('set-pin-instruction');
            if (instruction) instruction.textContent = isChangingPin ? 'Step 1 of 2: Enter new 4-digit PIN' : 'Step 1 of 2: Choose a 4-digit security PIN';
            if (errBanner) errBanner.style.display = 'none';
            isSettingUpPin = false;
          }, 1000);
        }
      }
    } catch (err) {
      console.error('[Vault] Setup error:', err);
      showToast('Error setting PIN. Please try again.', 'error');
      currentEnteredPin = '';
      updatePinDots('setup');
      isSettingUpPin = false;
    }
  }

  function toggleStealthMode(forceState, broadcast = true) {
    if (typeof forceState === 'boolean') {
      isStealthModeActive = forceState;
    } else {
      isStealthModeActive = !isStealthModeActive;
    }

    const btn = document.getElementById('stealth-mode-btn');
    if (btn) {
      if (isStealthModeActive) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        btn.setAttribute('title', 'Unmask Balances');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-eye"></i>';
        btn.setAttribute('title', 'Mask Balances (Stealth Mode)');
      }
    }

    const vaultStealthToggle = document.getElementById('vault-stealth-toggle');
    if (vaultStealthToggle) {
      vaultStealthToggle.checked = isStealthModeActive;
    }

    saveVaultConfig();
    refreshUI();

    const repTotal = document.getElementById('reports-month-total');
    if (repTotal) {
      if (isStealthModeActive) repTotal.classList.add('stealth-masked');
      else repTotal.classList.remove('stealth-masked');
    }

    const dashCenterTotal = document.getElementById('dashboard-category-center-total');
    if (dashCenterTotal) {
      if (isStealthModeActive) dashCenterTotal.classList.add('stealth-masked');
      else dashCenterTotal.classList.remove('stealth-masked');
    }

    const dashCatTotal = document.getElementById('dashboard-category-total');
    if (dashCatTotal) {
      if (isStealthModeActive) dashCatTotal.classList.add('stealth-masked');
      else dashCatTotal.classList.remove('stealth-masked');
    }

    updateNetWorthUI();

    // Update loan settlement modal if open
    const settleModal = document.getElementById('loan-settlement-modal');
    if (settleModal && settleModal.style.display === 'flex') {
      const sLoanId = document.getElementById('settlement-loan-id')?.value;
      if (sLoanId) {
        const sLoan = (state?.loans || []).find(l => l.id === sLoanId);
        if (sLoan) {
          const sDetails = getLoanDetails(sLoan);
          const pEl = document.getElementById('settlement-target-principal');
          const oEl = document.getElementById('settlement-target-outstanding');
          if (pEl) {
            pEl.textContent = formatCurrency(sDetails.principal);
            pEl.classList.toggle('stealth-masked', isStealthModeActive);
          }
          if (oEl) {
            oEl.textContent = formatCurrency(sDetails.outstanding);
            oEl.classList.toggle('stealth-masked', isStealthModeActive);
          }
          updateSettlementPreview();
        }
      }
    }

    // Update loan history modal if open
    const historyModal = document.getElementById('loan-history-modal');
    if (historyModal && historyModal.style.display === 'flex' && historyModal.dataset.loanId) {
      openLoanHistoryModal(historyModal.dataset.loanId);
    }

    if (broadcast) {
      broadcastSyncEvent('STEALTH_TOGGLED', {
        isStealth: isStealthModeActive,
        userId: getUserId()
      });
    }
  }

  function initInactivityTimer() {
    const resetActivity = () => {
      lastActivityTimestamp = Date.now();
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetActivity, { passive: true });
    });

    setInterval(() => {
      if (!vaultConfig.pinEnabled || !vaultConfig.pinHash || isVaultLocked || vaultConfig.autoLockTimeout <= 0) return;
      const idleMs = Date.now() - lastActivityTimestamp;
      const thresholdMs = vaultConfig.autoLockTimeout * 60 * 1000;
      if (idleMs >= thresholdMs) {
        console.log('[Ledgio Vault] Inactivity threshold reached. Locking private vault...');
        showLockScreen();
      }
    }, 5000);
  }

  function initVaultVisibilityAutoLock() {
    // Auto-lock vault immediately on visibility loss if timeout is set to 0 (Immediate)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (vaultConfig.pinEnabled && vaultConfig.pinHash && vaultConfig.autoLockTimeout === 0) {
          showLockScreen();
        }
      } else if (document.visibilityState === 'visible') {
        if (vaultConfig.pinEnabled && vaultConfig.pinHash && !isVaultLocked && vaultConfig.autoLockTimeout > 0) {
          const idleMs = Date.now() - lastActivityTimestamp;
          const thresholdMs = vaultConfig.autoLockTimeout * 60 * 1000;
          if (idleMs >= thresholdMs) {
            showLockScreen();
          }
        }
      }
    }, { capture: true });

    window.addEventListener('focus', () => {
      if (vaultConfig.pinEnabled && vaultConfig.pinHash && !isVaultLocked && vaultConfig.autoLockTimeout > 0) {
        const idleMs = Date.now() - lastActivityTimestamp;
        const thresholdMs = vaultConfig.autoLockTimeout * 60 * 1000;
        if (idleMs >= thresholdMs) {
          showLockScreen();
        }
      }
    });
  }

  // =========================================================================
  // Phase 4 (Milestone 4.1): Target Savings Goals & Milestones Engine (delegated to window.LedgioGoals)
  // =========================================================================

  function getGoalCurrentAmount(goalId) {
    return window.LedgioGoals ? window.LedgioGoals.getGoalCurrentAmount(goalId) : 0;
  }

  function getGoalProgress(goal) {
    return window.LedgioGoals ? window.LedgioGoals.getGoalProgress(goal) : { current: 0, target: 1, percent: 0, remaining: 1, isCompleted: false };
  }

  function renderGoals() {
    return window.LedgioGoals ? window.LedgioGoals.renderGoals() : null;
  }

  function createGoal(params) {
    return window.LedgioGoals ? window.LedgioGoals.createGoal(params) : null;
  }

  function updateGoal(goalId, params) {
    return window.LedgioGoals ? window.LedgioGoals.updateGoal(goalId, params) : null;
  }

  function deleteGoal(goalId) {
    return window.LedgioGoals ? window.LedgioGoals.deleteGoal(goalId) : null;
  }

  function restoreDeletedGoal() {
    return window.LedgioGoals ? window.LedgioGoals.restoreDeletedGoal() : null;
  }

  function addGoalDeposit(goalId, amount, date, note, isWithdrawal, recordAsExpense) {
    return window.LedgioGoals ? window.LedgioGoals.addGoalDeposit(goalId, amount, date, note, isWithdrawal, recordAsExpense) : null;
  }

  function fireConfetti() {
    return window.LedgioGoals ? window.LedgioGoals.fireConfetti() : null;
  }

  function showUndoToast(message, onUndo) {
    return window.LedgioGoals ? window.LedgioGoals.showUndoToast(message, onUndo) : (showToast(message, 'info'), setTimeout(onUndo, 5000));
  }

  function openGoalModal(goalId = null) {
    return window.LedgioGoals ? window.LedgioGoals.openGoalModal(goalId) : null;
  }

  function closeGoalModal() {
    return window.LedgioGoals ? window.LedgioGoals.closeGoalModal() : null;
  }

  function openDepositModal(goalId) {
    return window.LedgioGoals ? window.LedgioGoals.openDepositModal(goalId) : null;
  }

  function closeDepositModal() {
    return window.LedgioGoals ? window.LedgioGoals.closeDepositModal() : null;
  }

  function setDepositModalMode(mode) {
    return window.LedgioGoals ? window.LedgioGoals.setDepositModalMode(mode) : null;
  }

  function updateDepositPreview() {
    return window.LedgioGoals ? window.LedgioGoals.updateDepositPreview() : null;
  }

  function openDeleteGoalModal(goalId) {
    return window.LedgioGoals ? window.LedgioGoals.openDeleteGoalModal(goalId) : null;
  }

  function closeDeleteGoalModal() {
    return window.LedgioGoals ? window.LedgioGoals.closeDeleteGoalModal() : null;
  }

  function setupGoalsEventListeners() {
    return window.LedgioGoals ? window.LedgioGoals.setupGoalsEventListeners() : null;
  }

  // =========================================================================
  // Expenses & Budgets Domain Bridge (extracted to expenses.js)
  // =========================================================================
  if (window.LedgioExpenses && typeof window.LedgioExpenses.configure === 'function') {
    window.LedgioExpenses.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      enqueueMutation: (t, a, d, id) => enqueueMutation(t, a, d, id),
      saveData: () => saveData(),
      refreshUI: () => refreshUI(),
      showToast: (msg, type) => showToast(msg, type),
      showConfirm: async (msg) => (typeof showConfirm === 'function' ? await showConfirm(msg) : window.confirm(msg)),
      formatCurrency: (val, bypass) => formatCurrency(val, bypass),
      escapeHtml: (str) => escapeHtml(str),
      sanitizeColor: (col, fb) => sanitizeColor(col, fb),
      sanitizeIcon: (ic, fb) => sanitizeIcon(ic, fb),
      getCategoryMeta: (cat) => getCategoryMeta(cat),
      totalIncome: () => totalIncome(),
      isDevOrTest: Boolean(isDevOrTest)
    });
  }

  // =========================================================================
  // Categories Domain Bridge (extracted to categories.js)
  // =========================================================================
  if (window.LedgioCategories && typeof window.LedgioCategories.configure === 'function') {
    window.LedgioCategories.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      getSupabaseClient: () => supabase,
      enqueueMutation: (t, a, d, id) => enqueueMutation(t, a, d, id),
      getSyncQueue: () => getSyncQueue(),
      saveData: () => saveData(),
      refreshUI: () => refreshUI(),
      populateDropdowns: () => populateDropdowns(),
      showToast: (msg, type) => showToast(msg, type),
      showConfirm: async (msg) => (typeof showConfirm === 'function' ? await showConfirm(msg) : window.confirm(msg)),
      escapeHtml: (str) => escapeHtml(str),
      isDevOrTest: Boolean(isDevOrTest)
    });
  }

  // Savings Goals Domain Bridge (extracted to goals.js)
  if (window.LedgioGoals && typeof window.LedgioGoals.configure === 'function') {
    window.LedgioGoals.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      isStealthModeActive: () => isStealthModeActive,
      formatCurrency: (amt, hideDec) => formatCurrency(amt, hideDec),
      escapeHtml: (str) => escapeHtml(str),
      sanitizeColor: (col, fb) => sanitizeColor(col, fb),
      sanitizeIcon: (ic, fb) => sanitizeIcon(ic, fb),
      getLocalDateString: (d) => getLocalDateString(d),
      showToast: (msg, type) => showToast(msg, type),
      showUndoToast: (msg, onUndo) => showUndoToast(msg, onUndo),
      saveData: () => saveData(),
      enqueueMutation: (t, a, d) => enqueueMutation(t, a, d),
      getSyncQueue: () => getSyncQueue(),
      saveSyncQueue: (q) => saveSyncQueue(q),
      updateSummary: () => updateSummary(),
      renderExpenses: () => renderExpenses(),
      renderAllExpenses: () => renderAllExpenses(),
      isDevOrTest: Boolean(isDevOrTest)
    });
  }

  // =========================================================================
  // Phase 6: Income Ledger Domain Bridge (extracted to income.js)
  // =========================================================================
  if (window.LedgioIncome && typeof window.LedgioIncome.configure === 'function') {
    window.LedgioIncome.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      getCurrency: () => state?.settings?.currency || 'INR',
      formatCurrency: (amt, hideDec) => formatCurrency(amt, hideDec),
      escapeHtml: (str) => escapeHtml(str),
      isStealthModeActive: () => isStealthModeActive,
      enqueueMutation: (t, a, d) => enqueueMutation(t, a, d),
      saveData: () => saveData(),
      updateSummary: () => updateSummary(),
      showToast: (msg, type) => showToast(msg, type),
      showConfirm: async (msg) => (typeof showConfirm === 'function' ? await showConfirm(msg) : window.confirm(msg)),
      getLegacyIncome: () => legacyIncome,
      isDevOrTest: () => Boolean(isDevOrTest)
    });
  }

  // =========================================================================
  // Phase 5: Loans & Debts Domain Bridge (extracted to loans.js)
  // =========================================================================
  if (window.LedgioLoans && typeof window.LedgioLoans.configure === 'function') {
    window.LedgioLoans.configure({
      getState: () => state,
      getCurrentUser: () => currentUser,
      getUserId: () => getUserId(),
      isStealthModeActive: () => isStealthModeActive,
      formatCurrency: (val, bypass) => formatCurrency(val, bypass),
      escapeHtml: (str) => escapeHtml(str),
      getLocalDateString: (d) => getLocalDateString(d),
      showToast: (msg, type) => showToast(msg, type),
      showUndoToast: (msg, onUndo) => showUndoToast(msg, onUndo),
      fireConfetti: () => fireConfetti(),
      saveData: () => saveData(),
      saveIncomeEntries: () => saveIncomeEntries(),
      enqueueMutation: (t, a, d) => enqueueMutation(t, a, d),
      getSyncQueue: () => getSyncQueue(),
      saveSyncQueue: (q) => saveSyncQueue(q),
      updateSummary: () => updateSummary(),
      updateNetWorthUI: () => updateNetWorthUI(),
      isDevOrTest: Boolean(isDevOrTest)
    });
  }

  function getLoanSettledAmount(loanId) {
    return window.LedgioLoans ? window.LedgioLoans.getLoanSettledAmount(loanId) : 0;
  }

  function getLoanDetails(loan) {
    return window.LedgioLoans ? window.LedgioLoans.getLoanDetails(loan) : { principal: 0, settled: 0, outstanding: 0, percent: 0, isSettled: true };
  }

  function updatePeopleDatalist() {
    return window.LedgioLoans ? window.LedgioLoans.updatePeopleDatalist() : null;
  }

  function renderLoans() {
    return window.LedgioLoans ? window.LedgioLoans.renderLoans() : null;
  }

  // Modal Openers and CRUD Operations (delegated to window.LedgioLoans)
  function openCreateLoanModal(loanId = null, prefillPerson = '') {
    return window.LedgioLoans ? window.LedgioLoans.openCreateLoanModal(loanId, prefillPerson) : null;
  }

  function openLoanModal(loanId = null, prefillPerson = '') {
    return window.LedgioLoans ? window.LedgioLoans.openLoanModal(loanId, prefillPerson) : null;
  }

  function closeLoanModal() {
    return window.LedgioLoans ? window.LedgioLoans.closeLoanModal() : null;
  }

  function findOpeningLoanAdjustment(loan) {
    return window.LedgioLoans ? window.LedgioLoans.findOpeningLoanAdjustment(loan) : null;
  }

  function createLoan(direction, personName, principal, loanDate, notes, kind = 'cash') {
    return window.LedgioLoans ? window.LedgioLoans.createLoan(direction, personName, principal, loanDate, notes, kind) : null;
  }

  function saveLoan() {
    return window.LedgioLoans ? window.LedgioLoans.saveLoan() : null;
  }

  function openSettlementModal(loanId) {
    return window.LedgioLoans ? window.LedgioLoans.openSettlementModal(loanId) : null;
  }

  function closeSettlementModal() {
    return window.LedgioLoans ? window.LedgioLoans.closeSettlementModal() : null;
  }

  function updateSettlementPreview() {
    return window.LedgioLoans ? window.LedgioLoans.updateSettlementPreview() : null;
  }

  function recordSettlement(loanId, amount, settleDate, note, recordAsExpense = true, expenseCategory = 'Other') {
    return window.LedgioLoans ? window.LedgioLoans.recordSettlement(loanId, amount, settleDate, note, recordAsExpense, expenseCategory) : null;
  }

  function saveSettlement() {
    return window.LedgioLoans ? window.LedgioLoans.saveSettlement() : null;
  }

  function openLoanHistoryModal(loanId) {
    return window.LedgioLoans ? window.LedgioLoans.openLoanHistoryModal(loanId) : null;
  }

  function closeLoanHistoryModal() {
    return window.LedgioLoans ? window.LedgioLoans.closeLoanHistoryModal() : null;
  }

  function openRenamePersonModal(personName) {
    return window.LedgioLoans ? window.LedgioLoans.openRenamePersonModal(personName) : null;
  }

  function closeRenamePersonModal() {
    return window.LedgioLoans ? window.LedgioLoans.closeRenamePersonModal() : null;
  }

  function saveRenamePerson() {
    return window.LedgioLoans ? window.LedgioLoans.saveRenamePerson() : null;
  }

  function openDeleteLoanModal(loanId) {
    return window.LedgioLoans ? window.LedgioLoans.openDeleteLoanModal(loanId) : null;
  }

  function closeDeleteLoanModal() {
    return window.LedgioLoans ? window.LedgioLoans.closeDeleteLoanModal() : null;
  }

  function deleteLoan(loanId) {
    return window.LedgioLoans ? window.LedgioLoans.deleteLoan(loanId) : null;
  }

  function restoreDeletedLoan() {
    return window.LedgioLoans ? window.LedgioLoans.restoreDeletedLoan() : null;
  }

  function setupLoansEventListeners() {
    return window.LedgioLoans ? window.LedgioLoans.setupLoansEventListeners() : null;
  }

  // Event Listeners Setup (Isolated with try-catch blocks)
  function setupEventListeners() {
    function openSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar) sidebar.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      document.body.classList.add('sidebar-open');
    }

    function closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar) sidebar.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      document.body.classList.remove('sidebar-open');
    }

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('active')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }

    try {
      setupGoalsEventListeners();
    } catch (e) {
      console.error('[Ledgio] Failed to setup goals event listeners:', e);
    }

    try {
      setupLoansEventListeners();
    } catch (e) {
      console.error('[Ledgio] Failed to setup loans event listeners:', e);
    }

    try {
      window.addEventListener('online', () => {
        fetchLiveExchangeRates(true);
      });
      window.addEventListener('offline', () => {
        updateRatesFreshnessUI();
      });

      window.addEventListener('popstate', () => {
        closeSidebar();
        navigateTo(window.location.hash || '#dashboard');
      });
    } catch (e) {
      console.error('[Ledgio] Failed to setup network/popstate listeners:', e);
    }

    // Mobile Sidebar Controller & Sidebar Widgets
    try {
      document.getElementById('mobile-sidebar-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
      });

      document.getElementById('sidebar-close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSidebar();
      });

      document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);

      // Nav Item Click: Always close the mobile sidebar
      document.querySelectorAll('.sidebar-nav .nav-link, .sidebar-footer .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          closeSidebar();
          if (link.id === 'logout-btn') {
            e.preventDefault();
            if (window.logout) window.logout();
            return;
          }
          e.preventDefault();
          const hash = link.getAttribute('href');
          history.pushState(null, '', hash);
          navigateTo(hash);
        });
      });

      // Desktop Collapsible Sidebar (Icon-Rail Mode)
      const collapseBtn = document.getElementById('sidebar-collapse-btn');
      const sidebar = document.getElementById('sidebar');

      function updateCollapseUI(isCollapsed) {
        document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed);
        if (sidebar) sidebar.classList.toggle('collapsed', isCollapsed);
        if (collapseBtn) {
          collapseBtn.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
          collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
          collapseBtn.setAttribute('data-tooltip', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
          const icon = collapseBtn.querySelector('i');
          if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
          }
        }
      }

      // Check initial state from storage or html class
      const uid = getUserId();
      const storedCollapse = localStorage.getItem('ledgio_sidebar_collapsed_' + uid) || localStorage.getItem('ledgio_sidebar_collapsed');
      const isInitiallyCollapsed = storedCollapse === 'true' && window.innerWidth >= 1024;
      updateCollapseUI(isInitiallyCollapsed);

      if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextState = !document.documentElement.classList.contains('sidebar-collapsed');
          updateCollapseUI(nextState);
          try {
            localStorage.setItem('ledgio_sidebar_collapsed_' + getUserId(), nextState ? 'true' : 'false');
          } catch (err) {}

          // Allow charts to reflow smoothly after width transition
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 220);
        });
      }

      // Escape Key Listener to dismiss sidebar & modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeSidebar();
        }
      });

      // Auto-close on resize to desktop (768px+) & dynamic mobile/desktop title/chart refresh
      let prevIsMobile = window.innerWidth <= 768;
      window.addEventListener('resize', () => {
        const curIsMobile = window.innerWidth <= 768;
        if (window.innerWidth > 768) {
          closeSidebar();
        }
        if (curIsMobile !== prevIsMobile) {
          prevIsMobile = curIsMobile;
          updateHeaderTitle();
          const currentHash = window.location.hash || '#dashboard';
          const sec = currentHash.replace('#', '') || 'dashboard';
          if (sec === 'reports') {
            if (typeof window.renderTrendChart === 'function') window.renderTrendChart();
            if (typeof window.renderSpendingChart === 'function') window.renderSpendingChart();
          }
        }
      });
    } catch (e) {
      console.error('[Ledgio] Failed to setup sidebar listeners:', e);
    }
    
    try {
      document.getElementById('dark-mode-btn')?.addEventListener('click', toggleDarkMode);
      
      // Expenses & Daily Nudge
      document.getElementById('nudge-add-now-btn')?.addEventListener('click', () => {
        const nameInput = document.getElementById('expense-name-input');
        if (nameInput) {
          nameInput.focus();
          nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      document.getElementById('nudge-dismiss-btn')?.addEventListener('click', () => {
        const todayStr = getLocalDateString();
        try {
          localStorage.setItem(`ledgio_nudge_dismissed_${todayStr}`, 'true');
        } catch (e) {}
        const banner = document.getElementById('daily-nudge-banner');
        if (banner) banner.style.display = 'none';
      });

      // Expenses & Budgets (delegated to window.LedgioExpenses)
      if (window.LedgioExpenses && typeof window.LedgioExpenses.setupExpensesEventListeners === 'function') {
        window.LedgioExpenses.setupExpensesEventListeners();
      }
    } catch (e) {
      console.error('[Ledgio] Failed to setup expense/filter listeners:', e);
    }
    
    // Income Management (Tabs, Quick Chips, Dynamic Preview & Updater)
    try {
      setupIncomeEventListeners();

      // Leftover Quick Action Listeners
      document.getElementById('leftover-act-btn')?.addEventListener('click', () => {
        const totalExpenses = (state.expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        const remaining = totalIncome() - totalExpenses;
        if (remaining <= 0) return;

        if (Array.isArray(state?.goals) && state.goals.length > 0) {
          openLeftoverGoalPicker(remaining);
        } else {
          openGoalModalWithLeftover(remaining);
        }
      });

      document.getElementById('leftover-dismiss-btn')?.addEventListener('click', () => {
        const currentMonthKey = getLocalCurrentMonthString();
        localStorage.setItem(`ledgio_leftover_dismissed_${currentMonthKey}`, 'true');
        updateLeftoverPromptUI();
      });

      document.getElementById('close-leftover-picker-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('leftover-goal-picker-modal');
        if (modal) modal.style.display = 'none';
      });
      document.getElementById('cancel-leftover-picker-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('leftover-goal-picker-modal');
        if (modal) modal.style.display = 'none';
      });
      
    } catch (e) {
      console.error('[Ledgio] Failed to setup income listeners:', e);
    }

    // User-Defined Custom Categories Listeners (delegated to window.LedgioCategories)
    if (window.LedgioCategories && typeof window.LedgioCategories.setupCategoriesEventListeners === 'function') {
      window.LedgioCategories.setupCategoriesEventListeners();
    }
    
    // Settings: Currency & Preferences
    document.getElementById('quick-currency-select')?.addEventListener('change', (e) => {
      promptCurrencyChange(e.target.value, e.target);
    });

    // Currency Conversion Modal Buttons
    document.getElementById('convert-all-btn')?.addEventListener('click', () => {
      if (pendingCurrencyChange) {
        executeCurrencyChange(pendingCurrencyChange.oldCur, pendingCurrencyChange.newCur, true);
      }
    });

    document.getElementById('convert-symbol-only-btn')?.addEventListener('click', () => {
      if (pendingCurrencyChange) {
        executeCurrencyChange(pendingCurrencyChange.oldCur, pendingCurrencyChange.newCur, false);
      }
    });

    document.getElementById('convert-cancel-btn')?.addEventListener('click', () => {
      if (pendingCurrencyChange && pendingCurrencyChange.sourceSelect) {
        pendingCurrencyChange.sourceSelect.value = pendingCurrencyChange.oldCur;
        updateCurrencyPreview(pendingCurrencyChange.oldCur);
      }
      const modal = document.getElementById('currency-convert-modal');
      if (modal) modal.style.display = 'none';
      pendingCurrencyChange = null;
    });

    // Live Interactive Theme Preview Cards & Switch
    document.getElementById('theme-card-light')?.addEventListener('click', () => {
      state.settings.darkMode = false;
      applyDarkMode();
    });

    document.getElementById('theme-card-dark')?.addEventListener('click', () => {
      state.settings.darkMode = true;
      applyDarkMode();
    });

    document.getElementById('dark-mode-toggle')?.addEventListener('change', (e) => {
      state.settings.darkMode = Boolean(e.target.checked);
      applyDarkMode();
    });

    document.getElementById('currency-select')?.addEventListener('change', (e) => {
      updateCurrencyPreview(e.target.value);
    });

    document.getElementById('save-settings')?.addEventListener('click', async () => {
      const cur = document.getElementById('currency-select').value;
      const dark = document.getElementById('dark-mode-toggle').checked;
      const oldCur = state.settings?.currency || DEFAULT_CURRENCY;

      state.settings.darkMode = dark;
      applyDarkMode();

      if (cur !== oldCur) {
        promptCurrencyChange(cur, document.getElementById('currency-select'));
      } else {
        saveData();
        if (supabase && currentUser) {
          try {
            await supabase.from('profiles').update({ 
              dark_mode: dark,
              updated_at: new Date().toISOString()
            }).eq('id', currentUser.id);
          } catch (err) {}
        }
        refreshUI();
        showToast('Preferences saved');
      }
    });

    // Refresh Telemetry Stats
    document.getElementById('refresh-analytics-btn')?.addEventListener('click', async () => {
      if (!isAdmin) return;
      const btn = document.getElementById('refresh-analytics-btn');
      if (btn) btn.innerHTML = '<i class="fas fa-arrows-rotate fa-spin"></i> Refreshing...';
      await loadTelemetryStats();
      if (btn) btn.innerHTML = '<i class="fas fa-arrows-rotate"></i> Refresh Stats';
      showToast('Telemetry stats updated', 'info');
    });
    
    // Data Management
    document.getElementById('export-data')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledgio_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    document.getElementById('export-csv')?.addEventListener('click', () => {
      const headers = ['Name', 'Category', 'Amount', 'Date'];
      const rows = state.expenses.map(e => [
        `"${e.name.replace(/"/g, '""')}"`,
        e.category,
        e.amount,
        e.date
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledgio_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    document.getElementById('import-data')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const queue = getSyncQueue();
      if (queue.length > 0) {
        const proceed = await showConfirm(`You have ${queue.length} unsynced offline change${queue.length > 1 ? 's' : ''}. Importing a backup will overwrite your ledger and discard pending changes. Proceed?`);
        if (!proceed) {
          e.target.value = '';
          return;
        }
        saveSyncQueue([]);
        saveDeadLetterQueue([]);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          localStorage.setItem(getStorageKey(), JSON.stringify(parsed));
          loadData();
          populateDropdowns();
          refreshUI();
          applyDarkMode();
          showToast('Data imported successfully');
        } catch (err) {
          showToast('Invalid JSON file', 'error');
        }
        e.target.value = ''; // reset input
      };
      reader.readAsText(file);
    });
    
    // Stealth Mode Header Button & Double-Click Toggles
    document.getElementById('stealth-mode-btn')?.addEventListener('click', () => toggleStealthMode());
    document.querySelectorAll('.summary-card, #monthly-income-card, #net-worth-card').forEach(card => {
      card.addEventListener('dblclick', () => toggleStealthMode());
    });

    // Interactive Summary Stat Cards: Tap-to-Toggle (Income & Expenses cards)
    ['income', 'expenses'].forEach(type => {
      const cardEl = document.getElementById(type === 'income' ? 'summary-income-card' : 'summary-expenses-card');
      if (!cardEl) return;
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
        toggleSummaryCard(type);
      });
      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSummaryCard(type);
        }
      });
    });

    // Private Vault & Security Settings Card Listeners
    document.getElementById('vault-pin-toggle')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (!vaultConfig.pinHash || !vaultConfig.pinSalt) {
          openSetupPinModal(false);
        } else {
          vaultConfig.pinEnabled = true;
          saveVaultConfig();
          updateVaultSettingsUI();
          showToast('🔒 4-Digit PIN protection activated', 'success');
        }
      } else {
        const confirmDisable = await showConfirm('Disable 4-Digit Device PIN protection? Your financial vault will no longer require a passcode on entry, and your fingerprint enrollment will also be removed.');
        if (confirmDisable) {
          vaultConfig.pinEnabled = false;
          vaultConfig.pinHash = null;
          vaultConfig.pinSalt = null;
          vaultConfig.biometricEnabled = false;
          vaultConfig.biometricCredentialId = null;
          saveVaultConfig();
          localStorage.removeItem('ledgio_vault_default_user');
          updateVaultSettingsUI();
          showToast('PIN protection and biometrics disabled', 'info');
        } else {
          e.target.checked = true;
        }
      }
    });

    document.getElementById('change-pin-btn')?.addEventListener('click', () => {
      openSetupPinModal(true);
    });

    // Biometric Fingerprint Enrollment Toggle
    document.getElementById('vault-biometric-toggle')?.addEventListener('change', async (e) => {
      const noteEl = document.getElementById('vault-biometric-note');
      if (e.target.checked) {
        if (!vaultConfig.pinEnabled || !vaultConfig.pinHash) {
          e.target.checked = false;
          showToast('Please set a 4-digit PIN first as your primary passkey', 'warning');
          return;
        }

        // Hardware biometric detection check via PublicKeyCredential
        let isHardwareAvailable = false;
        try {
          if (window.PublicKeyCredential && 
              typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
            isHardwareAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          }
        } catch (err) {
          console.warn('[Ledgio Vault] Hardware biometric check error:', err);
        }

        if (!isHardwareAvailable) {
          e.target.checked = false;
          if (noteEl) {
            noteEl.innerHTML = '<i class="fas fa-circle-info"></i> <span>No biometric hardware detected on this device — PIN unlock remains available.</span>';
            noteEl.style.display = 'flex';
          }
          return;
        }

        // Hardware available: proceed with enrollment
        if (noteEl) noteEl.style.display = 'none';
        const enrolled = await enrollBiometrics();
        if (!enrolled) {
          e.target.checked = false;
        }
      } else {
        if (noteEl) noteEl.style.display = 'none';
        vaultConfig.biometricEnabled = false;
        vaultConfig.biometricCredentialId = null;
        saveVaultConfig();
        updateVaultSettingsUI();
        showToast('Biometric unlock disabled', 'info');
      }
    });

    // Biometric Fingerprint Lock Screen Button
    document.getElementById('vault-biometric-btn')?.addEventListener('click', () => {
      authenticateWithBiometrics();
    });

    document.getElementById('vault-stealth-toggle')?.addEventListener('change', (e) => {
      toggleStealthMode(Boolean(e.target.checked));
    });

    document.getElementById('auto-lock-select')?.addEventListener('change', (e) => {
      vaultConfig.autoLockTimeout = parseInt(e.target.value, 10);
      saveVaultConfig();
    });

    document.getElementById('save-security-settings-btn')?.addEventListener('click', () => {
      saveVaultConfig();
      updateVaultSettingsUI();
      showToast('Private vault preferences saved', 'success');
    });

    // Expose numpad handler for early inline delegation and testing
    if (isDevOrTest) {
      window.__ledgio_handleNumpad = handleNumpadKey;
    }

    // Zero-lag Touch Keypad Listeners (Lock Screen & Setup Modals)
    document.querySelectorAll('#lock-numpad .num-key').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        handleNumpadKey(key, 'lock');
      });
    });

    document.querySelectorAll('#setup-numpad .num-key').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        handleNumpadKey(key, 'setup');
      });
    });

    // Close / Cancel PIN Setup Modal Helper
    const resetSetupPinState = () => {
      const modal = document.getElementById('set-pin-modal');
      if (modal) modal.style.display = 'none';
      isChangingPin = false;
      isSettingUpPin = false;
      setupPinStep = 1;
      setupTempPin = '';
      currentEnteredPin = '';
      updateVaultSettingsUI();
    };

    document.getElementById('cancel-set-pin-btn')?.addEventListener('click', resetSetupPinState);
    document.getElementById('close-set-pin-btn')?.addEventListener('click', resetSetupPinState);

    // Reset Vault PIN from PIN Lock Screen
    document.getElementById('vault-reset-pin-btn')?.addEventListener('click', async () => {
      const confirmed = await showConfirm('Reset your 4-digit Vault PIN? This will disable device PIN lock so you can access your ledger.');
      if (confirmed) {
        vaultConfig.pinEnabled = false;
        vaultConfig.pinHash = null;
        vaultConfig.pinSalt = null;
        vaultConfig.biometricEnabled = false;
        vaultConfig.biometricCredentialId = null;
        saveVaultConfig();
        const userId = getUserId();
        localStorage.removeItem('ledgio_vault_' + userId);
        localStorage.removeItem('ledgio_vault_default_user');
        hideLockScreen();
        updateVaultSettingsUI();
        showToast('Vault PIN reset. You can set a new PIN in Settings → Private Vault.', 'info');
      }
    });

    // Emergency Sign Out from PIN Lock Screen
    document.getElementById('vault-emergency-logout-btn')?.addEventListener('click', () => {
      const userId = getUserId();
      localStorage.removeItem('ledgio_vault_' + userId);
      localStorage.removeItem('ledgio_vault_default_user');
      if (window.logout) {
        window.logout();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('index.html');
      }
    });

    // Physical Keyboard Support for PIN Lock & Setup
    document.addEventListener('keydown', (e) => {
      const lockModal = document.getElementById('vault-lock-modal');
      const setupModal = document.getElementById('set-pin-modal');
      
      if (lockModal && lockModal.style.display !== 'none') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleNumpadKey(e.key, 'lock');
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleNumpadKey('backspace', 'lock');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleNumpadKey('clear', 'lock');
        }
      } else if (setupModal && setupModal.style.display !== 'none') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleNumpadKey(e.key, 'setup');
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleNumpadKey('backspace', 'setup');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          resetSetupPinState();
        }
      }
    });

    document.getElementById('reset-data')?.addEventListener('click', async () => {
      const queue = getSyncQueue();
      if (queue.length > 0) {
        const proceed = await showConfirm(`You have ${queue.length} unsynced offline change${queue.length > 1 ? 's' : ''} that will be permanently lost if you reset. Proceed with reset?`);
        if (!proceed) return;
        saveSyncQueue([]);
        saveDeadLetterQueue([]);
      }

      const confirmed = await showConfirm('Are you sure you want to reset all data? This deletes your data on this device AND in your cloud backup (on next sync). This cannot be undone.');
      if (confirmed) {
        // 1. Increment reset epoch locally
        const targetEpoch = incrementResetEpoch();

        // 2. Clear queues first
        saveSyncQueue([]);
        saveDeadLetterQueue([]);

        // 3. Set persistent cloud reset tombstone (survives tab close / app restart)
        const tombstoneKey = getResetTombstoneKey();
        try {
          localStorage.setItem(tombstoneKey, JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: getUserId(),
            resetEpoch: targetEpoch
          }));
        } catch (e) {
          console.error('Failed to write cloud reset tombstone:', e);
        }

        // 4. Wipe local storage and reset state
        /* EXTEND_RESET_CASCADE_HERE */
        localStorage.removeItem(getStorageKey());
        localStorage.removeItem(getIncomeEntriesStorageKey());
        localStorage.removeItem(getCategoriesCacheKey());
        try { localStorage.removeItem('ledgio_income_pulled_' + getUserId()); } catch (e) {}
        try { localStorage.removeItem('ledgio_legacy_income_' + getUserId()); } catch (e) {}
        try { localStorage.removeItem('ledgio_last_sync_' + getUserId()); } catch (e) {}
        try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
        try { localStorage.removeItem(getVaultStorageKey()); } catch (e) {}
        try { localStorage.removeItem('ledgio_vault_default_user'); } catch (e) {}
        legacyIncome = 0;
        state = createInitialState({ income_entries: [], customCategories: [], hiddenBuiltins: [] });
        saveIncomeEntries();
        saveCategoriesCache();
        saveData(false);
        populateDropdowns();
        refreshUI();
        applyDarkMode();
        updateSyncStatusUI();

        // 5. Broadcast reset event across BroadcastChannel to converge open tabs immediately
        broadcastSyncEvent('RESET_EXECUTED', {
          userId: getUserId(),
          resetEpoch: targetEpoch,
          state: state
        });

        // 6. If online, wipe cloud immediately (don't wait for restart)
        if (navigator.onLine && supabase && currentUser) {
          await processCloudResetTombstone();
        }

        showToast('All data has been reset');
      }
    });

    // Network Event Listeners for Offline Sync Engine
    if (isDevOrTest) {
      window.__ledgio_syncEngineActive = true;
    }

    window.addEventListener('online', async () => {
      isWaitingForNetwork = false;
      if (window.LedgioSyncEngine) window.LedgioSyncEngine.isWaitingForNetwork = false;
      try {
        const q = getSyncQueue();
        let modified = false;
        q.forEach(m => {
          if (m && (m.status === 'waiting for network' || m.waitingForNetwork)) {
            delete m.status;
            delete m.waitingForNetwork;
            m.nextRetryTime = 0;
            modified = true;
          }
        });
        if (modified) saveSyncQueue(q);
      } catch (e) {}
      // Recover expired session before attempting sync
      if (!hasLiveSession()) {
        await tryRecoverSession();
      }
      updateSyncStatusUI();
      showToast('🟢 Internet restored — syncing changes...', 'info');
      await processCloudResetTombstone();
      await processSyncQueue();
      await pullRemoteChanges();
      updateSyncStatusUI();
    });

    window.addEventListener('offline', () => {
      updateSyncStatusUI();
      showToast('⚡ You are offline. Changes will queue safely on device.', 'info');
    });

    // Periodic Background Sync Check (every 60s) — includes session recovery
    setInterval(async () => {
      if (navigator.onLine && supabase) {
        // Try to recover session if not live (e.g. after Supabase outage)
        if (!hasLiveSession()) {
          const recovered = await tryRecoverSession();
          if (recovered) {
            showToast('🟢 Cloud connection restored', 'success');
          }
        }
        if (currentUser && (getSyncQueue().length > 0 || localStorage.getItem(getResetTombstoneKey()))) {
          processCloudResetTombstone().then(() => processSyncQueue());
        }
      }
    }, 60000);

    // Sync Diagnostics Hub Modal Listeners
    document.getElementById('sync-status-btn')?.addEventListener('click', async () => {
      const queue = getSyncQueue();
      const isSignInReq = Boolean(isSignInRequired || queue.some(m => m && (m.status === 'sign in required' || m.status === 'sign in again')));
      if (isSignInReq) {
        routeToLogin();
        return;
      }
      // If stuck in "Local Only", attempt session recovery on click
      if (!hasLiveSession() && navigator.onLine && supabase) {
        const recovered = await tryRecoverSession();
        if (recovered) {
          showToast('🟢 Cloud connection restored', 'success');
          await processSyncQueue();
          await pullRemoteChanges();
          updateSyncStatusUI();
          return;
        }
      }
      openSyncDiagnosticsModal();
    });

    document.getElementById('close-sync-modal-btn')?.addEventListener('click', () => {
      closeSyncDiagnosticsModal();
    });

    document.getElementById('sync-diagnostics-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'sync-diagnostics-modal') {
        closeSyncDiagnosticsModal();
      }
    });

    document.getElementById('trigger-sync-now-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('trigger-sync-now-btn');
      const textEl = document.getElementById('trigger-sync-btn-text');
      if (btn) btn.disabled = true;
      if (textEl) textEl.textContent = 'Syncing...';

      try {
        await processCloudResetTombstone();
        await processSyncQueue(true);
        await pullRemoteChanges();
        showToast('Sync completed successfully', 'success');
      } catch (err) {
        if (isAdmin) {
          showToast(`Sync error: ${err?.message || 'check network connection'}`, 'warning');
        } else {
          showToast(mapErrorToUserMessage(err), 'warning');
        }
      } finally {
        if (btn) btn.disabled = false;
        if (textEl) textEl.textContent = 'Sync Now';
        openSyncDiagnosticsModal();
        updateSyncStatusUI();
      }
    });

    // Clear Queue with Mandatory User Confirmation per Amendment 5
    document.getElementById('clear-queue-btn')?.addEventListener('click', async () => {
      const queue = getSyncQueue();
      if (queue.length === 0) return;
      const itemsList = queue.map((m, i) => `${i + 1}. [${m.action}] ${m.table}: ${m.data?.name || m.data?.category || m.id}`).join('\n');
      const confirmed = await showConfirm(`Are you sure you want to clear the offline sync queue? The following ${queue.length} unsynced change(s) will be permanently lost:\n\n${itemsList}`);
      if (confirmed) {
        saveSyncQueue([]);
        openSyncDiagnosticsModal();
        updateSyncStatusUI();
        showToast('Offline queue cleared');
      }
    });

    // Dead-Letter Item Retry and Discard per Amendment 1
    document.getElementById('deadletter-items-list')?.addEventListener('click', async (e) => {
      const targetBtn = e.target.closest('[data-dl-action]');
      if (!targetBtn) return;
      const action = targetBtn.dataset.dlAction;
      const id = targetBtn.dataset.id;
      const idx = targetBtn.dataset.idx !== undefined ? parseInt(targetBtn.dataset.idx, 10) : -1;
      
      const deadLetter = getDeadLetterQueue();
      let itemIdx = -1;
      if (id) {
        itemIdx = deadLetter.findIndex(d => d.id === id);
      }
      if (itemIdx === -1 && idx >= 0 && idx < deadLetter.length) {
        itemIdx = idx;
      }
      if (itemIdx === -1) return;

      if (action === 'retry') {
        const [item] = deadLetter.splice(itemIdx, 1);
        item.retries = 0;
        item.nextRetryTime = 0;
        item.lastError = null;
        delete item.isTransient;
        delete item.waitingForNetwork;
        saveDeadLetterQueue(deadLetter);

        const queue = getSyncQueue();
        queue.push(item);
        saveSyncQueue(queue);

        showToast('Retrying mutation...', 'info');
        updateSyncStatusUI();
        openSyncDiagnosticsModal();

        await processSyncQueue(true);
        updateSyncStatusUI();
        openSyncDiagnosticsModal();
      } else if (action === 'discard') {
        deadLetter.splice(itemIdx, 1);
        saveDeadLetterQueue(deadLetter);
        updateSyncStatusUI();
        openSyncDiagnosticsModal();
        showToast('Failed mutation discarded');
      }
    });

    document.getElementById('clear-all-deadletter-btn')?.addEventListener('click', async () => {
      const confirmed = await showConfirm('Discard all dead-lettered issues?');
      if (confirmed) {
        saveDeadLetterQueue([]);
        openSyncDiagnosticsModal();
        updateSyncStatusUI();
        showToast('All issues discarded');
      }
    });

    // Cross-Tab Storage Event Fallback
    window.addEventListener('storage', (e) => {
      if (e.key === getStorageKey() && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          state = Object.assign(state, parsed);
          populateDropdowns();
          refreshUI();
          updateSyncStatusUI();
        } catch (err) {}
      } else if (e.key === getSyncQueueKey()) {
        updateSyncStatusUI();
      }
    });

    // User Profile Chip & Dropdown Menu Listeners
    const profileChipBtn = document.getElementById('user-profile-btn');
    const profileDropdown = document.getElementById('user-profile-dropdown');

    profileChipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserProfileDropdown();
    });

    profileChipBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleUserProfileDropdown();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        toggleUserProfileDropdown(true);
        profileDropdown?.querySelector('button')?.focus();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      const wrapper = document.querySelector('.profile-chip-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        toggleUserProfileDropdown(false);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleUserProfileDropdown(false);
        closeEditProfileModal();
      }
    });

    // Status Row Clicks
    document.getElementById('dropdown-status-sync')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      const queue = getSyncQueue();
      const isSignInReq = Boolean(isSignInRequired || queue.some(m => m && (m.status === 'sign in required' || m.status === 'sign in again')));
      if (isSignInReq) {
        routeToLogin();
        return;
      }
      openSyncDiagnosticsModal();
    });

    document.getElementById('dropdown-status-vault')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      navigateTo('#settings');
      setTimeout(() => {
        const vaultCard = document.getElementById('security-vault-card');
        if (vaultCard) vaultCard.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    });

    // Menu Item Actions
    document.getElementById('menu-edit-profile-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      openEditProfileModal();
    });

    document.getElementById('menu-settings-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      navigateTo('#settings');
    });

    document.getElementById('menu-export-data-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      document.getElementById('export-data')?.click();
    });

    document.getElementById('menu-logout-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      if (window.logout) {
        window.logout();
      } else {
        window.location.href = 'index.html';
      }
    });

    // Edit Profile Modal Quick Jump to Account & Security Link
    document.getElementById('link-go-to-account-settings')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeEditProfileModal();
      navigateTo('#settings');
      setTimeout(() => {
        const accountCard = document.getElementById('account-security-card');
        if (accountCard) accountCard.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    });

    // Edit Profile Modal Listeners
    document.getElementById('close-edit-profile-btn')?.addEventListener('click', () => {
      closeEditProfileModal();
    });

    document.getElementById('cancel-edit-profile-btn')?.addEventListener('click', () => {
      closeEditProfileModal();
    });

    document.getElementById('edit-profile-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'edit-profile-modal') {
        closeEditProfileModal();
      }
    });

    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProfileEdit();
    });

    // Account & Security Management Listeners
    document.getElementById('change-email-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAccountEmailChange();
    });

    document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAccountPasswordChange();
    });

    document.querySelectorAll('.btn-toggle-pw').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          }
        } else {
          input.type = 'password';
          if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
      });
    });

    // Admin System: Broadcast Announcement Modal & Card Listeners
    function openBroadcastModal() {
      const modal = document.getElementById('broadcast-announcement-modal');
      if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('broadcast-modal-message-input');
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    }

    function closeBroadcastModal() {
      const modal = document.getElementById('broadcast-announcement-modal');
      if (modal) modal.style.display = 'none';
    }

    document.getElementById('menu-broadcast-announcement-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserProfileDropdown(false);
      openBroadcastModal();
    });

    document.getElementById('close-broadcast-modal-btn')?.addEventListener('click', closeBroadcastModal);
    document.getElementById('cancel-broadcast-btn')?.addEventListener('click', closeBroadcastModal);
    document.getElementById('broadcast-announcement-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'broadcast-announcement-modal') closeBroadcastModal();
    });

    document.getElementById('send-broadcast-modal-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('broadcast-modal-message-input');
      const btn = document.getElementById('send-broadcast-modal-btn');
      const msg = input ? input.value : '';
      if (!msg.trim()) {
        showToast('Please enter an announcement message', 'warning');
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      }
      const success = await broadcastAnnouncement(msg);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Broadcast';
      }
      if (success) {
        closeBroadcastModal();
      }
    });

    document.getElementById('broadcast-card-send-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('broadcast-card-message-input');
      const btn = document.getElementById('broadcast-card-send-btn');
      const msg = input ? input.value : '';
      if (!msg.trim()) {
        showToast('Please enter an announcement message', 'warning');
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      }
      const success = await broadcastAnnouncement(msg);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Broadcast';
      }
      if (success && input) {
        input.value = '';
      }
    });

    // Reports Month Stepper & Reset Controls
    document.getElementById('reports-prev-month-btn')?.addEventListener('click', () => {
      const { monthKeys } = getTrendMonthRange();
      if (!reportsSelectedMonthKey || !monthKeys.includes(reportsSelectedMonthKey)) {
        reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
      }
      const idx = monthKeys.indexOf(reportsSelectedMonthKey);
      if (idx > 0) {
        setReportsSelectedMonth(monthKeys[idx - 1]);
      }
    });

    document.getElementById('reports-next-month-btn')?.addEventListener('click', () => {
      const { monthKeys } = getTrendMonthRange();
      if (!reportsSelectedMonthKey || !monthKeys.includes(reportsSelectedMonthKey)) {
        reportsSelectedMonthKey = monthKeys[monthKeys.length - 1];
      }
      const idx = monthKeys.indexOf(reportsSelectedMonthKey);
      if (idx >= 0 && idx < monthKeys.length - 1) {
        setReportsSelectedMonth(monthKeys[idx + 1]);
      }
    });

    document.getElementById('reports-reset-latest-btn')?.addEventListener('click', () => {
      const { monthKeys } = getTrendMonthRange();
      setReportsSelectedMonth(monthKeys[monthKeys.length - 1]);
    });
  }

  // Phase 5b: System Announcements & Admin Broadcast Engine
  function showAnnouncementBanner(item) {
    const banner = document.getElementById('announcement-banner');
    const textEl = document.getElementById('announcement-text');
    const dismissBtn = document.getElementById('announcement-dismiss-btn');
    if (!banner || !textEl || !item || !item.message) return;

    textEl.textContent = item.message;
    banner.style.display = 'flex';

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        const seenKey = 'ledgio_announcement_seen_' + getUserId();
        try {
          const createdAtStr = typeof item.created_at === 'string'
            ? item.created_at
            : (item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString());
          localStorage.setItem(seenKey, createdAtStr);
        } catch (e) {}
        banner.style.display = 'none';
      };
    }
  }

  async function fetchLatestAnnouncement() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return;
      const latest = data[0];
      if (!latest || !latest.message) return;

      // Skip announcements older than 7 days
      const createdAtMs = new Date(latest.created_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (isNaN(createdAtMs) || (Date.now() - createdAtMs > sevenDaysMs)) {
        return;
      }

      // Skip if already dismissed/seen (show ONLY if created_at > seen_marker)
      const seenKey = 'ledgio_announcement_seen_' + getUserId();
      const seenTimestamp = localStorage.getItem(seenKey);
      if (seenTimestamp) {
        const seenMs = new Date(seenTimestamp).getTime();
        if (!isNaN(seenMs) && createdAtMs <= seenMs) {
          return;
        }
      }

      showAnnouncementBanner(latest);
    } catch (err) {
      console.warn('[Announcements] Fetch error:', err);
    }
  }

  async function broadcastAnnouncement(message) {
    if (!isAdmin) {
      showToast('Administrative privileges required', 'error');
      return false;
    }
    if (!supabase) {
      showToast('Database connection unavailable', 'error');
      return false;
    }
    const cleanMsg = (message || '').trim();
    if (!cleanMsg) {
      showToast('Please enter an announcement message', 'warning');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert([{ message: cleanMsg }])
        .select('id, message, created_at');

      if (error) throw error;

      const createdItem = (data && data[0]) ? data[0] : { message: cleanMsg, created_at: new Date().toISOString() };
      showToast('Announcement broadcast successfully!', 'success');
      showAnnouncementBanner(createdItem);
      return true;
    } catch (err) {
      console.error('[Announcements] Broadcast error:', err);
      if (isAdmin) {
        showToast(`Broadcast failed: ${err?.message || 'Database error'}`, 'error');
      } else {
        showToast(mapErrorToUserMessage(err), 'error');
      }
      return false;
    }
  }

  if (isDevOrTest) {
    window.__ledgio_computeNetWorthData = computeNetWorthData;
    window.__ledgio_updateNetWorthUI = updateNetWorthUI;
    window.__ledgio_fetchLatestAnnouncement = fetchLatestAnnouncement;
    window.__ledgio_showAnnouncementBanner = showAnnouncementBanner;
    window.__ledgio_broadcastAnnouncement = broadcastAnnouncement;
    window.__ledgio_openSyncDiagnosticsModal = openSyncDiagnosticsModal;
    window.__ledgio_closeSyncDiagnosticsModal = closeSyncDiagnosticsModal;
    window.__ledgio_getUserId = getUserId;
    window.__ledgio_openCustomCategoryModal = (id) => openCustomCategoryModal(id);
    window.__ledgio_closeCustomCategoryModal = () => closeCustomCategoryModal();
    window.__ledgio_saveCustomCategory = () => saveCustomCategory();
    window.__ledgio_deleteCustomCategory = (id, target) => deleteCategory(id, target);
    window.__ledgio_deleteCategory = (id, target) => deleteCategory(id, target);
    window.__ledgio_openReassignCategoryModal = (cat, count) => openReassignCategoryModal(cat, count);
    window.__ledgio_closeReassignCategoryModal = () => closeReassignCategoryModal();
    window.__ledgio_getSyncQueue = () => getSyncQueue();
    window.__ledgio_saveSyncQueue = (q) => saveSyncQueue(q);
    window.__ledgio_getDeadLetterQueue = () => getDeadLetterQueue();
    window.__ledgio_saveDeadLetterQueue = (dl) => saveDeadLetterQueue(dl);
    window.__ledgio_processSyncQueue = (force) => processSyncQueue(force);
    window.__ledgio_setSupabaseForTesting = (sb) => { supabase = sb; window.supabaseClient = sb; };
    window.__ledgio_getSupabaseForTesting = () => supabase;
    window.__ledgio_setCurrentUserForTesting = (u) => { currentUser = u; };
    window.__ledgio_getCurrentUserForTesting = () => currentUser;
    window.__ledgio_isSignInRequired = () => (window.LedgioSyncEngine ? window.LedgioSyncEngine.isSignInRequired : isSignInRequired);
    window.__ledgio_setSignInRequiredForTesting = (v) => {
      isSignInRequired = v;
      if (window.LedgioSyncEngine) window.LedgioSyncEngine.isSignInRequired = v;
    };
    window.__ledgio_restoreDefaultCategories = () => restoreDefaultCategories();
    window.__ledgio_getCategoryExpenseCount = (cat) => getCategoryExpenseCount(cat);
    window.__ledgio_getCategoryMeta = (k) => getCategoryMeta(k);
    window.__ledgio_getAllCategories = (includeHidden) => getAllCategories(includeHidden);
    window.__ledgio_getState = () => state;
    window.__ledgio_deleteExpense = (id) => deleteExpense(id);
    window.__ledgio_setBudget = (cat, val) => setBudget(cat, val);
    window.__ledgio_deleteBudget = (cat) => deleteBudget(cat);
    window.__ledgio_renderBudgets = () => renderBudgets();
    window.__ledgio_renderExpenses = () => renderExpenses();
    window.__ledgio_renderAllExpenses = () => renderAllExpenses();
    window.__ledgio_getFilteredExpenses = () => getFilteredExpenses();
    window.chartInstances = chartInstances; // Expose for test access (Gate 13.1)
    window.__ledgio_refreshUI = () => refreshUI(); // Expose for test access (Gate 13.2)
    window.__ledgio_renderCategoryChart = () => renderCategoryChart();
    window.__ledgio_renderSpendingChart = () => window.renderSpendingChart();
    window.__ledgio_setReportsMonth = (key) => setReportsSelectedMonth(key);
    window.__ledgio_getReportsSelectedMonth = () => reportsSelectedMonthKey;
    window.__ledgio_getTrendMonthRange = () => getTrendMonthRange();
    window.__ledgio_desktopTitleMap = desktopTitleMap;
    window.__ledgio_mobileTitleMap = mobileTitleMap;
    window.__ledgio_updateHeaderTitle = (sec) => updateHeaderTitle(sec);
    window.__ledgio_destroyChartInstance = (key, canvas) => destroyChartInstance(key, canvas);
    window.__ledgio_initChartResizeObservers = () => initChartResizeObservers();
    window.__ledgio_addIncome = addIncome;
    window.__ledgio_setBalance = setBalance;
    window.__ledgio_deleteIncomeEntry = deleteIncomeEntry;
    window.__ledgio_editIncomeEntry = editIncomeEntry;
    window.__ledgio_totalIncome = totalIncome;
    window.__ledgio_incomeThisMonth = incomeThisMonth;
    window.__ledgio_expensesThisMonth = expensesThisMonth;
    window.__ledgio_spendPercent = spendPercent;
    window.__ledgio_getIncomeEntries = () => state.income_entries;
    window.__ledgio_deterministicOpeningId = deterministicOpeningId;
    window.__ledgio_getLocalDateString = getLocalDateString;
    window.__ledgio_getLocalCurrentMonthString = getLocalCurrentMonthString;
    window.__ledgio_renderIncomeHistory = renderIncomeHistory;
    window.__ledgio_updateLeftoverPromptUI = updateLeftoverPromptUI;
    window.__ledgio_openLeftoverGoalPicker = openLeftoverGoalPicker;
    window.__ledgio_openGoalModalWithLeftover = openGoalModalWithLeftover;
    window.__ledgio_setIncomeMode = setIncomeMode;
    window.__ledgio_updateIncomePreview = updateIncomePreview;
    window.__ledgio_toggleSummaryCard = toggleSummaryCard;
    window.__ledgio_getSummaryCardModes = () => ({ ...summaryCardModes });
    window.__ledgio_setSummaryCardMode = (type, mode, userId) => {
      summaryCardModes[type] = sanitizeStatView(mode);
      saveStatViewPreferences(summaryCardModes, userId);
      updateSummary();
    };
    window.__ledgio_loadStatViewPreferences = (userId) => loadStatViewPreferences(userId);
    window.__ledgio_saveStatViewPreferences = (modes, userId) => saveStatViewPreferences(modes, userId);
    window.__ledgio_getStatViewsStorageKey = (userId) => getStatViewsStorageKey(userId);
    window.__ledgio_hasLiveSession = () => hasLiveSession();
    window.__ledgio_migrateDefaultUserData = (uid) => migrateDefaultUserData(uid);
    window.__ledgio_updateSyncStatusUI = () => updateSyncStatusUI();
    window.__ledgio_routeToLogin = () => routeToLogin();
    window.__ledgio_addExpense = () => addExpense();
    window.__ledgio_getUserId = () => getUserId();
    window.__ledgio_deleteGoal = (id) => deleteGoal(id);
    window.__ledgio_restoreDeletedGoal = () => restoreDeletedGoal();
    window.__ledgio_restoreDeletedLoan = () => restoreDeletedLoan();
    window.__ledgio_pullRemoteChanges = () => pullRemoteChanges();
    window.__ledgio_syncBus = syncBus;
    window.__ledgio_formatCurrency = formatCurrency;
    window.__ledgio_saveData = () => saveData();
    window.__ledgio_saveIncomeEntries = () => saveIncomeEntries();
    window.__ledgio_loadIncomeEntries = () => loadIncomeEntries();
    window.__ledgio_getIncomeEntriesStorageKey = () => getIncomeEntriesStorageKey();
    window.__ledgio_migrateLocalCategoriesToCloud = () => migrateLocalCategoriesToCloud();
    window.__ledgio_saveCategoriesCache = () => saveCategoriesCache();
    window.__ledgio_loadCategoriesCache = () => loadCategoriesCache();
    window.__ledgio_getCategoriesCacheKey = () => getCategoriesCacheKey();
    window.__ledgio_getResetEpoch = (uid) => getResetEpoch(uid);
    window.__ledgio_setResetEpoch = (epoch, uid) => setResetEpoch(epoch, uid);
    window.__ledgio_incrementResetEpoch = (uid) => incrementResetEpoch(uid);
    window.__ledgio_processCloudResetTombstone = () => processCloudResetTombstone();
    window.__ledgio_broadcastSyncEvent = (type, payload) => broadcastSyncEvent(type, payload);
    window.__ledgio_getResetTombstoneKey = () => getResetTombstoneKey();
    window.__ledgio_loadLocalState = () => loadLocalState();
    window.__ledgio_startupPhase1 = () => startupPhase1_LocalPaint();
    window.__ledgio_startupPhase2 = () => startupPhase2_SessionAndQueue();
    window.__ledgio_startupPhase3 = () => startupPhase3_CloudSyncAndBackground();
    window.__ledgio_isPhase1Painting = () => isPhase1Painting;
  }

  // Phase 6 Public Selectors & Functions
  window.hasLiveSession = hasLiveSession;
  window.updateSyncStatusUI = updateSyncStatusUI;
  window.addExpense = addExpense;
  window.saveEdit = saveEdit;
  window.deleteExpense = deleteExpense;
  window.openEditModal = openEditModal;
  window.renderExpenses = renderExpenses;
  window.renderAllExpenses = renderAllExpenses;
  window.renderBudgets = renderBudgets;
  window.setBudget = setBudget;
  window.deleteBudget = deleteBudget;
  window.getFilteredExpenses = getFilteredExpenses;
  window.addIncome = addIncome;
  window.setBalance = setBalance;
  window.deleteIncomeEntry = deleteIncomeEntry;
  window.editIncomeEntry = editIncomeEntry;
  window.totalIncome = totalIncome;
  window.incomeThisMonth = incomeThisMonth;
  window.expensesThisMonth = expensesThisMonth;
  window.spendPercent = spendPercent;
  window.renderIncomeHistory = renderIncomeHistory;
  window.updateLeftoverPromptUI = updateLeftoverPromptUI;
  window.setIncomeMode = setIncomeMode;
  window.updateIncomePreview = updateIncomePreview;
  window.openLeftoverGoalPicker = openLeftoverGoalPicker;
  window.openGoalModalWithLeftover = openGoalModalWithLeftover;
  window.createLoan = createLoan;
  window.recordSettlement = recordSettlement;
  window.isLoanAdjustment = isLoanAdjustment;
  window.toggleStealthMode = toggleStealthMode;
  window.toggleSummaryCard = toggleSummaryCard;
  window.getSummaryCardModes = () => ({ ...summaryCardModes });
  window.setSummaryCardMode = (type, mode, userId) => {
    summaryCardModes[type] = sanitizeStatView(mode);
    saveStatViewPreferences(summaryCardModes, userId);
    updateSummary();
  };
  window.loadStatViewPreferences = (userId) => loadStatViewPreferences(userId);
  window.saveStatViewPreferences = (modes, userId) => saveStatViewPreferences(modes, userId);
  window.getStatViewsStorageKey = (userId) => getStatViewsStorageKey(userId);

  // Phase 3 Safety Backup: One-time export of all current localStorage data prior to sync engine activation
  function createPhase3SafetyBackup() {
    const backupKey = 'ledgio_safety_backup_v1_3_0';
    if (localStorage.getItem(backupKey)) return;

    try {
      const dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) dump[k] = localStorage.getItem(k);
      }
      const expensesCount = Array.isArray(state.expenses) ? state.expenses.length : 0;
      const budgetsCount = state.budgets ? Object.keys(state.budgets).length : 0;
      const incomeVal = state.income || 0;

      const backupPayload = {
        version: '1.3.0-pre-sync',
        timestamp: new Date().toISOString(),
        userId: getUserId(),
        summary: {
          expensesCount,
          budgetsCount,
          income: incomeVal,
          currency: state.settings?.currency || 'INR'
        },
        data: dump
      };

      localStorage.setItem(backupKey, JSON.stringify(backupPayload));
      console.info('🛡️ [Ledgio Safety Backup] Archived pre-sync data:', backupPayload.summary);
    } catch (err) {
      console.warn('Could not complete safety backup snapshot:', err);
    }
  }

  // =========================================================================
  // Three-Phase Startup Architecture
  // =========================================================================

  // Phase 1: Pure Synchronous Local Paint (0ms Local-First)
  function startupPhase1_LocalPaint() {
    isPhase1Painting = true;
    try {
      // 1. Vault lock gate — gates UI immediately if PIN lock is enabled
      loadVaultConfig();
      if (vaultConfig.pinEnabled && vaultConfig.pinHash) {
        showLockScreen();
      }

      // 2. Admin identification & stat view preferences
      isAdmin = computeIsAdmin();
      updateAdminUI();
      summaryCardModes = loadStatViewPreferences();

      // 3. Synchronous local state hydration (reset epoch check, income_entries cache, categories cache)
      loadLocalState();

      // 4. Synchronous UI paint
      populateDropdowns();
      applyDarkMode();
      updateVaultSettingsUI();
      toggleStealthMode(isStealthModeActive);

      // Personalize user name dynamically
      const username = getEffectiveUserName();
      updateUserDisplayNames(username);

      // Ensure chart resize observers are initialized early
      initChartResizeObservers();

      // Initial routing & active section paint at 0ms
      navigateTo(window.location.hash || '#dashboard');
      refreshUI();
    } finally {
      isPhase1Painting = false;
    }

    // 5. The daily nudge banner: render after Phase 1 paint, not blocking it
    updateDailyNudgeUI();
  }

  // Phase 2: Session Check & Queue Drain (Async, Non-Blocking)
  async function startupPhase2_SessionAndQueue() {
    const previousUid = getUserId();

    // 1. Check Supabase auth session & recovery
    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          currentUser = data.user;
          localStorage.setItem('sb_user_id', data.user.id);
        } else {
          await tryRecoverSession();
        }
      } catch (err) {
        console.warn('Auth check error during startup Phase 2:', err);
        await tryRecoverSession();
      }
    }

    const currentUid = getUserId();

    // 2. Account switch / migration detection: if authenticated user differs from local Phase 1 user
    if (currentUser?.id && currentUid !== previousUid) {
      migrateDefaultUserData(currentUser.id);
      loadVaultConfig();
      if (vaultConfig.pinEnabled && vaultConfig.pinHash) {
        showLockScreen();
      }
      loadLocalState();
      summaryCardModes = loadStatViewPreferences();
      populateDropdowns();
      applyDarkMode();
      updateUserDisplayNames(getEffectiveUserName());
      refreshUI();
    }

    // 3. Process cloud reset tombstone if online
    if (navigator.onLine && supabase && currentUser) {
      try {
        await processCloudResetTombstone();
      } catch (e) {
        console.warn('Cloud reset tombstone error in Phase 2:', e);
      }
    }

    // 4. Drain offline mutation queue if online
    if (navigator.onLine && supabase && currentUser) {
      try {
        await processSyncQueue();
      } catch (e) {
        console.warn('Sync queue error in Phase 2:', e);
      }
    }

    // 5. Update honest sync status UI
    updateSyncStatusUI();
    updateAdminUI();
  }

  // Phase 3: Background Cloud Sync & Background Services (Async, Background)
  async function startupPhase3_CloudSyncAndBackground() {
    // 1. Pull remote changes & reconcile LWW
    if (navigator.onLine && supabase && currentUser) {
      try {
        await pullRemoteChanges();
      } catch (err) {
        console.warn('Remote sync error in Phase 3:', err);
      }
      try {
        await migrateLocalCategoriesToCloud();
      } catch (err) {
        console.warn('Category cloud migration error in Phase 3:', err);
      }
    }

    // 2. Announcements fetch (checks created_at > seen_marker, displays banner if unseen)
    try {
      await fetchLatestAnnouncement();
    } catch (e) {}

    // 3. Deferred background services
    createPhase3SafetyBackup();
    loadAccountSecurityInfo();

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => fetchLiveExchangeRates(), { timeout: 3500 });
    } else {
      setTimeout(() => fetchLiveExchangeRates(), 2500);
    }
  }

  // Initialization
  async function init() {
    // Phase 1: Synchronous Local Paint (0ms)
    startupPhase1_LocalPaint();

    setupEventListeners();
    initInactivityTimer();
    initVaultVisibilityAutoLock();
    initChartResizeObservers();

    if (isDevOrTest) {
      window.__ledgio_app_ready = true;
    }

    // Phase 2: Session Check & Queue Drain (Async, Non-Blocking)
    try {
      await startupPhase2_SessionAndQueue();
    } catch (e) {
      console.warn('Phase 2 startup error:', e);
    }

    // Phase 3: Background Cloud Sync & Background Services (Async, Background)
    try {
      await startupPhase3_CloudSyncAndBackground();
    } catch (e) {
      console.warn('Phase 3 startup error:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
