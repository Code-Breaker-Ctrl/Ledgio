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
    // Prevent default mini-infobar on mobile
    e.preventDefault();
    deferredPrompt = e;

    // Reveal Install Buttons across the UI
    const installBtns = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn, #landing-install-btn');
    installBtns.forEach(btn => {
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          if (window.showToast) {
            window.showToast('Installing Ledgio to your device...', 'success');
          }
        }
        deferredPrompt = null;
        installBtns.forEach(b => b.style.display = 'none');
      });
    });
  });

  // 3. App Installed Celebration
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtns = document.querySelectorAll('.pwa-install-btn, #pwa-install-btn, #landing-install-btn');
    installBtns.forEach(b => b.style.display = 'none');
    
    if (window.showToast) {
      window.showToast('🎉 Ledgio installed successfully! Open it from your desktop or home screen.', 'success');
    }
  });

  // 4. Online / Offline Connectivity Monitor
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
