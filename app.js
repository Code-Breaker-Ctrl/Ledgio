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
  
  const CURRENCY_LOCALES = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'en-AE',
    SGD: 'en-SG',
    CAD: 'en-CA',
    AUD: 'en-AU',
    JPY: 'ja-JP',
    SAR: 'ar-SA',
    KWD: 'ar-KW',
    BDT: 'bn-BD',
    PKR: 'ur-PK',
    NPR: 'ne-NP',
    LKR: 'si-LK'
  };

  // Supabase Client Initialization
  const supabaseUrl = window.SUPABASE_CONFIG?.url;
  const supabaseAnonKey = window.SUPABASE_CONFIG?.anonKey;
  const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'PASTE_YOUR_ANON_KEY_HERE';

  let supabase = null;
  if (isSupabaseConfigured && window.supabase) {
    try {
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
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

  // State Management (Supabase Cloud + User-Scoped LocalStorage Fallback)
  async function loadData() {
    // 0. Load existing user-scoped local storage state immediately
    const userKey = getStorageKey();
    const localData = localStorage.getItem(userKey);
    const directDark = localStorage.getItem('sb_dark_mode_' + getUserId());
    
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        state = {
          version: 2,
          income: parsed.income || 0,
          expenses: parsed.expenses || [],
          budgets: parsed.budgets || {},
          settings: {
            currency: parsed.settings?.currency || 'INR',
            darkMode: directDark !== null ? (directDark === 'true') : Boolean(parsed.settings?.darkMode)
          }
        };
      } catch (e) {
        console.error('Error loading user-scoped local data', e);
      }
    } else {
      state = {
        version: 2,
        income: 0,
        expenses: [],
        budgets: {},
        settings: { 
          currency: 'INR', 
          darkMode: directDark !== null ? (directDark === 'true') : false 
        }
      };
    }

    // Apply dark mode immediately from local preferences so there is zero UI jump
    applyDarkMode();

    // Remove legacy un-scoped data key to avoid data bleed between accounts
    try {
      localStorage.removeItem('smartBudgetData');
    } catch (e) {}

    // 1. Try Supabase Cloud Database
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUser = user;
          localStorage.setItem('sb_user_id', user.id);

          // Update username in localStorage if available
          const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
          const derivedName = metaName || (user.email ? user.email.split('@')[0] : 'User');
          localStorage.setItem('sb_username', derivedName);

          // Check user-scoped local storage for authenticated user
          const authUserKey = getStorageKey();
          const authLocal = localStorage.getItem(authUserKey);
          const userDirectDark = localStorage.getItem('sb_dark_mode_' + user.id);
          if (authLocal) {
            try {
              const parsed = JSON.parse(authLocal);
              if (parsed.settings) {
                if (parsed.settings.currency) state.settings.currency = parsed.settings.currency;
                if (parsed.settings.darkMode !== undefined) state.settings.darkMode = Boolean(parsed.settings.darkMode);
              }
              if (parsed.income !== undefined) state.income = parsed.income;
            } catch (e) {}
          }
          if (userDirectDark !== null) {
            state.settings.darkMode = (userDirectDark === 'true');
          }

          // Fetch user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile) {
            if (profile.currency) state.settings.currency = profile.currency;
            if (profile.dark_mode !== undefined && profile.dark_mode !== null) {
              state.settings.darkMode = Boolean(profile.dark_mode);
            } else if (user.user_metadata?.darkMode !== undefined) {
              state.settings.darkMode = Boolean(user.user_metadata.darkMode);
            }
            if (typeof profile.income === 'number' && !isNaN(profile.income)) {
              state.income = profile.income;
            }
          } else if (user.user_metadata?.darkMode !== undefined) {
            state.settings.darkMode = Boolean(user.user_metadata.darkMode);
          }

          // If profile didn't have income, check user metadata
          if (state.income === 0 && user.user_metadata?.income !== undefined) {
            state.income = parseFloat(user.user_metadata.income) || 0;
          }

          // Fetch cloud expenses for this user
          const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

          if (!expError && expenses) {
            state.expenses = expenses.map(e => ({
              id: e.id,
              name: e.name,
              amount: parseFloat(e.amount) || 0,
              category: e.category || 'other',
              date: e.date,
              createdAt: e.created_at,
              updatedAt: e.created_at
            }));
          }

          // Fetch cloud budgets for this user
          const { data: budgets, error: bgError } = await supabase
            .from('budgets')
            .select('*')
            .eq('user_id', user.id);

          if (!bgError && budgets) {
            state.budgets = {};
            budgets.forEach(b => {
              state.budgets[b.category] = parseFloat(b.monthly_limit) || 0;
            });
          }

          saveData();
          applyDarkMode();
          refreshUI();
          return;
        }
      } catch (err) {
        console.warn('Cloud sync fallback to user-scoped local storage:', err);
      }
    }

    // 2. Local Fallback Mode
    saveData();
    applyDarkMode();
    refreshUI();
  }

  function saveData() {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(state));
    const uid = getUserId();
    if (state.settings?.darkMode !== undefined) {
      localStorage.setItem('sb_dark_mode_' + uid, state.settings.darkMode ? 'true' : 'false');
    }
  }

  // Utilities
  function generateId() {
    return crypto.randomUUID();
  }

  function formatCurrency(value) {
    const curr = state.settings?.currency || 'INR';
    const locale = CURRENCY_LOCALES[curr] || 'en-IN';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
        maximumFractionDigits: (curr === 'JPY' ? 0 : 2)
      }).format(value);
    } catch {
      return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
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
    
    if (incomeEl) incomeEl.textContent = formatCurrency(state.income);
    if (expensesEl) expensesEl.textContent = formatCurrency(totalExpenses);
    if (remainingEl) {
      remainingEl.textContent = formatCurrency(remaining);
      remainingEl.className = remaining >= 0 ? 'text-success' : 'text-danger';
    }
    if (savingsEl) savingsEl.textContent = `${savingsRate}%`;
    
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
      name.textContent = exp.name;
      
      const catDiv = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'category-badge';
      badge.style.backgroundColor = cat.color;
      badge.textContent = cat.label;
      catDiv.appendChild(badge);
      
      const amount = document.createElement('div');
      amount.textContent = formatCurrency(exp.amount);
      amount.style.fontWeight = '500';
      
      const date = document.createElement('div');
      date.textContent = exp.date;
      date.style.color = 'var(--color-text-muted)';
      date.style.fontSize = '0.875rem';
      
      const actions = createActionButtons(exp.id);
      
      row.appendChild(name);
      row.appendChild(catDiv);
      row.appendChild(amount);
      row.appendChild(date);
      row.appendChild(actions);
      tbody.appendChild(row);
    });
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
      
      const amounts = document.createElement('div');
      amounts.className = 'budget-item-amounts';
      amounts.innerHTML = `<span style="color:var(--color-text)">${formatCurrency(spent)}</span> / ${formatCurrency(limit)}`;
      
      header.appendChild(title);
      header.appendChild(amounts);
      
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
    
    const newExpense = {
      id: generateId(),
      name,
      amount,
      category,
      date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Cloud Insert
    if (supabase && currentUser) {
      try {
        const { data, error } = await supabase.from('expenses').insert({
          user_id: currentUser.id,
          name,
          amount,
          category,
          date
        }).select().single();

        if (!error && data) {
          newExpense.id = data.id;
        }
      } catch (err) {
        console.error('Error saving expense to Supabase', err);
      }
    }

    state.expenses.unshift(newExpense);
    saveData();
    
    nameInput.value = '';
    valInput.value = '';
    
    refreshUI();
    showToast('Expense added successfully');
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
    
    // Cloud Update
    if (supabase && currentUser) {
      try {
        await supabase.from('expenses').update({
          name,
          amount,
          category,
          date
        }).eq('id', id);
      } catch (err) {
        console.error('Error updating expense in Supabase', err);
      }
    }

    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      state.expenses[idx] = {
        ...state.expenses[idx],
        name, amount, category, date,
        updatedAt: new Date().toISOString()
      };
      saveData();
      document.getElementById('edit-modal').style.display = 'none';
      refreshUI();
      showToast('Expense updated');
    }
  }

  async function deleteExpense(id) {
    const confirmed = await showConfirm('Are you sure you want to delete this expense?');
    if (confirmed) {
      // Cloud Delete
      if (supabase && currentUser) {
        try {
          await supabase.from('expenses').delete().eq('id', id);
        } catch (err) {
          console.error('Error deleting expense in Supabase', err);
        }
      }

      state.expenses = state.expenses.filter(e => e.id !== id);
      saveData();
      refreshUI();
      showToast('Expense deleted');
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
    const locale = CURRENCY_LOCALES[cur] || 'en-IN';
    try {
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: cur
      }).format(2500);
      previewEl.textContent = `Preview: ${formatted}`;
    } catch (e) {
      previewEl.textContent = `Preview: ${cur} 2,500.00`;
    }
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

  // Event Listeners Setup
  function setupEventListeners() {
    window.addEventListener('popstate', () => {
      navigateTo(window.location.hash || '#dashboard');
    });
    
    document.querySelectorAll('.sidebar-nav .nav-link, .sidebar-footer .nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.id === 'logout-btn') {
          e.preventDefault();
          if(window.logout) window.logout();
          return;
        }
        e.preventDefault();
        const hash = link.getAttribute('href');
        history.pushState(null, '', hash);
        navigateTo(hash);
      });
    });
    
    document.getElementById('mobile-sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('active');
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

      // Cloud Sync for Income (Supabase profiles + user metadata)
      if (supabase && currentUser) {
        try {
          await supabase.from('profiles').upsert({
            id: currentUser.id,
            income: finalIncome,
            currency: state.settings.currency || 'INR',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (err) {
          console.warn('Profiles upsert note:', err);
        }

        try {
          await supabase.auth.updateUser({
            data: { income: finalIncome }
          });
        } catch (err) {}
      }

      showToast(toastMsg, 'success');
    });
    
    document.getElementById('set-budget-btn')?.addEventListener('click', async () => {
      const cat = document.getElementById('budget-category-select').value;
      const val = parseFloat(document.getElementById('budget-amount-input').value);
      if (cat && !isNaN(val) && val >= 0) {
        state.budgets[cat] = val;
        
        // Cloud Budget Upsert
        if (supabase && currentUser) {
          try {
            await supabase.from('budgets').upsert({
              user_id: currentUser.id,
              category: cat,
              monthly_limit: val
            }, { onConflict: 'user_id,category' });
          } catch (err) {
            console.error('Error saving budget to Supabase', err);
          }
        }

        saveData();
        renderBudgets();
        showToast('Budget set successfully');
        document.getElementById('budget-amount-input').value = '';
      } else {
        showToast('Invalid budget data', 'error');
      }
    });
    
    // Settings
    document.getElementById('quick-currency-select')?.addEventListener('change', async (e) => {
      const cur = e.target.value;
      state.settings.currency = cur;
      const curSelect = document.getElementById('currency-select');
      if (curSelect) curSelect.value = cur;

      if (supabase && currentUser) {
        try {
          await supabase.from('profiles').update({ currency: cur }).eq('id', currentUser.id);
        } catch (err) {}
      }

      saveData();
      refreshUI();
      showToast(`Currency changed to ${cur}`);
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
      state.settings.currency = cur;
      state.settings.darkMode = dark;
      
      const quickCurSelect = document.getElementById('quick-currency-select');
      if (quickCurSelect) quickCurSelect.value = cur;

      applyDarkMode();
      saveData();

      if (supabase && currentUser) {
        try {
          await supabase.from('profiles').update({ 
            currency: cur,
            dark_mode: dark,
            updated_at: new Date().toISOString()
          }).eq('id', currentUser.id);
        } catch (err) {
          try {
            await supabase.from('profiles').update({ currency: cur }).eq('id', currentUser.id);
          } catch (e) {}
        }

        try {
          await supabase.auth.updateUser({
            data: { currency: cur, darkMode: dark }
          });
        } catch (err) {}
      }

      refreshUI();
      showToast('Preferences saved');
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
    
    document.getElementById('import-data')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
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
    
    document.getElementById('reset-data')?.addEventListener('click', async () => {
      const confirmed = await showConfirm('Are you sure you want to reset all data? This cannot be undone.');
      if (confirmed) {
        if (supabase && currentUser) {
          try {
            await supabase.from('expenses').delete().eq('user_id', currentUser.id);
            await supabase.from('budgets').delete().eq('user_id', currentUser.id);
            await supabase.from('profiles').update({ income: 0 }).eq('id', currentUser.id);
          } catch (err) {}
          try {
            await supabase.auth.updateUser({ data: { income: 0 } });
          } catch (err) {}
        }
        localStorage.removeItem(getStorageKey());
        try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
        state = { version: 2, income: 0, expenses: [], budgets: {}, settings: { currency: 'INR', darkMode: false } };
        populateDropdowns();
        refreshUI();
        applyDarkMode();
        showToast('All data has been reset');
      }
    });
  }

  // Initialization
  async function init() {
    await loadData();
    populateDropdowns();
    applyDarkMode();
    refreshUI();
    setupEventListeners();
    
    // Personalize user name dynamically
    const storedName = localStorage.getItem('sb_username');
    const userMeta = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name;
    const emailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : '';
    const username = storedName || userMeta || (emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : 'Ledgio User');
    
    const subtitle = document.getElementById('header-subtitle');
    if (subtitle) {
      const firstName = username.split(' ')[0];
      subtitle.textContent = `Welcome back, ${firstName}!`;
    }
    const profileSpan = document.querySelector('.user-profile-chip span');
    if (profileSpan) {
      profileSpan.textContent = username;
    }
    const avatarEl = document.querySelector('.user-avatar');
    if (avatarEl) {
      const parts = username.trim().split(/\s+/);
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'LU';
    }

    // Initial routing
    navigateTo(window.location.hash || '#dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
