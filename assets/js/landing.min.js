(function() {
  'use strict';

  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function initHeroSpotlightAndTilt() {
    var hero = document.getElementById('hero');
    var spotlight = document.getElementById('hero-spotlight');
    var frame = document.getElementById('hero-product-frame');
    if (!hero || !spotlight) return;

    if (isReducedMotion || isTouch) return;

    var heroRect = null;
    var rafPending = false;
    var mouseX = 0;
    var mouseY = 0;

    function updateHeroRect() {
      heroRect = hero.getBoundingClientRect();
    }

    updateHeroRect();
    window.addEventListener('scroll', updateHeroRect, { passive: true });
    window.addEventListener('resize', updateHeroRect, { passive: true });

    if (window.ResizeObserver) {
      new ResizeObserver(updateHeroRect).observe(hero);
    }

    hero.addEventListener('pointerenter', function() {
      spotlight.style.opacity = '1';
      if (frame) frame.style.willChange = 'transform';
    });

    hero.addEventListener('pointerleave', function() {
      spotlight.style.opacity = '0';
      if (frame) {
        frame.style.willChange = 'auto';
        frame.style.transform = 'perspective(1400px) rotateX(0deg) rotateY(0deg)';
      }
    });

    hero.addEventListener('pointermove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(function() {
          rafPending = false;
          if (!heroRect) return;

          var relX = mouseX - heroRect.left;
          var relY = mouseY - heroRect.top;

          var pctX = Math.round((relX / heroRect.width) * 100);
          var pctY = Math.round((relY / heroRect.height) * 100);

          spotlight.style.setProperty('--x', pctX + '%');
          spotlight.style.setProperty('--y', pctY + '%');

          if (frame) {
            var normX = (relX / heroRect.width) - 0.5;
            var normY = (relY / heroRect.height) - 0.5;
            var tiltY = (normX * 4).toFixed(2);
            var tiltX = (-normY * 3.5).toFixed(2);
            frame.style.transform = 'perspective(1400px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
          }
        });
      }
    });
  }

  function initMotionTour() {
    var section = document.getElementById('motion');
    if (!section) return;

    var tabs = section.querySelectorAll('.motion-tab-btn');
    var scenes = section.querySelectorAll('.motion-scene');
    var cursor = document.getElementById('motion-cursor');
    var ripple = document.getElementById('motion-ripple');
    if (!tabs.length || !scenes.length) return;

    var activeIdx = 0;
    var duration = 4800;
    var startTime = 0;
    var animFrame = null;
    var isPaused = false;
    var isVisible = false;

    function triggerRipple(x, y) {
      if (!ripple) return;
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.remove('animate');
      void ripple.offsetWidth;
      ripple.classList.add('animate');
    }

    function switchScene(idx) {
      activeIdx = idx;
      tabs.forEach(function(t, i) {
        if (i === idx) {
          t.classList.add('active');
          t.setAttribute('aria-selected', 'true');
        } else {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
          t.style.setProperty('--progress', '0%');
        }
      });

      scenes.forEach(function(s, i) {
        if (i === idx) {
          s.classList.add('active');
          runSceneTimeline(idx);
        } else {
          s.classList.remove('active');
        }
      });
      startTime = performance.now();
    }

    function runSceneTimeline(idx) {
      if (isReducedMotion) return;
      if (!cursor) return;

      if (idx === 0) {
        cursor.style.transform = 'translate(120px, 40px)';
        setTimeout(function() {
          cursor.style.transform = 'translate(360px, 90px)';
          setTimeout(function() { triggerRipple(360, 90); }, 500);
        }, 700);
      } else if (idx === 1) {
        cursor.style.transform = 'translate(220px, 160px)';
        setTimeout(function() {
          triggerRipple(220, 160);
          var bar = document.getElementById('motion-limit-bar');
          var chip = document.getElementById('motion-limit-warning');
          if (bar) {
            bar.style.width = '100%';
            bar.style.backgroundColor = '#f43f5e';
          }
          if (chip) chip.style.display = 'inline-flex';
        }, 1200);
      } else if (idx === 2) {
        cursor.style.transform = 'translate(300px, 220px)';
        setTimeout(function() {
          triggerRipple(300, 220);
          var val = document.getElementById('motion-goal-val');
          var fill = document.getElementById('motion-goal-fill');
          if (val) val.textContent = '₹50,000 / ₹1,00,000';
          if (fill) fill.style.width = '50%';
        }, 1200);
      } else if (idx === 3) {
        cursor.style.transform = 'translate(280px, 140px)';
        setTimeout(function() {
          triggerRipple(280, 140);
          var loanVal = document.getElementById('motion-loan-val');
          var loanBar = document.getElementById('motion-loan-bar');
          if (loanVal) loanVal.textContent = '₹2,500';
          if (loanBar) loanBar.style.width = '50%';
        }, 1200);
      }
    }

    tabs.forEach(function(tab, index) {
      tab.addEventListener('click', function() {
        switchScene(index);
      });
    });

    function tick(now) {
      if (!isPaused && isVisible && !isReducedMotion) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;
        var progress = Math.min((elapsed / duration) * 100, 100);
        var curTab = tabs[activeIdx];
        if (curTab) {
          curTab.style.setProperty('--progress', progress.toFixed(1) + '%');
        }

        if (elapsed >= duration) {
          var next = (activeIdx + 1) % tabs.length;
          switchScene(next);
        }
      }
      animFrame = requestAnimationFrame(tick);
    }

    if (window.IntersectionObserver) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          isVisible = entry.isIntersecting;
        });
      }, { threshold: 0.25 });
      observer.observe(section);
    } else {
      isVisible = true;
    }

    document.addEventListener('visibilitychange', function() {
      isPaused = document.hidden;
    });

    if (!isReducedMotion) {
      animFrame = requestAnimationFrame(tick);
    }
  }

  function initPaperInteractions() {
    var currPill = document.getElementById('paper-currency-pill');
    var currAmt = document.getElementById('paper-currency-amt');
    var currCode = document.getElementById('paper-currency-code');
    if (currPill && currAmt && currCode) {
      var currencies = [
        { code: 'INR', amt: '₹83,000' },
        { code: 'USD', amt: '$1,000' },
        { code: 'EUR', amt: '€920' },
        { code: 'GBP', amt: '£785' }
      ];
      var curIdx = 0;
      currPill.addEventListener('click', function() {
        curIdx = (curIdx + 1) % currencies.length;
        currAmt.textContent = currencies[curIdx].amt;
        currCode.textContent = currencies[curIdx].code;
      });
    }

    var catChips = document.querySelectorAll('.paper-cat-chip');
    catChips.forEach(function(chip) {
      chip.addEventListener('mouseenter', function() {
        var sub = chip.querySelector('.cat-spend-sub');
        if (sub) sub.style.display = 'inline';
      });
      chip.addEventListener('mouseleave', function() {
        var sub = chip.querySelector('.cat-spend-sub');
        if (sub) sub.style.display = 'none';
      });
    });

    var donutSlices = document.querySelectorAll('.mini-donut-slice');
    var legendRows = document.querySelectorAll('.mini-donut-legend-row');
    donutSlices.forEach(function(slice) {
      slice.addEventListener('mouseenter', function() {
        var cat = slice.getAttribute('data-cat');
        legendRows.forEach(function(row) {
          if (row.getAttribute('data-cat') === cat) {
            row.style.fontWeight = '700';
            row.style.color = '#10b981';
          }
        });
      });
      slice.addEventListener('mouseleave', function() {
        legendRows.forEach(function(row) {
          row.style.fontWeight = 'normal';
          row.style.color = '';
        });
      });
    });
  }

  function initPullThePlugDemo() {
    var syncBtn = document.getElementById('plug-sync-toggle-btn');
    var syncText = document.getElementById('plug-sync-text');
    var syncIcon = document.getElementById('plug-sync-icon');
    var waitingChip = document.getElementById('plug-waiting-chip');
    var waitingCount = document.getElementById('plug-waiting-count');
    var form = document.getElementById('plug-tx-form');
    var txList = document.getElementById('plug-tx-list');
    var balanceEl = document.getElementById('plug-balance-val');

    if (!syncBtn || !form || !txList) return;

    var isOnline = true;
    var pendingItems = [];
    var currentBalance = 48250;

    syncBtn.addEventListener('click', function() {
      isOnline = !isOnline;
      if (isOnline) {
        syncBtn.className = 'replica-sync-pill plug-status-pill';
        syncText.textContent = 'Cloud Synced';
        syncIcon.className = 'fas fa-circle-check';

        if (pendingItems.length > 0) {
          syncPendingItems();
        } else {
          if (waitingChip) waitingChip.style.display = 'none';
        }
      } else {
        syncBtn.className = 'replica-sync-pill offline plug-status-pill';
        syncText.textContent = 'Offline Mode';
        syncIcon.className = 'fas fa-wifi-slash';
      }
    });

    function syncPendingItems() {
      if (pendingItems.length === 0) return;
      var item = pendingItems.shift();
      if (item && item.iconEl) {
        item.iconEl.className = 'fas fa-check sync-tick-icon';
        item.iconEl.title = 'Synced';
      }
      if (waitingCount) waitingCount.textContent = pendingItems.length;
      if (pendingItems.length === 0) {
        if (waitingChip) waitingChip.style.display = 'none';
      } else {
        setTimeout(syncPendingItems, 350);
      }
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var amtInput = document.getElementById('plug-input-amt');
      var catInput = document.getElementById('plug-input-cat');
      var noteInput = document.getElementById('plug-input-note');

      var amt = parseFloat(amtInput.value) || 0;
      var cat = catInput.value || 'General';
      var note = noteInput.value.trim() || 'Quick Expense';

      if (amt <= 0) return;

      currentBalance -= amt;
      if (balanceEl) {
        balanceEl.textContent = '₹' + currentBalance.toLocaleString('en-IN');
      }

      var row = document.createElement('div');
      row.className = 'plug-tx-item';

      var dateStr = 'Just now';
      var iconClass = isOnline ? 'fas fa-check sync-tick-icon' : 'fas fa-clock sync-pending-icon';
      var iconTitle = isOnline ? 'Synced' : 'Waiting for sync';

      row.innerHTML = '<span class="plug-tx-date" style="font-size:0.75rem; color:#71717a;">' + dateStr + '</span>' +
        '<div style="min-width:0;"><div style="font-weight:600; font-size:0.86rem; color:#ffffff;">' + note + '</div>' +
        '<div style="font-size:0.74rem; color:#a1a1aa;">' + cat + '</div></div>' +
        '<div style="font-weight:700; font-variant-numeric:tabular-nums; color:#f43f5e; font-size:0.92rem;">−₹' + amt.toLocaleString('en-IN') + '</div>' +
        '<i class="' + iconClass + '" title="' + iconTitle + '"></i>';

      txList.insertBefore(row, txList.firstChild);

      var iconEl = row.querySelector('i');
      if (!isOnline) {
        pendingItems.push({ el: row, iconEl: iconEl });
        if (waitingChip) waitingChip.style.display = 'inline-flex';
        if (waitingCount) waitingCount.textContent = pendingItems.length;
      }

      amtInput.value = '';
      noteInput.value = '';
    });
  }

  function initManifestoScrollIllumination() {
    var manifesto = document.getElementById('manifesto');
    if (!manifesto) return;
    var words = manifesto.querySelectorAll('.manifesto-word');
    if (!words.length) return;

    var ticking = false;
    function updateIllumination() {
      ticking = false;
      var rect = manifesto.getBoundingClientRect();
      var h = window.innerHeight;
      if (rect.top > h || rect.bottom < 0) return;

      var progress = Math.max(0, Math.min(1, (h * 0.7 - rect.top) / (rect.height * 0.8)));
      var litCount = Math.floor(progress * words.length);

      words.forEach(function(word, idx) {
        if (idx <= litCount) {
          word.classList.add('lit');
        } else {
          word.classList.remove('lit');
        }
      });
    }

    window.addEventListener('scroll', function() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateIllumination);
      }
    }, { passive: true });
    updateIllumination();
  }

  document.addEventListener('DOMContentLoaded', function() {
    initHeroSpotlightAndTilt();
    initMotionTour();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
  });
})();
