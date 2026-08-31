'use strict';

(function() {
  // Initialize Supabase Client with explicit persistent storage
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
      window.supabaseClient = supabase;
    } catch (err) {
      console.warn('Supabase initialization error:', err);
    }
  }

  // Global logout function available before auth guard
  window.logout = async function() {
    console.log('[Ledgio Auth] Logging out user and clearing local credentials...');
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error signing out from Supabase:', e);
      }
    }
    localStorage.removeItem('sb_auth');
    localStorage.removeItem('sb_username');
    localStorage.removeItem('sb_user_id');
    try { localStorage.removeItem('smartBudgetData'); } catch (e) {}
    sessionStorage.setItem('just_logged_out', 'true');
    window.location.replace('index.html');
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
      if (hasLocalAuth) {
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
      if (isDashboard && !hasLocalAuth) {
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
        localStorage.removeItem('sb_auth');
        localStorage.removeItem('sb_user_id');
        localStorage.removeItem('sb_username');
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
          await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/dashboard.html' }
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
          await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo: window.location.origin + '/dashboard.html' }
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
