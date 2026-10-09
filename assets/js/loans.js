'use strict';

/**
 * Ledgio — Loans & Debts Domain Module
 * 
 * Provides:
 * - Full CRUD for loans and debt settlements
 * - Loan balance details computation (principal, settled, outstanding, percent, isSettled)
 * - Double-entry ledger integration (opening adjustment, settlement cash-flows, on_behalf expense mapping)
 * - Preserved Loan Audit Guarantees:
 *   - Zero cash-flow on cash write-offs
 *   - Opening adjustment sync on edit
 *   - Opening adjustment reversal on unsettled delete + undo restore
 *   - Principal >= settled validation
 *   - 2-decimal principal rounding
 *   - Integer-cents overpayment guard
 * - Stealth mode masking in loan views and modals
 * - UI rendering for loans container and modals
 */

(function() {
  let activeLoansFilter = 'all';
  let pendingDeletedLoan = null;
  let pendingDeleteLoanId = null;

  // Host bridge for state access, accounting callbacks, and UI hooks
  let loansBridge = {
    getState: () => (window.__ledgio_getState ? window.__ledgio_getState() : window.state || null),
    getCurrentUser: () => (window.__ledgio_getCurrentUserForTesting ? window.__ledgio_getCurrentUserForTesting() : window.currentUser || null),
    getUserId: () => (typeof window.getUserId === 'function' ? window.getUserId() : (localStorage.getItem('sb_user_id') || 'default_user')),
    isStealthModeActive: () => (typeof window.isStealthModeActive === 'boolean' ? window.isStealthModeActive : false),
    formatCurrency: (val, bypass) => (typeof window.formatCurrency === 'function' ? window.formatCurrency(val, bypass) : ('₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))),
    escapeHtml: (str) => (typeof window.escapeHtml === 'function' ? window.escapeHtml(str) : String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m])),
    getLocalDateString: (d) => (typeof window.getLocalDateString === 'function' ? window.getLocalDateString(d) : new Date().toISOString().split('T')[0]),
    showToast: (msg, type) => (typeof window.showToast === 'function' ? window.showToast(msg, type) : console.log(`[Toast ${type}] ${msg}`)),
    showUndoToast: (msg, onUndo) => (typeof window.showUndoToast === 'function' ? window.showUndoToast(msg, onUndo) : (console.log(msg), setTimeout(onUndo, 5000))),
    fireConfetti: () => (typeof window.fireConfetti === 'function' ? window.fireConfetti() : null),
    saveData: () => (typeof window.saveData === 'function' ? window.saveData() : null),
    saveIncomeEntries: () => (typeof window.saveIncomeEntries === 'function' ? window.saveIncomeEntries() : null),
    enqueueMutation: (t, a, d) => (window.LedgioSyncEngine ? window.LedgioSyncEngine.enqueueMutation(t, a, d) : (typeof window.enqueueMutation === 'function' ? window.enqueueMutation(t, a, d) : null)),
    getSyncQueue: () => (window.LedgioSyncEngine ? window.LedgioSyncEngine.getSyncQueue() : (typeof window.getSyncQueue === 'function' ? window.getSyncQueue() : [])),
    saveSyncQueue: (q) => (window.LedgioSyncEngine ? window.LedgioSyncEngine.saveSyncQueue(q) : (typeof window.saveSyncQueue === 'function' ? window.saveSyncQueue(q) : null)),
    updateSummary: () => (typeof window.updateSummary === 'function' ? window.updateSummary() : null),
    updateNetWorthUI: () => (typeof window.updateNetWorthUI === 'function' ? window.updateNetWorthUI() : null),
    isDevOrTest: false
  };

  function configure(customConfig = {}) {
    loansBridge = { ...loansBridge, ...customConfig };
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function isStealthActive() {
    if (typeof loansBridge.isStealthModeActive === 'function') {
      return Boolean(loansBridge.isStealthModeActive());
    }
    return Boolean(window.isStealthModeActive);
  }

  function escapeHtml(str) {
    return loansBridge.escapeHtml(str);
  }

  function formatCurrency(val, bypass = false) {
    return loansBridge.formatCurrency(val, bypass);
  }

  function isLoanAdjustment(entry) {
    if (!entry) return false;
    if (entry.loan_id || entry.settlement_id) return true;
    const n = (entry.note || '').trim();
    return n.startsWith('Lent to ') || n.startsWith('Borrowed from ') || n.startsWith('Repaid by ') || n.startsWith('Repaid to ');
  }

  // Computed Settled Amount (Client-Side SUM of Settlements)
  function getLoanSettledAmount(loanId) {
    const state = loansBridge.getState();
    if (!state?.loan_settlements || !Array.isArray(state.loan_settlements)) return 0;
    return state.loan_settlements
      .filter(s => s.loan_id === loanId)
      .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }

  // Loan Balance Details Computation
  function getLoanDetails(loan) {
    if (!loan) return { principal: 0, settled: 0, outstanding: 0, percent: 0, isSettled: true };
    const principal = parseFloat(loan.principal) || 0;
    const settled = getLoanSettledAmount(loan.id);
    const outstanding = Math.max(0, principal - settled);
    const percent = principal > 0 ? Math.min(100, Math.round((settled / principal) * 100)) : 0;
    const isSettled = outstanding <= 0.0001;
    return { principal, settled, outstanding, percent, isSettled };
  }

  // Update People Datalist for autocomplete
  function updatePeopleDatalist() {
    const datalist = document.getElementById('loan-people-datalist');
    if (!datalist) return;
    const state = loansBridge.getState();
    const names = Array.from(new Set(
      (state?.loans || [])
        .map(l => (l.person_name || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    datalist.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
  }

  // Render Loans & Debts Section
  function renderLoans() {
    const container = document.getElementById('loans-container');
    if (!container) return;

    const state = loansBridge.getState();
    if (!state) return;

    if (!Array.isArray(state.loans)) state.loans = [];
    if (!Array.isArray(state.loan_settlements)) state.loan_settlements = [];

    updatePeopleDatalist();

    const stealth = isStealthActive();

    // 1. Calculate overview metrics
    let totalToReceive = 0;
    let totalToPay = 0;
    const activePeopleSet = new Set();

    state.loans.forEach(loan => {
      const details = getLoanDetails(loan);
      if (loan.direction === 'lent') {
        totalToReceive += details.outstanding;
      } else if (loan.direction === 'borrowed') {
        totalToPay += details.outstanding;
      }
      if (!details.isSettled) {
        activePeopleSet.add((loan.person_name || '').trim().toLowerCase());
      }
    });

    const netPosition = totalToReceive - totalToPay;
    const activeCount = activePeopleSet.size;

    // 2. Update summary cards with stealth support
    const toReceiveEl = document.getElementById('loans-to-receive');
    const toPayEl = document.getElementById('loans-to-pay');
    const netPosEl = document.getElementById('loans-net-position');
    const activeCountEl = document.getElementById('loans-active-count');

    if (toReceiveEl) {
      toReceiveEl.textContent = formatCurrency(totalToReceive);
      if (stealth) toReceiveEl.classList.add('stealth-masked');
      else toReceiveEl.classList.remove('stealth-masked');
    }

    if (toPayEl) {
      toPayEl.textContent = formatCurrency(totalToPay);
      if (stealth) toPayEl.classList.add('stealth-masked');
      else toPayEl.classList.remove('stealth-masked');
    }

    if (netPosEl) {
      if (stealth) {
        netPosEl.textContent = '••••••';
        netPosEl.classList.add('stealth-masked');
        netPosEl.style.color = '';
      } else {
        netPosEl.classList.remove('stealth-masked');
        if (netPosition > 0) {
          netPosEl.textContent = '+' + formatCurrency(netPosition, true);
          netPosEl.style.color = 'var(--color-success)';
        } else if (netPosition < 0) {
          netPosEl.textContent = '-' + formatCurrency(Math.abs(netPosition), true);
          netPosEl.style.color = 'var(--color-danger)';
        } else {
          netPosEl.textContent = formatCurrency(0, true);
          netPosEl.style.color = 'var(--color-text)';
        }
      }
    }

    if (activeCountEl) {
      activeCountEl.textContent = `${activeCount} ${activeCount === 1 ? 'person' : 'people'}`;
    }

    loansBridge.updateNetWorthUI();

    // 3. Group loans by person (case-insensitive)
    const personMap = new Map();
    state.loans.forEach(loan => {
      const pName = (loan.person_name || 'Unnamed').trim();
      const key = pName.toLowerCase();
      if (!personMap.has(key)) {
        personMap.set(key, {
          name: pName,
          loans: []
        });
      }
      personMap.get(key).loans.push(loan);
    });

    // 4. Filter loans within each person group
    let renderedGroupCount = 0;
    let totalFilteredLoans = 0;
    const groupHtmls = [];

    personMap.forEach((group) => {
      // Sort loans by loan_date descending, then created_at descending
      group.loans.sort((a, b) => {
        const da = new Date(a.loan_date || a.created_at).getTime();
        const db = new Date(b.loan_date || b.created_at).getTime();
        return db - da;
      });

      // Calculate person's net position across all their loans
      let personLent = 0;
      let personBorrowed = 0;
      group.loans.forEach(l => {
        const d = getLoanDetails(l);
        if (l.direction === 'lent') personLent += d.outstanding;
        else if (l.direction === 'borrowed') personBorrowed += d.outstanding;
      });
      const personNet = personLent - personBorrowed;

      // Filter loans by activeLoansFilter
      const filteredLoans = group.loans.filter(l => {
        const d = getLoanDetails(l);
        if (activeLoansFilter === 'receive') return l.direction === 'lent' && !d.isSettled;
        if (activeLoansFilter === 'pay') return l.direction === 'borrowed' && !d.isSettled;
        if (activeLoansFilter === 'settled') return d.isSettled;
        return true;
      });

      if (filteredLoans.length === 0) return;

      renderedGroupCount++;
      totalFilteredLoans += filteredLoans.length;

      // Render net position badge
      let netBadgeHtml = '';
      if (personNet > 0) {
        const amtStr = stealth ? '••••••' : formatCurrency(personNet, true);
        netBadgeHtml = `<span class="net-position-badge lent ${stealth ? 'stealth-masked' : ''}"><i class="fas fa-arrow-down"></i> They owe you ${amtStr}</span>`;
      } else if (personNet < 0) {
        const amtStr = stealth ? '••••••' : formatCurrency(Math.abs(personNet), true);
        netBadgeHtml = `<span class="net-position-badge borrowed ${stealth ? 'stealth-masked' : ''}"><i class="fas fa-arrow-up"></i> You owe them ${amtStr}</span>`;
      } else {
        netBadgeHtml = `<span class="net-position-badge settled"><i class="fas fa-check"></i> All settled up</span>`;
      }

      const initial = (group.name.charAt(0) || '?').toUpperCase();

      const cardsHtml = filteredLoans.map(loan => {
        const details = getLoanDetails(loan);
        const isLent = loan.direction === 'lent';
        const dirClass = details.isSettled ? (isLent ? 'lent settled' : 'borrowed settled') : (isLent ? 'lent' : 'borrowed');
        const dirIcon = details.isSettled ? 'fa-check' : (isLent ? 'fa-arrow-down' : 'fa-arrow-up');
        const dirText = details.isSettled ? 'Settled' : (isLent ? 'They owe' : 'You owe');

        let dateStr = '';
        if (loan.loan_date) {
          const dObj = new Date(loan.loan_date + 'T00:00:00');
          dateStr = !isNaN(dObj.getTime()) ? dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : loan.loan_date;
        }

        const outstandingStr = formatCurrency(details.outstanding);
        const principalStr = formatCurrency(details.principal);
        const pctStr = stealth ? '••%' : `${details.percent}% settled`;
        const fillBg = details.isSettled ? '#10b981' : (isLent ? '#10b981' : '#f43f5e');
        const isCash = !loan.kind || loan.kind === 'cash';
        const kindBadgeClass = isCash ? 'loan-kind-badge cash' : 'loan-kind-badge on-behalf';
        const kindIcon = isCash ? 'fa-coins' : 'fa-receipt';
        const kindText = isCash ? 'Cash loan' : 'Paid for me';
        const kindBadgeHtml = `<span class="${kindBadgeClass}"><i class="fas ${kindIcon}"></i> ${escapeHtml(kindText)}</span>`;

        return `
          <article class="loan-card" data-id="${escapeHtml(loan.id)}">
            <div class="loan-card-top">
              <div class="loan-card-top-meta">
                <span class="direction-badge ${dirClass}">
                  <i class="fas ${dirIcon}"></i> <span>${escapeHtml(dirText)}</span>
                </span>
                ${kindBadgeHtml}
                ${dateStr ? `<span class="loan-date-badge"><i class="fas fa-calendar"></i> ${escapeHtml(dateStr)}</span>` : ''}
              </div>
              <div class="loan-card-top-actions">
                <button type="button" class="goal-card-menu-btn" data-action="loan-history" data-id="${escapeHtml(loan.id)}" title="Settlement History" aria-label="Settlement History">
                  <i class="fas fa-clock-rotate-left"></i>
                </button>
                <button type="button" class="goal-card-menu-btn" data-action="loan-edit" data-id="${escapeHtml(loan.id)}" title="Edit Loan" aria-label="Edit Loan">
                  <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="goal-card-menu-btn" data-action="loan-delete" data-id="${escapeHtml(loan.id)}" title="Delete Loan" aria-label="Delete Loan" style="color: var(--color-danger);">
                  <i class="fas fa-trash-can"></i>
                </button>
              </div>
            </div>

            ${loan.notes && loan.notes.trim() ? `<p class="loan-notes-text" title="${escapeHtml(loan.notes)}">${escapeHtml(loan.notes)}</p>` : ''}

            <div class="loan-amount-row">
              <div class="loan-outstanding-val ${stealth ? 'stealth-masked' : ''}">${outstandingStr}</div>
              <div class="loan-principal-val">Principal: <span class="${stealth ? 'stealth-masked' : ''}">${principalStr}</span></div>
            </div>

            <div class="loan-progress-track">
              <div class="loan-progress-fill" style="width: ${details.percent}%; background: ${fillBg};"></div>
            </div>

            <div class="loan-stats-row">
              <span class="loan-percent-badge">${pctStr}</span>
              <span class="${details.isSettled ? 'loan-settled-text' : ''}" style="font-size: 0.8rem; ${details.isSettled ? '' : 'color: var(--color-text-muted);'}">
                ${details.isSettled ? '🎉 Fully settled' : (stealth ? '••••••' : `${formatCurrency(details.outstanding)} remaining`)}
              </span>
            </div>

            <div class="loan-card-footer">
              ${!details.isSettled ? `
                <button type="button" class="btn btn-primary loan-settle-btn" data-action="loan-settle" data-id="${escapeHtml(loan.id)}">
                  <i class="fas fa-handshake"></i> <span>Settle Up</span>
                </button>
              ` : `
                <button type="button" class="btn btn-outline loan-settle-btn" data-action="loan-history" data-id="${escapeHtml(loan.id)}">
                  <i class="fas fa-clock-rotate-left"></i> <span>View History</span>
                </button>
              `}
            </div>
          </article>
        `;
      }).join('');

      groupHtmls.push(`
        <div class="loans-person-group" data-person="${escapeHtml(group.name)}">
          <div class="person-group-header">
            <div class="person-group-left">
              <div class="person-avatar">${escapeHtml(initial)}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="person-name-title">${escapeHtml(group.name)}</h3>
                <button type="button" class="person-rename-btn" data-action="rename-person" data-person="${escapeHtml(group.name)}" title="Rename ${escapeHtml(group.name)}">
                  <i class="fas fa-user-pen"></i>
                </button>
              </div>
            </div>
            <div class="person-group-net">
              ${netBadgeHtml}
              <button type="button" class="btn btn-outline" data-action="add-person-loan" data-person="${escapeHtml(group.name)}" style="padding: 4px 10px; font-size: 0.775rem; border-radius: 8px; font-weight: 600;">
                <i class="fas fa-plus"></i> <span>Add</span>
              </button>
            </div>
          </div>
          <div class="person-loans-grid">
            ${cardsHtml}
          </div>
        </div>
      `);
    });

    // 5. If no cards rendered, display empty state
    if (totalFilteredLoans === 0) {
      const emptyDesc = state.loans.length === 0
        ? 'Track money lent to friends, family, or colleagues, and keep a clear record of debts you owe with settle-up history.'
        : `No loans match the "${activeLoansFilter}" filter.`;

      container.innerHTML = `
        <div class="loans-empty-state">
          <div class="loans-empty-icon">
            <i class="fas fa-hand-holding-dollar"></i>
          </div>
          <h3 style="margin: 0 0 8px 0; font-size: 1.25rem;">${state.loans.length === 0 ? 'No loans or debts yet' : 'No records found'}</h3>
          <p style="margin: 0 0 24px 0; color: var(--color-text-muted); font-size: 0.9rem; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.5;">${emptyDesc}</p>
          <button type="button" id="create-first-loan-btn" class="btn btn-primary" style="min-height: 46px; padding: 10px 22px; font-weight: 600;">
            <i class="fas fa-plus"></i> <span>Record Your First Loan</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = groupHtmls.join('');
  }

  // Modal Openers and CRUD Operations
  function openCreateLoanModal(loanId = null, prefillPerson = '') {
    const modal = document.getElementById('loan-modal');
    if (!modal) return;

    const form = document.getElementById('loan-form');
    if (form) form.reset();

    updatePeopleDatalist();

    const titleEl = document.getElementById('loan-modal-title');
    const idInput = document.getElementById('loan-edit-id');
    const dirInput = document.getElementById('loan-direction-input');
    const lentBtn = document.getElementById('loan-direction-lent');
    const borrowedBtn = document.getElementById('loan-direction-borrowed');
    const kindInput = document.getElementById('loan-kind-input');
    const kindGroup = document.getElementById('loan-kind-group');
    const kindCashRadio = document.getElementById('loan-kind-cash');
    const kindOnBehalfRadio = document.getElementById('loan-kind-on-behalf');
    const personInput = document.getElementById('loan-person-input');
    const principalInput = document.getElementById('loan-principal-input');
    const dateInput = document.getElementById('loan-date-input');
    const notesInput = document.getElementById('loan-notes-input');

    const state = loansBridge.getState();

    if (loanId) {
      const loan = (state?.loans || []).find(l => l.id === loanId);
      if (!loan) return;

      const lKind = loan.kind || 'cash';
      if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen" style="color: var(--color-primary);"></i> <span>Edit Loan Record</span>';
      if (idInput) idInput.value = loan.id;
      if (dirInput) dirInput.value = loan.direction;
      if (lentBtn) lentBtn.classList.toggle('active', loan.direction === 'lent');
      if (borrowedBtn) borrowedBtn.classList.toggle('active', loan.direction === 'borrowed');
      if (kindInput) kindInput.value = lKind;
      if (kindCashRadio) kindCashRadio.checked = (lKind === 'cash');
      if (kindOnBehalfRadio) kindOnBehalfRadio.checked = (lKind === 'on_behalf');
      if (kindGroup) kindGroup.style.display = (loan.direction === 'borrowed') ? 'block' : 'none';
      if (personInput) personInput.value = loan.person_name || '';
      if (principalInput) principalInput.value = loan.principal || '';
      if (dateInput) dateInput.value = loan.loan_date || '';
      if (notesInput) notesInput.value = loan.notes || '';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="fas fa-hand-holding-dollar" style="color: var(--color-primary);"></i> <span>Record Loan / Debt</span>';
      if (idInput) idInput.value = '';
      if (dirInput) dirInput.value = 'lent';
      if (lentBtn) lentBtn.classList.add('active');
      if (borrowedBtn) borrowedBtn.classList.remove('active');
      if (kindInput) kindInput.value = 'cash';
      if (kindCashRadio) kindCashRadio.checked = true;
      if (kindOnBehalfRadio) kindOnBehalfRadio.checked = false;
      if (kindGroup) kindGroup.style.display = 'none';
      if (personInput) personInput.value = prefillPerson || '';
      if (principalInput) principalInput.value = '';
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      if (notesInput) notesInput.value = '';
    }

    modal.style.display = 'flex';
  }

  function closeLoanModal() {
    const modal = document.getElementById('loan-modal');
    if (modal) modal.style.display = 'none';
  }

  function findOpeningLoanAdjustment(loan) {
    const state = loansBridge.getState();
    if (!loan || !Array.isArray(state?.income_entries)) return null;
    const loanId = typeof loan === 'object' ? loan.id : loan;
    const loanObj = typeof loan === 'object' ? loan : (state.loans || []).find(l => l.id === loanId);

    // 1. Direct match by loan_id (and not a settlement adjustment)
    if (loanId) {
      const direct = state.income_entries.find(e => e.loan_id === loanId && !e.settlement_id);
      if (direct) return direct;
    }

    // 2. Self-healing fallback: match unlinked opening adjustment by person name and type
    if (!loanObj) return null;
    const isLent = loanObj.direction === 'lent';
    const personName = (loanObj.person_name || '').trim();
    const expectedNote = isLent ? `Lent to ${personName}` : `Borrowed from ${personName}`;

    // Protect adjustments belonging to other known loans
    const otherLoanIds = new Set((state.loans || []).filter(l => l.id !== loanObj.id).map(l => l.id));
    const fallback = state.income_entries.find(e => {
      if (e.settlement_id) return false;
      if (e.type !== 'adjustment') return false;
      if (e.loan_id && otherLoanIds.has(e.loan_id)) return false;
      if (e.note === expectedNote) return true;
      if (personName && e.note && e.note.toLowerCase().includes(personName.toLowerCase())) return true;
      return false;
    });

    if (fallback && loanObj.id) {
      fallback.loan_id = loanObj.id; // heal link in memory
    }

    return fallback || null;
  }

  function createLoan(direction, personName, principal, loanDate, notes, kind = 'cash') {
    const rawP = parseFloat(principal);
    if (isNaN(rawP) || rawP <= 0) return null;
    const p = Math.round(rawP * 100) / 100;
    if (p <= 0) return null;
    const name = (personName || '').trim();
    if (!name) return null;

    const state = loansBridge.getState();
    if (!state) return null;

    const currentUser = loansBridge.getCurrentUser();
    const uid = currentUser?.id || loansBridge.getUserId();
    const nowIso = new Date().toISOString();
    const newId = generateId();
    const lDate = loanDate || loansBridge.getLocalDateString();
    const loanKind = (direction === 'borrowed' && kind === 'on_behalf') ? 'on_behalf' : 'cash';

    const loan = {
      id: newId,
      user_id: uid,
      person_name: name,
      direction: direction || 'lent',
      principal: p,
      loan_date: lDate,
      notes: notes ? String(notes).trim().slice(0, 200) : '',
      kind: loanKind,
      created_at: nowIso,
      updated_at: nowIso
    };

    if (!Array.isArray(state.loans)) state.loans = [];
    state.loans.unshift(loan);
    loansBridge.enqueueMutation('loans', 'UPSERT', loan);

    let adjEntry = null;
    // Double-entry accounting: auto-create balance adjustment entry for 'cash' loans
    // For 'on_behalf' loans: NO balance adjustment at creation (no cash ever entered)
    if (loanKind === 'cash') {
      const isLent = loan.direction === 'lent';
      const adjAmount = isLent ? -p : p;
      const adjNote = isLent ? `Lent to ${name}` : `Borrowed from ${name}`;
      adjEntry = {
        id: generateId(),
        user_id: loansBridge.getUserId(),
        amount: Math.round(adjAmount * 100) / 100,
        entry_date: lDate,
        type: 'adjustment',
        note: adjNote,
        loan_id: newId,
        created_at: nowIso,
        updated_at: nowIso
      };

      delete state._incomeOverride;
      if (!Array.isArray(state.income_entries)) state.income_entries = [];
      state.income_entries.push(adjEntry);
      loansBridge.saveIncomeEntries();
      loansBridge.enqueueMutation('income_entries', 'UPSERT', adjEntry);
    }

    loansBridge.saveData();
    renderLoans();
    loansBridge.updateSummary();

    return { loan, adjustment: adjEntry };
  }

  function saveLoan() {
    const id = document.getElementById('loan-edit-id')?.value;
    const direction = document.getElementById('loan-direction-input')?.value || 'lent';
    const personName = (document.getElementById('loan-person-input')?.value || '').trim();
    const rawPrincipal = parseFloat(document.getElementById('loan-principal-input')?.value);
    const loanDate = document.getElementById('loan-date-input')?.value;
    const notes = (document.getElementById('loan-notes-input')?.value || '').trim();
    const kind = document.getElementById('loan-kind-input')?.value ||
                 (document.querySelector('input[name="loan-kind"]:checked')?.value) ||
                 'cash';

    if (!personName) {
      loansBridge.showToast('Please enter the person\'s name', 'warning');
      return;
    }
    if (isNaN(rawPrincipal) || rawPrincipal <= 0) {
      loansBridge.showToast('Please enter a valid principal amount greater than 0', 'warning');
      return;
    }
    const principal = Math.round(rawPrincipal * 100) / 100;
    if (principal <= 0) {
      loansBridge.showToast('Please enter a valid principal amount greater than 0', 'warning');
      return;
    }
    if (!loanDate) {
      loansBridge.showToast('Please select a loan date', 'warning');
      return;
    }

    const state = loansBridge.getState();
    if (!state) return;

    const nowIso = new Date().toISOString();
    const currentUser = loansBridge.getCurrentUser();
    const uid = currentUser?.id || loansBridge.getUserId();

    if (id) {
      // Edit existing loan
      const loan = (state.loans || []).find(l => l.id === id);
      if (!loan) return;

      // LOAN-AUDIT-04: Block principal below already-settled amount
      const details = getLoanDetails(loan);
      const principalCents = Math.round(principal * 100);
      const settledCents = Math.round(details.settled * 100);
      if (principalCents < settledCents) {
        loansBridge.showToast(`Principal cannot be less than already settled amount (${formatCurrency(details.settled, true)})`, 'warning');
        return;
      }

      const targetKind = direction === 'borrowed' ? kind : 'cash';

      loan.direction = direction;
      loan.person_name = personName;
      loan.principal = principal;
      loan.loan_date = loanDate;
      loan.notes = notes;
      loan.kind = targetKind;
      loan.updated_at = nowIso;

      loansBridge.enqueueMutation('loans', 'UPSERT', loan);

      // LOAN-AUDIT-02: Keep opening income_entries adjustment in sync with loan edit
      const openingAdj = findOpeningLoanAdjustment(loan);

      if (targetKind === 'on_behalf') {
        // Converted or remains on_behalf: no opening cash adjustment should exist
        if (openingAdj) {
          state.income_entries = (state.income_entries || []).filter(e => e.id !== openingAdj.id);
          delete state._incomeOverride;
          loansBridge.saveIncomeEntries();
          loansBridge.enqueueMutation('income_entries', 'DELETE', { id: openingAdj.id });
        }
      } else {
        // targetKind === 'cash'
        const isLent = direction === 'lent';
        const adjAmount = isLent ? -principal : principal;
        const adjNote = isLent ? `Lent to ${personName}` : `Borrowed from ${personName}`;

        if (openingAdj) {
          openingAdj.amount = Math.round(adjAmount * 100) / 100;
          openingAdj.entry_date = loanDate;
          openingAdj.note = adjNote;
          openingAdj.updated_at = nowIso;
          delete state._incomeOverride;
          loansBridge.saveIncomeEntries();
          loansBridge.enqueueMutation('income_entries', 'UPSERT', openingAdj);
        } else {
          // Converted from on_behalf to cash: create missing opening cash adjustment
          const newAdj = {
            id: generateId(),
            user_id: uid,
            amount: Math.round(adjAmount * 100) / 100,
            entry_date: loanDate,
            type: 'adjustment',
            note: adjNote,
            loan_id: id,
            created_at: nowIso,
            updated_at: nowIso
          };
          delete state._incomeOverride;
          if (!Array.isArray(state.income_entries)) state.income_entries = [];
          state.income_entries.push(newAdj);
          loansBridge.saveIncomeEntries();
          loansBridge.enqueueMutation('income_entries', 'UPSERT', newAdj);
        }
      }

      loansBridge.saveData();
      renderLoans();
      loansBridge.updateSummary();
      closeLoanModal();
      loansBridge.showToast(`Updated loan for "${personName}"`, 'success');
    } else {
      // Create new loan with double-entry adjustment (or on_behalf without initial adjustment)
      createLoan(direction, personName, principal, loanDate, notes, kind);
      closeLoanModal();
      loansBridge.showToast(`Recorded loan for "${personName}"`, 'success');
    }
  }

  function openSettlementModal(loanId) {
    const modal = document.getElementById('loan-settlement-modal');
    if (!modal) return;

    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    const details = getLoanDetails(loan);
    if (details.isSettled) {
      loansBridge.showToast('This loan is already fully settled!', 'info');
      return;
    }

    const isLent = loan.direction === 'lent';
    const stealth = isStealthActive();

    document.getElementById('settlement-loan-id').value = loan.id;
    modal.dataset.loanId = loan.id;
    document.getElementById('settlement-target-person').textContent = loan.person_name;
    const pEl = document.getElementById('settlement-target-principal');
    const oEl = document.getElementById('settlement-target-outstanding');
    if (pEl) {
      pEl.textContent = formatCurrency(details.principal);
      pEl.classList.toggle('stealth-masked', stealth);
    }
    if (oEl) {
      oEl.textContent = formatCurrency(details.outstanding);
      oEl.classList.toggle('stealth-masked', stealth);
    }

    const badge = document.getElementById('settlement-direction-badge');
    if (badge) {
      badge.textContent = isLent ? 'They owe you' : 'You owe them';
      badge.className = isLent ? 'net-position-badge lent' : 'net-position-badge borrowed';
      badge.style.fontSize = '0.75rem';
      badge.style.padding = '3px 8px';
    }

    const amtLabel = document.getElementById('settlement-amount-label');
    if (amtLabel) {
      amtLabel.textContent = isLent ? 'Payment Received *' : 'Payment Made *';
    }

    const amtInput = document.getElementById('settlement-amount-input');
    if (amtInput) {
      amtInput.value = '';
      amtInput.max = details.outstanding;
    }

    const dateInput = document.getElementById('settlement-date-input');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    const noteInput = document.getElementById('settlement-note-input');
    if (noteInput) {
      noteInput.value = '';
    }

    const previewBox = document.getElementById('settlement-preview-box');
    if (previewBox) {
      previewBox.style.display = 'none';
    }

    // Configure on-behalf expense options
    const onBehalfSection = document.getElementById('settlement-on-behalf-section');
    const recordExpenseCb = document.getElementById('settlement-record-expense');
    const categorySelect = document.getElementById('settlement-category-select');

    if (loan.direction === 'borrowed' && loan.kind === 'on_behalf') {
      if (onBehalfSection) onBehalfSection.style.display = 'block';
      if (recordExpenseCb) {
        recordExpenseCb.checked = true;
        recordExpenseCb.onchange = () => {
          if (categorySelect) categorySelect.disabled = !recordExpenseCb.checked;
          const wrapper = document.getElementById('settlement-expense-category-wrapper');
          if (wrapper) wrapper.style.opacity = recordExpenseCb.checked ? '1' : '0.5';
        };
      }
      if (categorySelect) {
        categorySelect.disabled = false;
        if (Array.from(categorySelect.options).some(o => o.value === 'Other')) {
          categorySelect.value = 'Other';
        }
      }
      const wrapper = document.getElementById('settlement-expense-category-wrapper');
      if (wrapper) wrapper.style.opacity = '1';
    } else {
      if (onBehalfSection) onBehalfSection.style.display = 'none';
    }

    // Wire up writeoff balance button
    const writeoffBtn = document.getElementById('settlement-writeoff-btn');
    if (writeoffBtn) {
      writeoffBtn.onclick = () => {
        if (amtInput) {
          amtInput.value = details.outstanding.toFixed(2);
          amtInput.dispatchEvent(new Event('input'));
        }
        if (noteInput) {
          noteInput.value = 'Written off';
        }
        if (loan.direction === 'borrowed' && loan.kind === 'on_behalf') {
          if (recordExpenseCb) recordExpenseCb.checked = true;
          if (categorySelect) categorySelect.disabled = false;
        }
      };
    }

    modal.style.display = 'flex';
  }

  function closeSettlementModal() {
    const modal = document.getElementById('loan-settlement-modal');
    if (modal) {
      modal.style.display = 'none';
      delete modal.dataset.loanId;
    }
  }

  function updateSettlementPreview() {
    const loanId = document.getElementById('settlement-loan-id')?.value;
    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    const details = getLoanDetails(loan);
    const rawAmt = parseFloat(document.getElementById('settlement-amount-input')?.value) || 0;
    const amt = Math.round(rawAmt * 100) / 100;
    const previewBox = document.getElementById('settlement-preview-box');
    const previewVal = document.getElementById('settlement-preview-val');

    if (!previewBox || !previewVal) return;

    if (amt <= 0) {
      previewBox.style.display = 'none';
      return;
    }

    const stealth = isStealthActive();
    previewBox.style.display = 'flex';
    const amtCents = Math.round(amt * 100);
    const outstandingCents = Math.round(details.outstanding * 100);
    const remaining = Math.max(0, (outstandingCents - amtCents) / 100);

    if (amtCents > outstandingCents) {
      previewVal.style.color = 'var(--color-danger)';
      previewVal.textContent = `Exceeds balance (${formatCurrency(details.outstanding)})`;
      previewVal.classList.toggle('stealth-masked', stealth);
    } else if (amtCents === outstandingCents) {
      previewVal.style.color = 'var(--color-success)';
      previewVal.textContent = '🎉 Fully settled!';
      previewVal.classList.remove('stealth-masked');
    } else {
      previewVal.style.color = 'var(--color-text)';
      previewVal.textContent = formatCurrency(remaining);
      previewVal.classList.toggle('stealth-masked', stealth);
    }
  }

  function recordSettlement(loanId, amount, settleDate, note, recordAsExpense = true, expenseCategory = 'Other') {
    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    if (!loan) return null;

    const rawAmt = parseFloat(amount);
    if (isNaN(rawAmt) || rawAmt <= 0) return null;
    const amt = Math.round(rawAmt * 100) / 100;
    if (amt <= 0) return null;

    const details = getLoanDetails(loan);
    const amtCents = Math.round(amt * 100);
    const outstandingCents = Math.round(details.outstanding * 100);
    if (amtCents > outstandingCents) return null;

    const currentUser = loansBridge.getCurrentUser();
    const uid = currentUser?.id || loansBridge.getUserId();
    const nowIso = new Date().toISOString();
    const settleId = generateId();
    const date = settleDate || loansBridge.getLocalDateString();
    const noteText = (note || '').trim();

    const settlement = {
      id: settleId,
      loan_id: loan.id,
      user_id: uid,
      amount: amt,
      settle_date: date,
      note: noteText,
      created_at: nowIso,
      updated_at: nowIso
    };

    if (!Array.isArray(state.loan_settlements)) state.loan_settlements = [];
    state.loan_settlements.push(settlement);
    loansBridge.enqueueMutation('loan_settlements', 'UPSERT', settlement);

    const isLent = loan.direction === 'lent';
    const isOnBehalf = !isLent && loan.kind === 'on_behalf';
    const isWriteoff = noteText.toLowerCase().includes('written off');

    let expenseEntry = null;
    let adjEntry = null;

    if (isOnBehalf && (recordAsExpense || isWriteoff)) {
      // On-behalf repayment / write-off: log as an expense in state.expenses
      // The expense naturally reduces available balance (totalIncome - totalExpenses) by amt and records in analytics
      const expId = generateId();
      const expDesc = noteText ? `${loan.person_name} — ${noteText}` : `${loan.person_name} — Loan Repayment`;
      expenseEntry = {
        id: expId,
        user_id: uid,
        name: expDesc,
        amount: Math.round(amt * 100) / 100,
        category: expenseCategory || 'Other',
        date: date,
        loan_id: loan.id,
        settlement_id: settleId,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      if (!Array.isArray(state.expenses)) state.expenses = [];
      state.expenses.unshift(expenseEntry);
      loansBridge.enqueueMutation('expenses', 'UPSERT', {
        id: expenseEntry.id,
        user_id: uid,
        name: expenseEntry.name,
        amount: expenseEntry.amount,
        category: expenseEntry.category,
        date: expenseEntry.date,
        updated_at: nowIso
      });
    } else if (isWriteoff) {
      // LOAN-AUDIT-01: Cash loan write-off (bad debt or forgiveness): ZERO cash ledger movement!
      // Incurring a bad debt loss or debt forgiveness is a non-cash event.
      // Outstanding balance is reduced via settlement record, but no cash leaves/enters wallet.
    } else {
      // Standard cash double-entry accounting: auto-create balance adjustment entry in income_entries
      // (Also used for on_behalf if user explicitly unchecks "Also record as expense" and not writeoff, so real cash still leaves)
      const adjAmount = isLent ? amt : -amt;
      const adjNote = isLent ? `Repaid by ${loan.person_name}` : `Repaid to ${loan.person_name}`;
      adjEntry = {
        id: generateId(),
        user_id: loansBridge.getUserId(),
        amount: Math.round(adjAmount * 100) / 100,
        entry_date: date,
        type: 'adjustment',
        note: adjNote,
        loan_id: loan.id,
        settlement_id: settleId,
        created_at: nowIso,
        updated_at: nowIso
      };

      delete state._incomeOverride;
      if (!Array.isArray(state.income_entries)) state.income_entries = [];
      state.income_entries.push(adjEntry);
      loansBridge.saveIncomeEntries();
      loansBridge.enqueueMutation('income_entries', 'UPSERT', adjEntry);
    }

    loansBridge.saveData();
    renderLoans();
    loansBridge.updateSummary();

    const newDetails = getLoanDetails(loan);
    if (newDetails.isSettled) {
      loansBridge.fireConfetti();
    }

    return { settlement, adjustment: adjEntry, expense: expenseEntry, isSettled: newDetails.isSettled };
  }

  function saveSettlement() {
    const loanId = document.getElementById('settlement-loan-id')?.value;
    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    const details = getLoanDetails(loan);
    const rawAmt = parseFloat(document.getElementById('settlement-amount-input')?.value);
    const date = document.getElementById('settlement-date-input')?.value;
    const note = (document.getElementById('settlement-note-input')?.value || '').trim();

    if (isNaN(rawAmt) || rawAmt <= 0) {
      loansBridge.showToast('Please enter a valid settlement amount greater than 0', 'warning');
      return;
    }
    const amt = Math.round(rawAmt * 100) / 100;
    if (amt <= 0) {
      loansBridge.showToast('Please enter a valid settlement amount greater than 0', 'warning');
      return;
    }

    const amtCents = Math.round(amt * 100);
    const outstandingCents = Math.round(details.outstanding * 100);
    if (amtCents > outstandingCents) {
      loansBridge.showToast(`Settlement amount cannot exceed outstanding balance (${formatCurrency(details.outstanding, true)})`, 'error');
      return;
    }

    if (!date) {
      loansBridge.showToast('Please select a settlement date', 'warning');
      return;
    }

    const isOnBehalf = loan.direction === 'borrowed' && loan.kind === 'on_behalf';
    const recordAsExpense = isOnBehalf ? (document.getElementById('settlement-record-expense')?.checked ?? true) : false;
    const expenseCategory = isOnBehalf ? (document.getElementById('settlement-category-select')?.value || 'Other') : 'Other';

    const res = recordSettlement(loanId, amt, date, note, recordAsExpense, expenseCategory);
    closeSettlementModal();

    if (res && res.isSettled) {
      loansBridge.showToast(`🎉 Outstanding balance on "${loan.person_name}" fully settled!`, 'success');
    } else {
      loansBridge.showToast(`Settlement of ${formatCurrency(amt, true)} recorded for ${loan.person_name}`, 'success');
    }
  }

  function openLoanHistoryModal(loanId) {
    const modal = document.getElementById('loan-history-modal');
    if (!modal) return;

    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    modal.dataset.loanId = loan.id;
    const details = getLoanDetails(loan);
    const isLent = loan.direction === 'lent';
    const stealth = isStealthActive();

    const titleEl = document.getElementById('loan-history-modal-title');
    const subtitleEl = document.getElementById('loan-history-modal-subtitle');
    const listEl = document.getElementById('loan-history-list');

    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-clock-rotate-left" style="color: var(--color-primary);"></i> <span>${escapeHtml(loan.person_name)}</span>`;
    }

    if (subtitleEl) {
      const dirText = isLent ? 'Lent' : 'Borrowed';
      const pStr = formatCurrency(details.principal);
      const oStr = formatCurrency(details.outstanding);
      subtitleEl.innerHTML = `${dirText} <span class="${stealth ? 'stealth-masked' : ''}">${escapeHtml(pStr)}</span> • Outstanding: <span class="${stealth ? 'stealth-masked' : ''}">${escapeHtml(oStr)}</span>`;
    }

    if (listEl) {
      const settlements = (state?.loan_settlements || [])
        .filter(s => s.loan_id === loan.id)
        .sort((a, b) => new Date(b.settle_date || b.created_at).getTime() - new Date(a.settle_date || a.created_at).getTime());

      if (settlements.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 24px 0; font-size: 0.85rem;">No settlements recorded yet</div>';
      } else {
        listEl.innerHTML = settlements.map(s => {
          let dateFormatted = s.settle_date;
          if (s.settle_date) {
            const d = new Date(s.settle_date + 'T00:00:00');
            dateFormatted = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : s.settle_date;
          }
          const amtStr = formatCurrency(s.amount);
          const isWriteoff = (s.note || '').toLowerCase().includes('written off');

          return `
            <div class="loan-history-entry">
              <div class="loan-history-left">
                <span class="loan-history-note">${escapeHtml(s.note || (isLent ? 'Payment received' : 'Payment made'))}</span>
                <span class="loan-history-date"><i class="fas fa-calendar"></i> ${escapeHtml(dateFormatted)}</span>
              </div>
              <div class="loan-history-amount ${isWriteoff ? 'writeoff' : ''} ${stealth ? 'stealth-masked' : ''}">
                ${isWriteoff ? '📝 ' : '+ '}${escapeHtml(amtStr)}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    modal.style.display = 'flex';
  }

  function closeLoanHistoryModal() {
    const modal = document.getElementById('loan-history-modal');
    if (modal) {
      modal.style.display = 'none';
      delete modal.dataset.loanId;
    }
  }

  function openRenamePersonModal(personName) {
    const modal = document.getElementById('loan-rename-modal');
    if (!modal) return;

    document.getElementById('loan-rename-old').value = personName;
    const input = document.getElementById('loan-rename-new');
    if (input) input.value = personName;

    modal.style.display = 'flex';
    input?.focus();
  }

  function closeRenamePersonModal() {
    const modal = document.getElementById('loan-rename-modal');
    if (modal) modal.style.display = 'none';
  }

  function saveRenamePerson() {
    const oldName = (document.getElementById('loan-rename-old')?.value || '').trim();
    const newName = (document.getElementById('loan-rename-new')?.value || '').trim();

    if (!newName) {
      loansBridge.showToast('Please enter a valid name', 'warning');
      return;
    }

    if (oldName.toLowerCase() === newName.toLowerCase() && oldName === newName) {
      closeRenamePersonModal();
      return;
    }

    const state = loansBridge.getState();
    if (!state) return;

    let modifiedCount = 0;
    const nowIso = new Date().toISOString();

    (state.loans || []).forEach(loan => {
      if ((loan.person_name || '').trim().toLowerCase() === oldName.toLowerCase()) {
        loan.person_name = newName;
        loan.updated_at = nowIso;
        loansBridge.enqueueMutation('loans', 'UPSERT', loan);
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      loansBridge.saveData();
      renderLoans();
      loansBridge.showToast(`Renamed "${oldName}" to "${newName}" across ${modifiedCount} record${modifiedCount === 1 ? '' : 's'}`, 'success');
    }

    closeRenamePersonModal();
  }

  function openDeleteLoanModal(loanId) {
    const modal = document.getElementById('loan-delete-modal');
    if (!modal) return;

    const state = loansBridge.getState();
    const loan = (state?.loans || []).find(l => l.id === loanId);
    const settlements = (state?.loan_settlements || []).filter(s => s.loan_id === loanId);

    pendingDeleteLoanId = loanId;
    const desc = document.getElementById('loan-delete-modal-desc') || document.getElementById('loan-delete-desc');
    if (desc) {
      const childCount = settlements.length;
      const countMsg = childCount > 0
        ? ` This will also remove ${childCount} settlement${childCount === 1 ? '' : 's'} from your backup.`
        : '';
      const person = loan ? ` for "${loan.person_name}"` : '';
      const noteMsg = childCount > 0
        ? ' Note: Historical cash flow adjustments in your balance ledger will remain.'
        : ' Note: Opening cash balance adjustment will also be removed.';
      desc.textContent = `Are you sure you want to delete this loan record${person}?${countMsg}${noteMsg}`;
    }
    modal.style.display = 'flex';
  }

  function closeDeleteLoanModal() {
    const modal = document.getElementById('loan-delete-modal');
    if (modal) modal.style.display = 'none';
    pendingDeleteLoanId = null;
  }

  function deleteLoan(loanId) {
    const state = loansBridge.getState();
    if (!state) return;

    const loan = (state.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    const settlements = (state.loan_settlements || []).filter(s => s.loan_id === loanId);
    const openingAdj = findOpeningLoanAdjustment(loan);

    // LOAN-AUDIT-03: Deleting an unsettled loan (no settlements) reverses its opening cash adjustment
    // This prevents phantom cash (on borrowed loans) and lost balance (on lent loans).
    const isUnsettled = settlements.length === 0;
    let removedOpeningAdj = null;

    if (isUnsettled && openingAdj) {
      removedOpeningAdj = { ...openingAdj };
      state.income_entries = (state.income_entries || []).filter(e => e.id !== openingAdj.id);
      delete state._incomeOverride;
      loansBridge.saveIncomeEntries();
      loansBridge.enqueueMutation('income_entries', 'DELETE', { id: openingAdj.id });
    }

    // Snapshot for undo window
    pendingDeletedLoan = {
      loan: { ...loan },
      settlements: settlements.map(s => ({ ...s })),
      openingAdj: removedOpeningAdj,
      loanId,
      timestamp: Date.now(),
      timer: null
    };

    // 0ms Optimistic local removal
    state.loans = (state.loans || []).filter(l => l.id !== loanId);
    state.loan_settlements = (state.loan_settlements || []).filter(s => s.loan_id !== loanId);

    loansBridge.saveData();
    renderLoans();
    loansBridge.updateSummary();
    loansBridge.updateNetWorthUI();

    // Enqueue DELETE mutations: child settlements first, then parent loan
    settlements.forEach(s => {
      loansBridge.enqueueMutation('loan_settlements', 'DELETE', { id: s.id });
    });
    loansBridge.enqueueMutation('loans', 'DELETE', { id: loanId });

    // Show Undo Toast with action button
    const toastMsg = removedOpeningAdj
      ? `Loan for "${loan.person_name}" and opening cash adjustment removed.`
      : `Loan for "${loan.person_name}" deleted. Historical cash flows remain in your ledger.`;

    loansBridge.showUndoToast(toastMsg, () => {
      restoreDeletedLoan();
    });

    // 5-second undo window
    pendingDeletedLoan.timer = setTimeout(() => {
      pendingDeletedLoan = null;
    }, 5000);
  }

  function restoreDeletedLoan() {
    if (!pendingDeletedLoan) return;
    if (pendingDeletedLoan.timer) clearTimeout(pendingDeletedLoan.timer);

    const { loan, settlements, openingAdj, loanId } = pendingDeletedLoan;
    const state = loansBridge.getState();
    if (!state) return;

    let queue = loansBridge.getSyncQueue();
    const setIds = new Set(settlements.map(s => s.id));
    const hasLoanDelete = queue.some(m => m.table === 'loans' && m.action === 'DELETE' && m.data?.id === loanId);
    const hasSettleDeletes = queue.some(m => m.table === 'loan_settlements' && m.action === 'DELETE' && setIds.has(m.data?.id));
    const hasAdjDelete = openingAdj ? queue.some(m => m.table === 'income_entries' && m.action === 'DELETE' && m.data?.id === openingAdj.id) : false;

    if (hasLoanDelete || hasSettleDeletes || hasAdjDelete) {
      queue = queue.filter(m => {
        if (m.table === 'loans' && m.action === 'DELETE' && m.data?.id === loanId) return false;
        if (m.table === 'loan_settlements' && m.action === 'DELETE' && setIds.has(m.data?.id)) return false;
        if (openingAdj && m.table === 'income_entries' && m.action === 'DELETE' && m.data?.id === openingAdj.id) return false;
        return true;
      });
      loansBridge.saveSyncQueue(queue);
      console.info('🛡️ [Loan Undo] Spliced DELETE mutations before remote sync for loan:', loanId);
    } else {
      if (openingAdj) loansBridge.enqueueMutation('income_entries', 'UPSERT', openingAdj);
      settlements.forEach(s => loansBridge.enqueueMutation('loan_settlements', 'UPSERT', s));
      loansBridge.enqueueMutation('loans', 'UPSERT', loan);
      console.info('🛡️ [Loan Undo] Re-upserted loan, settlements, and adjustment after sync processed');
    }

    if (!Array.isArray(state.loans)) state.loans = [];
    state.loans.unshift(loan);
    if (settlements.length > 0) {
      if (!Array.isArray(state.loan_settlements)) state.loan_settlements = [];
      state.loan_settlements.push(...settlements);
    }
    if (openingAdj) {
      if (!Array.isArray(state.income_entries)) state.income_entries = [];
      state.income_entries.push(openingAdj);
      delete state._incomeOverride;
      loansBridge.saveIncomeEntries();
    }

    loansBridge.saveData();
    renderLoans();
    loansBridge.updateSummary();
    loansBridge.updateNetWorthUI();
    loansBridge.showToast(`Restored loan for "${loan.person_name}"`, 'success');
    pendingDeletedLoan = null;
  }

  // Setup Loans Event Listeners
  function setupLoansEventListeners() {
    // Expose loan modal controllers globally for tests
    const isDevOrTest = Boolean(loansBridge.isDevOrTest || window.__ledgio_test_mode || window.__ledgio_app_ready);
    if (isDevOrTest || typeof window.__ledgio_setAdminForTesting === 'function') {
      window.__ledgio_openCreateLoanModal = (id, prefill) => openCreateLoanModal(id, prefill);
      window.__ledgio_openSettlementModal = (id) => openSettlementModal(id);
      window.__ledgio_closeSettlementModal = () => closeSettlementModal();
      window.__ledgio_openLoanHistoryModal = (id) => openLoanHistoryModal(id);
      window.__ledgio_closeLoanHistoryModal = () => closeLoanHistoryModal();
      window.__ledgio_openRenamePersonModal = (name) => openRenamePersonModal(name);
      window.__ledgio_openDeleteLoanModal = (id) => openDeleteLoanModal(id);
      window.__ledgio_deleteLoan = (id) => deleteLoan(id);
      window.__ledgio_restoreDeletedLoan = () => restoreDeletedLoan();
      window.__ledgio_renderLoans = () => renderLoans();
      window.__ledgio_createLoan = createLoan;
      window.__ledgio_saveLoan = saveLoan;
      window.__ledgio_recordSettlement = recordSettlement;
      window.__ledgio_saveSettlement = saveSettlement;
      window.__ledgio_isLoanAdjustment = isLoanAdjustment;
      window.__ledgio_toggleStealthMode = (f) => (typeof window.toggleStealthMode === 'function' ? window.toggleStealthMode(f) : null);
    }

    // Toolbar "+ Add Loan" button
    document.getElementById('open-create-loan-btn')?.addEventListener('click', () => {
      openCreateLoanModal();
    });

    // Toolbar Filter Buttons
    document.querySelectorAll('.loans-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loans-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLoansFilter = btn.dataset.filter || 'all';
        renderLoans();
      });
    });

    // Direction Toggle Pills in Loan Modal
    document.getElementById('loan-direction-lent')?.addEventListener('click', () => {
      document.getElementById('loan-direction-lent')?.classList.add('active');
      document.getElementById('loan-direction-borrowed')?.classList.remove('active');
      const dirInput = document.getElementById('loan-direction-input');
      if (dirInput) dirInput.value = 'lent';
      const kindGroup = document.getElementById('loan-kind-group');
      if (kindGroup) kindGroup.style.display = 'none';
    });

    document.getElementById('loan-direction-borrowed')?.addEventListener('click', () => {
      document.getElementById('loan-direction-borrowed')?.classList.add('active');
      document.getElementById('loan-direction-lent')?.classList.remove('active');
      const dirInput = document.getElementById('loan-direction-input');
      if (dirInput) dirInput.value = 'borrowed';
      const kindGroup = document.getElementById('loan-kind-group');
      if (kindGroup) kindGroup.style.display = 'block';
    });

    // Loan Kind Radio Listeners
    ['loan-kind-cash', 'loan-kind-on-behalf'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const kindInput = document.getElementById('loan-kind-input');
        if (kindInput && e.target.checked) {
          kindInput.value = e.target.value;
        }
      });
    });

    // Loan Form Submit
    document.getElementById('loan-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveLoan();
    });

    // Settlement Form Submit
    document.getElementById('loan-settlement-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettlement();
    });

    // Settlement Amount input listener for live preview
    document.getElementById('settlement-amount-input')?.addEventListener('input', () => {
      updateSettlementPreview();
    });

    // Rename Form Submit
    document.getElementById('loan-rename-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveRenamePerson();
    });

    // Delete Loan Modal Confirm
    document.getElementById('confirm-delete-loan-btn')?.addEventListener('click', () => {
      if (pendingDeleteLoanId) {
        deleteLoan(pendingDeleteLoanId);
        closeDeleteLoanModal();
      }
    });

    // Close Modal Buttons
    document.getElementById('close-loan-modal-btn')?.addEventListener('click', closeLoanModal);
    document.getElementById('cancel-loan-btn')?.addEventListener('click', closeLoanModal);

    document.getElementById('close-loan-settlement-btn')?.addEventListener('click', closeSettlementModal);
    document.getElementById('cancel-settlement-btn')?.addEventListener('click', closeSettlementModal);

    document.getElementById('close-loan-history-btn')?.addEventListener('click', closeLoanHistoryModal);
    document.getElementById('close-history-modal-btn')?.addEventListener('click', closeLoanHistoryModal);

    document.getElementById('close-loan-rename-btn')?.addEventListener('click', closeRenamePersonModal);
    document.getElementById('cancel-rename-person-btn')?.addEventListener('click', closeRenamePersonModal);

    document.getElementById('cancel-delete-loan-btn')?.addEventListener('click', closeDeleteLoanModal);

    // Modal Overlay Backdrop Dismissal
    ['loan-modal', 'loan-settlement-modal', 'loan-history-modal', 'loan-rename-modal', 'loan-delete-modal'].forEach(id => {
      const modalEl = document.getElementById(id);
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            modalEl.style.display = 'none';
          }
        });
      }
    });

    // Delegated actions for #loans-container
    const container = document.getElementById('loans-container');
    if (container) {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button, [data-action]');
        if (!btn) return;

        const action = btn.dataset.action || (btn.id === 'create-first-loan-btn' ? 'create-first' : null);
        const id = btn.dataset.id;
        const person = btn.dataset.person;

        if (action === 'loan-settle') {
          openSettlementModal(id);
        } else if (action === 'loan-history') {
          openLoanHistoryModal(id);
        } else if (action === 'loan-edit') {
          openCreateLoanModal(id);
        } else if (action === 'loan-delete') {
          openDeleteLoanModal(id);
        } else if (action === 'rename-person') {
          openRenamePersonModal(person);
        } else if (action === 'add-person-loan') {
          openCreateLoanModal(null, person);
        } else if (action === 'create-first' || btn.id === 'create-first-loan-btn') {
          openCreateLoanModal();
        }
      });
    }
  }

  // Public API
  const LedgioLoans = {
    configure,
    getLoanSettledAmount,
    getLoanDetails,
    updatePeopleDatalist,
    renderLoans,
    openCreateLoanModal,
    openLoanModal: openCreateLoanModal,
    closeLoanModal,
    findOpeningLoanAdjustment,
    createLoan,
    saveLoan,
    openSettlementModal,
    closeSettlementModal,
    updateSettlementPreview,
    recordSettlement,
    saveSettlement,
    openLoanHistoryModal,
    closeLoanHistoryModal,
    openRenamePersonModal,
    closeRenamePersonModal,
    saveRenamePerson,
    openDeleteLoanModal,
    closeDeleteLoanModal,
    deleteLoan,
    restoreDeletedLoan,
    isLoanAdjustment,
    setupLoansEventListeners,
    get activeLoansFilter() { return activeLoansFilter; },
    set activeLoansFilter(v) { activeLoansFilter = v; }
  };

  window.LedgioLoans = LedgioLoans;
  window.createLoan = createLoan;
  window.recordSettlement = recordSettlement;
  window.deleteLoan = deleteLoan;
  window.renderLoans = renderLoans;
  window.getLoanDetails = getLoanDetails;
  window.openLoanModal = openCreateLoanModal;
  window.openCreateLoanModal = openCreateLoanModal;
  window.openSettlementModal = openSettlementModal;
  window.openLoanHistoryModal = openLoanHistoryModal;
  window.isLoanAdjustment = isLoanAdjustment;
})();
