/**
 * Ledgio — Savings Goals & Milestones Domain Module
 * 
 * Provides:
 * - Computed current saved amounts (SUM of first-class deposits)
 * - Progress calculations, percentages, countdowns, and completion detection
 * - Goal lifecycle: createGoal, updateGoal, deleteGoal, restoreDeletedGoal
 * - Deposit & withdrawal flows: addGoalDeposit
 * - Child-first cascade delete mutation ordering (deposits deleted before parent goal)
 * - 5-second undo toast window & queue splicing / re-upsert logic
 * - Modal controllers: openGoalModal, closeGoalModal, openDepositModal, closeDepositModal,
 *   openDeleteGoalModal, closeDeleteGoalModal, openGoalModalWithLeftover
 * - Celebratory 60fps canvas confetti engine & custom undo toast helper
 * - Savings goals grid UI rendering & filter handling
 */

'use strict';

(function() {

  // Pure Sanitization & Security Utilities (SEC-01 & SEC-02)
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

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  // Host application connector bridge with sensible fallbacks
  const goalsBridge = {
    getState: () => (window.__ledgio_state || window.state || null),
    getCurrentUser: () => (window.__ledgio_currentUser || window.currentUser || null),
    getUserId: () => {
      if (typeof window.getUserId === 'function') return window.getUserId();
      return localStorage.getItem('sb_user_id') || 'default_user';
    },
    isStealthModeActive: () => Boolean(window.__ledgio_stealthMode || false),
    formatCurrency: (amt, hideDec) => {
      if (typeof window.formatCurrency === 'function') return window.formatCurrency(amt, hideDec);
      return '₹' + Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: hideDec ? 0 : 2, maximumFractionDigits: 2 });
    },
    escapeHtml: (str) => {
      if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
      return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
    },
    sanitizeColor: (col, fb) => sanitizeColor(col, fb),
    sanitizeIcon: (ic, fb) => sanitizeIcon(ic, fb),
    getLocalDateString: (d) => {
      if (typeof window.getLocalDateString === 'function') return window.getLocalDateString(d);
      const dt = d ? new Date(d) : new Date();
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    },
    showToast: (msg, type) => {
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      console.log(`[Toast ${type}] ${msg}`);
    },
    showUndoToast: (msg, onUndo) => showUndoToast(msg, onUndo),
    saveData: () => {
      if (typeof window.saveData === 'function') return window.saveData();
    },
    enqueueMutation: (table, action, data, id) => {
      if (window.LedgioSyncEngine && typeof window.LedgioSyncEngine.enqueueMutation === 'function') {
        return window.LedgioSyncEngine.enqueueMutation(table, action, data, id);
      }
      if (typeof window.enqueueMutation === 'function') return window.enqueueMutation(table, action, data, id);
    },
    getSyncQueue: () => {
      if (window.LedgioSyncEngine && typeof window.LedgioSyncEngine.getSyncQueue === 'function') {
        return window.LedgioSyncEngine.getSyncQueue();
      }
      if (typeof window.getSyncQueue === 'function') return window.getSyncQueue();
      return [];
    },
    saveSyncQueue: (q) => {
      if (window.LedgioSyncEngine && typeof window.LedgioSyncEngine.saveSyncQueue === 'function') {
        return window.LedgioSyncEngine.saveSyncQueue(q);
      }
      if (typeof window.saveSyncQueue === 'function') return window.saveSyncQueue(q);
    },
    updateSummary: () => {
      if (typeof window.updateSummary === 'function') return window.updateSummary();
    },
    renderExpenses: () => {
      if (typeof window.renderExpenses === 'function') return window.renderExpenses();
    },
    renderAllExpenses: () => {
      if (typeof window.renderAllExpenses === 'function') return window.renderAllExpenses();
    },
    isDevOrTest: false
  };

  function configure(customConfig = {}) {
    Object.assign(goalsBridge, customConfig);
  }

  // Domain UI State
  let activeGoalsFilter = 'all';
  let pendingDeletedGoal = null;
  let selectedGoalColor = '#10b981';
  let confettiAnimId = null;
  let currentDepositMode = 'deposit'; // 'deposit' | 'withdraw'
  let goalIdToDelete = null;

  // Computed Current Amount (Client-Side SUM of First-Class Deposits)
  function getGoalCurrentAmount(goalId) {
    const state = goalsBridge.getState();
    if (!state || !state.goal_deposits || !Array.isArray(state.goal_deposits)) return 0;
    return state.goal_deposits
      .filter(d => d.goal_id === goalId)
      .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  }

  // Goal Progress Computation
  function getGoalProgress(goal) {
    if (!goal) return { current: 0, target: 1, percent: 0, remaining: 1, isCompleted: false };
    const current = getGoalCurrentAmount(goal.id);
    const target = parseFloat(goal.target_amount) || 1;
    const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
    const remaining = Math.max(0, target - current);
    const isCompleted = current >= target;
    return { current, target, percent, remaining, isCompleted };
  }

  // Render Savings Goals Section
  function renderGoals() {
    const grid = document.getElementById('goals-grid');
    if (!grid) return;

    const state = goalsBridge.getState();
    if (!state) return;

    if (!Array.isArray(state.goals)) state.goals = [];
    if (!Array.isArray(state.goal_deposits)) state.goal_deposits = [];

    const isStealth = Boolean(typeof goalsBridge.isStealthModeActive === 'function' ? goalsBridge.isStealthModeActive() : goalsBridge.isStealthModeActive);

    // 1. Calculate Aggregate Header Metrics
    let totalTarget = 0;
    let totalSaved = 0;
    let completedCount = 0;

    state.goals.forEach(g => {
      totalTarget += parseFloat(g.target_amount) || 0;
      const cur = getGoalCurrentAmount(g.id);
      totalSaved += cur;
      if (cur >= (parseFloat(g.target_amount) || 0)) {
        completedCount++;
      }
    });

    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

    // Update Overview Header Elements (Stealth masked)
    const savedEl = document.getElementById('goals-total-saved');
    const targetEl = document.getElementById('goals-total-target');
    const progressEl = document.getElementById('goals-overall-progress');
    const completedEl = document.getElementById('goals-completed-count');

    if (savedEl) {
      savedEl.textContent = goalsBridge.formatCurrency(totalSaved);
      if (isStealth) savedEl.classList.add('stealth-masked');
      else savedEl.classList.remove('stealth-masked');
    }
    if (targetEl) {
      targetEl.textContent = goalsBridge.formatCurrency(totalTarget);
      if (isStealth) targetEl.classList.add('stealth-masked');
      else targetEl.classList.remove('stealth-masked');
    }
    if (progressEl) {
      progressEl.textContent = isStealth ? '••%' : `${overallPct}%`;
    }
    if (completedEl) {
      completedEl.textContent = `${completedCount} / ${state.goals.length}`;
    }

    // 2. Filter Goals
    const filteredGoals = state.goals.filter(goal => {
      const progress = getGoalProgress(goal);
      if (activeGoalsFilter === 'active') return !progress.isCompleted;
      if (activeGoalsFilter === 'completed') return progress.isCompleted;
      return true;
    });

    // 3. Empty State
    if (filteredGoals.length === 0) {
      const emptyDesc = state.goals.length === 0
        ? 'Set a target for an emergency fund, new tech, vacation, or investment milestone and start tracking progress with celebratory rewards.'
        : `No ${activeGoalsFilter === 'completed' ? 'completed' : 'in-progress'} goals found.`;

      grid.innerHTML = `
        <div class="goals-empty-state">
          <div class="goals-empty-icon">
            <i class="fas fa-bullseye"></i>
          </div>
          <h3 class="goals-empty-title">${state.goals.length === 0 ? 'No savings goals yet' : 'No goals match this filter'}</h3>
          <p class="goals-empty-desc">${emptyDesc}</p>
          <button type="button" id="create-first-goal-btn" data-action="create" class="btn btn-primary" style="min-height: 48px; padding: 12px 24px; font-weight: 600;">
            <i class="fas fa-plus"></i> <span>Create Your First Goal</span>
          </button>
        </div>
      `;
      return;
    }

    // 4. Render Goal Cards
    grid.innerHTML = filteredGoals.map(goal => {
      const progress = getGoalProgress(goal);
      const color = sanitizeColor(goal.color, '#10b981');
      const icon = sanitizeIcon(goal.icon, 'fa-bullseye');

      // Date Countdown computation
      let countdownHtml = '';
      if (goal.target_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetD = new Date(goal.target_date);
        targetD.setHours(0, 0, 0, 0);
        const diffMs = targetD.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          countdownHtml = `<span class="goal-target-countdown" style="color: var(--color-danger);"><i class="fas fa-clock"></i> Deadline passed</span>`;
        } else if (diffDays === 0) {
          countdownHtml = `<span class="goal-target-countdown" style="color: var(--color-warning);"><i class="fas fa-calendar-day"></i> Due today</span>`;
        } else {
          countdownHtml = `<span class="goal-target-countdown"><i class="fas fa-calendar"></i> ${diffDays} day${diffDays === 1 ? '' : 's'} left</span>`;
        }
      }

      // Stealth-aware amounts
      const savedStr = goalsBridge.formatCurrency(progress.current);
      const targetStr = goalsBridge.formatCurrency(progress.target);
      const remainingStr = goalsBridge.formatCurrency(progress.remaining);
      const pctStr = isStealth ? '••%' : (progress.isCompleted ? '🎉 100%' : `${progress.percent}%`);

      return `
        <article class="goal-card" data-id="${goalsBridge.escapeHtml(goal.id)}">
          <div class="goal-card-top">
            <div class="goal-icon-badge" style="background: ${color}18; color: ${color};">
              <i class="fas ${goalsBridge.escapeHtml(icon)}"></i>
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="goal-card-menu-btn" data-action="history" data-id="${goalsBridge.escapeHtml(goal.id)}" title="View History" aria-label="View History">
                <i class="fas fa-clock-rotate-left"></i>
              </button>
              <button type="button" class="goal-card-menu-btn" data-action="edit" data-id="${goalsBridge.escapeHtml(goal.id)}" title="Edit Goal" aria-label="Edit Goal">
                <i class="fas fa-pen"></i>
              </button>
              <button type="button" class="goal-card-menu-btn" data-action="delete" data-id="${goalsBridge.escapeHtml(goal.id)}" title="Delete Goal" aria-label="Delete Goal" style="color: var(--color-danger);">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </div>

          <h4 class="goal-card-title">${goalsBridge.escapeHtml(goal.name)}</h4>
          <p class="goal-card-notes">${goalsBridge.escapeHtml(goal.notes || '')}</p>

          <div class="goal-amount-row">
            <div class="goal-saved-amount ${isStealth ? 'stealth-masked' : ''}">${savedStr}</div>
            <div class="goal-target-amount">Target: <span class="${isStealth ? 'stealth-masked' : ''}">${targetStr}</span></div>
          </div>

          <!-- Milestone Progress Bar with Notches (25%, 50%, 75%, 100%) -->
          <div class="goal-progress-wrapper">
            <div class="goal-progress-track">
              <div class="goal-progress-fill" style="width: ${progress.percent}%; background: ${color};"></div>
              <div class="goal-milestone-notches" aria-hidden="true">
                <span class="goal-milestone-pip" style="margin-left: 25%;"></span>
                <span class="goal-milestone-pip" style="margin-left: 25%;"></span>
                <span class="goal-milestone-pip" style="margin-left: 25%;"></span>
              </div>
            </div>
          </div>

          <div class="goal-stats-row">
            <span class="goal-percentage-pill" style="background: ${color}20; color: ${color};">
              ${pctStr}
            </span>
            ${countdownHtml || `<span style="font-size: 0.8rem; color: var(--color-text-muted);">${isStealth ? '••••••' : `${remainingStr} to go`}</span>`}
          </div>

          <div class="goal-card-footer">
            <button type="button" class="btn btn-primary goal-add-funds-btn" data-action="deposit" data-id="${goalsBridge.escapeHtml(goal.id)}">
              <i class="fas fa-plus"></i> <span>Add Funds</span>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Create Goal
  function createGoal({ name, targetAmount, targetDate, category, color, icon, notes, initialDeposit }) {
    const state = goalsBridge.getState();
    if (!state) return;
    if (!Array.isArray(state.goals)) state.goals = [];
    if (!Array.isArray(state.goal_deposits)) state.goal_deposits = [];

    const goalId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId();
    const uid = goalsBridge.getCurrentUser()?.id || goalsBridge.getUserId();
    const nowIso = new Date().toISOString();

    const goal = {
      id: goalId,
      user_id: uid,
      name: name.trim(),
      target_amount: parseFloat(targetAmount) || 0,
      target_date: targetDate || null,
      category: category || 'general',
      color: sanitizeColor(color, '#10b981'),
      icon: sanitizeIcon(icon, 'fa-bullseye'),
      notes: (notes || '').trim(),
      created_at: nowIso,
      updated_at: nowIso
    };

    state.goals.unshift(goal);
    goalsBridge.enqueueMutation('goals', 'UPSERT', goal);

    const initAmt = parseFloat(initialDeposit) || 0;
    if (initAmt > 0) {
      const depId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId();
      const dep = {
        id: depId,
        goal_id: goalId,
        user_id: uid,
        amount: initAmt,
        deposit_date: nowIso.split('T')[0],
        note: 'Initial deposit',
        created_at: nowIso,
        updated_at: nowIso
      };
      state.goal_deposits.push(dep);
      goalsBridge.enqueueMutation('goal_deposits', 'UPSERT', dep);
    }

    goalsBridge.saveData();
    renderGoals();
    goalsBridge.showToast(`Savings goal "${goal.name}" created!`, 'success');
  }

  // Update Goal
  function updateGoal(goalId, { name, targetAmount, targetDate, category, color, icon, notes }) {
    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    goal.name = name.trim();
    goal.target_amount = parseFloat(targetAmount) || 0;
    goal.target_date = targetDate || null;
    goal.category = category || goal.category;
    goal.color = sanitizeColor(color || goal.color, '#10b981');
    goal.icon = sanitizeIcon(icon || goal.icon, 'fa-bullseye');
    goal.notes = (notes || '').trim();
    goal.updated_at = new Date().toISOString();

    goalsBridge.enqueueMutation('goals', 'UPSERT', goal);
    goalsBridge.saveData();
    renderGoals();
    goalsBridge.showToast(`Goal "${goal.name}" updated!`, 'success');
  }

  // Delete Goal with 5s Undo Window (Amendment 2)
  function deleteGoal(goalId) {
    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    const deposits = (state.goal_deposits || []).filter(d => d.goal_id === goalId);

    // Snapshot for undo window
    pendingDeletedGoal = {
      goal: { ...goal },
      deposits: deposits.map(d => ({ ...d })),
      goalId,
      timestamp: Date.now(),
      timer: null
    };

    // 0ms Optimistic local removal
    state.goals = state.goals.filter(g => g.id !== goalId);
    state.goal_deposits = (state.goal_deposits || []).filter(d => d.goal_id !== goalId);

    goalsBridge.saveData();
    renderGoals();

    // Enqueue DELETE mutations: child deposits first, then parent goal
    deposits.forEach(d => {
      goalsBridge.enqueueMutation('goal_deposits', 'DELETE', { id: d.id });
    });
    goalsBridge.enqueueMutation('goals', 'DELETE', { id: goalId });

    // Show Undo Toast with action button
    showUndoToast(`Goal "${goal.name}" deleted.`, () => {
      restoreDeletedGoal();
    });

    // 5-second undo window closure
    pendingDeletedGoal.timer = setTimeout(() => {
      pendingDeletedGoal = null;
    }, 5000);
  }

  // Restore Deleted Goal (Amendment 2: handles both pre-sync queue splice and post-sync re-upsert)
  function restoreDeletedGoal() {
    if (!pendingDeletedGoal) return;
    if (pendingDeletedGoal.timer) clearTimeout(pendingDeletedGoal.timer);

    const { goal, deposits, goalId } = pendingDeletedGoal;
    const state = goalsBridge.getState();
    if (!state) return;

    let queue = goalsBridge.getSyncQueue();
    const depIds = new Set(deposits.map(d => d.id));
    const hasGoalDelete = queue.some(m => m.table === 'goals' && m.action === 'DELETE' && m.data?.id === goalId);
    const hasDepDeletes = queue.some(m => m.table === 'goal_deposits' && m.action === 'DELETE' && depIds.has(m.data?.id));

    if (hasGoalDelete || hasDepDeletes) {
      // DELETEs have not synced yet: splice them out from queue
      queue = queue.filter(m => {
        if (m.table === 'goals' && m.action === 'DELETE' && m.data?.id === goalId) return false;
        if (m.table === 'goal_deposits' && m.action === 'DELETE' && depIds.has(m.data?.id)) return false;
        return true;
      });
      goalsBridge.saveSyncQueue(queue);
      console.info('🛡️ [Goal Undo] Spliced DELETE mutations before remote sync for goal:', goalId);
    } else {
      // DELETE already sent to Supabase: re-upsert goal and all its deposits
      goalsBridge.enqueueMutation('goals', 'UPSERT', goal);
      deposits.forEach(d => goalsBridge.enqueueMutation('goal_deposits', 'UPSERT', d));
      console.info('🛡️ [Goal Undo] Re-upserted goal and deposits after sync already processed');
    }

    if (!Array.isArray(state.goals)) state.goals = [];
    if (!Array.isArray(state.goal_deposits)) state.goal_deposits = [];

    state.goals.unshift(goal);
    if (deposits.length > 0) {
      state.goal_deposits.push(...deposits);
    }

    goalsBridge.saveData();
    renderGoals();
    goalsBridge.showToast(`Restored goal "${goal.name}"`, 'success');
    pendingDeletedGoal = null;
  }

  // Add Deposit / Contribution or Withdrawal (Amendment 3)
  function addGoalDeposit(goalId, amount, date, note, isWithdrawal, recordAsExpense) {
    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    let parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) {
      goalsBridge.showToast('Please enter an amount greater than zero', 'warning');
      return;
    }

    const currentSaved = getGoalCurrentAmount(goalId);

    if (isWithdrawal) {
      if (parsedAmount > currentSaved) {
        goalsBridge.showToast(`Cannot withdraw more than current saved balance (${goalsBridge.formatCurrency(currentSaved, true)})`, 'error');
        return;
      }
      parsedAmount = -Math.abs(parsedAmount);
    } else {
      parsedAmount = Math.abs(parsedAmount);
    }

    const depId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId();
    const uid = goalsBridge.getCurrentUser()?.id || goalsBridge.getUserId();
    const nowIso = new Date().toISOString();
    const depDate = date || nowIso.split('T')[0];

    const dep = {
      id: depId,
      goal_id: goalId,
      user_id: uid,
      amount: parsedAmount,
      deposit_date: depDate,
      note: (note || '').trim(),
      created_at: nowIso,
      updated_at: nowIso
    };

    if (!Array.isArray(state.goal_deposits)) state.goal_deposits = [];
    state.goal_deposits.push(dep);
    goalsBridge.enqueueMutation('goal_deposits', 'UPSERT', dep);

    // Optional: Log as expense in ledger
    if (recordAsExpense && !isWithdrawal) {
      const expId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId();
      const exp = {
        id: expId,
        user_id: uid,
        name: `Savings: ${goal.name}`,
        amount: Math.abs(parsedAmount),
        category: 'savings',
        date: depDate,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      if (Array.isArray(state.expenses)) {
        state.expenses.unshift(exp);
      }
      goalsBridge.enqueueMutation('expenses', 'UPSERT', exp);
      goalsBridge.updateSummary();
      goalsBridge.renderExpenses();
      goalsBridge.renderAllExpenses();
    }

    goalsBridge.saveData();
    renderGoals();

    const newSaved = getGoalCurrentAmount(goalId);

    // Celebration on hitting 100%
    if (!isWithdrawal && newSaved >= goal.target_amount && currentSaved < goal.target_amount) {
      fireConfetti();
      goalsBridge.showToast(`🎉 Congratulations! You reached your goal for "${goal.name}"!`, 'success');
    } else {
      const label = isWithdrawal ? 'Withdrew' : 'Added';
      goalsBridge.showToast(`${label} ${goalsBridge.formatCurrency(Math.abs(parsedAmount), true)} for "${goal.name}"`, 'success');
    }
  }

  // Lightweight 60fps Canvas Confetti Particle Engine (Zero Dependencies)
  function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const colors = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#f43f5e', '#ffffff'];
    const particles = [];
    const count = 130;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.35 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.7) * 20 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.005,
        gravity: 0.38
      });
    }

    let startTime = Date.now();

    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        if (p.opacity > 0 && p.y < canvas.height + 50) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size * 0.6);
          ctx.restore;
        }
      });

      if (aliveCount > 0 && Date.now() - startTime < 4000) {
        confettiAnimId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        confettiAnimId = null;
      }
    }

    confettiAnimId = requestAnimationFrame(renderConfetti);
  }

  // Custom Undo Toast Helper
  function showUndoToast(message, onUndo) {
    const container = document.getElementById('toast-container');
    if (!container) {
      goalsBridge.showToast(message, 'info');
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';
    toast.style.gap = '14px';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = 'Undo (5s)';
    undoBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    undoBtn.style.border = '1px solid rgba(255, 255, 255, 0.4)';
    undoBtn.style.color = '#ffffff';
    undoBtn.style.fontWeight = '700';
    undoBtn.style.padding = '4px 10px';
    undoBtn.style.borderRadius = '6px';
    undoBtn.style.cursor = 'pointer';
    undoBtn.style.fontSize = '0.8rem';

    undoBtn.onclick = () => {
      onUndo();
      toast.remove();
    };

    toast.appendChild(textSpan);
    toast.appendChild(undoBtn);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 5000);
  }

  // Modal Open/Close Helpers
  function openGoalModal(goalId = null) {
    const modal = document.getElementById('goal-modal');
    if (!modal) return;

    const state = goalsBridge.getState();
    const titleEl = document.getElementById('goal-modal-title');
    const form = document.getElementById('goal-form');
    if (form) form.reset();

    const idInput = document.getElementById('goal-edit-id');
    const initGroup = document.getElementById('goal-current-amount-group');

    if (goalId && state && Array.isArray(state.goals)) {
      const goal = state.goals.find(g => g.id === goalId);
      if (!goal) return;

      if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen" style="color: var(--color-primary);"></i> <span>Edit Savings Goal</span>';
      if (idInput) idInput.value = goal.id;
      if (initGroup) initGroup.style.display = 'none';

      const nameInput = document.getElementById('goal-name-input');
      const targetInput = document.getElementById('goal-target-input');
      const dateInput = document.getElementById('goal-date-input');
      const notesInput = document.getElementById('goal-notes-input');

      if (nameInput) nameInput.value = goal.name;
      if (targetInput) targetInput.value = goal.target_amount;
      if (dateInput) dateInput.value = goal.target_date || '';
      if (notesInput) notesInput.value = goal.notes || '';

      const catSelect = document.getElementById('goal-category-select');
      if (catSelect) {
        catSelect.value = `${goal.category}|${goal.icon}`;
      }

      selectedGoalColor = goal.color || '#10b981';
      document.querySelectorAll('#goal-color-palette .color-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === selectedGoalColor);
      });
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="fas fa-bullseye" style="color: var(--color-success);"></i> <span>Create Savings Goal</span>';
      if (idInput) idInput.value = '';
      if (initGroup) initGroup.style.display = 'block';

      selectedGoalColor = '#10b981';
      document.querySelectorAll('#goal-color-palette .color-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === '#10b981');
      });
    }

    modal.style.display = 'flex';
  }

  function closeGoalModal() {
    window.__ledgio_pendingLeftoverGoalDeposit = null;
    const modal = document.getElementById('goal-modal');
    if (modal) modal.style.display = 'none';
  }

  function openGoalModalWithLeftover(amount) {
    window.__ledgio_pendingLeftoverGoalDeposit = amount;
    openGoalModal();
    const initInput = document.getElementById('goal-current-input');
    if (initInput) {
      initInput.value = amount;
    }
  }

  function openDepositModal(goalId) {
    const modal = document.getElementById('goal-deposit-modal');
    if (!modal) return;

    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;

    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    const progress = getGoalProgress(goal);

    const idInput = document.getElementById('deposit-goal-id');
    const nameEl = document.getElementById('deposit-goal-name');
    const savedEl = document.getElementById('deposit-goal-saved-val');
    const targetEl = document.getElementById('deposit-goal-target-val');

    if (idInput) idInput.value = goal.id;
    if (nameEl) nameEl.textContent = goal.name;
    if (savedEl) savedEl.textContent = goalsBridge.formatCurrency(progress.current, true);
    if (targetEl) targetEl.textContent = goalsBridge.formatCurrency(progress.target, true);

    const badge = document.getElementById('deposit-goal-current-badge');
    if (badge) {
      badge.textContent = `${progress.percent}%`;
    }

    // Reset inputs
    const amtInput = document.getElementById('deposit-amount-input');
    const dtInput = document.getElementById('deposit-date-input');
    const ntInput = document.getElementById('deposit-note-input');
    const expCheck = document.getElementById('deposit-record-expense-checkbox');

    if (amtInput) amtInput.value = '';
    if (dtInput) dtInput.value = new Date().toISOString().split('T')[0];
    if (ntInput) ntInput.value = '';
    if (expCheck) expCheck.checked = false;

    // Reset Mode to Deposit
    setDepositModalMode('deposit');
    updateDepositPreview();

    // Render Recent Deposit History Activity
    const historyList = document.getElementById('goal-deposit-history-list');
    const historyCount = document.getElementById('goal-deposit-history-count');
    const deposits = (state.goal_deposits || [])
      .filter(d => d.goal_id === goal.id)
      .sort((a, b) => new Date(b.created_at || b.deposit_date) - new Date(a.created_at || a.deposit_date));

    if (historyCount) {
      historyCount.textContent = `${deposits.length} transaction${deposits.length === 1 ? '' : 's'}`;
    }

    if (historyList) {
      if (deposits.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); font-size: 0.78rem; padding: 6px 0;">No transactions recorded yet</div>';
      } else {
        historyList.innerHTML = deposits.map(d => {
          const amt = parseFloat(d.amount) || 0;
          const isNeg = amt < 0;
          const amtStr = (isNeg ? '-' : '+') + goalsBridge.formatCurrency(Math.abs(amt), true);
          const amtColor = isNeg ? 'var(--color-danger)' : 'var(--color-success)';
          const dDate = d.deposit_date ? new Date(d.deposit_date).toLocaleDateString() : '';
          const noteStr = d.note ? ` — ${goalsBridge.escapeHtml(d.note)}` : '';
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: var(--color-bg-light); border-radius: 6px; border: 1px solid var(--color-border);">
              <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
                <span style="font-weight: 600; color: var(--color-text);">${dDate}</span>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">${noteStr}</span>
              </div>
              <strong style="color: ${amtColor}; font-weight: 700; font-size: 0.82rem;">${amtStr}</strong>
            </div>
          `;
        }).join('');
      }
    }

    modal.style.display = 'flex';
  }

  function closeDepositModal() {
    const modal = document.getElementById('goal-deposit-modal');
    if (modal) modal.style.display = 'none';
  }

  function setDepositModalMode(mode) {
    currentDepositMode = mode;
    const isWithdraw = (mode === 'withdraw');

    const withInput = document.getElementById('deposit-is-withdrawal');
    if (withInput) withInput.value = isWithdraw ? 'true' : 'false';

    const depTab = document.getElementById('deposit-mode-deposit');
    const withTab = document.getElementById('deposit-mode-withdraw');
    if (depTab && withTab) {
      depTab.classList.toggle('active', !isWithdraw);
      withTab.classList.toggle('active', isWithdraw);
    }

    const labelEl = document.getElementById('deposit-amount-label');
    const submitBtn = document.getElementById('submit-goal-deposit-btn');
    const expenseCheckboxGroup = document.getElementById('deposit-record-expense-checkbox')?.parentElement;

    if (isWithdraw) {
      if (labelEl) labelEl.textContent = 'Withdrawal Amount *';
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-minus-circle"></i> <span>Confirm Withdrawal</span>';
        submitBtn.className = 'btn btn-danger';
      }
      if (expenseCheckboxGroup) expenseCheckboxGroup.style.display = 'none';
    } else {
      if (labelEl) labelEl.textContent = 'Deposit Amount *';
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> <span>Confirm Deposit</span>';
        submitBtn.className = 'btn btn-primary';
      }
      if (expenseCheckboxGroup) expenseCheckboxGroup.style.display = 'flex';
    }

    updateDepositPreview();
  }

  function updateDepositPreview() {
    const goalId = document.getElementById('deposit-goal-id')?.value;
    const amountVal = parseFloat(document.getElementById('deposit-amount-input')?.value) || 0;
    const previewBox = document.getElementById('deposit-calc-preview');
    const previewVal = document.getElementById('deposit-preview-val');

    if (!goalId || amountVal <= 0) {
      if (previewBox) previewBox.style.display = 'none';
      return;
    }

    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    const current = getGoalCurrentAmount(goalId);
    const isWithdraw = (currentDepositMode === 'withdraw');
    const resulting = isWithdraw ? Math.max(0, current - amountVal) : (current + amountVal);
    const target = parseFloat(goal.target_amount) || 1;
    const resultingPct = Math.min(100, Math.round((resulting / target) * 100));

    if (previewVal) {
      previewVal.textContent = `${goalsBridge.formatCurrency(resulting, true)} (${resultingPct}%)`;
      previewVal.style.color = isWithdraw ? 'var(--color-danger)' : 'var(--color-success)';
    }
    if (previewBox) previewBox.style.display = 'flex';
  }

  function openDeleteGoalModal(goalId) {
    const state = goalsBridge.getState();
    if (!state || !Array.isArray(state.goals)) return;
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;

    goalIdToDelete = goalId;
    const modal = document.getElementById('goal-delete-modal');
    const desc = document.getElementById('goal-delete-modal-desc');

    if (desc) {
      const currentSaved = getGoalCurrentAmount(goalId);
      const deposits = (state.goal_deposits || []).filter(d => d.goal_id === goalId);
      const childCount = deposits.length;
      const countMsg = childCount > 0
        ? ` This will also remove ${childCount} deposit${childCount === 1 ? '' : 's'} from your backup.`
        : '';
      desc.textContent = `Are you sure you want to delete "${goal.name}"? Target: ${goalsBridge.formatCurrency(goal.target_amount, true)}, Saved: ${goalsBridge.formatCurrency(currentSaved, true)}. All deposits and progress will be removed (an undo option is available for 5 seconds).${countMsg}`;
    }

    if (modal) modal.style.display = 'flex';
  }

  function closeDeleteGoalModal() {
    goalIdToDelete = null;
    const modal = document.getElementById('goal-delete-modal');
    if (modal) modal.style.display = 'none';
  }

  // Setup Savings Goals Event Listeners
  function setupGoalsEventListeners() {
    // Expose goal modal controllers globally for tests
    const isDev = Boolean(goalsBridge.isDevOrTest || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')));
    if (isDev) {
      window.__ledgio_openGoalModal = (id) => openGoalModal(id);
      window.__ledgio_openDepositModal = (id) => openDepositModal(id);
      window.__ledgio_openDeleteGoalModal = (id) => openDeleteGoalModal(id);
      window.__ledgio_deleteGoal = (id) => deleteGoal(id);
      window.__ledgio_restoreDeletedGoal = () => restoreDeletedGoal();
      window.__ledgio_openGoalModalWithLeftover = (amt) => openGoalModalWithLeftover(amt);
    }

    // Create Goal Button in Header Toolbar
    document.getElementById('open-create-goal-btn')?.addEventListener('click', () => {
      openGoalModal();
    });

    // Create First Goal Button in Empty State (if present)
    document.getElementById('create-first-goal-btn')?.addEventListener('click', () => {
      openGoalModal();
    });

    // Close Modals Buttons
    document.getElementById('close-goal-modal-btn')?.addEventListener('click', closeGoalModal);
    document.getElementById('cancel-goal-btn')?.addEventListener('click', closeGoalModal);
    document.getElementById('close-goal-deposit-btn')?.addEventListener('click', closeDepositModal);
    document.getElementById('cancel-deposit-btn')?.addEventListener('click', closeDepositModal);
    document.getElementById('cancel-delete-goal-btn')?.addEventListener('click', closeDeleteGoalModal);

    // Backdrop Click Dismissal
    ['goal-modal', 'goal-deposit-modal', 'goal-delete-modal', 'leftover-goal-picker-modal'].forEach(id => {
      const modalEl = document.getElementById(id);
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            modalEl.style.display = 'none';
            if (id === 'goal-modal') window.__ledgio_pendingLeftoverGoalDeposit = null;
          }
        });
      }
    });

    // Color Swatches Picker
    document.querySelectorAll('#goal-color-palette .color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#goal-color-palette .color-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedGoalColor = btn.dataset.color || '#10b981';
      });
    });

    // Save Goal Form Submit
    document.getElementById('goal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const goalId = document.getElementById('goal-edit-id')?.value;
      const name = document.getElementById('goal-name-input')?.value;
      const targetAmount = parseFloat(document.getElementById('goal-target-input')?.value);
      const targetDate = document.getElementById('goal-date-input')?.value;
      const catVal = document.getElementById('goal-category-select')?.value || 'general|fa-bullseye';
      const [category, icon] = catVal.split('|');
      const notes = document.getElementById('goal-notes-input')?.value;
      const initialDeposit = parseFloat(document.getElementById('goal-current-input')?.value) || 0;

      if (!name || isNaN(targetAmount) || targetAmount <= 0) {
        goalsBridge.showToast('Please enter a valid goal name and target amount', 'warning');
        return;
      }

      if (goalId) {
        updateGoal(goalId, {
          name,
          targetAmount,
          targetDate,
          category,
          color: selectedGoalColor,
          icon,
          notes
        });
      } else {
        createGoal({
          name,
          targetAmount,
          targetDate,
          category,
          color: selectedGoalColor,
          icon,
          notes,
          initialDeposit
        });
        if (window.__ledgio_pendingLeftoverGoalDeposit && initialDeposit > 0) {
          const expId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateId();
          const nowIso = new Date().toISOString();
          const exp = {
            id: expId,
            user_id: goalsBridge.getCurrentUser()?.id || goalsBridge.getUserId(),
            name: `Savings: ${name.trim()}`,
            amount: initialDeposit,
            category: 'savings',
            date: nowIso.split('T')[0],
            createdAt: nowIso,
            updatedAt: nowIso
          };
          const state = goalsBridge.getState();
          if (state && Array.isArray(state.expenses)) {
            state.expenses.unshift(exp);
          }
          goalsBridge.enqueueMutation('expenses', 'UPSERT', exp);
          goalsBridge.updateSummary();
          goalsBridge.renderExpenses();
          goalsBridge.renderAllExpenses();
          window.__ledgio_pendingLeftoverGoalDeposit = null;
        }
      }

      closeGoalModal();
    });

    // Deposit Mode Toggle (Deposit vs Withdraw)
    document.getElementById('deposit-mode-deposit')?.addEventListener('click', () => {
      setDepositModalMode('deposit');
    });

    document.getElementById('deposit-mode-withdraw')?.addEventListener('click', () => {
      setDepositModalMode('withdraw');
    });

    // Quick Increment Chips in Deposit Modal
    document.querySelectorAll('.deposit-chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseFloat(chip.dataset.val) || 0;
        const input = document.getElementById('deposit-amount-input');
        if (input) {
          const cur = parseFloat(input.value) || 0;
          input.value = cur + val;
          updateDepositPreview();
        }
      });
    });

    // Live Deposit Amount Change Preview
    document.getElementById('deposit-amount-input')?.addEventListener('input', () => {
      updateDepositPreview();
    });

    // Deposit Form Submit
    document.getElementById('goal-deposit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const goalId = document.getElementById('deposit-goal-id')?.value;
      const amount = parseFloat(document.getElementById('deposit-amount-input')?.value) || 0;
      const date = document.getElementById('deposit-date-input')?.value;
      const note = document.getElementById('deposit-note-input')?.value;
      const isWithdrawal = (currentDepositMode === 'withdraw');
      const recordExpense = document.getElementById('deposit-record-expense-checkbox')?.checked;

      if (amount <= 0) {
        goalsBridge.showToast('Please enter an amount greater than zero', 'warning');
        return;
      }

      addGoalDeposit(goalId, amount, date, note, isWithdrawal, recordExpense);
      closeDepositModal();
    });

    // Confirm Delete Goal
    document.getElementById('confirm-delete-goal-btn')?.addEventListener('click', () => {
      if (goalIdToDelete) {
        deleteGoal(goalIdToDelete);
        closeDeleteGoalModal();
      }
    });

    // Filter Pills Switching (Direct & Delegated)
    document.querySelectorAll('.goals-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.goals-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGoalsFilter = btn.dataset.filter || 'all';
        renderGoals();
      });
    });

    const filterGroup = document.querySelector('.goals-filter-group');
    if (filterGroup) {
      filterGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.goals-filter-btn');
        if (!btn) return;
        document.querySelectorAll('.goals-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGoalsFilter = btn.dataset.filter || 'all';
        renderGoals();
      });
    }

    // Delegated Goal Grid Actions (Create, Deposit, History, Edit, Delete)
    document.getElementById('goals-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const goalId = btn.dataset.id;

      if (action === 'create') {
        openGoalModal();
      } else if (action === 'deposit') {
        openDepositModal(goalId);
      } else if (action === 'history') {
        openDepositModal(goalId);
      } else if (action === 'edit') {
        openGoalModal(goalId);
      } else if (action === 'delete') {
        openDeleteGoalModal(goalId);
      }
    });
  }

  // Public domain namespace
  const LedgioGoals = {
    configure,
    getGoalCurrentAmount,
    getGoalProgress,
    renderGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    restoreDeletedGoal,
    addGoalDeposit,
    fireConfetti,
    showUndoToast,
    openGoalModal,
    closeGoalModal,
    openDepositModal,
    closeDepositModal,
    openDeleteGoalModal,
    closeDeleteGoalModal,
    openGoalModalWithLeftover,
    setDepositModalMode,
    updateDepositPreview,
    setupGoalsEventListeners,
    sanitizeColor,
    sanitizeIcon,
    getActiveGoalsFilter: () => activeGoalsFilter,
    setActiveGoalsFilter: (f) => { activeGoalsFilter = f; renderGoals(); }
  };

  // Expose namespace & global backwards compatibility
  window.LedgioGoals = LedgioGoals;
  window.getGoalCurrentAmount = getGoalCurrentAmount;
  window.getGoalProgress = getGoalProgress;
  window.renderGoals = renderGoals;
  window.createGoal = createGoal;
  window.updateGoal = updateGoal;
  window.deleteGoal = deleteGoal;
  window.restoreDeletedGoal = restoreDeletedGoal;
  window.addGoalDeposit = addGoalDeposit;
  window.openGoalModal = openGoalModal;
  window.closeGoalModal = closeGoalModal;
  window.openDepositModal = openDepositModal;
  window.closeDepositModal = closeDepositModal;
  window.openDeleteGoalModal = openDeleteGoalModal;
  window.closeDeleteGoalModal = closeDeleteGoalModal;
  window.openGoalModalWithLeftover = openGoalModalWithLeftover;
  window.fireConfetti = fireConfetti;
  window.showUndoToast = showUndoToast;

})();
