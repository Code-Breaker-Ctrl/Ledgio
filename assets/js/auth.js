'use strict';

(function() {
  // Initialize Supabase Client with explicit persistent storage
  const supabaseUrl = window.SUPABASE_CONFIG?.url;
  const supabaseAnonKey = window.SUPABASE_CONFIG?.anonKey;
  const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'PASTE_YOUR_ANON_KEY_HERE';

  let supabase = window.supabaseClient || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
  if (!supabase && isSupabaseConfigured && window.supabase) {
    try {
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      window.supabaseClient = supabase;
    } catch (err) {
      console.warn('Supabase initialization error:', err);
    }
  }

  // Global logout function available before auth guard
  window.logout = async function() {
    console.log('[Ledgio Auth] Checking pending sync queue and local data before logout...');
    const currentUid = localStorage.getItem('sb_user_id') || 'default_user';
    let pendingCount = 0;
    const enqueuedIds = new Set();
    try {
      const queueKeys = [
        `ledgio_sync_queue_${currentUid}`
      ];
      if (currentUid !== 'default_user' && localStorage.getItem('ledgio_sync_queue_default_user')) {
        queueKeys.push('ledgio_sync_queue_default_user');
      }
      queueKeys.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const queue = JSON.parse(raw);
            if (Array.isArray(queue)) {
              pendingCount += queue.length;
              queue.forEach(item => {
                if (item && item.data && item.data.id) {
                  enqueuedIds.add(String(item.data.id));
                }
              });
            }
          } catch (e) {}
        }
      });
    } catch (e) {
      console.warn('Error reading sync queues on logout:', e);
    }

    // Finding-08: Also count local financial records that have never synced or were updated after last sync
    let localUnsyncedCount = 0;
    try {
      const seenRecordIds = new Set();
      const lastSyncRaw = localStorage.getItem(`ledgio_last_sync_${currentUid}`) ||
        (currentUid !== 'default_user' ? localStorage.getItem('ledgio_last_sync_default_user') : null);
      const lastSyncTime = lastSyncRaw ? new Date(lastSyncRaw).getTime() : 0;

      const userBudgetKeys = [
        `smartBudgetData_${currentUid}`
      ];
      if (currentUid === 'default_user' || !localStorage.getItem(`smartBudgetData_${currentUid}`)) {
        if (localStorage.getItem('smartBudgetData')) {
          userBudgetKeys.push('smartBudgetData');
        }
      }

      userBudgetKeys.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') {
              const collections = ['expenses', 'goals', 'goal_deposits', 'loans', 'loan_settlements', 'income_entries'];
              collections.forEach(col => {
                if (Array.isArray(data[col])) {
                  data[col].forEach(rec => {
                    if (!rec || typeof rec !== 'object') return;
                    const recId = rec.id ? String(rec.id) : null;
                    if (recId) {
                      if (enqueuedIds.has(recId)) return;
                      if (seenRecordIds.has(recId)) return;
                      seenRecordIds.add(recId);
                    }
                    if (!lastSyncTime || isNaN(lastSyncTime)) {
                      localUnsyncedCount++;
                    } else {
                      const t = rec.updated_at || rec.created_at || rec.date || rec.entry_date;
                      const recTime = t ? new Date(t).getTime() : 0;
                      if (!recTime || isNaN(recTime) || recTime > lastSyncTime) {
                        localUnsyncedCount++;
                      }
                    }
                  });
                }
              });
            }
          } catch (err) {}
        }
      });

      const userIncomeKey = `ledgio_income_entries_${currentUid}`;
      const rawInc = localStorage.getItem(userIncomeKey);
      if (rawInc) {
        try {
          const entries = JSON.parse(rawInc);
          if (Array.isArray(entries)) {
            entries.forEach(rec => {
              if (!rec || typeof rec !== 'object') return;
              const recId = rec.id ? String(rec.id) : null;
              if (recId) {
                if (enqueuedIds.has(recId)) return;
                if (seenRecordIds.has(recId)) return;
                seenRecordIds.add(recId);
              }
              if (!lastSyncTime || isNaN(lastSyncTime)) {
                localUnsyncedCount++;
              } else {
                const t = rec.updated_at || rec.created_at || rec.entry_date;
                const recTime = t ? new Date(t).getTime() : 0;
                if (!recTime || isNaN(recTime) || recTime > lastSyncTime) {
                  localUnsyncedCount++;
                }
              }
            });
          }
        } catch (err) {}
      }
    } catch (e) {
      console.warn('Error checking local financial records on logout:', e);
    }

    const totalUnsynced = pendingCount + localUnsyncedCount;
    if (totalUnsynced > 0) {
      const confirmMsg = `You have ${totalUnsynced} change${totalUnsynced === 1 ? '' : 's'} not yet backed up to the cloud. Log out anyway?`;
      let proceed = true;
      if (typeof window.showConfirm === 'function') {
        proceed = await window.showConfirm(confirmMsg);
      } else {
        proceed = window.confirm(confirmMsg);
      }
      if (!proceed) {
        return false;
      }
    }

    console.log('[Ledgio Auth] Logging out user and clearing local credentials...');
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error signing out from Supabase:', e);
      }
    }

    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        // EXCLUSION: Preserve per-user stat card view preferences, category cache, and announcement seen markers (non-sensitive UX choices)
        if (
          k.startsWith('ledgio_stat_views_') ||
          k.startsWith('ledgio_categories_cache_') ||
          k.startsWith('ledgio_categories_migrated_') ||
          k.startsWith('ledgio_announcement_seen_')
        ) {
          continue;
        }
        if (
          k.startsWith('smartBudgetData') ||
          k.startsWith('ledgio_income_entries_') ||
          k.startsWith('ledgio_income_pulled_') ||
          k.startsWith('ledgio_legacy_income_') ||
          k.startsWith('ledgio_sync_queue_') ||
          k.startsWith('ledgio_dead_letter_') ||
          k.startsWith('ledgio_vault_') ||
          k.startsWith('ledgio_safety_backup') ||
          k.startsWith('ledgio_stealth_') ||
          k.startsWith('ledgio_sidebar_collapsed_') ||
          k.startsWith('ledgio_last_sync_') ||
          k.startsWith('ledgio_pending_cloud_reset_') ||
          k.startsWith('sb_') ||
          k.startsWith('sb-')
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });
    } catch (err) {
      console.warn('Error purging localStorage on logout:', err);
    }

    sessionStorage.setItem('just_logged_out', 'true');
    if (!window.__ledgio_suppressRedirect) {
      window.location.replace('index.html');
    }
    return true;
  };

  // Auth Guard (Persistent Session & Offline Aware)
  async function checkAuth() {
    const path = window.location.pathname;
    const isAuthPage = path.includes('login.html') || path.includes('signup.html');
    const isDashboard = path.includes('dashboard.html');
    const isLanding = !isAuthPage && !isDashboard && (
      path.endsWith('index.html') || 
      path.endsWith('/') || 
      path === '' || 
      path.endsWith('/Ledgio') || 
      path.endsWith('/Ledgio/')
    );

    // If user just explicitly logged out in this session, do NOT auto-redirect from landing page
    if (sessionStorage.getItem('just_logged_out') === 'true') {
      sessionStorage.removeItem('just_logged_out');
      if (isDashboard) {
        window.location.replace('login.html');
      }
      return;
    }

    const hasLocalAuth = localStorage.getItem('sb_auth') === 'true';

    // Update navbar buttons on landing page if rendered
    const updateLandingNav = () => {
      if (isLanding && hasLocalAuth) {
        document.querySelectorAll('.nav-login-btn, .btn-mobile-login').forEach(el => {
          el.href = 'dashboard.html';
          el.textContent = 'Dashboard';
        });
        document.querySelectorAll('.nav-signup-btn, .btn-mobile-signup, .hero-cta-group a[href="signup.html"], .intelligence-cta-btn, .cta-banner-3d a[href="signup.html"]').forEach(el => {
          el.href = 'dashboard.html';
          el.textContent = 'Open Dashboard';
        });
      }
    };

    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          localStorage.setItem('sb_auth', 'true');
          localStorage.setItem('sb_user_id', session.user.id);
          const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
          const emailPrefix = session.user.email ? session.user.email.split('@')[0] : 'User';
          const fullName = metaName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
          localStorage.setItem('sb_username', fullName);

          if (isAuthPage || isLanding) {
            console.log('[Ledgio Auth] Active user session verified. Redirecting to dashboard...');
            window.location.replace('dashboard.html');
            return;
          }
          return;
        }
      } catch (e) {
        console.warn('[Ledgio Auth] Supabase getSession verification check:', e);
      }

      // If getSession is temporarily null during cold start / offline PWA,
      // but user previously authenticated, preserve login state
      const isLocallyAuthed = hasLocalAuth || localStorage.getItem('sb_auth') === 'true';
      if (isLocallyAuthed) {
        if (isAuthPage || isLanding) {
          console.log('[Ledgio Auth] Persistent local auth confirmed. Navigating to dashboard...');
          window.location.replace('dashboard.html');
          return;
        }
        return;
      }

      // No session and no local auth -> redirect to login if currently on dashboard
      if (isDashboard) {
        window.location.replace('login.html');
      }
    } else {
      // Local fallback mode
      const isLocallyAuthed = hasLocalAuth || localStorage.getItem('sb_auth') === 'true';
      if (isDashboard && !isLocallyAuthed) {
        window.location.replace('login.html');
      }
      if ((isAuthPage || isLanding) && hasLocalAuth) {
        window.location.replace('dashboard.html');
      }
    }

    updateLandingNav();
  }

  // Subscribe to auth state changes
  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        localStorage.setItem('sb_auth', 'true');
        localStorage.setItem('sb_user_id', session.user.id);
        const metaName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        const emailPrefix = session.user.email ? session.user.email.split('@')[0] : 'User';
        const fullName = metaName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
        localStorage.setItem('sb_username', fullName);
      } else if (event === 'SIGNED_OUT') {
        if (sessionStorage.getItem('just_logged_out') === 'true') {
          localStorage.removeItem('sb_auth');
          localStorage.removeItem('sb_user_id');
          localStorage.removeItem('sb_username');
        }
      }
    });
  }

  // Run auth check immediately
  checkAuth();

  // Form Field Validation Helpers
  function showError(id, message) {
    const el = document.getElementById(id + '-error');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function clearError(id) {
    const el = document.getElementById(id + '-error');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // 1. Password Visibility Toggles
    const toggleBtns = document.querySelectorAll('.toggle-password-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const wrapper = this.closest('.input-icon-wrapper');
        const input = wrapper ? wrapper.querySelector('input') : null;
        const icon = this.querySelector('i');

        if (input && input.type === 'password') {
          input.type = 'text';
          if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          }
        } else if (input) {
          input.type = 'password';
          if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
      });
    });

    // 2. Real-time Password Strength Meter
    const signupPass = document.querySelector('#signup-form #password');
    const strengthFill = document.getElementById('strength-fill');

    if (signupPass && strengthFill) {
      signupPass.addEventListener('input', (e) => {
        const val = e.target.value;
        let score = 0;

        if (val.length >= 8) score += 25;
        if (/[A-Z]/.test(val)) score += 25;
        if (/[0-9]/.test(val)) score += 25;
        if (/[^A-Za-z0-9]/.test(val)) score += 25;

        strengthFill.style.width = score + '%';

        if (score <= 25) {
          strengthFill.style.backgroundColor = '#f43f5e';
        } else if (score <= 50) {
          strengthFill.style.backgroundColor = '#f97316';
        } else if (score <= 75) {
          strengthFill.style.backgroundColor = '#f59e0b';
        } else {
          strengthFill.style.backgroundColor = '#10b981';
        }
      });
    }

    // 3. Login Form Submission (Real Supabase Auth + Fallback)
    if (loginForm) {
      const emailInput = loginForm.querySelector('#email');
      const passInput = loginForm.querySelector('#password');

      emailInput?.addEventListener('input', () => clearError('email'));
      passInput?.addEventListener('input', () => clearError('password'));

      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
          showError('email', 'Please enter a valid email address.');
          valid = false;
        }

        if (!passInput.value || passInput.value.length < 6) {
          showError('password', 'Password must be at least 6 characters.');
          valid = false;
        }

        if (!valid) return;

        const btn = loginForm.querySelector('button[type="submit"]');
        const textSpan = btn.querySelector('.btn-text');
        const loadingSpan = btn.querySelector('.btn-loading');

        if (textSpan) textSpan.style.display = 'none';
        if (loadingSpan) loadingSpan.style.display = 'inline-flex';
        btn.disabled = true;

        try {
          if (supabase) {
            // Real Supabase Authentication
            const { data, error } = await supabase.auth.signInWithPassword({
              email: emailInput.value.trim(),
              password: passInput.value
            });

            if (error) {
              showError('password', error.message || 'Invalid email or password.');
              return;
            }

            if (data?.session) {
              localStorage.setItem('sb_auth', 'true');
              const userMetaName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
              const emailPrefix = data.user?.email ? data.user.email.split('@')[0] : 'User';
              const fullName = userMetaName || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
              localStorage.setItem('sb_username', fullName);
              localStorage.setItem('sb_user_id', data.user.id);
              try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
              window.location.href = 'dashboard.html';
            }
          } else {
            // Local mode fallback
            localStorage.setItem('sb_auth', 'true');
            const emailPrefix = emailInput.value.trim().split('@')[0] || 'User';
            const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
            localStorage.setItem('sb_username', fullName);
            localStorage.setItem('sb_user_id', 'local_' + emailInput.value.trim().toLowerCase());
            try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
            window.location.href = 'dashboard.html';
          }
        } catch (err) {
          showError('password', 'Authentication failed. Please try again.');
        } finally {
          if (textSpan) textSpan.style.display = 'inline-flex';
          if (loadingSpan) loadingSpan.style.display = 'none';
          btn.disabled = false;
        }
      });
    }

    // 4. Signup Form Submission (Real Supabase Auth + Fallback)
    if (signupForm) {
      const firstInput = signupForm.querySelector('#first-name');
      const lastInput = signupForm.querySelector('#last-name');
      const emailInput = signupForm.querySelector('#email');
      const passInput = signupForm.querySelector('#password');
      const confirmInput = signupForm.querySelector('#confirm-password');
      const termsBox = signupForm.querySelector('#terms');

      firstInput?.addEventListener('input', () => clearError('firstName'));
      lastInput?.addEventListener('input', () => clearError('lastName'));
      emailInput?.addEventListener('input', () => clearError('email'));
      passInput?.addEventListener('input', () => clearError('password'));
      confirmInput?.addEventListener('input', () => clearError('confirmPassword'));
      termsBox?.addEventListener('change', () => clearError('terms'));

      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        if (!firstInput.value.trim()) {
          showError('firstName', 'First name is required');
          valid = false;
        }

        if (!lastInput.value.trim()) {
          showError('lastName', 'Last name is required');
          valid = false;
        }

        if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
          showError('email', 'Please enter a valid email address');
          valid = false;
        }

        if (!passInput.value || passInput.value.length < 6) {
          showError('password', 'Password must be at least 6 characters');
          valid = false;
        }

        if (passInput.value !== confirmInput.value) {
          showError('confirmPassword', 'Passwords do not match');
          valid = false;
        }

        if (!termsBox.checked) {
          showError('terms', 'You must agree to the Terms of Service');
          valid = false;
        }

        if (!valid) return;

        const btn = signupForm.querySelector('button[type="submit"]');
        const textSpan = btn.querySelector('.btn-text');
        const loadingSpan = btn.querySelector('.btn-loading');

        if (textSpan) textSpan.style.display = 'none';
        if (loadingSpan) loadingSpan.style.display = 'inline-flex';
        btn.disabled = true;

        try {
          const fullName = `${firstInput.value.trim()} ${lastInput.value.trim()}`;

          if (supabase) {
            // Real Supabase Signup with User Metadata
            const { data, error } = await supabase.auth.signUp({
              email: emailInput.value.trim(),
              password: passInput.value,
              options: {
                data: {
                  full_name: fullName
                }
              }
            });

            if (error) {
              showError('email', error.message || 'Signup failed.');
              return;
            }

            if (data?.user) {
              localStorage.setItem('sb_auth', 'true');
              localStorage.setItem('sb_username', fullName);
              localStorage.setItem('sb_user_id', data.user.id);
              try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
              window.location.href = 'dashboard.html';
            }
          } else {
            // Local mode fallback
            localStorage.setItem('sb_auth', 'true');
            localStorage.setItem('sb_username', fullName);
            localStorage.setItem('sb_user_id', 'local_' + emailInput.value.trim().toLowerCase());
            try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
            window.location.href = 'dashboard.html';
          }
        } catch (err) {
          showError('email', 'An error occurred during signup.');
        } finally {
          if (textSpan) textSpan.style.display = 'inline-flex';
          if (loadingSpan) loadingSpan.style.display = 'none';
          btn.disabled = false;
        }
      });
    }

    // 5. Google / GitHub OAuth Trigger via Supabase
    const googleBtns = document.querySelectorAll('#google-login, #google-signup');
    googleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (supabase) {
          const redirectTo = new URL('dashboard.html', window.location.href).href;
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
          });
        } else {
          localStorage.setItem('sb_auth', 'true');
          localStorage.setItem('sb_username', 'Google User');
          localStorage.setItem('sb_user_id', 'local_google');
          try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
          window.location.href = 'dashboard.html';
        }
      });
    });

    const githubBtns = document.querySelectorAll('#github-login, #github-signup');
    githubBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (supabase) {
          const redirectTo = new URL('dashboard.html', window.location.href).href;
          await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo }
          });
        } else {
          localStorage.setItem('sb_auth', 'true');
          localStorage.setItem('sb_username', 'GitHub User');
          localStorage.setItem('sb_user_id', 'local_github');
          try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
          window.location.href = 'dashboard.html';
        }
      });
    });
  });

})();
