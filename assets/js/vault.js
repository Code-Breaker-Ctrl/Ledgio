/**
 * Ledgio — Private Vault, Device PIN Lock & Privacy Shield Engine
 * assets/js/vault.js
 *
 * Provides:
 * - 4-digit device PIN passcode setup, verification, and change
 * - Salted cryptographic PIN hashing with non-secure fallback
 * - WebAuthn biometric unlock (fingerprint / platform authenticator)
 * - Anti-brute-force lockout and cooldown tracking
 * - Device-local privacy shield / stealth mode toggling and element masking
 * - Inactivity auto-lock timer and Page Visibility background lock
 * - Device-local vault configuration persistence per user (ledgio_vault_<uid>)
 * - Lock screen, PIN pad, and vault settings UI controller
 */

(function () {
  'use strict';

  // Private Vault & Security State
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
  let lastLockKeyTime = 0;
  let lastLockKey = '';
  let isVerifyingPin = false;
  let isChangingPin = false;
  let isSettingUpPin = false;
  let lastSetupKeyTime = 0;
  let lastSetupKey = '';

  // Host Application Bridge
  const vaultBridge = {
    getUserId: () => {
      if (typeof window.getUserId === 'function') return window.getUserId();
      return localStorage.getItem('sb_user_id') || 'default_user';
    },
    getCurrentUser: () => (window.__ledgio_currentUser || window.currentUser || null),
    refreshUI: () => {
      if (typeof window.refreshUI === 'function') return window.refreshUI();
    },
    updateNetWorthUI: () => {
      if (typeof window.updateNetWorthUI === 'function') return window.updateNetWorthUI();
    },
    updateUserProfileDropdownContent: () => {
      if (typeof window.updateUserProfileDropdownContent === 'function') return window.updateUserProfileDropdownContent();
    },
    formatCurrency: (val, bypass) => {
      if (typeof window.formatCurrency === 'function') return window.formatCurrency(val, bypass);
      return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    showToast: (msg, type) => {
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      console.log(`[Toast ${type || 'info'}] ${msg}`);
    },
    showConfirm: async (msg) => {
      if (typeof window.showConfirm === 'function') return await window.showConfirm(msg);
      return window.confirm(msg);
    },
    broadcastSyncEvent: (type, payload) => {
      if (typeof window.broadcastSyncEvent === 'function') return window.broadcastSyncEvent(type, payload);
      if (window.__ledgio_broadcastSyncEvent) return window.__ledgio_broadcastSyncEvent(type, payload);
    },
    onStealthChange: (isActive) => {},
    isDevOrTest: false
  };

  function configure(customConfig = {}) {
    Object.assign(vaultBridge, customConfig);
  }

  function isQuotaExceededError(error) {
    if (!error) return false;
    if (typeof window.isQuotaExceededError === 'function') return window.isQuotaExceededError(error);
    return Boolean(
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      String(error.message || '').toLowerCase().includes('quota')
    );
  }

  // =========================================================================
  // Vault Config Persistence
  // =========================================================================

  function getVaultStorageKey(userId) {
    const uid = userId || vaultBridge.getUserId();
    return `ledgio_vault_${uid}`;
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
      const storedStealth = localStorage.getItem(`ledgio_stealth_${vaultBridge.getUserId()}`);
      if (storedStealth !== null) {
        isStealthModeActive = (storedStealth === 'true');
      } else if (vaultConfig.stealthMode) {
        isStealthModeActive = true;
      }
      window.isStealthModeActive = isStealthModeActive;
      window.__ledgio_stealthMode = isStealthModeActive;
      if (typeof vaultBridge.onStealthChange === 'function') {
        vaultBridge.onStealthChange(isStealthModeActive);
      }
    } catch (e) {
      console.warn('[Ledgio Vault] Error loading vault config:', e);
    }
    return vaultConfig;
  }

  function saveVaultConfig() {
    try {
      localStorage.setItem(getVaultStorageKey(), JSON.stringify(vaultConfig));
      localStorage.setItem(`ledgio_stealth_${vaultBridge.getUserId()}`, isStealthModeActive ? 'true' : 'false');
    } catch (e) {
      console.error('[Ledgio Vault] Error saving vault config:', e);
      if (isQuotaExceededError(e)) {
        vaultBridge.showToast('Local storage full — export your data or remove old records', 'error');
      }
    }
  }

  function resetVaultConfig(uid) {
    vaultConfig = {
      pinEnabled: false,
      pinHash: null,
      pinSalt: null,
      stealthMode: false,
      autoLockTimeout: 3,
      biometricEnabled: false,
      biometricCredentialId: null
    };
    isVaultLocked = false;
    const targetUid = uid || vaultBridge.getUserId();
    try { localStorage.removeItem(`ledgio_vault_${targetUid}`); } catch (e) {}
    try { localStorage.removeItem('ledgio_vault_default_user'); } catch (e) {}
    updateVaultSettingsUI();
  }

  // =========================================================================
  // Cryptographic & Hash Helpers
  // =========================================================================

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

  // =========================================================================
  // WebAuthn Biometric Authenticator Helpers
  // =========================================================================

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
      vaultBridge.showToast('Please set a 4-digit PIN first as your primary passkey', 'warning');
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = vaultBridge.getUserId() || 'ledgio_vault_user';
      const userBytes = new TextEncoder().encode(userId);
      const curUser = vaultBridge.getCurrentUser();

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'Ledgio Vault',
            id: window.location.hostname
          },
          user: {
            id: userBytes,
            name: (curUser && curUser.email) ? curUser.email : 'ledgio_user',
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
        vaultBridge.showToast('Fingerprint unlock enrolled successfully', 'success');
        return true;
      }
    } catch (err) {
      console.warn('[Ledgio Vault] Biometric enrollment error:', err);
      vaultConfig.biometricEnabled = false;
      vaultConfig.biometricCredentialId = null;
      saveVaultConfig();
      updateVaultSettingsUI();
      if (err.name === 'NotAllowedError') {
        vaultBridge.showToast('Biometric setup was cancelled', 'info');
      } else {
        vaultBridge.showToast('Device biometric sensor unavailable or error occurred', 'error');
      }
    }
    return false;
  }

  async function authenticateWithBiometrics() {
    if (!vaultConfig.biometricEnabled || !vaultConfig.biometricCredentialId) return false;
    if (Date.now() < lockoutTimestamp) {
      vaultBridge.showToast('PIN cooldown active. Please wait.', 'error');
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
        vaultBridge.showToast('🔒 Private Vault Unlocked with Biometrics', 'success');
        return true;
      }
    } catch (err) {
      console.warn('[Ledgio Vault] Biometric verification error:', err);
      if (err.name !== 'NotAllowedError') {
        vaultBridge.showToast('Biometric verification failed. Please enter your PIN.', 'info');
      }
    }
    return false;
  }

  // =========================================================================
  // Vault Settings UI Controller
  // =========================================================================

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
    vaultBridge.updateUserProfileDropdownContent();
  }

  // =========================================================================
  // PIN Lock Screen & Touch Numpad Controller
  // =========================================================================

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
        vaultBridge.showToast(`Cooldown active. Please wait ${remainingSec}s`, 'error');
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
        vaultBridge.showToast('🔒 Private Vault Unlocked', 'success');
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
          vaultBridge.showToast('Too many attempts. Cooldown for 30s', 'error');
        } else {
          if (errText) errText.textContent = `Incorrect PIN (${5 - failedPinAttempts} attempts left).`;
          if (errBanner) errBanner.style.display = 'flex';
          vaultBridge.showToast(`Incorrect PIN (${5 - failedPinAttempts} attempts left)`, 'error');
        }

        setTimeout(() => {
          currentEnteredPin = '';
          updatePinDots('lock');
          isVerifyingPin = false;
        }, 700);
      }
    } catch (err) {
      console.error('[Ledgio Vault] Verification error:', err);
      vaultBridge.showToast('Error verifying PIN. Please try again.', 'error');
      currentEnteredPin = '';
      updatePinDots('lock');
      isVerifyingPin = false;
    }
  }

  // =========================================================================
  // PIN Setup & Change Flow
  // =========================================================================

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
          vaultBridge.showToast('Incorrect current PIN', 'error');

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
          vaultBridge.showToast(wasChanging ? '✅ Vault PIN changed successfully!' : '✅ 4-Digit Device PIN successfully enabled!', 'success');
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
      console.error('[Ledgio Vault] Setup error:', err);
      vaultBridge.showToast('Error setting PIN. Please try again.', 'error');
      currentEnteredPin = '';
      updatePinDots('setup');
      isSettingUpPin = false;
    }
  }

  // =========================================================================
  // Stealth Mode / Privacy Shield Controller
  // =========================================================================

  function setStealthMode(val) {
    isStealthModeActive = Boolean(val);
    window.isStealthModeActive = isStealthModeActive;
    window.__ledgio_stealthMode = isStealthModeActive;
    if (typeof vaultBridge.onStealthChange === 'function') {
      vaultBridge.onStealthChange(isStealthModeActive);
    }
  }

  function toggleStealthMode(forceState, broadcast = true) {
    if (typeof forceState === 'boolean') {
      isStealthModeActive = forceState;
    } else {
      isStealthModeActive = !isStealthModeActive;
    }

    window.isStealthModeActive = isStealthModeActive;
    window.__ledgio_stealthMode = isStealthModeActive;
    if (typeof vaultBridge.onStealthChange === 'function') {
      vaultBridge.onStealthChange(isStealthModeActive);
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
    vaultBridge.refreshUI();

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

    vaultBridge.updateNetWorthUI();

    // Update loan settlement modal if open
    const settleModal = document.getElementById('loan-settlement-modal');
    if (settleModal && settleModal.style.display === 'flex') {
      const pEl = document.getElementById('settlement-target-principal');
      const oEl = document.getElementById('settlement-target-outstanding');
      if (pEl) pEl.classList.toggle('stealth-masked', isStealthModeActive);
      if (oEl) oEl.classList.toggle('stealth-masked', isStealthModeActive);
      if (typeof window.updateSettlementPreview === 'function') {
        window.updateSettlementPreview();
      }
    }

    // Update loan history modal if open
    const historyModal = document.getElementById('loan-history-modal');
    if (historyModal && historyModal.style.display === 'flex' && historyModal.dataset.loanId) {
      if (typeof window.openLoanHistoryModal === 'function') {
        window.openLoanHistoryModal(historyModal.dataset.loanId);
      }
    }

    if (broadcast) {
      vaultBridge.broadcastSyncEvent('STEALTH_TOGGLED', {
        isStealth: isStealthModeActive,
        userId: vaultBridge.getUserId()
      });
    }
  }

  // =========================================================================
  // Inactivity Auto-Lock & Page Visibility Auto-Lock
  // =========================================================================

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
  // Event Listeners Wiring
  // =========================================================================

  function setupVaultEventListeners() {
    const isDev = Boolean(
      (typeof vaultBridge.isDevOrTest === 'function' ? vaultBridge.isDevOrTest() : vaultBridge.isDevOrTest) ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'))
    );

    if (isDev) {
      window.__ledgio_handleNumpad = handleNumpadKey;
      window.__ledgio_showLockScreen = () => showLockScreen();
      window.__ledgio_hideLockScreen = () => hideLockScreen();
      window.__ledgio_toggleStealthMode = (f, b) => toggleStealthMode(f, b);
      window.__ledgio_loadVaultConfig = () => loadVaultConfig();
      window.__ledgio_saveVaultConfig = () => saveVaultConfig();
      window.__ledgio_hashPin = (p, s) => hashPin(p, s);
    }

    try {
      // Stealth Mode Header Button & Double-Click Toggles
      document.getElementById('stealth-mode-btn')?.addEventListener('click', () => toggleStealthMode());
      document.querySelectorAll('.summary-card, #monthly-income-card, #net-worth-card').forEach(card => {
        card.addEventListener('dblclick', () => toggleStealthMode());
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
            vaultBridge.showToast('🔒 4-Digit PIN protection activated', 'success');
          }
        } else {
          const confirmDisable = await vaultBridge.showConfirm('Disable 4-Digit Device PIN protection? Your financial vault will no longer require a passcode on entry, and your fingerprint enrollment will also be removed.');
          if (confirmDisable) {
            vaultConfig.pinEnabled = false;
            vaultConfig.pinHash = null;
            vaultConfig.pinSalt = null;
            vaultConfig.biometricEnabled = false;
            vaultConfig.biometricCredentialId = null;
            saveVaultConfig();
            localStorage.removeItem('ledgio_vault_default_user');
            updateVaultSettingsUI();
            vaultBridge.showToast('PIN protection and biometrics disabled', 'info');
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
            vaultBridge.showToast('Please set a 4-digit PIN first as your primary passkey', 'warning');
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
          vaultBridge.showToast('Biometric unlock disabled', 'info');
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
        vaultBridge.showToast('Private vault preferences saved', 'success');
      });

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

      document.getElementById('cancel-set-pin-btn')?.addEventListener('click', resetSetupPinState);
      document.getElementById('close-set-pin-btn')?.addEventListener('click', resetSetupPinState);

      // Reset Vault PIN from PIN Lock Screen
      document.getElementById('vault-reset-pin-btn')?.addEventListener('click', async () => {
        const confirmed = await vaultBridge.showConfirm('Reset your 4-digit Vault PIN? This will disable device PIN lock so you can access your ledger.');
        if (confirmed) {
          vaultConfig.pinEnabled = false;
          vaultConfig.pinHash = null;
          vaultConfig.pinSalt = null;
          vaultConfig.biometricEnabled = false;
          vaultConfig.biometricCredentialId = null;
          saveVaultConfig();
          const userId = vaultBridge.getUserId();
          localStorage.removeItem('ledgio_vault_' + userId);
          localStorage.removeItem('ledgio_vault_default_user');
          hideLockScreen();
          updateVaultSettingsUI();
          vaultBridge.showToast('Vault PIN reset. You can set a new PIN in Settings → Private Vault.', 'info');
        }
      });

      // Emergency Sign Out from PIN Lock Screen
      document.getElementById('vault-emergency-logout-btn')?.addEventListener('click', () => {
        const userId = vaultBridge.getUserId();
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

    } catch (e) {
      console.warn('[Ledgio Vault] Error setting up event listeners:', e);
    }
  }

  // =========================================================================
  // Public Namespace & Exports
  // =========================================================================

  const LedgioVault = {
    configure,
    loadVaultConfig,
    saveVaultConfig,
    resetVaultConfig,
    getVaultStorageKey,
    getVaultConfig: () => vaultConfig,
    isVaultProtected: () => Boolean(vaultConfig && vaultConfig.pinEnabled && vaultConfig.pinHash),
    isVaultLocked: () => isVaultLocked,
    setVaultLocked: (v) => { isVaultLocked = Boolean(v); },
    isStealthModeActive: () => isStealthModeActive,
    setStealthMode,
    toggleStealthMode,
    hashPin,
    generateSalt,
    checkBiometricSupport,
    enrollBiometrics,
    authenticateWithBiometrics,
    updateVaultSettingsUI,
    showLockScreen,
    hideLockScreen,
    openSetupPinModal,
    resetSetupPinState,
    handleNumpadKey,
    verifyLockPin,
    handleSetupPinInput,
    updatePinDots,
    initInactivityTimer,
    initVaultVisibilityAutoLock,
    setupVaultEventListeners
  };

  // Expose namespace & global backwards compatibility mirrors
  window.LedgioVault = LedgioVault;
  window.toggleStealthMode = toggleStealthMode;
  window.loadVaultConfig = loadVaultConfig;
  window.saveVaultConfig = saveVaultConfig;
  window.showLockScreen = showLockScreen;
  window.hideLockScreen = hideLockScreen;
  window.updateVaultSettingsUI = updateVaultSettingsUI;
  window.initInactivityTimer = initInactivityTimer;
  window.initVaultVisibilityAutoLock = initVaultVisibilityAutoLock;

})();
