'use strict';

/**
 * Ledgio — Offline-First Sync Engine Module
 * 
 * Provides:
 * - Unconditional mutation enqueuing (Stage 0 local-first invariant)
 * - Sequential FIFO queue processing & transient error halt
 * - Poison-pill quarantine & Dead-Letter Queue management
 * - Progressive backoff schedule for transient failures
 * - Server-timestamp stripping and authoritative write-back
 * - Public sync API bridge for cross-module coordination
 */

(function() {
  const BACKOFF_SCHEDULE = [3000, 6000, 12000, 30000, 60000];
  let isSyncProcessing = false;
  let syncRetryTimer = null;
  let isWaitingForNetwork = false;
  let isSignInRequired = false;

  // Host bridge for state access, client lookup, and notification hooks
  let syncBridge = {
    getState: () => (window.__ledgio_getState ? window.__ledgio_getState() : window.state || null),
    getCurrentUser: () => (window.__ledgio_getCurrentUserForTesting ? window.__ledgio_getCurrentUserForTesting() : window.currentUser || null),
    getUserId: () => {
      if (typeof window.getUserId === 'function') return window.getUserId();
      const u = (window.__ledgio_getCurrentUserForTesting ? window.__ledgio_getCurrentUserForTesting() : window.currentUser || null);
      if (u && u.id) return u.id;
      return localStorage.getItem('sb_user_id') || 'default_user';
    },
    getSupabaseClient: () => (window.supabaseClient || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null)),
    saveData: (trackUndo) => (typeof window.saveData === 'function' ? window.saveData(trackUndo) : null),
    saveIncomeEntries: () => (typeof window.saveIncomeEntries === 'function' ? window.saveIncomeEntries() : null),
    saveCategoriesCache: () => (typeof window.saveCategoriesCache === 'function' ? window.saveCategoriesCache() : null),
    updateSyncStatusUI: () => (typeof window.updateSyncStatusUI === 'function' ? window.updateSyncStatusUI() : null),
    broadcastSyncEvent: (type, payload) => (typeof window.broadcastSyncEvent === 'function' ? window.broadcastSyncEvent(type, payload) : null),
    showToast: (msg, type) => (typeof window.showToast === 'function' ? window.showToast(msg, type) : null),
    isQuotaExceededError: (e) => (typeof window.isQuotaExceededError === 'function' ? window.isQuotaExceededError(e) : false),
    pullRemoteChanges: () => (typeof window.pullRemoteChanges === 'function' ? window.pullRemoteChanges() : Promise.resolve()),
    onSyncStateChange: null
  };

  function configure(customConfig = {}) {
    syncBridge = { ...syncBridge, ...customConfig };
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getSyncQueueKey(userId) {
    const uid = userId || syncBridge.getUserId();
    return `ledgio_sync_queue_${uid}`;
  }

  function getDeadLetterKey(userId) {
    const uid = userId || syncBridge.getUserId();
    return `ledgio_dead_letter_${uid}`;
  }

  function getLastSyncKey(userId) {
    const uid = userId || syncBridge.getUserId();
    return `ledgio_last_sync_${uid}`;
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

      // Reconcile and migrate orphan sync queues from default_user
      const defaultQueueKey = 'ledgio_sync_queue_default_user';
      if (primaryKey !== defaultQueueKey) {
        try {
          const orphanRaw = localStorage.getItem(defaultQueueKey);
          if (orphanRaw) {
            const orphanItems = JSON.parse(orphanRaw);
            if (Array.isArray(orphanItems) && orphanItems.length > 0) {
              const existingIds = new Set(items.map(it => it.id));
              let migrated = false;
              const currentUid = syncBridge.getUserId();
              orphanItems.forEach(oit => {
                if (oit && (!oit.id || !existingIds.has(oit.id))) {
                  if (oit.data && typeof oit.data === 'object' && (oit.data.user_id === 'default_user' || !oit.data.user_id)) {
                    oit.data.user_id = currentUid;
                  }
                  items.push(oit);
                  migrated = true;
                }
              });
              if (migrated) {
                localStorage.removeItem(defaultQueueKey);
                localStorage.setItem(primaryKey, JSON.stringify(items));
              }
            }
          }
        } catch (e) {}
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
      console.error('Could not save sync queue:', e);
      if (syncBridge.isQuotaExceededError(e)) {
        syncBridge.showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
    syncBridge.updateSyncStatusUI();
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

      // Reconcile and migrate orphan dead-letter queues from default_user
      const defaultDlKey = 'ledgio_dead_letter_default_user';
      if (primaryKey !== defaultDlKey) {
        try {
          const orphanRaw = localStorage.getItem(defaultDlKey);
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
                localStorage.removeItem(defaultDlKey);
                localStorage.setItem(primaryKey, JSON.stringify(items));
              }
            }
          }
        } catch (e) {}
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
      console.error('Could not save dead-letter queue:', e);
      if (syncBridge.isQuotaExceededError(e)) {
        syncBridge.showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
    syncBridge.updateSyncStatusUI();
  }

  function enqueueMutation(table, action, data) {
    const mutation = {
      id: generateId(),
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

    syncBridge.broadcastSyncEvent('QUEUE_MUTATION', {
      userId: syncBridge.getUserId(),
      queueLength: queue.length
    });

    // If online and connected, attempt background processing asynchronously
    const supabase = syncBridge.getSupabaseClient();
    const currentUser = syncBridge.getCurrentUser();
    if (navigator.onLine && supabase && currentUser) {
      setTimeout(() => processSyncQueue(), 40);
    }

    return mutation;
  }

  function writeBackServerTimestamp(table, id, serverUpdatedAt) {
    const state = syncBridge.getState();
    if (!state || !id || !serverUpdatedAt) return;
    if (table === 'expenses' && Array.isArray(state.expenses)) {
      const rec = state.expenses.find(e => e.id === id);
      if (rec) { rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt; }
    } else if (table === 'goals' && Array.isArray(state.goals)) {
      const rec = state.goals.find(g => g.id === id);
      if (rec) { rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt; }
    } else if (table === 'goal_deposits' && Array.isArray(state.goal_deposits)) {
      const rec = state.goal_deposits.find(d => d.id === id);
      if (rec) { rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt; }
    } else if (table === 'loans' && Array.isArray(state.loans)) {
      const rec = state.loans.find(l => l.id === id);
      if (rec) { rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt; }
    } else if (table === 'loan_settlements' && Array.isArray(state.loan_settlements)) {
      const rec = state.loan_settlements.find(s => s.id === id);
      if (rec) { rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt; }
    } else if (table === 'income_entries' && Array.isArray(state.income_entries)) {
      const rec = state.income_entries.find(e => e.id === id);
      if (rec) {
        rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt;
        if (typeof syncBridge.saveIncomeEntries === 'function') syncBridge.saveIncomeEntries();
      }
    } else if (table === 'user_categories' && Array.isArray(state.customCategories)) {
      const rec = state.customCategories.find(c => c.id === id);
      if (rec) {
        rec.updated_at = serverUpdatedAt; rec.updatedAt = serverUpdatedAt;
        if (typeof syncBridge.saveCategoriesCache === 'function') syncBridge.saveCategoriesCache();
      }
    }
  }

  // Sequential FIFO processor with per-item Poison Pill handling & backoff (Amendment 1)
  async function processSyncQueue(force = false) {
    if (isSyncProcessing && !force) return;
    const supabase = syncBridge.getSupabaseClient();
    const currentUser = syncBridge.getCurrentUser();
    if (!navigator.onLine || !supabase || !currentUser) {
      syncBridge.updateSyncStatusUI();
      return;
    }

    isSyncProcessing = true;
    if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ processing: true });
    syncBridge.updateSyncStatusUI();

    try {
      let queue = getSyncQueue();
      const deadLetter = getDeadLetterQueue();
      let queueModified = false;
      let dlModified = false;
      const now = Date.now();

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item) continue;

        // If item is currently backing off, skip it or halt queue if transient (FIFO guarantee)
        if (!force && item.nextRetryTime && now < item.nextRetryTime) {
          if (item.isTransient || item.waitingForNetwork || item.status === 'waiting for network' || item.status === 'sign in required' || item.status === 'sign in again') {
            break; // Transient failure halts entire queue; child mutations wait for parent
          }
          continue; // Poison-pill escape for non-transient items
        }

        let opError = null;
        let opStatus = null;
        let res = null;
        try {
          if (item.table === 'expenses') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('expenses').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('expenses').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'budgets') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('budgets').upsert(payload, { onConflict: 'user_id,category' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('budgets').delete().eq('user_id', currentUser.id).eq('category', item.data.category);
            }
          } else if (item.table === 'profiles') {
            if (item.action === 'UPSERT' || item.action === 'UPDATE') {
              const payload = { ...item.data, id: item.data.id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('profiles').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            }
          } else if (item.table === 'goals') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('goals').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('goals').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'goal_deposits') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('goal_deposits').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('goal_deposits').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'loans') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('loans').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('loans').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'loan_settlements') {
            if (item.action === 'UPSERT') {
              const payload = { ...item.data, user_id: item.data.user_id || currentUser.id };
              delete payload.updated_at;
              delete payload.updatedAt;
              const query = supabase.from('loan_settlements').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('loan_settlements').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'income_entries') {
            if (item.action === 'UPSERT') {
              const { id, user_id, amount, entry_date, type, note, loan_id, settlement_id, created_at, createdAt } = item.data || {};
              const payload = {
                id,
                user_id: user_id || currentUser.id,
                amount,
                entry_date,
                type,
                note,
                loan_id: loan_id || null,
                settlement_id: settlement_id || null,
                created_at: created_at || createdAt || new Date().toISOString()
              };
              const query = supabase.from('income_entries').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('income_entries').delete().eq('id', item.data.id);
            }
          } else if (item.table === 'user_categories') {
            if (item.action === 'UPSERT') {
              const { id, user_id, name, color, icon, is_builtin, created_at, createdAt } = item.data || {};
              const payload = {
                id,
                user_id: user_id || currentUser.id,
                name,
                color: color || '#3b82f6',
                icon: icon || 'fa-tag',
                is_builtin: Boolean(is_builtin),
                created_at: created_at || createdAt || new Date().toISOString()
              };
              const query = supabase.from('user_categories').upsert(payload, { onConflict: 'id' });
              if (query && typeof query.select === 'function') {
                res = await query.select();
              } else {
                res = await query;
              }
            } else if (item.action === 'DELETE') {
              res = await supabase.from('user_categories').delete().eq('id', item.data.id);
            }
          }

          if (res && res.error) {
            opError = res.error;
            opStatus = res.status !== undefined ? res.status : null;
          }
        } catch (err) {
          opError = err;
          opStatus = err.status || err.statusCode || null;
        }

        if (!opError) {
          // Success: dequeue mutation
          isSignInRequired = false;
          if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: false });
          queue.splice(i, 1);
          i--;
          queueModified = true;
          localStorage.setItem(getLastSyncKey(), new Date().toISOString());

          // Write back server-assigned authoritative timestamp into local record (Finding-10)
          const returnedRow = (res && res.data) ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
          const serverUpdatedAt = returnedRow?.updated_at || returnedRow?.updatedAt;
          if (serverUpdatedAt && item.data?.id) {
            writeBackServerTimestamp(item.table, item.data.id, serverUpdatedAt);
          }
        } else {
          // Failure: classify opError before incrementing retries
          const rawStatus = opStatus !== null && opStatus !== undefined ? opStatus : (opError.status || opError.statusCode || opError.status_code);
          const httpStatus = (rawStatus !== undefined && rawStatus !== null && !isNaN(Number(rawStatus)) && Number(rawStatus) > 0) ? Number(rawStatus) : null;
          const errCode = String(opError.code || '');

          // Opening race / unique constraint (Postgres 23505): treat as ALREADY DONE
          // regardless of error shape — remove local mutation, do NOT dead-letter, let pull adopt entry
          const isIncomeOpening23505 = Boolean(
            item.table === 'income_entries' &&
            (errCode === '23505' || /23505/i.test(String(opError.code || opError.message || '')))
          );

          if (isIncomeOpening23505) {
            console.info('🛡️ [Sync Engine] income_entries 23505 unique violation (opening entry already exists) — adopting server entry');
            delete item.waitingForNetwork;
            queue.splice(i, 1);
            i--;
            queueModified = true;
            if (typeof syncBridge.pullRemoteChanges === 'function') {
              await syncBridge.pullRemoteChanges().catch(() => {});
            }
            continue;
          }

          // 1. Narrow the TypeError rule: treat as network only if
          //    name === 'TypeError' AND message matches /failed to fetch|load failed|network/i.
          //    Other TypeErrors (code bugs) count as real failures (cap 5).
          const isTypeError = opError.name === 'TypeError';
          const isNetworkTypeError = isTypeError && /failed to fetch|load failed|network/i.test(opError.message || '');
          const isGenericNetworkMsg = /failed to fetch|network|load failed|timeout/i.test(opError.message || '');

          const isNetworkError = (
            navigator.onLine === false ||
            isNetworkTypeError ||
            (!isTypeError && (opError.name === 'AbortError' || isGenericNetworkMsg))
          );

          // 2. Auth-transient: HTTP 401 or message /jwt expired/i
          const isAuthTransient = Boolean(
            httpStatus === 401 ||
            /jwt expired/i.test(opError.message || '')
          );

          item.lastError = opError.message || opError.details || String(opError);

          if (isNetworkError) {
            // Branch 1: network throw / fetch failure / no HTTP status: do NOT increment item.retries;
            // keep the backoff timer, mark queue as "waiting for network", and halt queue replay (FIFO).
            item.status = 'waiting for network';
            item.waitingForNetwork = true;
            item.isTransient = true;
            isWaitingForNetwork = true;
            if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ waiting: true });

            const backoffIdx = Math.max(0, Math.min((item.retries || 1) - 1, BACKOFF_SCHEDULE.length - 1));
            const delay = BACKOFF_SCHEDULE[backoffIdx];
            if (!item.nextRetryTime || item.nextRetryTime <= now) {
              item.nextRetryTime = now + delay;
            }
            queueModified = true;
            if (!syncRetryTimer) {
              syncRetryTimer = setTimeout(() => {
                syncRetryTimer = null;
                processSyncQueue();
              }, delay);
            }
            break; // FIFO halt: transient network drop halts subsequent queue items
          } else if (isAuthTransient) {
            // Branch 2: Auth-transient (HTTP 401 or JWT expired)
            // Do NOT increment retries; call supabase.auth.refreshSession() once, then retry on the normal backoff.
            // If refresh fails, mark the queue "sign in required" and keep the items.
            item.isTransient = true;
            delete item.waitingForNetwork;
            if (item.status === 'waiting for network') delete item.status;

            let refreshSucceeded = false;
            try {
              if (supabase && supabase.auth && typeof supabase.auth.refreshSession === 'function') {
                const refreshRes = await supabase.auth.refreshSession();
                if (refreshRes && !refreshRes.error && refreshRes.data && (refreshRes.data.session || refreshRes.data.user)) {
                  refreshSucceeded = true;
                }
              }
            } catch (authErr) {
              refreshSucceeded = false;
            }

            const backoffIdx = Math.max(0, Math.min((item.retries || 1) - 1, BACKOFF_SCHEDULE.length - 1));
            const delay = BACKOFF_SCHEDULE[backoffIdx];
            item.nextRetryTime = Date.now() + delay;

            if (refreshSucceeded) {
              isSignInRequired = false;
              if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: false });
              if (item.status === 'sign in required' || item.status === 'sign in again') delete item.status;
              if (!syncRetryTimer) {
                syncRetryTimer = setTimeout(() => {
                  syncRetryTimer = null;
                  processSyncQueue();
                }, delay);
              }
            } else {
              // Refresh failed: set flag "sign in required", show quiet toast, and keep the items intact
              if (!isSignInRequired) {
                syncBridge.showToast('Session expired — please sign in again', 'warning');
              }
              isSignInRequired = true;
              if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: true });
              queue.forEach(qItem => {
                if (qItem) qItem.status = 'sign in required';
              });
            }

            queueModified = true;
            break; // Stop replaying rest of queue for now
          } else {
            // Real rejection: server response, Postgres constraint/RLS error, or code bug (e.g. plain TypeError)
            delete item.waitingForNetwork;
            if (item.status === 'waiting for network' || item.status === 'sign in required' || item.status === 'sign in again') delete item.status;

            // Permanent Postgres rejections (dead-letter cap 5):
            // 42501 (RLS), 23505 (unique), 23503 (FK), 23514 (check), 22xxx (bad data exceptions)
            const isPermanentPgError = (
              errCode === '42501' ||
              errCode === '23505' ||
              errCode === '23503' ||
              errCode === '23514' ||
              /^22/.test(errCode)
            );

            // Transient server errors (5xx or 429) that are not permanent Postgres errors: cap 10
            const isTransient5xxOr429 = Boolean(
              !isPermanentPgError &&
              httpStatus &&
              (httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599))
            );

            if (isTransient5xxOr429) {
              item.isTransient = true;
            } else {
              item.isTransient = false;
            }

            // Cap: 10 for transient 5xx/429; 5 for permanent PG codes, 4xx rejections, and anything else
            const deadLetterCap = isTransient5xxOr429 ? 10 : 5;

            item.retries = (item.retries || 0) + 1;

            if (item.retries >= deadLetterCap) {
              // Poison Pill / Exhausted: Move to dead-letter queue
              console.error(`⚠️ [Sync Poison Pill] Moving to dead-letter queue after ${item.retries} failed attempts (status: ${httpStatus}, code: ${errCode || 'none'}):`, item);
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
              if (isTransient5xxOr429) {
                break; // FIFO halt: transient 5xx/429 server outage halts subsequent queue items
              }
            }
          }
        }
      }

      if (queueModified) {
        saveSyncQueue(queue);
        syncBridge.saveData(false);
      }
      if (dlModified) saveDeadLetterQueue(deadLetter);
    } finally {
      isSyncProcessing = false;
      if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ processing: false });
      syncBridge.updateSyncStatusUI();
    }
  }

  async function pullRemoteChanges() {
    if (typeof syncBridge.pullRemoteChanges === 'function') {
      return await syncBridge.pullRemoteChanges();
    }
  }

  // Public API
  const LedgioSyncEngine = {
    configure,
    enqueueMutation,
    processSyncQueue,
    getSyncQueue,
    saveSyncQueue,
    getDeadLetterQueue,
    saveDeadLetterQueue,
    getSyncQueueKey,
    getDeadLetterKey,
    getLastSyncKey,
    pullRemoteChanges,
    get isSyncProcessing() { return isSyncProcessing; },
    set isSyncProcessing(v) {
      isSyncProcessing = Boolean(v);
      if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ processing: isSyncProcessing });
    },
    get isWaitingForNetwork() { return isWaitingForNetwork; },
    set isWaitingForNetwork(v) {
      isWaitingForNetwork = Boolean(v);
      if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ waiting: isWaitingForNetwork });
    },
    get isSignInRequired() { return isSignInRequired; },
    set isSignInRequired(v) {
      isSignInRequired = Boolean(v);
      if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: isSignInRequired });
    }
  };

  window.LedgioSyncEngine = LedgioSyncEngine;
  window.enqueueMutation = enqueueMutation;
  window.processSyncQueue = processSyncQueue;
  window.getSyncQueue = getSyncQueue;
  window.saveSyncQueue = saveSyncQueue;
  window.getDeadLetterQueue = getDeadLetterQueue;
  window.saveDeadLetterQueue = saveDeadLetterQueue;
  window.pullRemoteChanges = pullRemoteChanges;
})();
