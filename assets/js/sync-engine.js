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
  let lastSkipReason = null;

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

  function resetAuthRefreshAttempts() {
    try {
      const q = getSyncQueue();
      let mod = false;
      q.forEach(item => {
        if (item && (item.authRefreshAttempts || item.transientAttempts)) {
          delete item.authRefreshAttempts;
          item.transientAttempts = 0;
          mod = true;
        }
      });
      if (mod) saveSyncQueue(q);
    } catch (e) {}
  }

  let authListenerAttached = false;
  function attachAuthStateListener(sb) {
    if (!authListenerAttached && sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
      try {
        sb.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            resetAuthRefreshAttempts();
          }
        });
        authListenerAttached = true;
      } catch (e) {}
    }
  }

  function configure(customConfig = {}) {
    syncBridge = { ...syncBridge, ...customConfig };
    resetAuthRefreshAttempts();
    attachAuthStateListener(syncBridge.getSupabaseClient());
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
      const raw = localStorage.getItem(primaryKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
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
      const raw = localStorage.getItem(primaryKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (err) {
      console.warn('Error reading dead-letter queue:', err);
      return [];
    }
  }

  // Explicit post-sign-in orphan queue migration (B1):
  // Never migrates during plain reads. Only adopts items with missing user_id or 'default_user'.
  // Preserves items belonging to other real users and sets a one-time marker key.
  function migrateOrphanQueues(targetUserId) {
    const uid = targetUserId || syncBridge.getUserId();
    if (!uid || uid === 'default_user') return;

    const markerKey = `ledgio_orphan_queue_migrated_${uid}`;
    if (localStorage.getItem(markerKey) === 'true') return;

    try {
      // 1. Sync Queue migration
      const defaultQueueKey = 'ledgio_sync_queue_default_user';
      const targetQueueKey = getSyncQueueKey(uid);
      const orphanRaw = localStorage.getItem(defaultQueueKey);

      if (orphanRaw) {
        let orphanItems = [];
        try {
          const parsed = JSON.parse(orphanRaw);
          if (Array.isArray(parsed)) orphanItems = parsed;
        } catch (e) {}

        if (orphanItems.length > 0) {
          let targetQueue = [];
          const targetRaw = localStorage.getItem(targetQueueKey);
          if (targetRaw) {
            try {
              const parsed = JSON.parse(targetRaw);
              if (Array.isArray(parsed)) targetQueue = parsed;
            } catch (e) {}
          }

          const existingIds = new Set(targetQueue.map(it => it.id));
          const remainingOrphans = [];

          orphanItems.forEach(oit => {
            if (!oit) return;
            const itemUserId = oit.data?.user_id;
            // Only adopt items with missing user_id or explicitly 'default_user'
            if (!itemUserId || itemUserId === 'default_user') {
              if (oit.data && typeof oit.data === 'object') {
                oit.data.user_id = uid;
              }
              if (!existingIds.has(oit.id)) {
                targetQueue.push(oit);
                existingIds.add(oit.id);
              }
            } else if (itemUserId === uid) {
              // Already belongs to target user
              if (!existingIds.has(oit.id)) {
                targetQueue.push(oit);
                existingIds.add(oit.id);
              }
            } else {
              // Real user id belonging to someone else — MUST STAY PUT, never re-stamped!
              remainingOrphans.push(oit);
            }
          });

          localStorage.setItem(targetQueueKey, JSON.stringify(targetQueue));
          if (remainingOrphans.length > 0) {
            localStorage.setItem(defaultQueueKey, JSON.stringify(remainingOrphans));
          } else {
            localStorage.removeItem(defaultQueueKey);
          }
        }
      }

      // 2. Dead-letter queue migration
      const defaultDlKey = 'ledgio_dead_letter_default_user';
      const targetDlKey = getDeadLetterKey(uid);
      const orphanDlRaw = localStorage.getItem(defaultDlKey);

      if (orphanDlRaw) {
        let orphanDlItems = [];
        try {
          const parsed = JSON.parse(orphanDlRaw);
          if (Array.isArray(parsed)) orphanDlItems = parsed;
        } catch (e) {}

        if (orphanDlItems.length > 0) {
          let targetDl = [];
          const targetDlRaw = localStorage.getItem(targetDlKey);
          if (targetDlRaw) {
            try {
              const parsed = JSON.parse(targetDlRaw);
              if (Array.isArray(parsed)) targetDl = parsed;
            } catch (e) {}
          }

          const existingDlIds = new Set(targetDl.map(it => it.id));
          const remainingDlOrphans = [];

          orphanDlItems.forEach(oit => {
            if (!oit) return;
            const itemUserId = oit.data?.user_id;
            if (!itemUserId || itemUserId === 'default_user') {
              if (oit.data && typeof oit.data === 'object') {
                oit.data.user_id = uid;
              }
              if (!existingDlIds.has(oit.id)) {
                targetDl.push(oit);
                existingDlIds.add(oit.id);
              }
            } else if (itemUserId === uid) {
              if (!existingDlIds.has(oit.id)) {
                targetDl.push(oit);
                existingDlIds.add(oit.id);
              }
            } else {
              remainingDlOrphans.push(oit);
            }
          });

          localStorage.setItem(targetDlKey, JSON.stringify(targetDl));
          if (remainingDlOrphans.length > 0) {
            localStorage.setItem(defaultDlKey, JSON.stringify(remainingDlOrphans));
          } else {
            localStorage.removeItem(defaultDlKey);
          }
        }
      }

      // Set one-time marker key so migration cannot run twice
      localStorage.setItem(markerKey, 'true');
    } catch (err) {
      console.warn('[Sync Engine] Error migrating orphan queues:', err);
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
    if (isSyncProcessing && !force) {
      lastSkipReason = 'already processing';
      console.log('[Sync Engine] Skip guard fired: already processing');
      return;
    }
    const supabase = syncBridge.getSupabaseClient();
    const currentUser = syncBridge.getCurrentUser();
    if (!navigator.onLine) {
      lastSkipReason = 'offline';
      console.log('[Sync Engine] Skip guard fired: offline');
      syncBridge.updateSyncStatusUI();
      return;
    }
    if (!supabase) {
      lastSkipReason = 'no client';
      console.log('[Sync Engine] Skip guard fired: no client');
      syncBridge.updateSyncStatusUI();
      return;
    }
    if (!currentUser) {
      lastSkipReason = 'no currentUser';
      console.log('[Sync Engine] Skip guard fired: no currentUser');
      syncBridge.updateSyncStatusUI();
      return;
    }

    try {
      isSyncProcessing = true;
      if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ processing: true });
      syncBridge.updateSyncStatusUI();

      let queue = getSyncQueue();
      const deadLetter = getDeadLetterQueue();
      let queueModified = false;
      let dlModified = false;
      const now = Date.now();
      const blockedKeys = new Set();
      let queueCompletedWithoutHalt = true;

      // Auto-heal legacy or poisoned user_categories non-UUID entries in dead-letter queue
      for (let j = deadLetter.length - 1; j >= 0; j--) {
        const dlItem = deadLetter[j];
        if (dlItem && dlItem.table === 'user_categories') {
          const catId = dlItem.data?.id;
          const isNotUuid = !catId || (typeof catId === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catId));
          const dlErrStr = typeof dlItem.lastError === 'string' ? dlItem.lastError : (dlItem.lastError ? `${dlItem.lastError.message || ''} ${dlItem.lastError.code || ''}` : '');
          const isUuidErr = dlErrStr && /uuid|22P02/i.test(dlErrStr);
          if (isNotUuid || isUuidErr) {
            const uid = dlItem.data?.user_id || currentUser.id;
            const toUuid = window.deterministicUuid || window.LedgioIncome?.deterministicUuid;
            const seed = 'category:' + uid + ':' + (dlItem.data?.name || '').trim().toLowerCase();
            const validUuid = typeof toUuid === 'function' ? toUuid(seed) : generateId();
            if (dlItem.data) dlItem.data.id = validUuid;
            dlItem.retries = 0;
            delete dlItem.nextRetryTime;
            delete dlItem.lastError;
            delete dlItem.failedAt;
            deadLetter.splice(j, 1);
            queue.push(dlItem);
            dlModified = true;
            queueModified = true;
          }
        }
      }

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item) continue;

        const recordKey = item.table && item.data ? `${item.table}:${item.data.id || item.data.category || ''}` : null;

        // FIFO Invariant (A3): If a preceding mutation for the same record is currently backing off,
        // skip this item so subsequent mutations (e.g. DELETE) don't execute before earlier ones (e.g. UPSERT)
        if (recordKey && blockedKeys.has(recordKey)) {
          continue;
        }

        // If item is currently backing off, skip it or halt queue if transient (FIFO guarantee)
        if (!force && item.nextRetryTime && now < item.nextRetryTime) {
          if (item.isTransient || item.waitingForNetwork || item.status === 'waiting for network' || item.status === 'sign in required' || item.status === 'sign in again') {
            const waitSec = Math.max(0, Math.round((item.nextRetryTime - now) / 1000));
            lastSkipReason = `backoff break (${item.status || (item.waitingForNetwork ? 'waiting for network' : 'transient')}, ${waitSec}s remaining)`;
            console.log(`[Sync Engine] Skip guard fired: backoff break (${item.status || 'transient'}, ${waitSec}s remaining)`);
            queueCompletedWithoutHalt = false;
            break; // Transient failure halts entire queue; child mutations wait for parent
          }
          if (recordKey) {
            blockedKeys.add(recordKey);
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
              let { id, user_id, amount, entry_date, type, note, loan_id, settlement_id, created_at, createdAt } = item.data || {};
              if (id && typeof id === 'string' && id.startsWith('inc_salary_')) {
                const toUuid = window.deterministicUuid || window.LedgioIncome?.deterministicUuid;
                const validUuid = typeof toUuid === 'function' ? toUuid(id) : null;
                if (validUuid) {
                  id = validUuid;
                  if (item.data) item.data.id = id;
                }
              }
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
              let { id, user_id, name, color, icon, is_builtin, created_at, createdAt } = item.data || {};
              const uid = user_id || currentUser.id;
              const isUuid = id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
              if (!isUuid) {
                const toUuid = window.deterministicUuid || window.LedgioIncome?.deterministicUuid;
                const seed = 'category:' + uid + ':' + (name || '').trim().toLowerCase();
                const validUuid = typeof toUuid === 'function' ? toUuid(seed) : generateId();
                id = validUuid;
                if (item.data) item.data.id = id;
                const appState = syncBridge.getState();
                if (Array.isArray(appState?.customCategories)) {
                  const stateCat = appState.customCategories.find(c => c.id === item.data?.id || (c.name && c.name.toLowerCase() === (name || '').toLowerCase()));
                  if (stateCat) stateCat.id = validUuid;
                }
              }
              const payload = {
                id,
                user_id: uid,
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
              let catId = item.data?.id;
              const isUuid = catId && typeof catId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catId);
              if (!isUuid && catId) {
                const toUuid = window.deterministicUuid || window.LedgioIncome?.deterministicUuid;
                const seed = 'category:' + (item.data?.user_id || currentUser.id) + ':' + (item.data?.name || '').trim().toLowerCase();
                catId = typeof toUuid === 'function' ? toUuid(seed) : catId;
                if (item.data) item.data.id = catId;
              }
              res = await supabase.from('user_categories').delete().eq('id', catId);
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
          if (item.transientAttempts) item.transientAttempts = 0;
          if (item.authRefreshAttempts) delete item.authRefreshAttempts;
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

          // Postgres 23505 Unique Violation Handling (A4):
          // 1. income_entries special case: Opening balance has a partial unique index on (user_id, type)
          //    where type='opening' (idx_income_opening_unique). If two devices create opening balances concurrently,
          //    or an offline queue replays an opening entry that cloud already created, 23505 means the opening
          //    balance already exists. Treat as ALREADY DONE and adopt server entry.
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

          // user_categories special case: Unique index on (user_id, LOWER(name)).
          // If the category name already exists in Supabase, 23505 means the category is already present in cloud.
          // Treat as done & pull remote changes to adopt server entry.
          const isCategoryName23505 = Boolean(
            item.table === 'user_categories' &&
            (errCode === '23505' || /23505/i.test(String(opError.code || opError.message || '')))
          );

          if (isCategoryName23505) {
            console.info('🛡️ [Sync Engine] user_categories 23505 unique violation (category name already exists in cloud) — adopting server category');
            delete item.waitingForNetwork;
            queue.splice(i, 1);
            i--;
            queueModified = true;
            if (typeof syncBridge.pullRemoteChanges === 'function') {
              await syncBridge.pullRemoteChanges().catch(() => {});
            }
            continue;
          }

          // 2. Generalized "already exists" for tables conflicting on primary key 'id'
          //    (expenses, goals, goal_deposits, loans, loan_settlements, user_categories, profiles).
          //    For UPSERT actions: if 23505 is on the primary key 'id' constraint (e.g. "expenses_pkey" or
          //    "Key (id)=(...) already exists"), the row is already present in Supabase (e.g. uploaded by another
          //    device or previous socket disconnect after commit). Treat as ALREADY DONE.
          //    Note: a 23505 on a *different* unique constraint (e.g. unique category name) is a real conflict and
          //    must fall through to normal failure/dead-letter. For 'budgets' (conflict key user_id,category), do not change behaviour.
          const isTableWithIdConflict = item.action === 'UPSERT' && item.table && item.table !== 'budgets' && item.table !== 'income_entries';
          const isGeneral23505 = isTableWithIdConflict && (errCode === '23505' || /23505/i.test(String(opError.code || opError.message || '')));

          if (isGeneral23505) {
            const errDetails = String(opError.details || '');
            const errMsg = String(opError.message || '');
            const errCombined = `${errMsg} ${errDetails}`;
            const isIdConflict = (
              /key \(id\)=/i.test(errDetails) ||
              /_pkey"?/i.test(errCombined) ||
              /\(id\)/i.test(errCombined) ||
              (!errDetails && !errMsg.includes('unique constraint'))
            );

            if (isIdConflict) {
              console.info(`🛡️ [Sync Engine] ${item.table} 23505 unique violation on id (record already exists) — treating as done`);
              delete item.waitingForNetwork;
              queue.splice(i, 1);
              i--;
              queueModified = true;
              if (typeof syncBridge.pullRemoteChanges === 'function') {
                await syncBridge.pullRemoteChanges().catch(() => {});
              }
              continue;
            }
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

          item.lastError = {
            message: opError.message || String(opError),
            code: errCode || opError.code || null,
            details: opError.details || opError.hint || null,
            status: httpStatus
          };

          if (isNetworkError) {
            // Branch 1: network throw / fetch failure / no HTTP status: do NOT increment item.retries;
            // increment item.transientAttempts for backoff progression (A1), mark queue as "waiting for network", and halt queue replay (FIFO).
            item.status = 'waiting for network';
            item.waitingForNetwork = true;
            item.isTransient = true;
            isWaitingForNetwork = true;
            if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ waiting: true });

            item.transientAttempts = (item.transientAttempts || 0) + 1;
            const backoffIdx = Math.max(0, Math.min(item.transientAttempts - 1, BACKOFF_SCHEDULE.length - 1));
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
            lastSkipReason = 'network error break';
            console.log('[Sync Engine] Skip guard fired: network error break');
            queueCompletedWithoutHalt = false;
            break; // FIFO halt: transient network drop halts subsequent queue items
          } else if (isAuthTransient) {
            // Branch 2: Auth-transient (HTTP 401 or JWT expired)
            // Do NOT increment retries; call supabase.auth.refreshSession() once, then retry on the normal backoff.
            // If refresh fails or loops > 5 times, mark the queue "sign in required" and stop timer (A2).
            item.isTransient = true;
            delete item.waitingForNetwork;
            if (item.status === 'waiting for network') delete item.status;

            item.transientAttempts = (item.transientAttempts || 0) + 1;
            const backoffIdx = Math.max(0, Math.min(item.transientAttempts - 1, BACKOFF_SCHEDULE.length - 1));
            const delay = BACKOFF_SCHEDULE[backoffIdx];
            item.nextRetryTime = Date.now() + delay;

            // Persistent 401 guard: Stop if already reached 5 attempts
            if ((item.authRefreshAttempts || 0) >= 5) {
              if (!isSignInRequired) {
                syncBridge.showToast('Session expired — please sign in again', 'warning');
              }
              isSignInRequired = true;
              if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: true });
              queue.forEach(qItem => {
                if (qItem) qItem.status = 'sign in required';
              });
              queueModified = true;
              lastSkipReason = `auth failure break (${item.status || 'sign in required'})`;
              console.log(`[Sync Engine] Skip guard fired: auth failure break (${item.status || 'sign in required'})`);
              queueCompletedWithoutHalt = false;
              break;
            }

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

            if (refreshSucceeded) {
              item.authRefreshAttempts = (item.authRefreshAttempts || 0) + 1;
              if (item.authRefreshAttempts >= 5) {
                // Persistent 401: Cap at 5 consecutive refresh cycles to prevent infinite looping (A2)
                console.warn('[Sync Engine] Persistent 401: exceeded 5 consecutive refresh cycles without auth resolution');
                if (!isSignInRequired) {
                  syncBridge.showToast('Session expired — please sign in again', 'warning');
                }
                isSignInRequired = true;
                if (syncBridge.onSyncStateChange) syncBridge.onSyncStateChange({ signInRequired: true });
                queue.forEach(qItem => {
                  if (qItem) qItem.status = 'sign in required';
                });
                queueModified = true;
                lastSkipReason = `auth failure break (${item.status || 'sign in required'})`;
                console.log(`[Sync Engine] Skip guard fired: auth failure break (${item.status || 'sign in required'})`);
                queueCompletedWithoutHalt = false;
                break; // Stop loop and do not schedule retry timer
              }

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
            lastSkipReason = `auth failure break (${item.status || 'sign in required'})`;
            console.log(`[Sync Engine] Skip guard fired: auth failure break (${item.status || 'sign in required'})`);
            queueCompletedWithoutHalt = false;
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
              if (recordKey) {
                blockedKeys.add(recordKey);
              }
              if (!syncRetryTimer) {
                syncRetryTimer = setTimeout(() => {
                  syncRetryTimer = null;
                  processSyncQueue();
                }, delay);
              }
              if (isTransient5xxOr429) {
                lastSkipReason = `transient ${httpStatus || '5xx/429'} break`;
                console.log(`[Sync Engine] Skip guard fired: transient ${httpStatus || '5xx/429'} break`);
                queueCompletedWithoutHalt = false;
                break; // FIFO halt: transient 5xx/429 server outage halts subsequent queue items
              }
            }
          }
        }
      }

      if (queueCompletedWithoutHalt) {
        lastSkipReason = null;
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
    migrateOrphanQueues,
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
    },
    get lastSkipReason() { return lastSkipReason; },
    set lastSkipReason(v) { lastSkipReason = v; }
  };

  window.LedgioSyncEngine = LedgioSyncEngine;
  window.enqueueMutation = enqueueMutation;
  window.processSyncQueue = processSyncQueue;
  window.getSyncQueue = getSyncQueue;
  window.saveSyncQueue = saveSyncQueue;
  window.getDeadLetterQueue = getDeadLetterQueue;
  window.saveDeadLetterQueue = saveDeadLetterQueue;
  window.pullRemoteChanges = pullRemoteChanges;
  window.migrateOrphanQueues = migrateOrphanQueues;
})();
