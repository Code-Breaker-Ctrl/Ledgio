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
    var stage = section.querySelector('.motion-stage');
    if (!tabs.length || !scenes.length) return;

    var activeIdx = 0;
    var duration = 4800;
    var startTime = 0;
    var animFrame = null;
    var isPaused = false;
    var isVisible = false;
    var sceneTimeouts = [];

    // Ensure cursor is hidden initially before animation starts
    if (cursor) {
      cursor.style.opacity = '0';
    }

    var targetRects = {};

    function updateCachedTargets() {
      if (!stage) return;
      var stageRect = stage.getBoundingClientRect();

      var btn0 = document.getElementById('motion-submit-btn') || stage.querySelector('.motion-submit-btn');
      if (btn0) {
        var r0 = btn0.getBoundingClientRect();
        targetRects.scene0 = {
          x: Math.round(r0.left - stageRect.left + r0.width / 2),
          y: Math.round(r0.top - stageRect.top + r0.height / 2)
        };
      }

      var bar1 = document.getElementById('motion-limit-bar');
      if (bar1) {
        var r1 = bar1.getBoundingClientRect();
        targetRects.scene1 = {
          x: Math.round(r1.left - stageRect.left + r1.width * 0.75),
          y: Math.round(r1.top - stageRect.top + r1.height / 2)
        };
      }

      var chip2 = document.getElementById('motion-goal-chip') || stage.querySelector('.motion-chip-btn');
      if (chip2) {
        var r2 = chip2.getBoundingClientRect();
        targetRects.scene2 = {
          x: Math.round(r2.left - stageRect.left + r2.width / 2),
          y: Math.round(r2.top - stageRect.top + r2.height / 2)
        };
      }

      var bar3 = document.getElementById('motion-loan-bar');
      if (bar3) {
        var r3 = bar3.getBoundingClientRect();
        targetRects.scene3 = {
          x: Math.round(r3.left - stageRect.left + r3.width * 0.7),
          y: Math.round(r3.top - stageRect.top + r3.height / 2)
        };
      }
    }

    window.addEventListener('resize', updateCachedTargets, { passive: true });

    function clearSceneTimeouts() {
      while (sceneTimeouts.length > 0) {
        clearTimeout(sceneTimeouts.pop());
      }
    }

    function triggerRipple(x, y) {
      if (!ripple) return;
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.remove('animate');
      void ripple.offsetWidth;
      ripple.classList.add('animate');
    }

    function switchScene(idx) {
      clearSceneTimeouts();
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
        } else {
          s.classList.remove('active');
        }
      });

      updateCachedTargets();
      runSceneTimeline(idx);
      startTime = performance.now();
    }

    function runSceneTimeline(idx) {
      if (isReducedMotion || !cursor) {
        if (cursor) cursor.style.opacity = '0';
        return;
      }

      var target = targetRects['scene' + idx];
      if (!target) {
        updateCachedTargets();
        target = targetRects['scene' + idx];
      }

      cursor.style.opacity = '1';

      if (idx === 0) {
        cursor.style.transform = 'translate(60px, 60px)';
        var t0a = setTimeout(function() {
          var destX = target ? target.x : 280;
          var destY = target ? target.y : 180;
          cursor.style.transform = 'translate(' + destX + 'px, ' + destY + 'px)';
          var t0b = setTimeout(function() {
            triggerRipple(destX, destY);
          }, 600);
          sceneTimeouts.push(t0b);
        }, 500);
        sceneTimeouts.push(t0a);
      } else if (idx === 1) {
        cursor.style.transform = 'translate(80px, 80px)';
        var t1a = setTimeout(function() {
          var destX1 = target ? target.x : 260;
          var destY1 = target ? target.y : 140;
          cursor.style.transform = 'translate(' + destX1 + 'px, ' + destY1 + 'px)';
          var t1b = setTimeout(function() {
            triggerRipple(destX1, destY1);
            var bar = document.getElementById('motion-limit-bar');
            var chip = document.getElementById('motion-limit-warning');
            if (bar) {
              bar.style.width = '100%';
              bar.style.backgroundColor = '#f43f5e';
            }
            if (chip) chip.style.display = 'inline-flex';
          }, 600);
          sceneTimeouts.push(t1b);
        }, 500);
        sceneTimeouts.push(t1a);
      } else if (idx === 2) {
        cursor.style.transform = 'translate(80px, 80px)';
        var t2a = setTimeout(function() {
          var destX2 = target ? target.x : 300;
          var destY2 = target ? target.y : 150;
          cursor.style.transform = 'translate(' + destX2 + 'px, ' + destY2 + 'px)';
          var t2b = setTimeout(function() {
            triggerRipple(destX2, destY2);
            var val = document.getElementById('motion-goal-val');
            var fill = document.getElementById('motion-goal-fill');
            if (val) val.textContent = '\u20B91,50,000 / \u20B91,00,000';
            if (fill) fill.style.width = '50%';
          }, 600);
          sceneTimeouts.push(t2b);
        }, 500);
        sceneTimeouts.push(t2a);
      } else if (idx === 3) {
        cursor.style.transform = 'translate(80px, 80px)';
        var t3a = setTimeout(function() {
          var destX3 = target ? target.x : 280;
          var destY3 = target ? target.y : 140;
          cursor.style.transform = 'translate(' + destX3 + 'px, ' + destY3 + 'px)';
          var t3b = setTimeout(function() {
            triggerRipple(destX3, destY3);
            var loanVal = document.getElementById('motion-loan-val');
            var loanBar = document.getElementById('motion-loan-bar');
            if (loanVal) loanVal.textContent = '\u20B912,500';
            if (loanBar) loanBar.style.width = '50%';
          }, 600);
          sceneTimeouts.push(t3b);
        }, 500);
        sceneTimeouts.push(t3a);
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
          if (isVisible) {
            updateCachedTargets();
          }
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
        { code: 'INR', amt: '\u20B983,000' },
        { code: 'USD', amt: '$1,000' },
        { code: 'EUR', amt: '\u20AC920' },
        { code: 'GBP', amt: '\u00A3785' }
      ];
      var curIdx = 0;
      currPill.addEventListener('click', function() {
        curIdx = (curIdx + 1) % currencies.length;
        currAmt.textContent = currencies[curIdx].amt;
        currCode.textContent = currencies[curIdx].code;
      });
    }
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
      var note = noteInput.value.trim() || 'Kirana store';

      if (amt <= 0) return;

      currentBalance -= amt;
      if (balanceEl) {
        balanceEl.textContent = '\u20B9' + currentBalance.toLocaleString('en-IN');
      }

      var row = document.createElement('div');
      row.className = 'plug-tx-item';

      var dateStr = 'Just now';
      var iconClass = isOnline ? 'fas fa-check sync-tick-icon' : 'fas fa-clock sync-pending-icon';
      var iconTitle = isOnline ? 'Synced' : 'Waiting for sync';

      row.innerHTML = '<span class="plug-tx-date">' + dateStr + '</span>' +
        '<div class="plug-tx-desc-col">' +
          '<div class="plug-tx-note">' + note + '</div>' +
          '<div class="plug-tx-cat">' + cat + '</div>' +
        '</div>' +
        '<div class="plug-tx-amt tx-out tabular-nums">\u2212\u20B9' + amt.toLocaleString('en-IN') + '</div>' +
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

  function initSimulatorSliders() {
    var incomeSlider = document.getElementById('sim-income');
    var expensesSlider = document.getElementById('sim-expenses');
    function updateFill(slider) {
      if (!slider) return;
      var min = parseFloat(slider.min) || 0;
      var max = parseFloat(slider.max) || 100;
      var val = parseFloat(slider.value) || 0;
      var pct = ((val - min) / (max - min)) * 100;
      slider.style.setProperty('--fill', pct.toFixed(1) + '%');
    }
    if (incomeSlider) {
      updateFill(incomeSlider);
      incomeSlider.addEventListener('input', function() { updateFill(incomeSlider); });
    }
    if (expensesSlider) {
      updateFill(expensesSlider);
      expensesSlider.addEventListener('input', function() { updateFill(expensesSlider); });
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    initHeroSpotlightAndTilt();
    initMotionTour();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
    initSimulatorSliders();
  });
})();
