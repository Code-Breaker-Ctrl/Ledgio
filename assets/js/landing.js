(function() {
  'use strict';

  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function triggerHaptic(duration) {
    if (isReducedMotion) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(duration || 8); } catch (e) {}
    }
  }

  function formatINR(val, prefix) {
    var p = prefix || '';
    var abs = Math.abs(val);
    var formatted = abs.toLocaleString('en-IN');
    if (val < 0 && p.indexOf('−') === -1 && p.indexOf('-') === -1) {
      return '−' + p + formatted;
    }
    return p + formatted;
  }

  function tickNumber(el, start, end, duration, prefix, suffix, decimals) {
    if (!el) return;
    var p = prefix !== undefined ? prefix : '';
    var s = suffix !== undefined ? suffix : '';
    var d = typeof decimals === 'number' ? decimals : 0;

    function formatVal(v) {
      if (d > 0) {
        return p + Number(v).toFixed(d) + s;
      }
      if (s) {
        return p + Math.round(v) + s;
      }
      return formatINR(Math.round(v), p);
    }

    if (isReducedMotion || duration <= 0) {
      el.textContent = formatVal(end);
      return;
    }

    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var easeOut = 1 - Math.pow(1 - progress, 3);
      var current = start + (end - start) * easeOut;
      el.textContent = formatVal(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatVal(end);
      }
    }
    requestAnimationFrame(step);
  }

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
            var tiltY = (normX * 0.7).toFixed(2);
            var tiltX = (-normY * 0.6).toFixed(2);
            frame.style.transform = 'perspective(1400px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';
          }
        });
      }
    });
  }

  function initHeroDashboardLiveFeed() {
    var txList = document.getElementById('replica-tx-list');
    var netBalEl = document.getElementById('hero-net-balance-val');
    var incEl = document.getElementById('hero-stat-income');
    var expEl = document.getElementById('hero-stat-expenses');
    var expSubEl = document.getElementById('hero-stat-expenses-sub');
    var safeEl = document.getElementById('hero-stat-safe');
    var savingsEl = document.getElementById('hero-stat-savings');
    var netBadge = document.getElementById('replica-chart-badge');
    var syncPill = document.querySelector('.hero-preview-stage .replica-sync-pill') || document.querySelector('.replica-sync-pill');
    if (!txList) return;

    var pool = [
      { cat: 'Chai & Snacks', badge: 'badge-dining', desc: 'Chai Tapri', amt: -20, isOut: true },
      { cat: 'UPI Transfer', badge: 'badge-salary', desc: 'UPI from Mom', amt: 500, isOut: false },
      { cat: 'Transit', badge: 'badge-bills', desc: 'Metro Card', amt: -45, isOut: true },
      { cat: 'Dining Out', badge: 'badge-dining', desc: 'Swiggy Dinner', amt: -240, isOut: true },
      { cat: 'Utilities', badge: 'badge-bills', desc: 'Mobile Recharge', amt: -299, isOut: true },
      { cat: 'Freelance', badge: 'badge-salary', desc: 'Freelance Design', amt: 2000, isOut: false },
      { cat: 'Groceries', badge: 'badge-groceries', desc: 'Nature Basket', amt: -650, isOut: true },
      { cat: 'Entertainment', badge: 'badge-dining', desc: 'BookMyShow', amt: -380, isOut: true },
      { cat: 'Repayment', badge: 'badge-salary', desc: 'Repaid by Priya', amt: 1200, isOut: false }
    ];

    var poolIdx = 0;
    var currentIncome = 50000;
    var currentExpenses = 12450;
    var currentSafe = 37550;
    var currentSavings = 75.1;
    var isPaused = false;
    var isVisible = true;

    function getNextDistinctItem() {
      var rows = txList.querySelectorAll('.replica-tx-row');
      var visibleMerchants = [];
      rows.forEach(function(r) {
        var nameEl = r.querySelector('.replica-tx-left span:last-child');
        if (nameEl) visibleMerchants.push(nameEl.textContent.trim().toLowerCase());
      });

      for (var i = 0; i < pool.length; i++) {
        var candidate = pool[(poolIdx + i) % pool.length];
        if (visibleMerchants.indexOf(candidate.desc.toLowerCase()) === -1) {
          poolIdx = (poolIdx + i + 1) % pool.length;
          return candidate;
        }
      }
      var fallback = pool[poolIdx];
      poolIdx = (poolIdx + 1) % pool.length;
      return fallback;
    }

    function addLiveRow() {
      if (isPaused || !isVisible || isReducedMotion) return;

      var item = getNextDistinctItem();

      var row = document.createElement('div');
      row.className = 'replica-tx-row tx-row-fresh';

      var amtFormatted = item.isOut ? '−₹' + Math.abs(item.amt).toLocaleString('en-IN') : '+₹' + item.amt.toLocaleString('en-IN');
      var amtClass = item.isOut ? 'replica-tx-amt tx-out' : 'replica-tx-amt tx-in';

      row.innerHTML = '<div class="replica-tx-left">' +
        '<span class="replica-cat-badge ' + item.badge + '">' + item.cat + '</span>' +
        '<span>' + item.desc + '</span>' +
        '</div>' +
        '<span class="' + amtClass + '">' + amtFormatted + '</span>';

      txList.insertBefore(row, txList.firstChild);

      var rows = txList.querySelectorAll('.replica-tx-row');
      if (rows.length > 3) {
        txList.removeChild(rows[rows.length - 1]);
      }

      if (item.isOut) {
        var oldExp = currentExpenses;
        currentExpenses += Math.abs(item.amt);
        if (expEl) tickNumber(expEl, oldExp, currentExpenses, 600, '₹');

        var oldSafe = currentSafe;
        currentSafe -= Math.abs(item.amt);
        if (safeEl) tickNumber(safeEl, oldSafe, currentSafe, 600, '₹');
        if (netBalEl) tickNumber(netBalEl, oldSafe, currentSafe, 600, '₹');
      } else {
        var oldInc = currentIncome;
        currentIncome += item.amt;
        if (incEl) tickNumber(incEl, oldInc, currentIncome, 600, '₹');

        var oldSafe2 = currentSafe;
        currentSafe += item.amt;
        if (safeEl) tickNumber(safeEl, oldSafe2, currentSafe, 600, '₹');
        if (netBalEl) tickNumber(netBalEl, oldSafe2, currentSafe, 600, '₹');
      }

      if (expSubEl && currentIncome > 0) {
        var expPct = ((currentExpenses / currentIncome) * 100).toFixed(1);
        expSubEl.textContent = expPct + '% of income';
      }

      if (savingsEl && currentIncome > 0) {
        var oldSav = currentSavings;
        currentSavings = parseFloat((((currentIncome - currentExpenses) / currentIncome) * 100).toFixed(1));
        tickNumber(savingsEl, oldSav, currentSavings, 600, '', '%', 1);
      }

      if (netBadge) {
        netBadge.textContent = '+₹' + currentSafe.toLocaleString('en-IN');
      }

      if (syncPill) {
        var icon = syncPill.querySelector('i');
        var text = syncPill.querySelector('span') || syncPill;
        if (icon) icon.className = 'fas fa-rotate fa-spin text-emerald';
        if (text) text.textContent = 'Syncing...';

        setTimeout(function() {
          if (icon) icon.className = 'fas fa-circle-check text-emerald';
          if (text) text.textContent = 'Cloud Synced';
        }, 900);
      }
    }

    var feedInterval = setInterval(addLiveRow, 7500);

    var statCards = document.querySelectorAll('.replica-stat-card');
    statCards.forEach(function(card) {
      card.addEventListener('mouseenter', function() {
        var valEl = card.querySelector('.replica-stat-value');
        if (valEl) {
          if (valEl.id === 'hero-stat-savings') {
            var raw = currentSavings || 75.1;
            tickNumber(valEl, Math.max(0, raw - 5), raw, 500, '', '%', 1);
            return;
          }
          var raw = parseInt(valEl.textContent.replace(/[^0-9]/g, ''), 10) || 0;
          if (raw > 0) {
            var prefix = valEl.textContent.indexOf('%') !== -1 ? '' : '₹';
            var suffix = valEl.textContent.indexOf('%') !== -1 ? '%' : '';
            tickNumber(valEl, Math.round(raw * 0.9), raw, 500, prefix, suffix, 0);
          }
        }
      });
    });

    document.addEventListener('visibilitychange', function() {
      isPaused = document.hidden;
    });

    var heroSec = document.getElementById('hero');
    if (heroSec && window.IntersectionObserver) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          isVisible = entry.isIntersecting;
        });
      }, { threshold: 0.1 });
      obs.observe(heroSec);
    }
  }

  function initChartScrubbing() {
    var wrap = document.getElementById('replica-chart-wrap');
    var svg = document.getElementById('replica-chart-svg');
    var curve = document.getElementById('hero-balance-curve');
    var crosshair = document.getElementById('chart-scrub-line');
    var dot = document.getElementById('chart-scrub-dot');
    var tooltip = document.getElementById('chart-scrub-tooltip');
    if (!wrap || !curve || !crosshair || !dot || !tooltip) return;

    var curveLength = 0;
    try {
      curveLength = curve.getTotalLength();
    } catch(err) {
      curveLength = 550;
    }

    function handleScrub(clientX) {
      var rect = wrap.getBoundingClientRect();
      var relX = clientX - rect.left;
      var t = Math.max(0, Math.min(1, relX / rect.width));

      var pt = { x: t * 500, y: 115 - t * 85 };
      if (curve.getPointAtLength && curveLength > 0) {
        try {
          pt = curve.getPointAtLength(t * curveLength);
        } catch(e) {}
      }

      crosshair.setAttribute('x1', pt.x);
      crosshair.setAttribute('x2', pt.x);
      crosshair.setAttribute('y1', 0);
      crosshair.setAttribute('y2', 140);
      crosshair.style.opacity = '1';

      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.style.opacity = '1';

      var day = Math.min(24, Math.max(1, Math.round(1 + t * 23)));
      var amt = Math.round(32500 + t * 15750);
      var dayStr = (day < 10 ? '0' + day : '' + day) + ' Oct';
      tooltip.textContent = dayStr + ' • ' + formatINR(amt, '₹');

      var leftPct = (pt.x / 500) * 100;
      var topPct = (pt.y / 140) * 100;
      tooltip.style.left = leftPct.toFixed(1) + '%';
      tooltip.style.top = topPct.toFixed(1) + '%';
      tooltip.style.opacity = '1';
    }

    function hideScrub() {
      crosshair.style.opacity = '0';
      dot.style.opacity = '0';
      tooltip.style.opacity = '0';
    }

    wrap.addEventListener('pointerenter', function(e) {
      handleScrub(e.clientX);
    });

    wrap.addEventListener('pointermove', function(e) {
      handleScrub(e.clientX);
    });

    wrap.addEventListener('pointerleave', hideScrub);

    wrap.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) {
        handleScrub(e.touches[0].clientX);
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', function(e) {
      if (e.touches && e.touches[0]) {
        handleScrub(e.touches[0].clientX);
      }
    }, { passive: true });

    wrap.addEventListener('touchend', hideScrub);
    wrap.addEventListener('touchcancel', hideScrub);
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
    var duration = 5000;
    var startTime = 0;
    var animFrame = null;
    var isPaused = false;
    var isVisible = false;
    var sceneTimeouts = [];

    if (cursor) {
      cursor.style.opacity = '0';
    }

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

    function getElementCenterInStage(el) {
      if (!el || !stage) return { x: 280, y: 160 };
      var sRect = stage.getBoundingClientRect();
      var eRect = el.getBoundingClientRect();
      return {
        x: Math.round(eRect.left - sRect.left + eRect.width / 2),
        y: Math.round(eRect.top - sRect.top + eRect.height / 2)
      };
    }

    function renderFinalState(idx) {
      if (idx === 0) {
        var s1Amt = document.getElementById('scene1-amt-text');
        var s1Tag = document.getElementById('scene1-cat-tag');
        var s1Safe = document.getElementById('scene1-safe-val');
        var s1BudText = document.getElementById('scene1-budget-text');
        var s1BudBar = document.getElementById('scene1-budget-bar');
        var s1Toast = document.getElementById('scene1-toast');
        var s1List = document.getElementById('scene1-today-list');

        if (s1Amt) s1Amt.textContent = '1,200';
        if (s1Tag) s1Tag.innerHTML = '<i class="fas fa-tag"></i> Groceries';
        if (s1Safe) s1Safe.textContent = '₹36,350';
        if (s1BudText) s1BudText.textContent = '₹1,200 / ₹5,000 (24%)';
        if (s1BudBar) s1BudBar.style.width = '24%';
        if (s1Toast) s1Toast.style.display = 'inline-flex';
        if (s1List && !s1List.querySelector('.tx-added-row')) {
          var newRow = document.createElement('div');
          newRow.className = 'motion-today-row tx-added-row';
          newRow.innerHTML = '<span>Kirana store &bull; Groceries</span><span class="tx-out tabular-nums">−₹1,200</span>';
          s1List.insertBefore(newRow, s1List.firstChild);
        }
      } else if (idx === 1) {
        var s2Sub = document.getElementById('scene2-sub-label');
        var s2Badge = document.getElementById('scene2-badge');
        var s2Bar = document.getElementById('scene2-bar');
        var s2Over = document.getElementById('scene2-overflow');
        var s2Warn = document.getElementById('scene2-warning');
        var s2Head = document.getElementById('scene2-headroom-val');
        var s2Dining = document.getElementById('scene2-dining-list');

        if (s2Sub) s2Sub.textContent = '₹5,250 / ₹5,000 (105%)';
        if (s2Badge) {
          s2Badge.className = 'motion-badge-coral';
          s2Badge.textContent = 'Over by ₹250';
        }
        if (s2Bar) {
          s2Bar.className = 'motion-bar-fill bar-coral';
          s2Bar.style.width = '100%';
        }
        if (s2Over) { s2Over.style.left = '95%'; s2Over.style.width = '5%'; }
        if (s2Warn) s2Warn.style.display = 'inline-flex';
        if (s2Head) {
          s2Head.textContent = 'Over by ₹250 (105%)';
          s2Head.className = 'motion-stat-val text-coral tabular-nums';
        }
        if (s2Dining && !s2Dining.querySelector('.tx-dining-added')) {
          var dRow = document.createElement('div');
          dRow.className = 'motion-today-row tx-dining-added';
          dRow.innerHTML = '<span>Dinner &bull; Dining Out</span><span class="tx-out tabular-nums">−₹650</span>';
          s2Dining.insertBefore(dRow, s2Dining.firstChild);
        }
      } else if (idx === 2) {
        var s3Cur = document.getElementById('scene3-current-val');
        var s3Bar = document.getElementById('scene3-goal-fill');
        var s3Mile = document.getElementById('scene3-milestone');
        var s3Hist = document.getElementById('scene3-history');
        var s3Cushion = document.getElementById('scene3-months-cushion');

        if (s3Cur) s3Cur.textContent = '₹50,000';
        if (s3Bar) s3Bar.style.width = '50%';
        if (s3Mile) s3Mile.style.display = 'inline-flex';
        if (s3Cushion) s3Cushion.textContent = '4.0 Months Buffer';
        if (s3Hist && !s3Hist.querySelector('.tx-history-added')) {
          var hRow = document.createElement('div');
          hRow.className = 'motion-history-row tx-history-added';
          hRow.innerHTML = '<span>Today &bull; Manual Deposit</span><span class="text-emerald tabular-nums">+₹5,000</span>';
          s3Hist.insertBefore(hRow, s3Hist.firstChild);
        }
      } else if (idx === 3) {
        var s4Val = document.getElementById('scene4-loan-val');
        var s4RepLabel = document.getElementById('scene4-repaid-label');
        var s4Bar = document.getElementById('scene4-loan-bar');
        var s4Pill = document.getElementById('scene4-repay-pill');
        var s4Settle = document.getElementById('scene4-settle-list');
        var s4Inc = document.getElementById('scene4-income-list');

        if (s4Val) s4Val.textContent = '₹10,000';
        if (s4RepLabel) s4RepLabel.textContent = 'Repaid ₹2,500 / ₹12,500 (20%)';
        if (s4Bar) s4Bar.style.width = '20%';
        if (s4Pill) s4Pill.style.display = 'inline-flex';
        if (s4Settle) {
          s4Settle.innerHTML = '<div class="motion-today-row"><span>Today &bull; UPI</span><span class="text-emerald tabular-nums">+₹2,500</span></div>';
        }
        if (s4Inc) {
          s4Inc.innerHTML = '<div class="motion-today-row"><span>Repaid by Rahul</span><span class="text-emerald tabular-nums">+₹2,500</span></div>';
        }
      }
    }

    function resetSceneInitialState(idx) {
      if (idx === 0) {
        var s1Amt = document.getElementById('scene1-amt-text');
        var s1Tag = document.getElementById('scene1-cat-tag');
        var s1Safe = document.getElementById('scene1-safe-val');
        var s1BudText = document.getElementById('scene1-budget-text');
        var s1BudBar = document.getElementById('scene1-budget-bar');
        var s1Toast = document.getElementById('scene1-toast');
        var s1List = document.getElementById('scene1-today-list');

        if (s1Amt) s1Amt.textContent = '0';
        if (s1Tag) s1Tag.innerHTML = '<i class="fas fa-tag"></i> Category';
        if (s1Safe) s1Safe.textContent = '₹37,550';
        if (s1BudText) s1BudText.textContent = '₹0 / ₹5,000 (0%)';
        if (s1BudBar) s1BudBar.style.width = '0%';
        if (s1Toast) s1Toast.style.display = 'none';
        if (s1List) {
          var added = s1List.querySelector('.tx-added-row');
          if (added) s1List.removeChild(added);
        }
      } else if (idx === 1) {
        var s2Sub = document.getElementById('scene2-sub-label');
        var s2Badge = document.getElementById('scene2-badge');
        var s2Bar = document.getElementById('scene2-bar');
        var s2Over = document.getElementById('scene2-overflow');
        var s2Warn = document.getElementById('scene2-warning');
        var s2Head = document.getElementById('scene2-headroom-val');
        var s2Dining = document.getElementById('scene2-dining-list');

        if (s2Sub) s2Sub.textContent = '₹4,600 / ₹5,000 (92%)';
        if (s2Badge) {
          s2Badge.className = 'motion-badge-amber';
          s2Badge.textContent = '₹400 left';
        }
        if (s2Bar) {
          s2Bar.className = 'motion-bar-fill bar-amber';
          s2Bar.style.width = '92%';
        }
        if (s2Over) { s2Over.style.left = '95%'; s2Over.style.width = '0%'; }
        if (s2Warn) s2Warn.style.display = 'none';
        if (s2Head) {
          s2Head.textContent = '₹400 Left (8%)';
          s2Head.className = 'motion-stat-val text-amber tabular-nums';
        }
        if (s2Dining) {
          var dAdded = s2Dining.querySelector('.tx-dining-added');
          if (dAdded) s2Dining.removeChild(dAdded);
        }
      } else if (idx === 2) {
        var s3Cur = document.getElementById('scene3-current-val');
        var s3Bar = document.getElementById('scene3-goal-fill');
        var s3Mile = document.getElementById('scene3-milestone');
        var s3Hist = document.getElementById('scene3-history');
        var s3Chip = document.getElementById('scene3-flying-chip');
        var s3Cushion = document.getElementById('scene3-months-cushion');

        if (s3Cur) s3Cur.textContent = '₹45,000';
        if (s3Bar) s3Bar.style.width = '45%';
        if (s3Mile) s3Mile.style.display = 'none';
        if (s3Cushion) s3Cushion.textContent = '3.6 Months Buffer';
        if (s3Chip) {
          s3Chip.classList.remove('fly');
          s3Chip.style.opacity = '0';
        }
        if (s3Hist) {
          var added3 = s3Hist.querySelector('.tx-history-added');
          if (added3) s3Hist.removeChild(added3);
        }
      } else if (idx === 3) {
        var s4Val = document.getElementById('scene4-loan-val');
        var s4RepLabel = document.getElementById('scene4-repaid-label');
        var s4Bar = document.getElementById('scene4-loan-bar');
        var s4Pill = document.getElementById('scene4-repay-pill');
        var s4Settle = document.getElementById('scene4-settle-list');
        var s4Inc = document.getElementById('scene4-income-list');

        if (s4Val) s4Val.textContent = '₹12,500';
        if (s4RepLabel) s4RepLabel.textContent = 'Repaid ₹0 / ₹12,500 (0%)';
        if (s4Bar) s4Bar.style.width = '0%';
        if (s4Pill) s4Pill.style.display = 'none';
        if (s4Settle) s4Settle.innerHTML = '<div class="motion-feed-empty text-zinc">No repayments yet</div>';
        if (s4Inc) s4Inc.innerHTML = '<div class="motion-feed-empty text-zinc">Awaiting settlement</div>';
      }
    }

    function runSceneTimeline(idx) {
      resetSceneInitialState(idx);

      if (isReducedMotion || !cursor) {
        if (cursor) cursor.style.opacity = '0';
        renderFinalState(idx);
        return;
      }

      cursor.style.opacity = '1';

      if (idx === 0) {
        var amtBox = document.getElementById('scene1-amt-box');
        var submitBtn = document.getElementById('scene1-submit-btn');

        cursor.style.transform = 'translate(40px, 40px)';

        var t0a = setTimeout(function() {
          var amtPt = getElementCenterInStage(amtBox);
          cursor.style.transform = 'translate(' + amtPt.x + 'px, ' + amtPt.y + 'px)';

          var t0b = setTimeout(function() {
            var s1Amt = document.getElementById('scene1-amt-text');
            if (s1Amt) {
              s1Amt.textContent = '1';
              setTimeout(function() { s1Amt.textContent = '12'; }, 100);
              setTimeout(function() { s1Amt.textContent = '120'; }, 200);
              setTimeout(function() { s1Amt.textContent = '1,200'; }, 300);
            }

            var t0c = setTimeout(function() {
              var s1Tag = document.getElementById('scene1-cat-tag');
              if (s1Tag) s1Tag.innerHTML = '<i class="fas fa-tag"></i> Groceries';

              var btnPt = getElementCenterInStage(submitBtn);
              cursor.style.transform = 'translate(' + btnPt.x + 'px, ' + btnPt.y + 'px)';

              var t0d = setTimeout(function() {
                if (submitBtn) submitBtn.classList.add('sim-pressed');
                triggerRipple(btnPt.x, btnPt.y);

                var t0e = setTimeout(function() {
                  if (submitBtn) submitBtn.classList.remove('sim-pressed');

                  var s1Safe = document.getElementById('scene1-safe-val');
                  var s1BudText = document.getElementById('scene1-budget-text');
                  var s1BudBar = document.getElementById('scene1-budget-bar');
                  var s1Toast = document.getElementById('scene1-toast');
                  var s1List = document.getElementById('scene1-today-list');

                  if (s1Safe) tickNumber(s1Safe, 37550, 36350, 800, '₹');
                  if (s1BudBar) s1BudBar.style.width = '24%';
                  if (s1BudText) s1BudText.textContent = '₹1,200 / ₹5,000 (24%)';
                  if (s1Toast) s1Toast.style.display = 'inline-flex';

                  if (s1List && !s1List.querySelector('.tx-added-row')) {
                    var newRow = document.createElement('div');
                    newRow.className = 'motion-today-row tx-added-row';
                    newRow.innerHTML = '<span>Kirana store &bull; Groceries</span><span class="tx-out tabular-nums">−₹1,200</span>';
                    s1List.insertBefore(newRow, s1List.firstChild);
                  }
                }, 180);
                sceneTimeouts.push(t0e);
              }, 700);
              sceneTimeouts.push(t0d);
            }, 600);
            sceneTimeouts.push(t0c);
          }, 500);
          sceneTimeouts.push(t0b);
        }, 400);
        sceneTimeouts.push(t0a);

      } else if (idx === 1) {
        var actionBtn2 = document.getElementById('scene2-action-btn');
        cursor.style.transform = 'translate(60px, 60px)';

        var t1a = setTimeout(function() {
          var btnPt2 = getElementCenterInStage(actionBtn2);
          cursor.style.transform = 'translate(' + btnPt2.x + 'px, ' + btnPt2.y + 'px)';

          var t1b = setTimeout(function() {
            if (actionBtn2) actionBtn2.classList.add('sim-pressed');
            triggerRipple(btnPt2.x, btnPt2.y);

            var t1c = setTimeout(function() {
              if (actionBtn2) actionBtn2.classList.remove('sim-pressed');

              var s2Card = document.getElementById('scene2-card');
              var s2Sub = document.getElementById('scene2-sub-label');
              var s2Badge = document.getElementById('scene2-badge');
              var s2Bar = document.getElementById('scene2-bar');
              var s2Over = document.getElementById('scene2-overflow');
              var s2Warn = document.getElementById('scene2-warning');
              var s2Head = document.getElementById('scene2-headroom-val');
              var s2Dining = document.getElementById('scene2-dining-list');

              if (s2Card) {
                s2Card.classList.remove('sim-shake');
                void s2Card.offsetWidth;
                s2Card.classList.add('sim-shake');
              }

              if (s2Bar) {
                s2Bar.className = 'motion-bar-fill bar-coral';
                s2Bar.style.width = '100%';
              }
              if (s2Over) { s2Over.style.left = '95%'; s2Over.style.width = '5%'; }
              if (s2Sub) s2Sub.textContent = '₹5,250 / ₹5,000 (105%)';
              if (s2Badge) {
                s2Badge.className = 'motion-badge-coral';
                s2Badge.textContent = 'Over by ₹250';
              }
              if (s2Warn) s2Warn.style.display = 'inline-flex';
              if (s2Head) {
                s2Head.textContent = 'Over by ₹250 (105%)';
                s2Head.className = 'motion-stat-val text-coral tabular-nums';
              }
              if (s2Dining && !s2Dining.querySelector('.tx-dining-added')) {
                var dRow = document.createElement('div');
                dRow.className = 'motion-today-row tx-dining-added';
                dRow.innerHTML = '<span>Dinner &bull; Dining Out</span><span class="tx-out tabular-nums">−₹650</span>';
                s2Dining.insertBefore(dRow, s2Dining.firstChild);
              }
            }, 180);
            sceneTimeouts.push(t1c);
          }, 700);
          sceneTimeouts.push(t1b);
        }, 500);
        sceneTimeouts.push(t1a);

      } else if (idx === 2) {
        var addBtn3 = document.getElementById('scene3-add-btn');
        cursor.style.transform = 'translate(60px, 60px)';

        var t2a = setTimeout(function() {
          var btnPt3 = getElementCenterInStage(addBtn3);
          cursor.style.transform = 'translate(' + btnPt3.x + 'px, ' + btnPt3.y + 'px)';

          var t2b = setTimeout(function() {
            if (addBtn3) addBtn3.classList.add('sim-pressed');
            triggerRipple(btnPt3.x, btnPt3.y);

            var t2c = setTimeout(function() {
              if (addBtn3) addBtn3.classList.remove('sim-pressed');

              var s3Cur = document.getElementById('scene3-current-val');
              var s3Bar = document.getElementById('scene3-goal-fill');
              var s3Mile = document.getElementById('scene3-milestone');
              var s3Hist = document.getElementById('scene3-history');
              var s3Chip = document.getElementById('scene3-flying-chip');
              var s3Cushion = document.getElementById('scene3-months-cushion');

              if (s3Chip) {
                s3Chip.classList.add('fly');
              }

              if (s3Bar) s3Bar.style.width = '50%';
              if (s3Cur) tickNumber(s3Cur, 45000, 50000, 800, '₹');
              if (s3Mile) s3Mile.style.display = 'inline-flex';
              if (s3Cushion) s3Cushion.textContent = '4.0 Months Buffer';

              if (s3Hist && !s3Hist.querySelector('.tx-history-added')) {
                var hRow = document.createElement('div');
                hRow.className = 'motion-history-row tx-history-added';
                hRow.innerHTML = '<span>Today &bull; Manual Deposit</span><span class="text-emerald tabular-nums">+₹5,000</span>';
                s3Hist.insertBefore(hRow, s3Hist.firstChild);
              }
            }, 180);
            sceneTimeouts.push(t2c);
          }, 700);
          sceneTimeouts.push(t2b);
        }, 500);
        sceneTimeouts.push(t2a);

      } else if (idx === 3) {
        var repayBtn4 = document.getElementById('scene4-repay-btn');
        cursor.style.transform = 'translate(60px, 60px)';

        var t3a = setTimeout(function() {
          var btnPt4 = getElementCenterInStage(repayBtn4);
          cursor.style.transform = 'translate(' + btnPt4.x + 'px, ' + btnPt4.y + 'px)';

          var t3b = setTimeout(function() {
            if (repayBtn4) repayBtn4.classList.add('sim-pressed');
            triggerRipple(btnPt4.x, btnPt4.y);

            var t3c = setTimeout(function() {
              if (repayBtn4) repayBtn4.classList.remove('sim-pressed');

              var s4Val = document.getElementById('scene4-loan-val');
              var s4RepLabel = document.getElementById('scene4-repaid-label');
              var s4Bar = document.getElementById('scene4-loan-bar');
              var s4Pill = document.getElementById('scene4-repay-pill');
              var s4Settle = document.getElementById('scene4-settle-list');
              var s4Inc = document.getElementById('scene4-income-list');

              if (s4Pill) s4Pill.style.display = 'inline-flex';
              if (s4Val) tickNumber(s4Val, 12500, 10000, 800, '₹');
              if (s4Bar) s4Bar.style.width = '20%';
              if (s4RepLabel) s4RepLabel.textContent = 'Repaid ₹2,500 / ₹12,500 (20%)';

              if (s4Settle) {
                s4Settle.innerHTML = '<div class="motion-today-row"><span>Today &bull; UPI</span><span class="text-emerald tabular-nums">+₹2,500</span></div>';
              }
              if (s4Inc) {
                s4Inc.innerHTML = '<div class="motion-today-row"><span>Repaid by Rahul</span><span class="text-emerald tabular-nums">+₹2,500</span></div>';
              }
            }, 180);
            sceneTimeouts.push(t3c);
          }, 700);
          sceneTimeouts.push(t3b);
        }, 500);
        sceneTimeouts.push(t3a);
      }
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

      runSceneTimeline(idx);
      startTime = performance.now();
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
          if (isVisible && !startTime) {
            switchScene(0);
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
    } else {
      for (var k = 0; k < scenes.length; k++) {
        renderFinalState(k);
      }
    }
  }

  function initCategoryInspector() {
    var chips = document.querySelectorAll('.paper-cat-chip');
    var catName = document.getElementById('cat-inspector-name');
    var catStatus = document.getElementById('cat-inspector-status');
    var catBar = document.getElementById('cat-inspector-bar');
    var catCap = document.getElementById('cat-inspector-cap');
    var recentList = document.getElementById('cat-recent-list');
    var overBar = document.getElementById('cat-inspector-overflow');
    if (!chips.length || !catName || !catBar) return;

    var catData = {
      food: {
        name: 'Food & Dining',
        status: '₹800 left',
        statusColor: '#d97706',
        pct: 84,
        hasOverflow: false,
        barClass: 'motion-bar-fill bar-amber',
        capText: '₹4,200 / ₹5,000 cap',
        rows: [
          { note: 'Weekly Groceries', amt: '−₹2,100' },
          { note: 'Dinner with team', amt: '−₹1,450' },
          { note: 'Coffee & Bakery', amt: '−₹650' }
        ]
      },
      bills: {
        name: 'Bills & Utilities',
        status: 'On track',
        statusColor: '#059669',
        pct: 61.25,
        hasOverflow: false,
        barClass: 'motion-bar-fill',
        capText: '₹2,450 / ₹4,000 cap',
        rows: [
          { note: 'Fiber Broadband', amt: '−₹999' },
          { note: 'Electricity Utility', amt: '−₹1,150' },
          { note: 'Mobile Prepaid', amt: '−₹301' }
        ]
      },
      transit: {
        name: 'Transit & Fuel',
        status: 'Over by ₹50',
        statusColor: '#f43f5e',
        pct: 100,
        hasOverflow: true,
        overflowWidth: '6.25%',
        barClass: 'motion-bar-fill bar-coral',
        capText: '₹850 / ₹800 cap',
        rows: [
          { note: 'Monthly Metro Pass', amt: '−₹450' },
          { note: 'Auto Rickshaw Fares', amt: '−₹220' },
          { note: 'Petrol Pump', amt: '−₹180' }
        ]
      }
    };

    function selectCat(key) {
      var data = catData[key];
      if (!data) return;

      chips.forEach(function(c) {
        if (c.getAttribute('data-cat') === key) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });

      catName.textContent = data.name;
      catStatus.textContent = data.status;
      catStatus.style.color = data.statusColor;
      catCap.textContent = data.capText;

      catBar.className = data.barClass;
      catBar.style.width = '0%';
      void catBar.offsetWidth;
      catBar.style.width = data.pct + '%';

      if (overBar) {
        if (data.hasOverflow) {
          overBar.style.display = 'block';
          overBar.style.width = data.overflowWidth || '6%';
        } else {
          overBar.style.display = 'none';
          overBar.style.width = '0%';
        }
      }

      if (recentList) {
        recentList.innerHTML = '';
        data.rows.forEach(function(r) {
          var row = document.createElement('div');
          row.className = 'cat-recent-row';
          row.innerHTML = '<span>' + r.note + '</span><span class="tabular-nums">' + r.amt + '</span>';
          recentList.appendChild(row);
        });
      }
    }

    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var key = chip.getAttribute('data-cat');
        selectCat(key);
      });
    });
  }

  function initInteractiveDonut() {
    var card = document.getElementById('paper-card-reports');
    var svg = document.getElementById('reports-donut-svg');
    var btnThis = document.getElementById('btn-month-this');
    var btnLast = document.getElementById('btn-month-last');
    var centerAmt = document.getElementById('donut-center-amt');
    var centerLbl = document.getElementById('donut-center-lbl');
    var insightText = document.getElementById('donut-insight-text');
    var insightLine = document.getElementById('donut-insight-line');
    var slices = document.querySelectorAll('.mini-donut-slice');
    var legendRows = document.querySelectorAll('.mini-donut-legend-row');

    if (!card || !svg) return;

    var monthData = {
      this: {
        total: 9350,
        slices: {
          Food: { pct: 45, dash: '45 55', offset: 25, amt: '₹4,208' },
          Bills: { pct: 26, dash: '26 74', offset: 80, amt: '₹2,431' },
          Transit: { pct: 9, dash: '9 91', offset: 54, amt: '₹841' },
          Shopping: { pct: 20, dash: '20 80', offset: 45, amt: '₹1,870' }
        },
        insightText: 'Food down 12% vs last month',
        insightIcon: 'fas fa-arrow-trend-down text-emerald'
      },
      last: {
        total: 11200,
        slices: {
          Food: { pct: 52, dash: '52 48', offset: 25, amt: '₹5,824' },
          Bills: { pct: 22, dash: '22 78', offset: 73, amt: '₹2,464' },
          Transit: { pct: 11, dash: '11 89', offset: 51, amt: '₹1,232' },
          Shopping: { pct: 15, dash: '15 85', offset: 40, amt: '₹1,680' }
        },
        insightText: 'Shopping was 15% higher',
        insightIcon: 'fas fa-arrow-trend-up text-amber'
      }
    };

    var activeMonth = 'this';

    function setMonth(monthKey) {
      activeMonth = monthKey;
      var data = monthData[monthKey];
      if (!data) return;

      if (btnThis && btnLast) {
        if (monthKey === 'this') {
          btnThis.classList.add('active');
          btnLast.classList.remove('active');
        } else {
          btnLast.classList.add('active');
          btnThis.classList.remove('active');
        }
      }

      if (centerAmt) {
        var startAmt = monthKey === 'this' ? 11200 : 9350;
        tickNumber(centerAmt, startAmt, data.total, 500, '₹');
      }
      if (centerLbl) centerLbl.textContent = 'Total spent';

      slices.forEach(function(s) {
        var cat = s.getAttribute('data-cat');
        var sData = data.slices[cat];
        if (sData) {
          s.setAttribute('stroke-dasharray', sData.dash);
          s.setAttribute('stroke-dashoffset', sData.offset);
        }
      });

      legendRows.forEach(function(row) {
        var cat = row.getAttribute('data-cat');
        var sData = data.slices[cat];
        if (sData) {
          var dot = row.querySelector('.legend-dot');
          var dotHtml = dot ? dot.outerHTML : '';
          row.innerHTML = dotHtml + ' ' + cat + ' (' + sData.pct + '%)';
        }
      });

      if (insightLine && insightText) {
        var icon = insightLine.querySelector('i');
        if (icon) icon.className = data.insightIcon;
        insightText.textContent = data.insightText;
      }
    }

    if (btnThis) {
      btnThis.addEventListener('click', function() { setMonth('this'); });
    }
    if (btnLast) {
      btnLast.addEventListener('click', function() { setMonth('last'); });
    }

    function highlightCategory(cat) {
      var data = monthData[activeMonth];
      if (!data) return;
      var sData = data.slices[cat];
      if (!sData) return;

      slices.forEach(function(s) {
        if (s.getAttribute('data-cat') === cat) {
          s.classList.add('highlight');
          s.classList.remove('dimmed');
        } else {
          s.classList.remove('highlight');
          s.classList.add('dimmed');
        }
      });

      legendRows.forEach(function(lr) {
        if (lr.getAttribute('data-cat') === cat) {
          lr.classList.add('active');
        } else {
          lr.classList.remove('active');
        }
      });

      if (centerAmt) centerAmt.textContent = sData.amt;
      if (centerLbl) centerLbl.textContent = cat + ' (' + sData.pct + '%)';
    }

    function clearHighlight() {
      var data = monthData[activeMonth];
      slices.forEach(function(s) {
        s.classList.remove('highlight');
        s.classList.remove('dimmed');
      });
      legendRows.forEach(function(lr) {
        lr.classList.remove('active');
      });
      if (centerAmt && data) centerAmt.textContent = formatINR(data.total, '₹');
      if (centerLbl) centerLbl.textContent = 'Total spent';
    }

    slices.forEach(function(s) {
      s.addEventListener('mouseenter', function() {
        var cat = s.getAttribute('data-cat');
        highlightCategory(cat);
      });
      s.addEventListener('mouseleave', clearHighlight);
    });

    legendRows.forEach(function(lr) {
      lr.addEventListener('mouseenter', function() {
        var cat = lr.getAttribute('data-cat');
        highlightCategory(cat);
      });
      lr.addEventListener('mouseleave', clearHighlight);
    });

    if (window.IntersectionObserver) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            slices.forEach(function(s) {
              s.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
            });
            obs.disconnect();
          }
        });
      }, { threshold: 0.3 });
      obs.observe(card);
    }
  }

  function initPwaCard() {
    var card = document.getElementById('paper-card-pwa');
    var installBtn = document.getElementById('pwa-card-install-btn');
    var installedPill = document.getElementById('pwa-installed-pill');
    var hintEl = document.getElementById('pwa-platform-hint');
    if (!card) return;

    var ua = navigator.userAgent || '';
    var isIos = /iphone|ipad|ipod/i.test(ua);
    var isAndroid = /android/i.test(ua);
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isStandalone) {
      if (installBtn) installBtn.style.display = 'none';
      if (installedPill) installedPill.style.display = 'inline-flex';
      if (hintEl) hintEl.textContent = 'Running in standalone native window.';
      return;
    }

    if (hintEl) {
      if (isIos) {
        hintEl.innerHTML = '<i class="fas fa-arrow-up-from-bracket text-emerald"></i> Tap Share in Safari, then select <strong>Add to Home Screen</strong>.';
      } else if (isAndroid) {
        hintEl.innerHTML = '<i class="fas fa-ellipsis-vertical text-emerald"></i> Tap browser menu or the button above to install directly.';
      } else {
        hintEl.innerHTML = '<i class="fas fa-desktop text-emerald"></i> Click the install icon in the address bar or the button above.';
      }
    }

    if (installBtn) {
      installBtn.addEventListener('click', function() {
        if (window.deferredPWAInstallPrompt) {
          window.deferredPWAInstallPrompt.prompt();
          window.deferredPWAInstallPrompt.userChoice.then(function(choice) {
            if (choice.outcome === 'accepted') {
              installBtn.style.display = 'none';
              if (installedPill) installedPill.style.display = 'inline-flex';
            }
          });
        } else {
          installBtn.style.display = 'none';
          if (installedPill) installedPill.style.display = 'inline-flex';
        }
      });
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

  
  /* ==========================================================================
     MOBILE APP EXPERIENCE CONTROLLERS (< 768px)
     ========================================================================== */
  var mobileIntervals = [];
  var mobileTimeouts = [];

  function clearMobileTimers() {
    mobileIntervals.forEach(function(i) { clearInterval(i); });
    mobileIntervals = [];
    mobileTimeouts.forEach(function(t) { clearTimeout(t); });
    mobileTimeouts = [];
  }

  // 1. Mobile App Shell: Bottom Tabs & ScrollSpy
  function initMobileAppShell() {
    var tabBtns = document.querySelectorAll('.mobile-bottom-tabs .mobile-tab-btn');
    if (!tabBtns.length) return;

    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var targetId = btn.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
          var targetEl = document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            triggerHaptic(8);
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            tabBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
          }
        }
      });
    });

    if ('IntersectionObserver' in window) {
      var sections = [
        { id: 'hero', tab: 'hero' },
        { id: 'motion', tab: 'motion' },
        { id: 'paper-sections', tab: 'paper-sections' },
        { id: 'faq', tab: 'faq' }
      ];

      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            var activeSecId = entry.target.id;
            tabBtns.forEach(function(b) {
              if (b.getAttribute('data-tab') === activeSecId) {
                b.classList.add('active');
              } else {
                b.classList.remove('active');
              }
            });
          }
        });
      }, { threshold: [0.25, 0.5] });

      sections.forEach(function(s) {
        var el = document.getElementById(s.id);
        if (el) observer.observe(el);
      });
    }
  }

  // 2. Mobile Hero: Dashboard Replica & Live Feed
  function initMobileHeroDashboard() {
    var txList = document.getElementById('mob-replica-tx-list');
    var networthEl = document.getElementById('mob-networth-val');
    var incEl = document.getElementById('mob-stat-income');
    var expEl = document.getElementById('mob-stat-expenses');
    var expSubEl = document.getElementById('mob-stat-expenses-sub');
    var safeEl = document.getElementById('mob-stat-safe');
    var savingsEl = document.getElementById('mob-stat-savings');
    var syncPill = document.getElementById('mob-hero-sync-pill');
    var stealthBtn = document.getElementById('mob-stealth-toggle');
    var fabBtn = document.getElementById('mob-hero-fab');

    if (!txList) return;

    var mobPool = [
      { cat: 'Chai & Snacks', badge: 'badge-dining', desc: 'Chai Tapri', amt: -20, isOut: true },
      { cat: 'UPI Transfer', badge: 'badge-salary', desc: 'UPI from Mom', amt: 500, isOut: false },
      { cat: 'Transit', badge: 'badge-bills', desc: 'Metro Card', amt: -45, isOut: true },
      { cat: 'Dining Out', badge: 'badge-dining', desc: 'Swiggy Dinner', amt: -240, isOut: true },
      { cat: 'Utilities', badge: 'badge-bills', desc: 'Mobile Recharge', amt: -299, isOut: true },
      { cat: 'Groceries', badge: 'badge-groceries', desc: 'Nature Basket', amt: -650, isOut: true }
    ];

    var poolIdx = 0;
    var curIncome = 50000;
    var curExpenses = 12450;
    var curSafe = 37550;
    var curSavings = 75.1;
    var isStealth = false;

    if (stealthBtn) {
      stealthBtn.addEventListener('click', function() {
        isStealth = !isStealth;
        triggerHaptic(8);
        stealthBtn.classList.toggle('active', isStealth);
        var icon = stealthBtn.querySelector('i');
        if (icon) icon.className = isStealth ? 'fas fa-eye-slash text-emerald' : 'fas fa-eye';

        var amounts = document.querySelectorAll('#mobile-dashboard-replica .tabular-nums');
        amounts.forEach(function(el) {
          if (isStealth) {
            el.setAttribute('data-original-val', el.textContent);
            el.textContent = '••••••';
          } else {
            var orig = el.getAttribute('data-original-val');
            if (orig) el.textContent = orig;
          }
        });
      });
    }

    if (fabBtn) {
      fabBtn.addEventListener('click', function() {
        triggerHaptic(12);
        var motionSec = document.getElementById('motion');
        if (motionSec) motionSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    function addMobileLiveRow() {
      if (document.hidden || isReducedMotion || isStealth) return;

      var item = mobPool[poolIdx % mobPool.length];
      poolIdx++;

      var row = document.createElement('div');
      row.className = 'mob-tx-row tx-row-fresh';
      var amtFormatted = item.isOut ? '−₹' + Math.abs(item.amt).toLocaleString('en-IN') : '+₹' + item.amt.toLocaleString('en-IN');
      var amtClass = item.isOut ? 'replica-tx-amt tx-out tabular-nums' : 'replica-tx-amt tx-in tabular-nums';

      row.innerHTML = '<div class="mob-tx-left">' +
        '<span class="replica-cat-badge ' + item.badge + '">' + item.cat + '</span>' +
        '<span class="mob-tx-desc">' + item.desc + '</span>' +
        '</div>' +
        '<span class="' + amtClass + '">' + amtFormatted + '</span>';

      txList.insertBefore(row, txList.firstChild);
      var rows = txList.querySelectorAll('.mob-tx-row');
      if (rows.length > 3) txList.removeChild(rows[rows.length - 1]);

      if (item.isOut) {
        var oldExp = curExpenses;
        curExpenses += Math.abs(item.amt);
        if (expEl) tickNumber(expEl, oldExp, curExpenses, 600, '₹');

        var oldSafe = curSafe;
        curSafe -= Math.abs(item.amt);
        if (safeEl) tickNumber(safeEl, oldSafe, curSafe, 600, '₹');
        if (networthEl) tickNumber(networthEl, oldSafe, curSafe, 600, '₹');
      } else {
        var oldInc = curIncome;
        curIncome += item.amt;
        if (incEl) tickNumber(incEl, oldInc, curIncome, 600, '₹');

        var oldSafe2 = curSafe;
        curSafe += item.amt;
        if (safeEl) tickNumber(safeEl, oldSafe2, curSafe, 600, '₹');
        if (networthEl) tickNumber(networthEl, oldSafe2, curSafe, 600, '₹');
      }

      if (expSubEl && curIncome > 0) {
        expSubEl.textContent = ((curExpenses / curIncome) * 100).toFixed(1) + '% of income';
      }

      if (savingsEl && curIncome > 0) {
        var oldSav = curSavings;
        curSavings = parseFloat((((curIncome - curExpenses) / curIncome) * 100).toFixed(1));
        tickNumber(savingsEl, oldSav, curSavings, 600, '', '%', 1);
      }

      if (syncPill) {
        var icon = syncPill.querySelector('i');
        var text = syncPill.querySelector('span');
        if (icon) icon.className = 'fas fa-rotate fa-spin text-emerald';
        if (text) text.textContent = 'Syncing...';

        setTimeout(function() {
          if (icon) icon.className = 'fas fa-circle-check text-emerald';
          if (text) text.textContent = 'Cloud Synced';
        }, 900);
      }
    }

    var feedTimer = setInterval(addMobileLiveRow, 7000);
    mobileIntervals.push(feedTimer);
  }

  // 3. Mobile Touch Spotlight Torch
  function initMobileTouchSpotlight() {
    var hero = document.getElementById('hero');
    var spotlight = document.getElementById('hero-spotlight');
    if (!hero || !spotlight) return;

    spotlight.style.opacity = '1';
    spotlight.style.setProperty('--r', '200px');

    var isTouching = false;
    var floatAngle = 0;

    function handleTouch(e) {
      if (!e.touches || !e.touches[0]) return;
      isTouching = true;
      var touch = e.touches[0];
      var rect = hero.getBoundingClientRect();
      var x = touch.clientX - rect.left;
      var y = touch.clientY - rect.top;
      spotlight.style.setProperty('--x', Math.round(x) + 'px');
      spotlight.style.setProperty('--y', Math.round(y) + 'px');
    }

    hero.addEventListener('touchstart', handleTouch, { passive: true });
    hero.addEventListener('touchmove', handleTouch, { passive: true });
    hero.addEventListener('touchend', function() {
      isTouching = false;
    }, { passive: true });

    function drift() {
      if (!isTouching && isMobileQuery.matches) {
        floatAngle += 0.012;
        var cx = 50 + 18 * Math.cos(floatAngle);
        var cy = 35 + 14 * Math.sin(floatAngle * 1.3);
        spotlight.style.setProperty('--x', cx.toFixed(1) + '%');
        spotlight.style.setProperty('--y', cy.toFixed(1) + '%');
      }
      if (isMobileQuery.matches) {
        requestAnimationFrame(drift);
      }
    }
    requestAnimationFrame(drift);
  }

  // 4. Mobile Demo 4-Slide Carousel & Phone Workflows
  function initMobileDemoCarousel() {
    var viewport = document.getElementById('mob-motion-viewport');
    var dots = document.querySelectorAll('#mob-motion-dots .mob-dot');
    var sceneIndicator = document.getElementById('mob-scene-indicator');
    var sceneTitle = document.getElementById('mob-scene-title-active');

    if (!viewport) return;

    var sceneTitles = [
      'Add an Expense',
      'Hit a Budget Limit',
      'Fund a Goal',
      'Log a Repayment'
    ];

    var currentSceneIdx = 0;
    var isUserInteracting = false;

    function goToSlide(idx) {
      currentSceneIdx = idx;
      var slide = document.getElementById('mob-slide-' + (idx + 1));
      if (slide) {
        slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      updateActiveMeta(idx);
      playSceneAction(idx);
    }

    function updateActiveMeta(idx) {
      dots.forEach(function(d, i) {
        d.classList.toggle('active', i === idx);
      });
      if (sceneIndicator) sceneIndicator.textContent = 'SCENE ' + (idx + 1) + ' OF 4';
      if (sceneTitle) sceneTitle.textContent = sceneTitles[idx] || '';
    }

    dots.forEach(function(d, i) {
      d.addEventListener('click', function() {
        triggerHaptic(8);
        isUserInteracting = true;
        goToSlide(i);
        setTimeout(function() { isUserInteracting = false; }, 4000);
      });
    });

    viewport.addEventListener('scroll', function() {
      var w = viewport.offsetWidth;
      if (w > 0) {
        var idx = Math.round(viewport.scrollLeft / w);
        if (idx !== currentSceneIdx && idx >= 0 && idx < 4) {
          currentSceneIdx = idx;
          updateActiveMeta(idx);
        }
      }
    }, { passive: true });

    // Scene 1: Bottom Sheet Add Expense
    var s1Fab = document.getElementById('mob-s1-fab');
    var s1Sheet = document.getElementById('mob-s1-sheet');
    var s1Close = document.getElementById('mob-s1-close-btn');
    var s1Save = document.getElementById('mob-s1-save-btn');
    var s1Amount = document.getElementById('mob-s1-amount');
    var s1Safe = document.getElementById('mob-s1-safe');
    var s1Toast = document.getElementById('mob-s1-toast');
    var s1List = document.getElementById('mob-s1-tx-list');

    function triggerScene1Flow() {
      if (!s1Sheet) return;
      s1Sheet.classList.add('open');
      triggerHaptic(10);

      if (s1Amount) s1Amount.textContent = '₹0';

      var digits = ['1', '2', '0', '0'];
      var curVal = '';
      digits.forEach(function(d, i) {
        var t = setTimeout(function() {
          curVal += d;
          if (s1Amount) s1Amount.textContent = '₹' + parseInt(curVal, 10).toLocaleString('en-IN');
          triggerHaptic(4);
        }, 300 + i * 220);
        mobileTimeouts.push(t);
      });

      var tSave = setTimeout(function() {
        if (s1Save) {
          s1Save.classList.add('sim-pressed');
          triggerHaptic(12);
        }
        var tDismiss = setTimeout(function() {
          if (s1Save) s1Save.classList.remove('sim-pressed');
          if (s1Sheet) s1Sheet.classList.remove('open');

          // Append row
          if (s1List && !s1List.querySelector('.tx-added')) {
            var row = document.createElement('div');
            row.className = 'mob-tx-row tx-added';
            row.innerHTML = '<div class="mob-tx-left"><span class="replica-cat-badge badge-groceries">Groceries</span><span>Kirana store</span></div><span class="replica-tx-amt tx-out tabular-nums">−₹1,200</span>';
            s1List.insertBefore(row, s1List.firstChild);
          }

          if (s1Safe) s1Safe.textContent = 'Safe: ₹36,350';
          if (s1Toast) {
            s1Toast.classList.add('visible');
            setTimeout(function() { s1Toast.classList.remove('visible'); }, 2200);
          }
        }, 350);
        mobileTimeouts.push(tDismiss);
      }, 1600);
      mobileTimeouts.push(tSave);
    }

    if (s1Fab) s1Fab.addEventListener('click', triggerScene1Flow);
    if (s1Close) s1Close.addEventListener('click', function() { s1Sheet.classList.remove('open'); });
    if (s1Save) s1Save.addEventListener('click', function() {
      s1Sheet.classList.remove('open');
      if (s1Toast) {
        s1Toast.classList.add('visible');
        setTimeout(function() { s1Toast.classList.remove('visible'); }, 2000);
      }
    });

    // Scene 2: Budget Limit Warning Banner
    var s2AddBtn = document.getElementById('mob-s2-add-btn');
    var s2Notif = document.getElementById('mob-s2-notification');
    var s2Card = document.getElementById('mob-s2-card');
    var s2Bar = document.getElementById('mob-s2-bar');
    var s2Over = document.getElementById('mob-s2-over');
    var s2Sub = document.getElementById('mob-s2-sub');
    var s2Badge = document.getElementById('mob-s2-badge');

    function triggerScene2Flow() {
      triggerHaptic(12);
      if (s2Notif) s2Notif.classList.add('visible');
      if (s2Bar) {
        s2Bar.className = 'motion-bar-fill bar-coral';
        s2Bar.style.width = '100%';
      }
      if (s2Over) {
        s2Over.style.left = '95%';
        s2Over.style.width = '5%';
      }
      if (s2Sub) s2Sub.textContent = '₹5,250 / ₹5,000 (105%)';
      if (s2Badge) {
        s2Badge.className = 'motion-badge-coral';
        s2Badge.textContent = 'Over by ₹250';
      }
      if (s2Card) {
        s2Card.classList.remove('sim-shake');
        void s2Card.offsetWidth;
        s2Card.classList.add('sim-shake');
      }

      var tResetNotif = setTimeout(function() {
        if (s2Notif) s2Notif.classList.remove('visible');
      }, 3500);
      mobileTimeouts.push(tResetNotif);
    }

    if (s2AddBtn) s2AddBtn.addEventListener('click', triggerScene2Flow);

    // Scene 3: Fund a Goal
    var s3FundBtn = document.getElementById('mob-s3-fund-btn');
    var s3Val = document.getElementById('mob-s3-val');
    var s3Bar = document.getElementById('mob-s3-bar');
    var s3Badge = document.getElementById('mob-s3-milestone');

    function triggerScene3Flow() {
      triggerHaptic(12);
      if (s3Val) tickNumber(s3Val, 45000, 50000, 700, '₹');
      if (s3Bar) s3Bar.style.width = '50%';
      if (s3Badge) {
        s3Badge.style.display = 'inline-flex';
        s3Badge.classList.add('sim-pressed');
        setTimeout(function() { s3Badge.classList.remove('sim-pressed'); }, 300);
      }
    }

    if (s3FundBtn) s3FundBtn.addEventListener('click', triggerScene3Flow);

    // Scene 4: Swipe to Repay Loan
    var s4Row = document.getElementById('mob-s4-row');
    var s4RepayBtn = document.getElementById('mob-s4-repay-btn');
    var s4Val = document.getElementById('mob-s4-val');
    var s4Sub = document.getElementById('mob-s4-sub');
    var s4Feed = document.getElementById('mob-s4-feed-row');

    function triggerScene4Flow() {
      if (s4Row) s4Row.classList.add('swiped');
      triggerHaptic(8);

      var tTap = setTimeout(function() {
        triggerHaptic(12);
        if (s4Val) tickNumber(s4Val, 12500, 10000, 600, '₹');
        if (s4Sub) s4Sub.textContent = '₹10,000 left';
        if (s4Feed) s4Feed.style.display = 'flex';
        if (s4Row) s4Row.classList.remove('swiped');
      }, 1200);
      mobileTimeouts.push(tTap);
    }

    if (s4RepayBtn) {
      s4RepayBtn.addEventListener('click', function() {
        triggerHaptic(12);
        if (s4Val) tickNumber(s4Val, 12500, 10000, 600, '₹');
        if (s4Sub) s4Sub.textContent = '₹10,000 left';
        if (s4Feed) s4Feed.style.display = 'flex';
        if (s4Row) s4Row.classList.remove('swiped');
      });
    }

    function playSceneAction(idx) {
      if (isReducedMotion) return;
      if (idx === 0) triggerScene1Flow();
      else if (idx === 1) triggerScene2Flow();
      else if (idx === 2) triggerScene3Flow();
      else if (idx === 3) triggerScene4Flow();
    }

    // Auto-advance carousel every 7.5s unless touched
    var autoPlayTimer = setInterval(function() {
      if (isUserInteracting || document.hidden || isReducedMotion) return;
      var next = (currentSceneIdx + 1) % 4;
      goToSlide(next);
    }, 7500);
    mobileIntervals.push(autoPlayTimer);
  }

  // 5. Mobile Features "Today" Carousel
  function initMobileFeaturesCarousel() {
    var currencyCard = document.getElementById('mob-feat-currency');
    var currencyAmt = document.getElementById('mob-currency-amt');
    var currencyCode = document.getElementById('mob-currency-code');

    var rates = [
      { code: 'INR', symbol: '₹', val: 83000 },
      { code: 'USD', symbol: '
    initHeroSpotlightAndTilt();
    initHeroDashboardLiveFeed();
    initChartScrubbing();
    initMotionTour();
    initCategoryInspector();
    initInteractiveDonut();
    initPwaCard();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
    initSimulatorSliders();
  });
})();
, val: 1000 },
      { code: 'EUR', symbol: '€', val: 920 },
      { code: 'GBP', symbol: '£', val: 790 },
      { code: 'AED', symbol: 'د.إ', val: 3670 },
      { code: 'SGD', symbol: 'S
    initHeroSpotlightAndTilt();
    initHeroDashboardLiveFeed();
    initChartScrubbing();
    initMotionTour();
    initCategoryInspector();
    initInteractiveDonut();
    initPwaCard();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
    initSimulatorSliders();
  });
})();
, val: 1350 }
    ];
    var rIdx = 0;

    if (currencyCard) {
      currencyCard.addEventListener('click', function() {
        rIdx = (rIdx + 1) % rates.length;
        var r = rates[rIdx];
        triggerHaptic(6);
        if (currencyCode) currencyCode.textContent = r.code;
        if (currencyAmt) currencyAmt.textContent = r.symbol + r.val.toLocaleString('en-IN');
      });
    }

    // Vault Press & Hold
    var vaultCard = document.getElementById('mob-feat-vault');
    var vaultBox = document.getElementById('mob-vault-box');
    var vaultOverlay = document.getElementById('mob-vault-overlay');

    if (vaultCard && vaultBox) {
      function showVault() {
        triggerHaptic(10);
        vaultBox.classList.add('unlocked');
        if (vaultOverlay) vaultOverlay.style.display = 'none';
      }
      function hideVault() {
        vaultBox.classList.remove('unlocked');
        if (vaultOverlay) vaultOverlay.style.display = 'flex';
      }

      vaultCard.addEventListener('touchstart', showVault, { passive: true });
      vaultCard.addEventListener('touchend', hideVault, { passive: true });
      vaultCard.addEventListener('mousedown', showVault);
      vaultCard.addEventListener('mouseup', hideVault);
    }

    // Category Inspector Chips
    var catChips = document.querySelectorAll('#mob-category-chips .paper-chip');
    var catName = document.getElementById('mob-cat-name');
    var catStatus = document.getElementById('mob-cat-status');
    var catBar = document.getElementById('mob-cat-bar');
    var catCap = document.getElementById('mob-cat-cap');

    var catData = {
      food: { name: 'Food & Dining', status: '₹800 left', bar: '84%', cap: '₹4,200 / ₹5,000 cap', colorClass: 'bar-amber' },
      bills: { name: 'Bills & Utilities', status: 'On track', bar: '61%', cap: '₹2,450 / ₹4,000 cap', colorClass: 'bar-emerald' },
      transit: { name: 'Transit & Fuel', status: 'Over by ₹50', bar: '100%', cap: '₹850 / ₹800 cap', colorClass: 'bar-coral' }
    };

    catChips.forEach(function(chip) {
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        triggerHaptic(6);
        catChips.forEach(function(c) { c.classList.remove('selected'); });
        chip.classList.add('selected');

        var key = chip.getAttribute('data-cat');
        var d = catData[key] || catData.food;
        if (catName) catName.textContent = d.name;
        if (catStatus) catStatus.textContent = d.status;
        if (catCap) catCap.textContent = d.cap;
        if (catBar) {
          catBar.className = 'motion-bar-fill ' + d.colorClass;
          catBar.style.width = d.bar;
        }
      });
    });

    // Donut Segments
    var donutCard = document.getElementById('mob-feat-donut');
    var donutVal = document.getElementById('mob-donut-val');
    var donutLbl = document.getElementById('mob-donut-lbl');

    var donutItems = [
      { cat: 'Food', val: '₹4,200' },
      { cat: 'Bills', val: '₹3,450' },
      { cat: 'Transit', val: '₹2,800' },
      { cat: 'Shopping', val: '₹2,000' }
    ];
    var dIdx = 0;

    if (donutCard) {
      donutCard.addEventListener('click', function() {
        dIdx = (dIdx + 1) % donutItems.length;
        var it = donutItems[dIdx];
        triggerHaptic(6);
        if (donutLbl) donutLbl.textContent = it.cat;
        if (donutVal) donutVal.textContent = it.val;
      });
    }
  }

  // 6. Mobile Offline Demo: Control Centre & Pull to Refresh
  function initMobileOfflineDemo() {
    var handle = document.getElementById('mob-control-handle');
    var panel = document.getElementById('mob-control-panel');
    var closeBtn = document.getElementById('mob-cc-close');
    var airplaneToggle = document.getElementById('mob-airplane-toggle');
    var airplaneStatus = document.getElementById('mob-airplane-status');
    var statusPill = document.getElementById('mob-plug-pill');
    var statusIcon = document.getElementById('mob-plug-icon');
    var statusText = document.getElementById('mob-plug-status-text');
    var queueBadge = document.getElementById('mob-plug-queue-badge');
    var txForm = document.getElementById('mob-plug-tx-form');
    var txList = document.getElementById('mob-plug-tx-list');
    var balEl = document.getElementById('mob-plug-bal');
    var ptrSpinner = document.getElementById('mob-ptr-spinner');
    var ptrContainer = document.getElementById('mob-ptr-container');

    var isAirplane = false;
    var offlineQueueCount = 0;
    var currentBal = 48250;

    if (handle && panel) {
      handle.addEventListener('click', function() {
        panel.classList.toggle('open');
        triggerHaptic(8);
      });
    }

    if (closeBtn && panel) {
      closeBtn.addEventListener('click', function() {
        panel.classList.remove('open');
      });
    }

    if (airplaneToggle) {
      airplaneToggle.addEventListener('click', function() {
        isAirplane = !isAirplane;
        triggerHaptic(12);

        airplaneToggle.classList.toggle('airplane-on', isAirplane);
        if (airplaneStatus) airplaneStatus.textContent = isAirplane ? 'ON' : 'OFF';

        if (isAirplane) {
          if (statusPill) {
            statusPill.className = 'mob-plug-status-pill offline';
            if (statusIcon) statusIcon.className = 'fas fa-plane text-amber';
            if (statusText) statusText.textContent = 'Offline · Queued';
          }
          if (queueBadge) {
            queueBadge.style.display = 'inline-block';
            queueBadge.textContent = offlineQueueCount + ' changes waiting';
          }
        } else {
          // Cloud sync on reconnection
          if (statusPill) {
            statusPill.className = 'mob-plug-status-pill online';
            if (statusIcon) statusIcon.className = 'fas fa-rotate fa-spin text-emerald';
            if (statusText) statusText.textContent = 'Syncing...';
          }

          setTimeout(function() {
            if (statusIcon) statusIcon.className = 'fas fa-circle-check text-emerald';
            if (statusText) statusText.textContent = 'Cloud Synced';
            offlineQueueCount = 0;
            if (queueBadge) queueBadge.style.display = 'none';

            // Mark all items synced
            var pendingIcons = txList ? txList.querySelectorAll('.sync-tick-icon.pending') : [];
            pendingIcons.forEach(function(pi) {
              pi.className = 'fas fa-check sync-tick-icon text-emerald';
              pi.title = 'Synced';
            });
          }, 1000);
        }
      });
    }

    // Submit new transaction
    if (txForm && txList) {
      txForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var amtInput = document.getElementById('mob-plug-amt');
        var noteInput = document.getElementById('mob-plug-note');
        var catSelect = document.getElementById('mob-plug-cat');

        var amt = parseFloat(amtInput ? amtInput.value : 0);
        var note = noteInput ? noteInput.value.trim() : 'Expense';
        var cat = catSelect ? catSelect.value : 'Groceries';

        if (!amt) return;
        triggerHaptic(10);

        var row = document.createElement('div');
        row.className = 'mob-tx-row tx-added';

        var tickIcon = isAirplane
          ? '<i class="fas fa-clock sync-tick-icon pending text-amber" title="Pending Sync"></i>'
          : '<i class="fas fa-check sync-tick-icon text-emerald" title="Synced"></i>';

        row.innerHTML = '<div class="mob-tx-left"><span class="replica-cat-badge badge-groceries">' + cat + '</span><span>' + note + '</span></div>' +
          '<div class="mob-tx-right"><span class="replica-tx-amt tx-out tabular-nums">−₹' + Math.abs(amt).toLocaleString('en-IN') + '</span>' + tickIcon + '</div>';

        txList.insertBefore(row, txList.firstChild);

        currentBal -= amt;
        if (balEl) balEl.textContent = '₹' + currentBal.toLocaleString('en-IN');

        if (isAirplane) {
          offlineQueueCount++;
          if (queueBadge) {
            queueBadge.style.display = 'inline-block';
            queueBadge.textContent = offlineQueueCount + ' changes waiting';
          }
        }

        if (amtInput) amtInput.value = '';
        if (noteInput) noteInput.value = '';
      });
    }

    // Pull-to-refresh simulation
    if (ptrContainer) {
      var startY = 0;
      ptrContainer.addEventListener('touchstart', function(e) {
        if (e.touches && e.touches[0]) startY = e.touches[0].clientY;
      }, { passive: true });

      ptrContainer.addEventListener('touchmove', function(e) {
        if (!e.touches || !e.touches[0]) return;
        var diff = e.touches[0].clientY - startY;
        if (diff > 45 && ptrSpinner) {
          ptrSpinner.classList.add('active');
        }
      }, { passive: true });

      ptrContainer.addEventListener('touchend', function() {
        if (ptrSpinner && ptrSpinner.classList.contains('active')) {
          triggerHaptic(12);
          setTimeout(function() {
            ptrSpinner.classList.remove('active');
            if (statusIcon) statusIcon.className = 'fas fa-circle-check text-emerald';
            if (statusText) statusText.textContent = 'Cloud Synced';
          }, 800);
        }
      }, { passive: true });
    }
  }

  // 7. Mobile Simulator Sliders
  function initMobileSimulator() {
    initSimulatorSliders();
  }

  // 8. Mobile FAQ Accordion
  function initMobileFaq() {
    var triggers = document.querySelectorAll('.faq-accordion-trigger');
    triggers.forEach(function(btn) {
      btn.addEventListener('click', function() {
        triggerHaptic(6);
      });
    });
  }

  function initMobileExperience() {
    initMobileAppShell();
    initMobileHeroDashboard();
    initMobileTouchSpotlight();
    initMobileDemoCarousel();
    initMobileFeaturesCarousel();
    initMobileOfflineDemo();
    initMobileSimulator();
    initMobileFaq();
  }

  function initDesktopExperience() {
    initHeroSpotlightAndTilt();
    initHeroDashboardLiveFeed();
    initChartScrubbing();
    initMotionTour();
    initCategoryInspector();
    initInteractiveDonut();
    initPwaCard();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
    initSimulatorSliders();
  }


  var isMobileQuery = window.matchMedia('(max-width: 767px)');
  var activeMode = null;

  function runActiveExperience() {
    var isMobile = isMobileQuery.matches;
    if (isMobile && activeMode !== 'mobile') {
      activeMode = 'mobile';
      initMobileExperience();
    } else if (!isMobile && activeMode !== 'desktop') {
      clearMobileTimers();
      activeMode = 'desktop';
      initDesktopExperience();
    }
  }

  isMobileQuery.addEventListener('change', runActiveExperience);
  document.addEventListener('DOMContentLoaded', runActiveExperience);
})();
