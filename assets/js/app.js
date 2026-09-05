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

  // User-Scoped Storage Helpers
  function getUserId() {
    if (currentUser?.id) return currentUser.id;
    const storedId = localStorage.getItem('sb_user_id');
    if (storedId) return storedId;
    return 'default_user';
  }

  function getStorageKey() {
    return `smartBudgetData_${getUserId()}`;
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

  // Supabase Client Initialization with persistent storage
  const supabaseUrl = window.SUPABASE_CONFIG?.url;
  const supabaseAnonKey = window.SUPABASE_CONFIG?.anonKey;
  const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'PASTE_YOUR_ANON_KEY_HERE';

  let supabase = null;
  if (isSupabaseConfigured && window.supabase) {
    try {
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
    } catch (e) {
      console.warn('Supabase not initialized:', e);
    }
  }

  let state = {
    version: 2,
    income: 0,
    expenses: [],
    budgets: {},
    settings: { currency: 'INR', darkMode: false }
  };

  let currentUser = null;

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
  let failedPinAttempts = 0;
  let lockoutTimestamp = 0;
  let lastActivityTimestamp = Date.now();
  let currentEnteredPin = '';
  let setupPinStep = 1;
  let setupTempPin = '';
  let isVerifyingPin = false;
  let lastBiometricAttemptTime = 0;
  let isBiometricAuthenticating = false;

  // =========================================================================
  // Phase 3: Offline-First Sync Engine, Mutation Queue & Poison Pill Handler
  // =========================================================================
  const BACKOFF_SCHEDULE = [3000, 6000, 12000, 30000, 60000];
  let isSyncProcessing = false;
  let syncRetryTimer = null;

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

        if (msg.type === 'STATE_UPDATED') {
          if (msg.payload?.state) {
            state = Object.assign(state, msg.payload.state);

            // MANDATORY (Amendment 5): Cross-tab handlers must WRITE received state to localStorage so newly opened tabs inherit it
            const userKey = getStorageKey();
            localStorage.setItem(userKey, JSON.stringify(state));
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

            populateDropdowns();
            refreshUI();
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
      syncBus.postMessage({
        type,
        payload,
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('Could not post sync bus message:', e);
    }
  }

  function getSyncQueueKey() {
    return `ledgio_sync_queue_${getUserId()}`;
  }

  function getDeadLetterKey() {
    return `ledgio_dead_letter_${getUserId()}`;
  }

  function getLastSyncKey() {
    return `ledgio_last_sync_${getUserId()}`;
  }

  function getSyncQueue() {
    try {
      const primaryKey = getSyncQueueKey();
      let raw = localStorage.getItem(primaryKey);
      let items = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) items = parsed;
        } catch (e) {}
      }

      // Reconcile and migrate orphan sync queues from default_user or other scopes
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ledgio_sync_queue_') && k !== primaryKey) {
          try {
            const orphanRaw = localStorage.getItem(k);
            if (orphanRaw) {
              const orphanItems = JSON.parse(orphanRaw);
              if (Array.isArray(orphanItems) && orphanItems.length > 0) {
                const existingIds = new Set(items.map(it => it.id));
                let migrated = false;
                orphanItems.forEach(oit => {
                  if (oit && (!oit.id || !existingIds.has(oit.id))) {
                    items.push(oit);
                    migrated = true;
                  }
                });
                if (migrated) {
                  localStorage.removeItem(k);
                  localStorage.setItem(primaryKey, JSON.stringify(items));
                }
              }
            }
          } catch (e) {}
        }
      }

      return items;
    } catch (err) {
      console.warn('Error reading sync queue:', err);
      return [];
    }
  }

  function saveSyncQueue(queue) {
    try {
      localStorage.setItem(getSyncQueueKey(), JSON.stringify(queue || []));
    } catch (e) {
      console.warn('Could not save sync queue:', e);
    }
    updateSyncStatusUI();
  }

  function getDeadLetterQueue() {
    try {
      const primaryKey = getDeadLetterKey();
      let raw = localStorage.getItem(primaryKey);
      let items = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) items = parsed;
        } catch (e) {}
      }

      // Reconcile and migrate orphan dead-letter queues from default_user or other scopes
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ledgio_dead_letter_') && k !== primaryKey) {
          try {
            const orphanRaw = localStorage.getItem(k);
            if (orphanRaw) {
              const orphanItems = JSON.parse(orphanRaw);
              if (Array.isArray(orphanItems) && orphanItems.length > 0) {
                const existingIds = new Set(items.map(it => it.id));
                let migrated = false;
                orphanItems.forEach(oit => {
                  if (oit && (!oit.id || !existingIds.has(oit.id))) {
                    items.push(oit);
                    migrated = true;
                  }
                });
                if (migrated) {
                  localStorage.removeItem(k);
                  localStorage.setItem(primaryKey, JSON.stringify(items));
                }
              }
            }
          } catch (e) {}
        }
      }

      return items;
    } catch (err) {
      console.warn('Error reading dead-letter queue:', err);
      return [];
    }
  }

  function saveDeadLetterQueue(dl) {
    try {
      localStorage.setItem(getDeadLetterKey(), JSON.stringify(dl || []));
    } catch (e) {
      console.warn('Could not save dead-letter queue:', e);
    }
    updateSyncStatusUI();
  }

  function updateSyncStatusUI() {
    const btn = document.getElementById('sync-status-btn');
    if (!btn) return;

    const queue = getSyncQueue();
    const deadLetter = getDeadLetterQueue();
    const isOnline = navigator.onLine;

    btn.classList.remove('online', 'offline', 'syncing');

    if (!isOnline) {
      btn.classList.add('offline');
      const count = queue.length;
      btn.innerHTML = `<i class="fas fa-bolt"></i> <span id="sync-status-text">${count > 0 ? `Offline (${count})` : 'Offline'}</span>`;
    } else if (isSyncProcessing || queue.length > 0) {
      btn.classList.add('syncing');
      const count = queue.length;
      btn.innerHTML = `<i class="fas fa-arrows-rotate fa-spin"></i> <span id="sync-status-text">${count > 0 ? `Syncing (${count})` : 'Syncing...'}</span>`;
    } else if (deadLetter.length > 0) {
      btn.classList.add('offline');
      btn.innerHTML = `<i class="fas fa-triangle-exclamation"></i> <span id="sync-status-text">${deadLetter.length} Issue${deadLetter.length > 1 ? 's' : ''}</span>`;
    } else {
      btn.classList.add('online');
      btn.innerHTML = `<i class="fas fa-circle-check"></i> <span id="sync-status-text">Cloud Synced</span>`;
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
    const mutation = {
      id: crypto.randomUUID ? crypto.randomUUID() : generateId(),
      table,
      action,
      data,
      timestamp: new Date().toISOString(),
      retries: 0,
      lastError: null,
      nextRetryTime: 0
    };

    const queue = getSyncQueue();
    queue.push(mutation);
    saveSyncQueue(queue);

    broadcastSyncEvent('QUEUE_MUTATION', {
      userId: getUserId(),
      queueLength: queue.length
    });

    // If online and connected, attempt background processing asynchronously
    if (navigator.onLine && supabase && currentUser) {
      setTimeout(() => processSyncQueue(), 40);
    }

    return mutation;
  }

  // Sequential FIFO processor with per-item Poison Pill handling & backoff (Amendment 1)
  async function processSyncQueue(force = false) {
    if (isSyncProcessing && !force) return;
    if (!navigator.onLine || !supabase || !currentUser) {
      updateSyncStatusUI();
      return;
    }

    isSyncProcessing = true;
    updateSyncStatusUI();

    try {
      let queue = getSyncQueue();
      const deadLetter = getDeadLetterQueue();
      let queueModified = false;
      let dlModified = false;
      const now = Date.now();

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item) continue;

        // If item is currently backing off, skip it and continue processing next items
        if (!force && item.nextRetryTime && now < item.nextRetryTime) {
          continue;
        }

        let opError = null;
        try {
          if (item.table === 'expenses') {
            if (item.action === 'UPSERT') {
              const { error } = await supabase.from('expenses').upsert(item.data, { onConflict: 'id' });
              if (error) opError = error;
            } else if (item.action === 'DELETE') {
              const { error } = await supabase.from('expenses').delete().eq('id', item.data.id);
              if (error) opError = error;
            }
          } else if (item.table === 'budgets') {
            if (item.action === 'UPSERT') {
              const { error } = await supabase.from('budgets').upsert(item.data, { onConflict: 'user_id,category' });
              if (error) opError = error;
            } else if (item.action === 'DELETE') {
              const { error } = await supabase.from('budgets').delete().eq('user_id', currentUser.id).eq('category', item.data.category);
              if (error) opError = error;
            }
          } else if (item.table === 'profiles') {
            if (item.action === 'UPSERT' || item.action === 'UPDATE') {
              const { error } = await supabase.from('profiles').upsert(item.data, { onConflict: 'id' });
              if (error) opError = error;
            }
          }
        } catch (err) {
          opError = err;
        }

        if (!opError) {
          // Success: dequeue mutation
          queue.splice(i, 1);
          i--;
          queueModified = true;
          localStorage.setItem(getLastSyncKey(), new Date().toISOString());
        } else {
          // Failure: per-mutation backoff and poison-pill ejection
          item.retries = (item.retries || 0) + 1;
          item.lastError = opError.message || opError.details || String(opError);

          if (item.retries >= 5) {
            // Poison Pill: Move to dead-letter queue after 5 failed attempts, CONTINUE subsequent items!
            console.error('⚠️ [Sync Poison Pill] Moving to dead-letter queue after 5 failed attempts:', item);
            deadLetter.push({
              ...item,
              failedAt: new Date().toISOString()
            });
            dlModified = true;
            queue.splice(i, 1);
            i--;
            queueModified = true;
          } else {
            // Schedule backoff (3s, 6s, 12s, 30s, 60s)
            const delay = BACKOFF_SCHEDULE[Math.min(item.retries - 1, BACKOFF_SCHEDULE.length - 1)];
            item.nextRetryTime = Date.now() + delay;
            queueModified = true;
            if (!syncRetryTimer) {
              syncRetryTimer = setTimeout(() => {
                syncRetryTimer = null;
                processSyncQueue();
              }, delay);
            }
            // Continue loop to process subsequent items!
          }
        }
      }

      if (queueModified) saveSyncQueue(queue);
      if (dlModified) saveDeadLetterQueue(deadLetter);
    } finally {
      isSyncProcessing = false;
      updateSyncStatusUI();
    }
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
        localStorage.removeItem('ledgio_pending_cloud_reset_default_user');
        localStorage.setItem(tombstoneKey, rawTombstone);
      }
    }
    if (!rawTombstone) return;

    try {
      console.info('🪦 [Reset Tombstone] Processing pending cloud wipe for user:', currentUser.id);

      // a. DELETE all rows from expenses and budgets for this user in Supabase
      const { error: expErr } = await supabase.from('expenses').delete().eq('user_id', currentUser.id);
      if (expErr) throw expErr;

      const { error: bgErr } = await supabase.from('budgets').delete().eq('user_id', currentUser.id);
      if (bgErr) throw bgErr;

      // b. UPDATE profiles: income = 0 (keep currency/full_name)
      const { error: profErr } = await supabase.from('profiles').update({
        income: 0,
        updated_at: new Date().toISOString()
      }).eq('id', currentUser.id);
      if (profErr) throw profErr;

      try {
        await supabase.auth.updateUser({ data: { income: 0 } });
      } catch (e) {}

      // c. Remove the tombstone
      localStorage.removeItem(tombstoneKey);
      console.info('🪦 [Reset Tombstone] Cloud wipe complete and tombstone removed');
    } catch (err) {
      console.error('Failed executing cloud reset tombstone, will retry on next connection:', err);
    }
  }

  // Pull remote changes from Supabase and merge via Last-Write-Wins (Amendment 3)
  async function pullRemoteChanges() {
    if (!supabase || !currentUser || !navigator.onLine) return;

    // Safety guard: if a cloud reset is pending execution, do not pull/resurrect remote records
    if (localStorage.getItem(getResetTombstoneKey())) return;

    try {
      // 1. Fetch remote user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

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
            state.income = profile.income;
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
        const pendingExpenseIds = new Set(queue.filter(m => m.table === 'expenses').map(m => m.data.id));
        const localExpMap = new Map((state.expenses || []).map(e => [e.id, e]));

        remoteExpenses.forEach(re => {
          if (pendingExpenseIds.has(re.id)) return; // Local mutation pending, keep local

          const localExp = localExpMap.get(re.id);
          const remoteTime = re.updated_at ? new Date(re.updated_at).getTime() : (re.created_at ? new Date(re.created_at).getTime() : 0);

          if (!localExp) {
            // New remote expense
            localExpMap.set(re.id, {
              id: re.id,
              name: re.name,
              amount: parseFloat(re.amount) || 0,
              category: re.category || 'other',
              date: re.date,
              createdAt: re.created_at,
              updatedAt: re.updated_at || re.created_at
            });
          } else {
            // Existing expense: LWW comparison
            const localTime = localExp.updatedAt ? new Date(localExp.updatedAt).getTime() : (localExp.createdAt ? new Date(localExp.createdAt).getTime() : 0);
            if (remoteTime > localTime) {
              localExpMap.set(re.id, {
                ...localExp,
                name: re.name,
                amount: parseFloat(re.amount) || 0,
                category: re.category || 'other',
                date: re.date,
                updatedAt: re.updated_at || re.created_at
              });
            }
          }
        });

        state.expenses = Array.from(localExpMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
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

      saveData();
      refreshUI();
      localStorage.setItem(getLastSyncKey(), new Date().toISOString());
    } catch (err) {
      console.warn('[Sync Engine] Error pulling remote changes:', err);
    }
  }

  // State Management (0ms Local-First + Strict Queue Drain & LWW Remote Sync)
  async function loadData() {
    // 0. Load existing user-scoped local storage state immediately (0ms paint)
    const userKey = getStorageKey();
    const localData = localStorage.getItem(userKey);
    const globalTheme = localStorage.getItem('ledgio_theme');
    const directDark = localStorage.getItem('sb_dark_mode_' + getUserId());
    const globalCurrency = localStorage.getItem('ledgio_currency');

    let initialDarkMode = false;
    if (globalTheme) {
      initialDarkMode = (globalTheme === 'dark');
    } else if (directDark !== null) {
      initialDarkMode = (directDark === 'true');
    }

    let initialCurrency = globalCurrency || 'INR';

    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        state = {
          version: 2,
          income: parsed.income || 0,
          expenses: parsed.expenses || [],
          budgets: parsed.budgets || {},
          settings: {
            currency: parsed.settings?.currency || initialCurrency,
            darkMode: parsed.settings?.darkMode !== undefined ? parsed.settings.darkMode : initialDarkMode
          }
        };
      } catch (e) {
        console.error('Error parsing local state', e);
      }
    } else {
      state = {
        version: 2,
        income: 0,
        expenses: [],
        budgets: {},
        settings: { 
          currency: initialCurrency, 
          darkMode: initialDarkMode 
        }
      };
    }

    applyDarkMode();
    refreshUI();
    updateSyncStatusUI();

    // Remove legacy un-scoped data key to avoid data bleed between accounts
    try {
      localStorage.removeItem('smartBudgetData');
    } catch (e) {}

    // Check Supabase authentication
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUser = user;
          localStorage.setItem('sb_user_id', user.id);

          // STRICT SYNC ORDER:
          // (1) Execute pending cloud reset tombstone (if reset was done offline)
          // (2) Drain the mutation queue completely to Supabase
          // (3) THEN pull remote changes and merge per-record LWW
          if (navigator.onLine) {
            await processCloudResetTombstone();
            await processSyncQueue();
            await pullRemoteChanges();
          }
        }
      } catch (err) {
        console.warn('Cloud sync error during loadData:', err);
      }
    }

    saveData();
    refreshUI();
    updateSyncStatusUI();
  }

  function saveData(broadcast = true) {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(state));
    const uid = getUserId();
    const isDark = Boolean(state.settings?.darkMode);
    localStorage.setItem('sb_dark_mode_' + uid, isDark ? 'true' : 'false');
    localStorage.setItem('ledgio_theme', isDark ? 'dark' : 'light');
    if (state.settings?.currency) {
      localStorage.setItem('ledgio_currency', state.settings.currency);
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
              targetLabel = m.data.name || m.data.category || (m.data.id ? `ID: ${String(m.data.id).substring(0, 8)}...` : '');
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

            return `
              <div class="deadletter-item-row" data-dl-id="${escapeHtml(itemId)}">
                <div class="deadletter-item-top">
                  <span><strong>${escapeHtml(action)} ${escapeHtml(table)}</strong> (${escapeHtml(targetLabel)})</span>
                  <div class="deadletter-actions-group">
                    <button class="btn-mini retry" data-dl-action="retry" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Retry sync">Retry</button>
                    <button class="btn-mini discard" data-dl-action="discard" data-id="${escapeHtml(itemId)}" data-idx="${idx}" title="Discard mutation">Discard</button>
                  </div>
                </div>
                <div class="deadletter-error-text">${escapeHtml(errText)}</div>
                <div style="font-size: 0.675rem; color: var(--color-text-muted); margin-top: 2px;">Failed ${escapeHtml(timeLabel)} • 5 retries exhausted</div>
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
      subtitle.textContent = `Welcome back, ${firstName}!`;
    }
    document.querySelectorAll('.user-name-text').forEach(el => {
      el.textContent = username;
    });
    const dropdownName = document.getElementById('dropdown-user-name');
    if (dropdownName) {
      dropdownName.textContent = username;
    }

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
    const email = currentUser?.email || 'Local Profile';

    const nameEl = document.getElementById('dropdown-user-name');
    if (nameEl) nameEl.textContent = username;

    const emailEl = document.getElementById('dropdown-user-email');
    if (emailEl) emailEl.textContent = email;

    const parts = username.trim().split(/\s+/);
    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    const avatarEl = document.getElementById('dropdown-user-avatar');
    if (avatarEl) avatarEl.textContent = initials || 'LU';

    // Update compact Sync state row
    const syncDot = document.getElementById('dropdown-sync-dot');
    const syncText = document.getElementById('dropdown-sync-text');
    const queue = getSyncQueue();
    const deadLetter = getDeadLetterQueue();
    const isOnline = navigator.onLine;

    if (syncDot && syncText) {
      syncDot.className = 'status-dot';
      if (!isOnline) {
        syncDot.classList.add('offline');
        const count = queue.length;
        syncText.textContent = count > 0 ? `🔴 Offline (${count})` : '🔴 Offline';
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

    if (currentUser) {
      enqueueMutation('profiles', 'UPSERT', {
        id: currentUser.id,
        full_name: newName,
        updated_at: new Date().toISOString()
      });

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
        }
      } catch (err) {
        console.warn('[Account & Security] Error fetching session:', err);
      }
    }

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

    if (subtitleEl) subtitleEl.innerHTML = `Switch ledger from <strong>${oldCur}</strong> to <strong>${newCur}</strong>?`;
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
      if (state.income) {
        state.income = convertAmount(state.income, oldCur, newCur);
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
    localStorage.setItem('ledgio_currency', newCur);

    const quickSelect = document.getElementById('quick-currency-select');
    const settingsSelect = document.getElementById('currency-select');
    if (quickSelect) quickSelect.value = newCur;
    if (settingsSelect) settingsSelect.value = newCur;
    updateCurrencyPreview(newCur);

    saveData();

    if (currentUser) {
      enqueueMutation('profiles', 'UPSERT', {
        id: currentUser.id,
        currency: newCur,
        income: state.income,
        updated_at: new Date().toISOString()
      });

      if (shouldConvertValues) {
        if (state.expenses && state.expenses.length > 0) {
          state.expenses.forEach(e => {
            enqueueMutation('expenses', 'UPSERT', {
              id: e.id,
              user_id: currentUser.id,
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
              user_id: currentUser.id,
              category: cat,
              monthly_limit: state.budgets[cat],
              updated_at: new Date().toISOString()
            });
          });
        }
      }
    }

    refreshUI();

    const toastMsg = shouldConvertValues
      ? `✅ Converted ledger to ${newCur} (${rateText})`
      : `✅ Currency changed to ${newCur}`;
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

  function openEditModal(expenseId) {
    const expense = state.expenses.find(e => e.id === expenseId);
    if (!expense) return;
    
    document.getElementById('edit-expense-id').value = expense.id;
    document.getElementById('edit-expense-name').value = expense.name;
    document.getElementById('edit-expense-amount').value = expense.amount;
    document.getElementById('edit-expense-category').value = expense.category;
    document.getElementById('edit-expense-date').value = expense.date;
    
    document.getElementById('edit-modal').style.display = 'flex';
  }

  // Calculation & Summaries
  function updateSummary() {
    const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = state.income - totalExpenses;
    const savingsRate = state.income > 0 ? ((remaining / state.income) * 100).toFixed(1) : 0;
    
    const incomeEl = document.getElementById('summary-income');
    const expensesEl = document.getElementById('summary-expenses');
    const remainingEl = document.getElementById('summary-remaining');
    const savingsEl = document.getElementById('summary-savings-rate');
    
    if (incomeEl) {
      incomeEl.textContent = formatCurrency(state.income);
      if (isStealthModeActive) incomeEl.classList.add('stealth-masked');
      else incomeEl.classList.remove('stealth-masked');
    }
    if (expensesEl) {
      expensesEl.textContent = formatCurrency(totalExpenses);
      if (isStealthModeActive) expensesEl.classList.add('stealth-masked');
      else expensesEl.classList.remove('stealth-masked');
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
  }

  function createActionButtons(id) {
    const container = document.createElement('div');
    container.className = 'expense-item-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    editBtn.onclick = () => openEditModal(id);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    delBtn.onclick = () => deleteExpense(id);
    
    container.appendChild(editBtn);
    container.appendChild(delBtn);
    return container;
  }

  function renderExpenses() {
    const list = document.getElementById('expense-list');
    if (!list) return;
    list.innerHTML = '';
    
    const recent = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    if (recent.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No recent expenses</p></div>';
      return;
    }
    
    recent.forEach(exp => {
      const cat = CATEGORIES[exp.category] || CATEGORIES.other;
      
      const item = document.createElement('div');
      item.className = 'expense-item';
      
      const icon = document.createElement('div');
      icon.className = 'expense-item-icon';
      icon.style.backgroundColor = cat.color;
      icon.innerHTML = `<i class="fas ${cat.icon}"></i>`;
      
      const details = document.createElement('div');
      details.className = 'expense-item-details';
      
      const name = document.createElement('p');
      name.className = 'expense-item-name';
      name.textContent = exp.name;
      
      const date = document.createElement('p');
      date.className = 'expense-item-date';
      date.textContent = exp.date;
      
      details.appendChild(name);
      details.appendChild(date);
      
      const amount = document.createElement('div');
      amount.className = 'expense-item-amount';
      amount.textContent = formatCurrency(exp.amount);
      
      const actions = createActionButtons(exp.id);
      
      item.appendChild(icon);
      item.appendChild(details);
      item.appendChild(amount);
      item.appendChild(actions);
      
      list.appendChild(item);
    });
  }

  function renderAllExpenses() {
    const tbody = document.getElementById('all-expenses-table');
    if (!tbody) return;
    
    const filtered = getFilteredExpenses();
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fas fa-search"></i><p>No expenses found</p></div>';
      return;
    }
    
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(exp => {
      const cat = CATEGORIES[exp.category] || CATEGORIES.other;
      const row = document.createElement('div');
      row.className = 'table-row';
      
      const name = document.createElement('div');
      name.className = 'col-name';
      name.textContent = exp.name;
      
      const catDiv = document.createElement('div');
      catDiv.className = 'col-category';
      const badge = document.createElement('span');
      badge.className = 'category-badge';
      badge.style.backgroundColor = cat.color;
      badge.textContent = cat.label;
      catDiv.appendChild(badge);
      
      const amount = document.createElement('div');
      amount.className = 'col-amount';
      amount.textContent = formatCurrency(exp.amount);
      amount.style.fontWeight = '600';
      
      const date = document.createElement('div');
      date.className = 'col-date';
      date.textContent = exp.date;
      date.style.color = 'var(--color-text-muted)';
      date.style.fontSize = '0.875rem';
      
      const actions = createActionButtons(exp.id);
      actions.className = 'col-actions expense-item-actions';
      
      row.appendChild(name);
      row.appendChild(catDiv);
      row.appendChild(amount);
      row.appendChild(date);
      row.appendChild(actions);
      tbody.appendChild(row);
    });
  }

  async function deleteBudget(category) {
    const cat = CATEGORIES[category] || { label: category };
    const confirmed = await showConfirm(`Delete the budget for ${cat.label}? This syncs to your cloud backup.`);
    if (!confirmed) return;

    delete state.budgets[category];
    saveData();
    refreshUI();
    showToast(`Budget for ${cat.label} deleted`);

    if (currentUser) {
      enqueueMutation('budgets', 'DELETE', {
        user_id: currentUser.id,
        category: category
      });
    }
  }

  function renderBudgets() {
    const list = document.getElementById('budget-list');
    if (!list) return;
    list.innerHTML = '';
    
    const entries = Object.entries(state.budgets);
    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-bullseye"></i><p>No budgets set</p></div>';
      return;
    }
    
    // Calculate current month's spending per category
    const currentMonth = new Date().toISOString().slice(0, 7);
    const spendingMap = {};
    state.expenses
      .filter(e => e.date.startsWith(currentMonth))
      .forEach(e => {
        spendingMap[e.category] = (spendingMap[e.category] || 0) + e.amount;
      });
      
    entries.forEach(([category, limit]) => {
      const cat = CATEGORIES[category] || CATEGORIES.other;
      const spent = spendingMap[category] || 0;
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      
      const color = pct >= 90 ? 'var(--color-danger)' : 
                    pct >= 75 ? 'var(--color-warning)' : 
                    'var(--color-success)';
                    
      const item = document.createElement('div');
      item.className = 'budget-item';
      
      const header = document.createElement('div');
      header.className = 'budget-item-header';
      
      const title = document.createElement('div');
      title.className = 'budget-item-title';
      title.innerHTML = `<i class="fas ${cat.icon}" style="color:${cat.color}"></i> <span>${cat.label}</span>`;
      
      const actions = document.createElement('div');
      actions.className = 'budget-item-actions';

      const amounts = document.createElement('div');
      amounts.className = 'budget-item-amounts';
      amounts.innerHTML = `<span style="color:var(--color-text)">${formatCurrency(spent)}</span> / ${formatCurrency(limit)}`;

      const delBtn = document.createElement('button');
      delBtn.className = 'budget-delete-btn';
      delBtn.setAttribute('type', 'button');
      delBtn.setAttribute('title', `Delete ${cat.label} budget`);
      delBtn.setAttribute('aria-label', `Delete ${cat.label} budget`);
      delBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBudget(category);
      });

      actions.appendChild(amounts);
      actions.appendChild(delBtn);

      header.appendChild(title);
      header.appendChild(actions);
      
      const bar = document.createElement('div');
      bar.className = 'budget-progress-bar';
      
      const fill = document.createElement('div');
      fill.className = 'budget-progress-fill';
      fill.style.width = `${pct}%`;
      fill.style.backgroundColor = color;
      
      bar.appendChild(fill);
      
      const footer = document.createElement('div');
      footer.className = 'budget-item-footer';
      footer.innerHTML = `<span>${pct}% used</span><span>${formatCurrency(Math.max(0, limit - spent))} remaining</span>`;
      
      item.appendChild(header);
      item.appendChild(bar);
      item.appendChild(footer);
      
      list.appendChild(item);
    });
  }

  // Chart Rendering
  function renderCategoryChart() {
    const canvas = document.getElementById('category-chart');
    if (!canvas) return;
    
    if (chartInstances.category) {
      chartInstances.category.destroy();
    }
    
    const catMap = {};
    state.expenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    
    const labels = [];
    const data = [];
    const bgColors = [];
    
    Object.entries(catMap).forEach(([k, v]) => {
      const cat = CATEGORIES[k] || CATEGORIES.other;
      labels.push(cat.label);
      data.push(v);
      bgColors.push(cat.color);
    });
    
    if (data.length === 0) {
      labels.push('No Expenses');
      data.push(1);
      bgColors.push('#cbd5e1');
    }
    
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 10 } }
          }
        },
        cutout: '70%'
      }
    });
  }

  window.renderSpendingChart = function() {
    const canvas = document.getElementById('spending-chart');
    if (!canvas) return;
    
    if (chartInstances.spending) {
      chartInstances.spending.destroy();
    }
    
    const catMap = {};
    state.expenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    
    const labels = [];
    const data = [];
    const bgColors = [];
    
    Object.entries(catMap).forEach(([k, v]) => {
      const cat = CATEGORIES[k] || CATEGORIES.other;
      labels.push(cat.label);
      data.push(v);
      bgColors.push(cat.color);
    });
    
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
        plugins: {
          legend: { position: 'right' }
        }
      }
    });
  };

  window.renderTrendChart = function() {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    
    if (chartInstances.trend) {
      chartInstances.trend.destroy();
    }
    
    // Group expenses by month (last 6 months)
    const monthMap = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthMap[key] = { label, total: 0 };
    }
    
    state.expenses.forEach(e => {
      const key = e.date.slice(0, 7);
      if (monthMap[key]) {
        monthMap[key].total += e.amount;
      }
    });
    
    const labels = Object.values(monthMap).map(m => m.label);
    const data = Object.values(monthMap).map(m => m.total);
    
    chartInstances.trend = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Expenses',
          data,
          backgroundColor: 'var(--color-primary)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  };

  // Actions (Cloud & Local Sync)
  // Optimistic Expense Operations (0ms Latency + Background Mutation Queue)
  async function addExpense() {
    const nameInput = document.getElementById('expense-name-input');
    const valInput = document.getElementById('expense-value-input');
    const catInput = document.getElementById('expense-category-select');
    
    const name = nameInput.value.trim();
    const amount = parseFloat(valInput.value);
    const category = catInput.value;
    const date = new Date().toISOString().split('T')[0];
    
    if (!name || isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid name and amount.', 'error');
      return;
    }
    
    const newId = crypto.randomUUID ? crypto.randomUUID() : generateId();
    const timestamp = new Date().toISOString();
    const newExpense = {
      id: newId,
      name,
      amount,
      category,
      date,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // 1. Optimistic Local State Update (0ms)
    state.expenses.unshift(newExpense);
    saveData();
    refreshUI();

    nameInput.value = '';
    valInput.value = '';
    showToast('Expense added successfully');

    // 2. Background Queue
    if (currentUser) {
      enqueueMutation('expenses', 'UPSERT', {
        id: newExpense.id,
        user_id: currentUser.id,
        name,
        amount,
        category,
        date,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  async function saveEdit() {
    const id = document.getElementById('edit-expense-id').value;
    const name = document.getElementById('edit-expense-name').value.trim();
    const amount = parseFloat(document.getElementById('edit-expense-amount').value);
    const category = document.getElementById('edit-expense-category').value;
    const date = document.getElementById('edit-expense-date').value;
    
    if (!name || isNaN(amount) || amount <= 0 || !date) {
      showToast('Please fill all fields correctly.', 'error');
      return;
    }

    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      const updatedAt = new Date().toISOString();
      state.expenses[idx] = {
        ...state.expenses[idx],
        name, amount, category, date,
        updatedAt
      };
      saveData();
      document.getElementById('edit-modal').style.display = 'none';
      refreshUI();
      showToast('Expense updated');

      if (currentUser) {
        enqueueMutation('expenses', 'UPSERT', {
          id,
          user_id: currentUser.id,
          name,
          amount,
          category,
          date,
          updated_at: updatedAt
        });
      }
    }
  }

  async function deleteExpense(id) {
    const confirmed = await showConfirm('Are you sure you want to delete this expense?');
    if (confirmed) {
      state.expenses = state.expenses.filter(e => e.id !== id);
      saveData();
      refreshUI();
      showToast('Expense deleted');

      if (currentUser) {
        enqueueMutation('expenses', 'DELETE', { id, user_id: currentUser.id });
      }
    }
  }

  function getFilteredExpenses() {
    let filtered = [...state.expenses];
    
    const q = document.getElementById('expense-search')?.value.toLowerCase() || '';
    const cat = document.getElementById('category-filter')?.value || '';
    const mo = document.getElementById('month-filter')?.value || '';
    
    if (q) filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
    if (cat) filtered = filtered.filter(e => e.category === cat);
    if (mo) filtered = filtered.filter(e => e.date.startsWith(mo));
    
    return filtered;
  }

  // Populate UI
  function populateDropdowns() {
    const cats = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    
    ['expense-category-select', 'edit-expense-category', 'budget-category-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = cats;
    });
    
    const catFilter = document.getElementById('category-filter');
    if (catFilter) {
      catFilter.innerHTML = `<option value="">All Categories</option>${cats}`;
    }
    
    const moFilter = document.getElementById('month-filter');
    if (moFilter) {
      const months = new Set(state.expenses.map(e => e.date.slice(0, 7)));
      const sortedMonths = Array.from(months).sort().reverse();
      moFilter.innerHTML = '<option value="">All Time</option>' + 
        sortedMonths.map(m => `<option value="${m}">${m}</option>`).join('');
    }
    
    const incInput = document.getElementById('income-input');
    if (incInput) {
      if (currentIncomeMode === 'set') {
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

  // Income Mode & Calculations
  let currentIncomeMode = 'add'; // 'add' or 'set'

  function updateIncomePreview() {
    const inputEl = document.getElementById('income-input');
    const inputVal = parseFloat(inputEl?.value) || 0;
    const previewBox = document.getElementById('income-calc-preview');
    const previewVal = document.getElementById('income-preview-val');
    const currentBadge = document.getElementById('income-current-badge');
    
    if (currentBadge) {
      currentBadge.textContent = `Current: ${formatCurrency(state.income || 0)}`;
    }
    
    if (!previewBox || !previewVal) return;
    
    if (currentIncomeMode === 'add') {
      if (inputVal > 0) {
        const resultingTotal = (state.income || 0) + inputVal;
        previewVal.textContent = formatCurrency(resultingTotal);
        previewBox.style.display = 'flex';
      } else {
        previewBox.style.display = 'none';
      }
    } else {
      if (inputVal >= 0 && inputEl?.value !== '') {
        previewVal.textContent = formatCurrency(inputVal);
        previewBox.style.display = 'flex';
      } else {
        previewBox.style.display = 'none';
      }
    }
  }

  function setIncomeMode(mode) {
    currentIncomeMode = mode;
    const tabAdd = document.getElementById('income-tab-add');
    const tabSet = document.getElementById('income-tab-set');
    const label = document.getElementById('income-input-label');
    const input = document.getElementById('income-input');
    const chips = document.getElementById('income-quick-chips');
    const btnIcon = document.querySelector('#set-income-btn i');
    const btnText = document.getElementById('set-income-btn-text');
    
    if (mode === 'add') {
      tabAdd?.classList.add('active');
      tabSet?.classList.remove('active');
      if (label) label.textContent = 'Amount to Add (+)';
      if (input) {
        input.placeholder = 'e.g. 2500';
        input.value = '';
      }
      if (chips) chips.style.display = 'flex';
      if (btnText) btnText.textContent = 'Add to Income';
      if (btnIcon) btnIcon.className = 'fas fa-plus-circle';
    } else {
      tabSet?.classList.add('active');
      tabAdd?.classList.remove('active');
      if (label) label.textContent = 'Total Monthly Income (=)';
      if (input) {
        input.placeholder = 'e.g. 50000';
        input.value = state.income || '';
      }
      if (chips) chips.style.display = 'none';
      if (btnText) btnText.textContent = 'Set Total Income';
      if (btnIcon) btnIcon.className = 'fas fa-sliders';
    }
    updateIncomePreview();
  }

  // Navigation
  function navigateTo(hash) {
    const sectionName = hash.replace('#', '') || 'dashboard';
    
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const target = link.getAttribute('href').replace('#', '');
      link.classList.toggle('active', target === sectionName);
    });
    
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${sectionName}`);
    });
    
    const titleMap = {
      dashboard: 'Dashboard',
      expenses: 'Expenses Ledger',
      budget: 'Monthly Budgets',
      reports: 'Financial Reports',
      settings: 'App Preferences'
    };
    
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.textContent = titleMap[sectionName] || 'Dashboard';
    
    if (sectionName === 'dashboard') {
      renderCategoryChart();
    } else if (sectionName === 'reports') {
      window.renderSpendingChart();
      window.renderTrendChart();
    } else if (sectionName === 'settings') {
      updateRatesFreshnessUI();
      loadAccountSecurityInfo();
    }
  }

  // Dark Mode & Live Preview System
  function applyDarkMode() {
    const isDark = Boolean(state.settings.darkMode);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem('ledgio_theme', isDark ? 'dark' : 'light');
    localStorage.setItem('sb_dark_mode_' + getUserId(), isDark ? 'true' : 'false');
    
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
    if (!supabase) return;
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

  function refreshUI() {
    updateSummary();
    renderExpenses();
    renderAllExpenses();
    renderBudgets();
    renderCategoryChart();
    applyDarkMode();
    updateCurrencyPreview(state.settings?.currency);
    const curSelect = document.getElementById('currency-select');
    if (curSelect && state.settings?.currency) {
      curSelect.value = state.settings.currency;
    }
    loadTelemetryStats();
  }

  // =========================================================================
  // Phase 2: Private Vault, Device PIN Lock & Privacy Shield Implementation
  // =========================================================================

  function getVaultStorageKey() {
    return `ledgio_vault_${getUserId()}`;
  }

  function loadVaultConfig() {
    try {
      const hasAuth = (localStorage.getItem('sb_auth') === 'true' && !!localStorage.getItem('sb_user_id'));
      if (!hasAuth && !currentUser?.id) {
        vaultConfig = {
          pinEnabled: false,
          pinHash: null,
          pinSalt: null,
          stealthMode: false,
          autoLockTimeout: 3,
          biometricEnabled: false,
          biometricCredentialId: null
        };
        return;
      }
      const raw = localStorage.getItem(getVaultStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          vaultConfig = Object.assign({
            pinEnabled: false,
            pinHash: null,
            pinSalt: null,
            stealthMode: false,
            autoLockTimeout: 3,
            biometricEnabled: false,
            biometricCredentialId: null
          }, parsed);
          vaultConfig.biometricEnabled = Boolean(parsed.biometricEnabled && parsed.biometricCredentialId);
          vaultConfig.biometricCredentialId = parsed.biometricCredentialId || null;
        }
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
      console.warn('[Ledgio Vault] Error loading vault config, using defaults:', e);
      vaultConfig = {
        pinEnabled: false,
        pinHash: null,
        pinSalt: null,
        stealthMode: false,
        autoLockTimeout: 3,
        biometricEnabled: false,
        biometricCredentialId: null
      };
    }
  }

  function saveVaultConfig() {
    try {
      localStorage.setItem(getVaultStorageKey(), JSON.stringify(vaultConfig));
      localStorage.setItem(`ledgio_stealth_${getUserId()}`, isStealthModeActive ? 'true' : 'false');
    } catch (e) {
      console.warn('Error saving vault config:', e);
    }
  }

  async function hashPin(pin, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${pin}:${salt}:ledgio_vault_v2`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    const now = Date.now();
    if (isBiometricAuthenticating || (now - lastBiometricAttemptTime < 300)) {
      return false;
    }
    lastBiometricAttemptTime = now;
    isBiometricAuthenticating = true;

    const bioBtn = document.getElementById('vault-biometric-btn');
    if (bioBtn) bioBtn.disabled = true;

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
        showToast('🔒 Private Vault Unlocked', 'success');
        return true;
      }
    } catch (err) {
      console.warn('[Ledgio Vault] Biometric verification error:', err);
      if (err.name === 'NotAllowedError') {
        // User cancelled OS dialog — allowed to tap again immediately
      } else {
        showToast('Biometric verification failed. Please enter your PIN.', 'info');
      }
    } finally {
      isBiometricAuthenticating = false;
      if (bioBtn) bioBtn.disabled = false;
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

    if (badge) {
      if (vaultConfig.pinEnabled && vaultConfig.pinHash) {
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

    if (pinToggle) pinToggle.checked = Boolean(vaultConfig.pinEnabled);
    if (changePinRow) changePinRow.style.display = vaultConfig.pinEnabled ? 'flex' : 'none';
    if (stealthToggle) stealthToggle.checked = Boolean(isStealthModeActive);
    if (autoLockSelect) autoLockSelect.value = String(vaultConfig.autoLockTimeout);

    // Biometric Row handling
    if (biometricRow && biometricToggle) {
      biometricRow.style.display = 'flex';
      const noteEl = document.getElementById('vault-biometric-note');
      if (!vaultConfig.pinEnabled || !vaultConfig.pinHash) {
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
        hideLockScreen();
        isVerifyingPin = false;
        return;
      }

      const computedHash = await hashPin(currentEnteredPin, vaultConfig.pinSalt);
      if (computedHash === vaultConfig.pinHash) {
        failedPinAttempts = 0;
        hideLockScreen();
        showToast('🔒 Private Vault Unlocked', 'success');
        isVerifyingPin = false;
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
        } else {
          if (errText) errText.textContent = `Incorrect PIN (${5 - failedPinAttempts} attempts left).`;
          if (errBanner) errBanner.style.display = 'flex';
        }

        setTimeout(() => {
          currentEnteredPin = '';
          updatePinDots('lock');
          isVerifyingPin = false;
        }, 500);
      }
    } catch (e) {
      console.error('[Ledgio Vault] Error verifying PIN:', e);
      isVerifyingPin = false;
    }
  }

  function openSetupPinModal() {
    setupPinStep = 1;
    setupTempPin = '';
    currentEnteredPin = '';
    updatePinDots('setup');

    const modal = document.getElementById('set-pin-modal');
    const title = document.getElementById('set-pin-title');
    const instruction = document.getElementById('set-pin-instruction');
    const errBanner = document.getElementById('setup-error-msg');

    if (title) title.innerHTML = '<i class="fas fa-key" style="color:#10b981;"></i> Set 4-Digit PIN';
    if (instruction) instruction.textContent = 'Step 1 of 2: Choose a 4-digit security PIN';
    if (errBanner) errBanner.style.display = 'none';
    if (modal) modal.style.display = 'flex';
  }

  async function handleSetupPinInput() {
    if (setupPinStep === 1) {
      setupTempPin = currentEnteredPin;
      setupPinStep = 2;
      currentEnteredPin = '';
      updatePinDots('setup');
      const instruction = document.getElementById('set-pin-instruction');
      if (instruction) instruction.textContent = 'Step 2 of 2: Re-enter PIN to confirm';
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
        showToast('✅ 4-Digit Device PIN successfully enabled!', 'success');
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
          if (instruction) instruction.textContent = 'Step 1 of 2: Choose a 4-digit security PIN';
          if (errBanner) errBanner.style.display = 'none';
        }, 1000);
      }
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
    updateSummary();
    renderExpenses();
    renderAllExpenses();
    renderBudgets();

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
      if (!vaultConfig.pinEnabled || isVaultLocked || vaultConfig.autoLockTimeout < 0) return;
      const idleMs = Date.now() - lastActivityTimestamp;
      const thresholdMs = (vaultConfig.autoLockTimeout === 0 ? 5000 : vaultConfig.autoLockTimeout * 60 * 1000);
      if (idleMs >= thresholdMs) {
        console.log('[Ledgio Vault] Inactivity threshold reached. Locking private vault...');
        showLockScreen();
      }
    }, 10000);
  }

  function initVaultVisibilityAutoLock() {
    // Auto-lock vault immediately on visibility loss if timeout is set to 0 (Immediate)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (vaultConfig.pinEnabled && vaultConfig.autoLockTimeout === 0) {
          showLockScreen();
        }
      }
    }, { capture: true });
  }

  // Event Listeners Setup
  function setupEventListeners() {
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

    // Mobile Sidebar Controller
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

    // Escape Key Listener to dismiss sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    });

    // Auto-close on resize to desktop (1024px+)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeSidebar();
      }
    });
    
    document.getElementById('dark-mode-btn')?.addEventListener('click', toggleDarkMode);
    
    // Expenses
    document.getElementById('add-expense-btn')?.addEventListener('click', addExpense);
    ['expense-name-input', 'expense-value-input'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') addExpense();
      });
    });
    
    // Edit Modal
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      document.getElementById('edit-modal').style.display = 'none';
    });
    document.getElementById('save-edit-btn')?.addEventListener('click', saveEdit);
    
    // Filters
    ['expense-search', 'category-filter', 'month-filter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', renderAllExpenses);
    });
    
    // Income Management (Tabs, Quick Chips, Dynamic Preview & Updater)
    document.getElementById('income-tab-add')?.addEventListener('click', () => setIncomeMode('add'));
    document.getElementById('income-tab-set')?.addEventListener('click', () => setIncomeMode('set'));

    document.querySelectorAll('.income-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.val) || 0;
        const input = document.getElementById('income-input');
        if (input) {
          const currentInput = parseFloat(input.value) || 0;
          input.value = (currentInput + addVal);
          updateIncomePreview();
          input.focus();
        }
      });
    });

    document.getElementById('income-input')?.addEventListener('input', updateIncomePreview);

    document.getElementById('set-income-btn')?.addEventListener('click', async () => {
      const inputEl = document.getElementById('income-input');
      const val = parseFloat(inputEl.value);
      if (isNaN(val) || val < 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      let finalIncome = 0;
      let toastMsg = '';

      if (currentIncomeMode === 'add') {
        if (val === 0) {
          showToast('Please enter an amount to add', 'error');
          return;
        }
        finalIncome = (state.income || 0) + val;
        toastMsg = `Added +${formatCurrency(val)}! Total income is now ${formatCurrency(finalIncome)}.`;
      } else {
        finalIncome = val;
        toastMsg = `Total monthly income set to ${formatCurrency(finalIncome)}.`;
      }

      state.income = finalIncome;
      saveData();
      updateSummary();
      updateIncomePreview();

      if (currentIncomeMode === 'add') {
        inputEl.value = '';
        const previewBox = document.getElementById('income-calc-preview');
        if (previewBox) previewBox.style.display = 'none';
      }

      // Background Queue for Income (Supabase profiles)
      if (currentUser) {
        enqueueMutation('profiles', 'UPSERT', {
          id: currentUser.id,
          income: finalIncome,
          currency: state.settings.currency || 'INR',
          updated_at: new Date().toISOString()
        });
      }

      showToast(toastMsg, 'success');
    });
    
    document.getElementById('set-budget-btn')?.addEventListener('click', async () => {
      const cat = document.getElementById('budget-category-select').value;
      const val = parseFloat(document.getElementById('budget-amount-input').value);
      if (cat && !isNaN(val) && val >= 0) {
        state.budgets[cat] = val;
        
        saveData();
        renderBudgets();
        showToast('Budget set successfully');
        document.getElementById('budget-amount-input').value = '';

        // Background Queue for Budget Upsert
        if (currentUser) {
          enqueueMutation('budgets', 'UPSERT', {
            user_id: currentUser.id,
            category: cat,
            monthly_limit: val,
            updated_at: new Date().toISOString()
          });
        }
      } else {
        showToast('Invalid budget data', 'error');
      }
    });
    
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
    document.querySelectorAll('.summary-card, #monthly-income-card').forEach(card => {
      card.addEventListener('dblclick', () => toggleStealthMode());
    });

    // Private Vault & Security Settings Card Listeners
    document.getElementById('vault-pin-toggle')?.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (!vaultConfig.pinHash) {
          openSetupPinModal();
        } else {
          vaultConfig.pinEnabled = true;
          saveVaultConfig();
          updateVaultSettingsUI();
          showToast('🔒 4-Digit PIN protection activated', 'success');
        }
      } else {
        const confirmDisable = await showConfirm('Disable 4-Digit Device PIN protection? Your financial vault will no longer require a passcode on entry.');
        if (confirmDisable) {
          vaultConfig.pinEnabled = false;
          vaultConfig.biometricEnabled = false;
          vaultConfig.biometricCredentialId = null;
          saveVaultConfig();
          updateVaultSettingsUI();
          showToast('PIN protection disabled', 'info');
        } else {
          e.target.checked = true;
        }
      }
    });

    document.getElementById('change-pin-btn')?.addEventListener('click', () => {
      openSetupPinModal();
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

    // Biometric Fingerprint Lock Screen Button
    document.getElementById('vault-biometric-btn')?.addEventListener('click', () => {
      authenticateWithBiometrics();
    });

    // Emergency Sign Out from PIN Lock Screen
    document.getElementById('vault-emergency-logout-btn')?.addEventListener('click', () => {
      if (window.logout) {
        window.logout();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('index.html');
      }
    });

    // Zero-lag Touch Keypad Listener for Lock Screen
    const lockNumpad = document.getElementById('lock-numpad');
    let lastLockTap = 0;
    lockNumpad?.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const btn = e.target.closest('.num-key');
      if (!btn) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastLockTap < 80) return;
      lastLockTap = now;
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 100);
      const key = btn.dataset.key;
      if (key) handleNumpadKey(key, 'lock');
    });

    // Zero-lag Touch Keypad Listener for PIN Setup Modal
    const setupNumpad = document.getElementById('setup-numpad');
    let lastSetupTap = 0;
    setupNumpad?.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const btn = e.target.closest('.num-key');
      if (!btn) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastSetupTap < 80) return;
      lastSetupTap = now;
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 100);
      const key = btn.dataset.key;
      if (key) handleNumpadKey(key, 'setup');
    });

    // Close / Cancel PIN Setup Modal
    document.getElementById('cancel-set-pin-btn')?.addEventListener('click', () => {
      document.getElementById('set-pin-modal').style.display = 'none';
      updateVaultSettingsUI();
    });
    document.getElementById('close-set-pin-btn')?.addEventListener('click', () => {
      document.getElementById('set-pin-modal').style.display = 'none';
      updateVaultSettingsUI();
    });

    // Physical Keyboard Support for PIN Lock & Setup
    document.addEventListener('keydown', (e) => {
      const lockModal = document.getElementById('vault-lock-modal');
      const setupModal = document.getElementById('set-pin-modal');
      
      if (isVaultLocked && lockModal && lockModal.style.display !== 'none') {
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
          setupModal.style.display = 'none';
          updateVaultSettingsUI();
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
        // 1. Clear queues first
        saveSyncQueue([]);
        saveDeadLetterQueue([]);

        // 2. Set persistent cloud reset tombstone (survives tab close / app restart)
        const tombstoneKey = getResetTombstoneKey();
        localStorage.setItem(tombstoneKey, JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: getUserId()
        }));

        // 3. If online, wipe cloud immediately (don't wait for restart)
        if (navigator.onLine && supabase && currentUser) {
          await processCloudResetTombstone();
        }

        // 4. Wipe local storage and reset state
        localStorage.removeItem(getStorageKey());
        try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
        state = { version: 2, income: 0, expenses: [], budgets: {}, settings: { currency: 'INR', darkMode: false } };
        populateDropdowns();
        refreshUI();
        applyDarkMode();
        updateSyncStatusUI();
        showToast('All data has been reset');
      }
    });

    // Network Event Listeners for Offline Sync Engine
    window.__ledgio_syncEngineActive = true;

    window.addEventListener('online', async () => {
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

    // Periodic Background Sync Check (every 60s)
    setInterval(() => {
      if (navigator.onLine && supabase && currentUser && (getSyncQueue().length > 0 || localStorage.getItem(getResetTombstoneKey()))) {
        processCloudResetTombstone().then(() => processSyncQueue());
      }
    }, 60000);

    // Sync Diagnostics Hub Modal Listeners
    document.getElementById('sync-status-btn')?.addEventListener('click', () => {
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
        showToast('Sync encounter note: check network connection', 'warning');
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
  }

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

  // Initialization
  async function init() {
    loadVaultConfig();
    await loadData();
    createPhase3SafetyBackup();
    populateDropdowns();
    applyDarkMode();
    updateVaultSettingsUI();
    toggleStealthMode(isStealthModeActive);
    fetchLiveExchangeRates();
    refreshUI();
    setupEventListeners();
    initInactivityTimer();
    initVaultVisibilityAutoLock();
    
    // Personalize user name dynamically
    const username = getEffectiveUserName();
    updateUserDisplayNames(username);
    loadAccountSecurityInfo();

    // Trigger PIN lock on startup if enabled
    if (vaultConfig.pinEnabled && vaultConfig.pinHash) {
      showLockScreen();
    }

    // Initial routing
    navigateTo(window.location.hash || '#dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
