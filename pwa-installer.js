/**
 * Ledgio — PWA Installation & Offline Engine
 */

(function() {
  'use strict';

  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          // Check for worker updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Ledgio: New version available!');
                  if (window.showToast) {
                    window.showToast('New update available! Refresh to apply.', 'info');
                  }
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('ServiceWorker registration error:', err);
        });
    });
  }

  // 2. Native PWA Install Prompt Handling
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    console.log('Ledgio: Native PWA install prompt ready.');

    // Ensure all install buttons are visible and active
    const installBtns = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn, #landing-install-btn');
    installBtns.forEach(btn => {
      btn.style.display = 'inline-flex';
    });
  });

  // 3. Fallback Instructions Modal Builder
  function showInstallGuideModal() {
    let modal = document.getElementById('pwa-install-guide-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pwa-install-guide-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 20px;
      `;

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isAndroid = /Android/.test(navigator.userAgent);

      let guideContent = '';
      if (isIOS) {
        guideContent = `
          <div style="display:flex; align-items:flex-start; gap:14px; margin-bottom:16px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">1</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Tap the <strong>Share</strong> button <i class="fas fa-arrow-up-from-bracket" style="color:#38bdf8; margin:0 4px;"></i> at the bottom of Safari.</p>
          </div>
          <div style="display:flex; align-items:flex-start; gap:14px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">2</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Scroll down and tap <strong>Add to Home Screen</strong> <i class="fas fa-plus-square" style="color:#10b981; margin:0 4px;"></i>.</p>
          </div>
        `;
      } else if (isAndroid) {
        guideContent = `
          <div style="display:flex; align-items:flex-start; gap:14px; margin-bottom:16px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">1</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Tap the browser menu <strong style="font-size:1.1rem;">⋮</strong> in the top right corner.</p>
          </div>
          <div style="display:flex; align-items:flex-start; gap:14px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">2</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Tap <strong>Install App</strong> or <strong>Add to Home screen</strong>.</p>
          </div>
        `;
      } else {
        guideContent = `
          <div style="display:flex; align-items:flex-start; gap:14px; margin-bottom:16px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">1</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Look at the right side of your browser's address bar.</p>
          </div>
          <div style="display:flex; align-items:flex-start; gap:14px;">
            <span style="width:36px; height:36px; border-radius:10px; background:rgba(16,185,129,0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">2</span>
            <p style="margin:0; font-size:0.95rem; color:#e2e8f0;">Click the <strong>Install Ledgio</strong> icon <i class="fas fa-download" style="color:#38bdf8; margin:0 4px;"></i> or open browser menu <strong>⋮ / ≡ → Install Ledgio</strong>.</p>
          </div>
        `;
      }

      modal.innerHTML = `
        <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.15); border-radius:24px; max-width:440px; width:100%; padding:32px 28px; box-shadow:0 25px 60px rgba(0,0,0,0.6); position:relative; color:#fff; font-family:system-ui, -apple-system, sans-serif;">
          <button id="close-pwa-modal" style="position:absolute; top:18px; right:18px; background:rgba(255,255,255,0.1); border:none; color:#94a3b8; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.9rem; transition:all 0.2s ease;">✕</button>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
            <img src="icon-192.png" alt="Ledgio" style="width:48px; height:48px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
            <div>
              <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#fff;">Install Ledgio App</h3>
              <p style="margin:2px 0 0; font-size:0.85rem; color:#94a3b8;">100% Private • Works Offline</p>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; margin-bottom:24px;">
            ${guideContent}
          </div>
          <button id="got-it-pwa-btn" style="width:100%; padding:12px; background:#10b981; color:#09090b; font-weight:700; border:none; border-radius:12px; font-size:0.95rem; cursor:pointer; transition:opacity 0.2s ease;">Got It</button>
        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => { modal.style.display = 'none'; };
      modal.querySelector('#close-pwa-modal')?.addEventListener('click', closeModal);
      modal.querySelector('#got-it-pwa-btn')?.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    modal.style.display = 'flex';
  }

  // 4. Trigger Install Action
  async function triggerInstallFlow() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (window.showToast) {
            window.showToast('Installing Ledgio to your device...', 'success');
          }
        }
        deferredPrompt = null;
      } catch (err) {
        console.warn('Install prompt error:', err);
        showInstallGuideModal();
      }
    } else {
      // Browser didn't provide deferred prompt or is iOS/Desktop manual install
      showInstallGuideModal();
    }
  }

  // Attach click handlers across all install triggers
  document.addEventListener('DOMContentLoaded', () => {
    const installBtns = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn, #landing-install-btn, a[href="#install"]');
    installBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerInstallFlow();
      });
    });
  });

  // 5. App Installed Celebration
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtns = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn, #landing-install-btn');
    installBtns.forEach(b => b.style.display = 'none');
    
    const modal = document.getElementById('pwa-install-guide-modal');
    if (modal) modal.style.display = 'none';

    if (window.showToast) {
      window.showToast('🎉 Ledgio installed as a standalone app! Launch it from your home screen or apps menu.', 'success');
    }
  });

  // 6. Online / Offline Connectivity Monitor
  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const offlineIndicator = document.getElementById('offline-indicator');

    if (offlineIndicator) {
      if (!isOnline) {
        offlineIndicator.style.display = 'inline-flex';
        offlineIndicator.innerHTML = '<i class="fas fa-bolt"></i> <span>Offline Mode</span>';
        offlineIndicator.className = 'status-indicator-pill offline';
      } else {
        offlineIndicator.style.display = 'inline-flex';
        offlineIndicator.innerHTML = '<i class="fas fa-circle-check"></i> <span>Cloud Synced</span>';
        offlineIndicator.className = 'status-indicator-pill online';
        setTimeout(() => {
          if (navigator.onLine && offlineIndicator) {
            offlineIndicator.style.display = 'none';
          }
        }, 3000);
      }
    }
  }

  window.addEventListener('online', () => {
    updateNetworkStatus();
    if (window.showToast) {
      window.showToast('🟢 Internet restored — Synced with cloud', 'success');
    }
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    if (window.showToast) {
      window.showToast('⚡ You are offline. Ledgio is saving everything securely on your device.', 'info');
    }
  });

  document.addEventListener('DOMContentLoaded', updateNetworkStatus);

})();
