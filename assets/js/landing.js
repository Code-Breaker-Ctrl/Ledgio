(function() {
  'use strict';

  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // Desktop-only timers & intervals tracking
  var desktopTimers = [];
  var desktopIntervals = [];
  var desktopAnimFrames = [];
  var desktopCleanups = [];
  var isDesktopActive = false;

  function safeDesktopTimeout(fn, ms) {
    var id;
    id = setTimeout(function() {
      var idx = desktopTimers.indexOf(id);
      if (idx !== -1) desktopTimers.splice(idx, 1);
      fn();
    }, ms);
    desktopTimers.push(id);
    return id;
  }

  function clearDesktopTimeout(id) {
    var idx = desktopTimers.indexOf(id);
    if (idx !== -1) desktopTimers.splice(idx, 1);
    clearTimeout(id);
  }

  function safeDesktopInterval(fn, ms) {
    var id = setInterval(fn, ms);
    desktopIntervals.push(id);
    return id;
  }

  function clearDesktopInterval(id) {
    var idx = desktopIntervals.indexOf(id);
    if (idx !== -1) desktopIntervals.splice(idx, 1);
    clearInterval(id);
  }

  function safeDesktopRaf(fn) {
    var id;
    id = requestAnimationFrame(function(time) {
      var idx = desktopAnimFrames.indexOf(id);
      if (idx !== -1) desktopAnimFrames.splice(idx, 1);
      fn(time);
    });
    desktopAnimFrames.push(id);
    return id;
  }

  function cancelDesktopRaf(id) {
    var idx = desktopAnimFrames.indexOf(id);
    if (idx !== -1) desktopAnimFrames.splice(idx, 1);
    cancelAnimationFrame(id);
  }

  function getActiveDesktopTimersCount() {
    return desktopTimers.length + desktopIntervals.length + desktopAnimFrames.length;
  }
  window.__ledgio_activeDesktopTimers = getActiveDesktopTimersCount;
  window.__ledgio_desktopTimersCount = getActiveDesktopTimersCount;

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
    });

    hero.addEventListener('pointerleave', function() {
      spotlight.style.opacity = '0';
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
        });
      }
    });
  }

  // =========================================================================
  // Desktop Hero: Living Ledger Typography ("LEDGIO")
  // =========================================================================
  function initHeroLedgerTitle() {
    var wrap = document.getElementById('hero-ledger-title-wrap');
    var canvas = document.getElementById('hero-ledger-canvas');
    if (!wrap || !canvas) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var animFrameId = null;
    var startTime = null;
    var isHovered = false;
    var mouseX = -9999;
    var mouseY = -9999;
    var targetMouseX = -9999;
    var targetMouseY = -9999;
    var waves = [];
    var lastCutePingTime = 0;
    var isHeroVisible = true;

    var FINANCIAL_DATA = [
      '+₹45,000', '−₹1,200', '₹36,350', '24.10', 'EMI 7/24', 'SAVINGS',
      '+₹8,000', '₹0 FOREVER', '09:41', 'LOAN: ₹5k', 'KIRANA: ₹640',
      'NET: ₹1.85L', 'LOCAL_FIRST', '0% TELEMETRY', 'CAP: ₹5,000', 'SAFE: ₹36k',
      '+₹14,500', 'AUDIT: PASS', '₹1,299', 'OFFLINE'
    ];

    var dataStreamCells = [];
    var cutePips = [];
    var PIP_SYMBOLS = ['₹', '✦', '+', '★', '₹', '•'];
    var PIP_COLORS = ['#34d399', '#38bdf8', '#fef08a', '#6ee7b7', '#7dd3fc'];

    var width = 940;
    var height = 210;
    var dpr = 1;

    // Reusable offscreen buffers for smooth 60fps rendering without GC thrash
    var maskCanvas = document.createElement('canvas');
    var mCtx = maskCanvas.getContext('2d');
    var contentCanvas = document.createElement('canvas');
    var cCtx = contentCanvas.getContext('2d');

    function initCutePips() {
      cutePips = [];
      var count = 14;
      for (var p = 0; p < count; p++) {
        cutePips.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.22 + Math.random() * 0.28,
          swayAmp: 5 + Math.random() * 8,
          swayFreq: 0.0016 + Math.random() * 0.001,
          swayOffset: Math.random() * Math.PI * 2,
          symbol: PIP_SYMBOLS[p % PIP_SYMBOLS.length],
          color: PIP_COLORS[p % PIP_COLORS.length],
          baseAlpha: 0.38 + Math.random() * 0.42,
          size: Math.floor(10 + Math.random() * 4)
        });
      }
    }

    function resize() {
      if (!isDesktopActive) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = wrap.getBoundingClientRect();
      width = Math.round(rect.width || 940);
      height = Math.round(Math.min(260, Math.max(145, width * 0.24)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      contentCanvas.width = canvas.width;
      contentCanvas.height = canvas.height;

      dataStreamCells = [];
      var colWidth = Math.max(52, Math.round(width / 16));
      var rowHeight = 17;
      var cols = Math.ceil(width / colWidth);
      var rows = Math.ceil(height / rowHeight);

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          dataStreamCells.push({
            x: c * colWidth + colWidth / 2,
            y: r * rowHeight + rowHeight / 2,
            baseText: FINANCIAL_DATA[(r * 5 + c * 3) % FINANCIAL_DATA.length],
            scrambleOffset: (r * 0.05 + c * 0.04) % 1
          });
        }
      }

      initCutePips();
    }

    function drawFrame(now) {
      if (!isDesktopActive) return;
      if (!startTime) startTime = now || performance.now();
      var currentNow = now || performance.now();
      var elapsed = (currentNow - startTime) / 1000;
      var duration = 1.15;
      var progress = Math.min(1, elapsed / duration);
      var ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      mouseX += (targetMouseX - mouseX) * 0.2;
      mouseY += (targetMouseY - mouseY) * 0.2;

      for (var i = waves.length - 1; i >= 0; i--) {
        var w = waves[i];
        w.r += 14;
        w.life = 1 - (w.r / w.maxR);
        if (w.life <= 0) waves.splice(i, 1);
      }

      // Cute periodic "savings coin drop" ping when idle
      if (currentNow - lastCutePingTime > 3400 && !isHovered && progress >= 1) {
        lastCutePingTime = currentNow;
        var pingLetterIdx = Math.floor(Math.random() * 6);
        var letterX = (width * 0.16) + pingLetterIdx * (width * 0.136);
        var letterY = height * 0.5 + Math.sin(currentNow * 0.001) * 14;
        waves.push({
          x: letterX,
          y: letterY,
          r: 0,
          maxR: Math.min(100, width * 0.13),
          life: 1,
          cute: true
        });
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      var text = 'LEDGIO';
      var fontSize = Math.round(Math.min(185, Math.max(88, width * 0.205)));
      var fontStr = "800 " + fontSize + "px 'Space Grotesk', 'Plus Jakarta Sans', system-ui, sans-serif";
      var centerY = height / 2;
      var textY = centerY + (1 - ease) * 16;

      // 1. Mask Canvas
      mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mCtx.clearRect(0, 0, width, height);
      mCtx.font = fontStr;
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      if ('letterSpacing' in mCtx) mCtx.letterSpacing = '0.08em';
      mCtx.fillStyle = '#ffffff';

      mCtx.save();
      mCtx.globalAlpha = Math.min(1, progress * 1.5);
      mCtx.fillText(text, width / 2, textY);
      mCtx.restore();

      // 2. Content Canvas
      cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cCtx.globalCompositeOperation = 'source-over';
      cCtx.clearRect(0, 0, width, height);

      // Premium Brand Gradient Fill: #10b981 (Emerald) -> #14b8a6 (Teal) -> #0ea5e9 (Cyan)
      var bgGrad = cCtx.createLinearGradient(0, 0, width, 0);
      bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
      bgGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.24)');
      bgGrad.addColorStop(1, 'rgba(14, 165, 233, 0.24)');
      cCtx.fillStyle = bgGrad;
      cCtx.fillRect(0, 0, width, height);

      cCtx.font = "700 11px 'Space Grotesk', 'JetBrains Mono', monospace";
      cCtx.textAlign = 'center';
      cCtx.textBaseline = 'middle';

      for (var j = 0; j < dataStreamCells.length; j++) {
        var cell = dataStreamCells[j];
        if (progress >= 1 && !isReducedMotion) {
          cell.y -= 0.16;
          if (cell.y < 0) cell.y += height;
        }

        var textToShow = cell.baseText;
        if (progress < 1) {
          var scramble = Math.floor((currentNow * 0.03 + cell.scrambleOffset * 100) % FINANCIAL_DATA.length);
          textToShow = FINANCIAL_DATA[scramble];
        }

        var dx = cell.x - mouseX;
        var dy = cell.y - mouseY;
        var dist = Math.hypot(dx, dy);
        var isNearMouse = isHovered && dist < 140;

        var alpha = 0.65;
        var xRatio = Math.max(0, Math.min(1, cell.x / width));
        // Gradient interpolation #34d399 -> #38bdf8
        var cr = Math.round(52 + (56 - 52) * xRatio);
        var cg = Math.round(211 + (189 - 211) * xRatio);
        var cb = Math.round(153 + (248 - 153) * xRatio);
        var color = 'rgb(' + cr + ',' + cg + ',' + cb + ')';

        if (isNearMouse) {
          var k = 1 - (dist / 140);
          alpha = 0.75 + k * 0.25;
          color = '#ffffff';
        }

        for (var wi = 0; wi < waves.length; wi++) {
          var wav = waves[wi];
          var wDist = Math.abs(Math.hypot(cell.x - wav.x, cell.y - wav.y) - wav.r);
          if (wDist < 32) {
            alpha = Math.min(1, alpha + (1 - wDist / 32) * wav.life * 0.7);
            color = wav.cute ? '#fef08a' : '#ffffff';
          }
        }

        cCtx.fillStyle = color;
        cCtx.globalAlpha = alpha;
        cCtx.fillText(textToShow, cell.x, cell.y);
      }

      // Draw cute floating savings micro-particles (₹, ✦, ★, +) inside letters
      if (progress >= 0.5 && !isReducedMotion) {
        for (var pi = 0; pi < cutePips.length; pi++) {
          var pip = cutePips[pi];
          pip.y -= pip.speed;
          if (pip.y < -12) {
            pip.y = height + 10;
            pip.x = Math.random() * width;
          }
          var pipX = pip.x + Math.sin(currentNow * pip.swayFreq + pip.swayOffset) * pip.swayAmp;
          cCtx.font = "800 " + pip.size + "px 'Space Grotesk', system-ui, sans-serif";
          cCtx.fillStyle = pip.color;
          var breatheAlpha = pip.baseAlpha * (0.65 + 0.35 * Math.sin(currentNow * 0.0025 + pip.swayOffset));
          cCtx.globalAlpha = Math.min(1, breatheAlpha * progress);
          cCtx.fillText(pip.symbol, pipX, pip.y);
        }
      }

      var lineSpacing = 5.5;
      var lineCount = Math.floor(height / lineSpacing);

      for (var li = 0; li <= lineCount; li++) {
        var baseY = li * lineSpacing;
        cCtx.beginPath();
        var stepX = 14;
        var first = true;
        for (var lx = 0; lx <= width; lx += stepX) {
          var ldy = 0;

          // Cute continuous gentle ledger wave
          if (!isReducedMotion) {
            ldy += Math.sin(lx * 0.02 + currentNow * 0.0016 + li * 0.35) * 2.2;
          }

          if (isHovered) {
            var mDist = Math.hypot(lx - mouseX, baseY - mouseY);
            if (mDist < 120) {
              var mk = 1 - mDist / 120;
              ldy += -mk * mk * 9;
            }
          }
          for (var wj = 0; wj < waves.length; wj++) {
            var wv = waves[wj];
            var wvDist = Math.abs(Math.hypot(lx - wv.x, baseY - wv.y) - wv.r);
            if (wvDist < 32) {
              var wk = 1 - wvDist / 32;
              ldy += Math.sin(wvDist * 0.25) * wk * (wv.cute ? 7 : 10) * wv.life;
            }
          }

          if (first) {
            cCtx.moveTo(lx, baseY + ldy);
            first = false;
          } else {
            cCtx.lineTo(lx, baseY + ldy);
          }
        }

        var isMajor = (li % 3 === 0);
        cCtx.lineWidth = isMajor ? 2.2 : 1.3;
        var lineAlpha = (isMajor ? 0.95 : 0.8) * Math.min(1, progress * 1.3);
        var lineGrad = cCtx.createLinearGradient(0, 0, width, 0);
        lineGrad.addColorStop(0, isMajor ? 'rgba(110, 231, 183, ' + lineAlpha + ')' : 'rgba(52, 211, 153, ' + lineAlpha + ')');
        lineGrad.addColorStop(0.5, isMajor ? 'rgba(94, 234, 212, ' + lineAlpha + ')' : 'rgba(45, 212, 191, ' + lineAlpha + ')');
        lineGrad.addColorStop(1, isMajor ? 'rgba(125, 211, 252, ' + lineAlpha + ')' : 'rgba(56, 189, 248, ' + lineAlpha + ')');
        cCtx.strokeStyle = lineGrad;
        cCtx.stroke();
      }

      // Mask content into letters
      cCtx.globalCompositeOperation = 'destination-in';
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.drawImage(maskCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'source-over';

      // 3. Render into visible canvas with silky breathing pulse
      var pulse = 0.5 + 0.5 * Math.sin(currentNow * 0.0016);
      ctx.save();
      ctx.shadowColor = 'rgba(16, 185, 129, ' + (0.45 + pulse * 0.16) + ')';
      ctx.shadowBlur = 24 + pulse * 8;
      ctx.drawImage(contentCanvas, 0, 0, width, height);
      ctx.shadowBlur = 0;

      // Stroke outline with emerald -> cyan breathing gradient
      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.08em';

      var strokeGrad = ctx.createLinearGradient(width * (0.08 + pulse * 0.04), 0, width * (0.92 - pulse * 0.04), 0);
      var strokeAlpha = (0.86 + pulse * 0.14) * Math.min(1, progress * 1.5);
      strokeGrad.addColorStop(0, 'rgba(52, 211, 153, ' + strokeAlpha + ')');
      strokeGrad.addColorStop(0.5, 'rgba(45, 212, 191, ' + strokeAlpha + ')');
      strokeGrad.addColorStop(1, 'rgba(56, 189, 248, ' + strokeAlpha + ')');

      ctx.lineWidth = 2.4;
      ctx.strokeStyle = strokeGrad;
      ctx.strokeText(text, width / 2, textY);

      ctx.restore();

      var isStillAnimating = isDesktopActive && !isReducedMotion && isHeroVisible;
      if (isStillAnimating) {
        animFrameId = safeDesktopRaf(drawFrame);
      } else {
        animFrameId = null;
      }
    }

    function wakeAnimation() {
      if (!animFrameId && isDesktopActive) {
        animFrameId = safeDesktopRaf(drawFrame);
      }
    }

    function onPointerEnter(e) {
      isHovered = true;
      var rect = wrap.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
      wakeAnimation();
    }

    function onPointerMove(e) {
      var rect = wrap.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
      wakeAnimation();
    }

    function onPointerLeave() {
      isHovered = false;
      targetMouseX = -9999;
      targetMouseY = -9999;
      wakeAnimation();
    }

    var heroEl = document.getElementById('hero');
    function onHeroPointerMove(e) {
      var rect = wrap.getBoundingClientRect();
      var relX = e.clientX - rect.left;
      var relY = e.clientY - rect.top;
      var marginX = 260;
      var marginY = 180;
      var isNear = relX >= -marginX && relX <= rect.width + marginX &&
                  relY >= -marginY && relY <= rect.height + marginY;
      if (isNear) {
        isHovered = true;
        targetMouseX = relX;
        targetMouseY = relY;
        wakeAnimation();
      } else if (isHovered) {
        isHovered = false;
        targetMouseX = -9999;
        targetMouseY = -9999;
        wakeAnimation();
      }
    }

    function onHeroPointerLeave() {
      isHovered = false;
      targetMouseX = -9999;
      targetMouseY = -9999;
      wakeAnimation();
    }

    function onPointerDown(e) {
      var rect = wrap.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      var clickY = e.clientY - rect.top;
      waves.push({
        x: clickX,
        y: clickY,
        r: 0,
        maxR: rect.width * 0.85,
        life: 1
      });
      wakeAnimation();
    }

    function onResize() {
      resize();
      wakeAnimation();
    }

    wrap.addEventListener('pointerenter', onPointerEnter);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerleave', onPointerLeave);
    wrap.addEventListener('pointerdown', onPointerDown);
    if (heroEl) {
      heroEl.addEventListener('pointermove', onHeroPointerMove);
      heroEl.addEventListener('pointerleave', onHeroPointerLeave);
    }
    window.addEventListener('resize', onResize);

    desktopCleanups.push(function() {
      if (animFrameId) {
        cancelDesktopRaf(animFrameId);
        animFrameId = null;
      }
      wrap.removeEventListener('pointerenter', onPointerEnter);
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('pointerdown', onPointerDown);
      if (heroEl) {
        heroEl.removeEventListener('pointermove', onHeroPointerMove);
        heroEl.removeEventListener('pointerleave', onHeroPointerLeave);
      }
      window.removeEventListener('resize', onResize);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() {
        if (!isDesktopActive) return;
        resize();
        wakeAnimation();
      }).catch(function() {});
    }

    if ('IntersectionObserver' in window && heroEl) {
      var heroObs = new IntersectionObserver(function(entries) {
        if (!entries || !entries.length) return;
        isHeroVisible = entries[0].isIntersecting;
        if (isHeroVisible) {
          wakeAnimation();
        }
      }, { threshold: 0.05 });
      heroObs.observe(heroEl);
      desktopCleanups.push(function() {
        heroObs.disconnect();
      });
    }

    resize();
    wakeAnimation();
  }

  function initHeroPreviewSidebar() {
    var frame = document.getElementById('hero-product-frame');
    var navItems = Array.prototype.slice.call(document.querySelectorAll('.replica-sidebar button.replica-nav-item'));
    var views = document.querySelectorAll('.replica-content .replica-view-pane');
    var hudLabel = document.getElementById('hero-hud-label');
    var hudBtn = document.getElementById('hero-hud-toggle');
    var hudIcon = document.getElementById('hero-hud-icon');
    var cursor = document.getElementById('hero-sim-cursor');
    var ripple = document.getElementById('hero-sim-ripple');

    if (!frame || !navItems.length || !views.length) return;

    var isUserInteracting = false;
    var isManualPause = false;
    var currentActIdx = 0;
    var actTimer = null;
    var subTimers = [];
    var isHeroVisible = true;

    var cameraClasses = [
      'cam-wide',
      'cam-zoom-budgets',
      'cam-zoom-goals',
      'cam-zoom-vault',
      'cam-zoom-dashboard'
    ];

    function clearAllTimers() {
      if (actTimer) {
        clearDesktopTimeout(actTimer);
        actTimer = null;
      }
      while (subTimers.length > 0) {
        clearDesktopTimeout(subTimers.pop());
      }
    }

    function addSubTimer(fn, delay) {
      var t = safeDesktopTimeout(fn, delay);
      subTimers.push(t);
      return t;
    }

    function moveCursor(x, y) {
      if (!cursor) return;
      cursor.style.opacity = '1';
      cursor.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
    }

    function triggerRipple(x, y) {
      if (!ripple) return;
      ripple.style.left = Math.round(x) + 'px';
      ripple.style.top = Math.round(y) + 'px';
      ripple.classList.remove('animate');
      void ripple.offsetWidth; // force reflow
      ripple.classList.add('animate');
    }

    function setCamera(className) {
      cameraClasses.forEach(function(c) {
        frame.classList.remove(c);
      });
      if (className) {
        frame.classList.add(className);
      }
    }

    function switchViewPane(viewKey) {
      views.forEach(function(pane) {
        var key = pane.getAttribute('data-view');
        if (key === viewKey) {
          pane.style.display = 'block';
          pane.classList.add('active');
        } else {
          pane.style.display = 'none';
          pane.classList.remove('active');
        }
      });
      navItems.forEach(function(item) {
        var key = item.getAttribute('data-hero-view');
        if (key === viewKey) {
          item.classList.add('active');
          item.setAttribute('aria-selected', 'true');
        } else {
          item.classList.remove('active');
          item.setAttribute('aria-selected', 'false');
        }
      });
    }

    function updateHud(text, isPlaying) {
      if (hudLabel) hudLabel.textContent = text;
      if (hudIcon) {
        hudIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
      }
    }

    // Helper to get element coordinates inside unscaled frame
    function getFrameCoords(el) {
      if (!el || !frame) return { x: 100, y: 100 };
      var x = 0, y = 0;
      var curr = el;
      while (curr && curr !== frame) {
        x += curr.offsetLeft || 0;
        y += curr.offsetTop || 0;
        curr = curr.offsetParent;
      }
      return {
        x: x + (el.offsetWidth ? el.offsetWidth / 2 : 0),
        y: y + (el.offsetHeight ? el.offsetHeight / 2 : 0)
      };
    }

    // 4 High-Energy Acts
    var acts = [
      // ACT 1: Budgets
      {
        key: 'budgets',
        tabId: 'hero-tab-budgets',
        run: function() {
          var tab = document.getElementById('hero-tab-budgets');
          var tabCoords = getFrameCoords(tab);
          
          // 1. Zoom wide, move cursor to tab
          setCamera('cam-wide');
          moveCursor(tabCoords.x, tabCoords.y);

          // 2. Click tab at 600ms
          addSubTimer(function() {
            triggerRipple(tabCoords.x, tabCoords.y);
            switchViewPane('budgets');
            updateHud('01 · Category Budgets (Zooming In...)', true);
          }, 600);

          // 3. Zoom camera in at 800ms
          addSubTimer(function() {
            setCamera('cam-zoom-budgets');
          }, 800);

          // 4. Move cursor to Food & Groceries bar inside pane at 1300ms
          addSubTimer(function() {
            var pane = document.getElementById('hero-view-budgets');
            var foodCard = pane ? pane.querySelectorAll('.budget-mini-card')[1] : null;
            var coords = foodCard ? getFrameCoords(foodCard) : { x: 500, y: 210 };
            moveCursor(coords.x + 40, coords.y);

            // 5. Click food budget at 1800ms -> Action implements!
            addSubTimer(function() {
              triggerRipple(coords.x + 40, coords.y);
              updateHud('01 · Live Headroom Recalculated (84% Spent)', true);
              if (foodCard) {
                var fill = foodCard.querySelector('.motion-bar-fill');
                if (fill) {
                  fill.style.width = '20%';
                  addSubTimer(function() {
                    fill.style.width = '84%';
                  }, 50);
                }
              }
            }, 500);
          }, 1300);

          // 6. Camera zooms out to wide at 2900ms
          addSubTimer(function() {
            setCamera('cam-wide');
            updateHud('01 · Category Budgets (Completed)', true);
          }, 2900);
        }
      },

      // ACT 2: Goals
      {
        key: 'goals',
        tabId: 'hero-tab-goals',
        run: function() {
          var tab = document.getElementById('hero-tab-goals');
          var tabCoords = getFrameCoords(tab);

          // 1. Zoom wide, move cursor to Goals tab
          setCamera('cam-wide');
          moveCursor(tabCoords.x, tabCoords.y);

          // 2. Click tab at 600ms
          addSubTimer(function() {
            triggerRipple(tabCoords.x, tabCoords.y);
            switchViewPane('goals');
            updateHud('02 · Goals & Momentum (Zooming In...)', true);
          }, 600);

          // 3. Zoom camera in at 800ms
          addSubTimer(function() {
            setCamera('cam-zoom-goals');
          }, 800);

          // 4. Move cursor to Emergency Fund ring at 1300ms
          addSubTimer(function() {
            var pane = document.getElementById('hero-view-goals');
            var ringCard = pane ? pane.querySelector('.goal-mini-card.ring-card') : null;
            var coords = ringCard ? getFrameCoords(ringCard) : { x: 420, y: 175 };
            moveCursor(coords.x, coords.y);

            // 5. Click Emergency Fund at 1800ms -> Action implements!
            addSubTimer(function() {
              triggerRipple(coords.x, coords.y);
              updateHud('02 · 6 Months Runway Secured (50% Funded)', true);
              if (pane) {
                var ring = pane.querySelector('.goal-ring-svg .ring-fill');
                var pctEl = pane.querySelector('.goal-ring-pct');
                if (ring) {
                  ring.style.strokeDasharray = '0, 100';
                  addSubTimer(function() {
                    ring.style.transition = 'stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1)';
                    ring.style.strokeDasharray = '50, 100';
                  }, 50);
                }
                if (pctEl) {
                  tickNumber(pctEl, 0, 50, 850, '', '%', 0);
                }
              }
            }, 500);
          }, 1300);

          // 6. Camera zooms out to wide at 2900ms
          addSubTimer(function() {
            setCamera('cam-wide');
            updateHud('02 · Goals Momentum (Completed)', true);
          }, 2900);
        }
      },

      // ACT 3: Vault
      {
        key: 'vault',
        tabId: 'hero-tab-vault',
        run: function() {
          var tab = document.getElementById('hero-tab-vault');
          var tabCoords = getFrameCoords(tab);

          // 1. Zoom wide, move cursor to Vault tab
          setCamera('cam-wide');
          moveCursor(tabCoords.x, tabCoords.y);

          // 2. Click tab at 600ms
          addSubTimer(function() {
            triggerRipple(tabCoords.x, tabCoords.y);
            switchViewPane('vault');
            updateHud('03 · Encrypted Vault (Zooming In...)', true);
          }, 600);

          // 3. Zoom camera in at 800ms
          addSubTimer(function() {
            setCamera('cam-zoom-vault');
          }, 800);

          // 4. Move cursor to first encrypted account row at 1300ms
          addSubTimer(function() {
            var pane = document.getElementById('hero-view-vault');
            var firstRow = pane ? pane.querySelector('.vault-blur-box') : null;
            var coords = firstRow ? getFrameCoords(firstRow) : { x: 500, y: 165 };
            moveCursor(coords.x + 60, coords.y);

            // 5. Click encrypted row at 1800ms -> Action implements! Decrypts!
            addSubTimer(function() {
              triggerRipple(coords.x + 60, coords.y);
              updateHud('03 · AES-GCM Decrypted: A/C 4091 Revealed', true);
              if (firstRow) {
                firstRow.classList.add('auto-decrypted');
                addSubTimer(function() {
                  firstRow.classList.remove('auto-decrypted');
                }, 1600);
              }
            }, 500);
          }, 1300);

          // 6. Camera zooms out to wide at 2900ms
          addSubTimer(function() {
            setCamera('cam-wide');
            updateHud('03 · Encrypted Vault (Completed)', true);
          }, 2900);
        }
      },

      // ACT 4: Dashboard
      {
        key: 'dashboard',
        tabId: 'hero-tab-dashboard',
        run: function() {
          var tab = document.getElementById('hero-tab-dashboard');
          var tabCoords = getFrameCoords(tab);

          // 1. Zoom wide, move cursor to Dashboard tab
          setCamera('cam-wide');
          moveCursor(tabCoords.x, tabCoords.y);

          // 2. Click tab at 600ms
          addSubTimer(function() {
            triggerRipple(tabCoords.x, tabCoords.y);
            switchViewPane('dashboard');
            updateHud('04 · Net Balance Trend (Zooming In...)', true);
          }, 600);

          // 3. Zoom camera in at 800ms
          addSubTimer(function() {
            setCamera('cam-zoom-dashboard');
          }, 800);

          // 4. Move cursor along Net Balance Curve at 1300ms
          addSubTimer(function() {
            var pane = document.getElementById('hero-view-dashboard');
            var curve = document.getElementById('hero-balance-curve');
            var safeEl = document.getElementById('hero-stat-safe');
            
            // Scrub from left to right along curve
            moveCursor(350, 315);
            addSubTimer(function() {
              moveCursor(560, 290);
              triggerRipple(560, 290);
              updateHud('04 · Surplus Recomputed: +₹37,530 Safe', true);
              if (curve) {
                curve.classList.add('curve-glow-streak');
                addSubTimer(function() { curve.classList.remove('curve-glow-streak'); }, 1400);
              }
              if (safeEl) {
                safeEl.classList.add('stat-glow-pulse');
                addSubTimer(function() { safeEl.classList.remove('stat-glow-pulse'); }, 1400);
              }
            }, 600);
          }, 1300);

          // 6. Camera zooms out to wide at 2900ms
          addSubTimer(function() {
            setCamera('cam-wide');
            updateHud('04 · Ledger Overview (Completed)', true);
          }, 2900);
        }
      }
    ];

    var ACT_DURATION = 3600;

    function stepTour() {
      if (isUserInteracting || isManualPause || !isHeroVisible) return;
      var act = acts[currentActIdx];
      act.run();

      actTimer = safeDesktopTimeout(function() {
        currentActIdx = (currentActIdx + 1) % acts.length;
        stepTour();
      }, ACT_DURATION);
    }

    // Manual user override on click
    navItems.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-hero-view');
        clearAllTimers();
        isUserInteracting = true;
        frame.classList.add('is-user-interacting');
        setCamera('cam-wide');
        if (cursor) cursor.style.opacity = '0';
        switchViewPane(key);
        updateHud('Manual: ' + key.toUpperCase(), false);

        // Resume auto showcase after 8s of inactivity
        safeDesktopTimeout(function() {
          isUserInteracting = false;
          frame.classList.remove('is-user-interacting');
          for (var i = 0; i < acts.length; i++) {
            if (acts[i].key === key) {
              currentActIdx = (i + 1) % acts.length;
              break;
            }
          }
          stepTour();
        }, 8000);
      });
    });

    // HUD toggle button
    if (hudBtn) {
      hudBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        isManualPause = !isManualPause;
        if (isManualPause) {
          clearAllTimers();
          setCamera('cam-wide');
          if (cursor) cursor.style.opacity = '0';
          updateHud('Demo Paused', false);
        } else {
          isUserInteracting = false;
          frame.classList.remove('is-user-interacting');
          stepTour();
        }
      });
    }

    // Intersection Observer
    var heroEl = document.getElementById('hero');
    if (heroEl && 'IntersectionObserver' in window) {
      var heroObs = new IntersectionObserver(function(entries) {
        if (!entries || !entries.length) return;
        var wasVisible = isHeroVisible;
        isHeroVisible = entries[0].isIntersecting;
        if (isHeroVisible && !wasVisible && !isUserInteracting && !isManualPause) {
          stepTour();
        } else if (!isHeroVisible) {
          clearAllTimers();
        }
      }, { threshold: 0.1 });
      heroObs.observe(heroEl);
      desktopCleanups.push(function() {
        heroObs.disconnect();
      });
    }

    desktopCleanups.push(function() {
      clearAllTimers();
      if (frame) {
        frame.classList.remove('is-user-interacting');
        cameraClasses.forEach(function(c) { frame.classList.remove(c); });
      }
    });

    // Kick off Act 1
    stepTour();
  }

  function initPaperCardsEmeraldSpotlight() {
    var cards = document.querySelectorAll('.paper-card');
    if (!cards.length) return;

    cards.forEach(function(card) {
      function onCardMove(e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      }
      card.addEventListener('pointermove', onCardMove);
      desktopCleanups.push(function() {
        card.removeEventListener('pointermove', onCardMove);
      });
    });
  }

  function initScrollReveal() {
    if (isReducedMotion) {
      document.querySelectorAll('.lp-reveal').forEach(function(el) {
        el.classList.add('is-revealed');
      });
      return;
    }

    // Auto-tag key headings if not tagged
    document.querySelectorAll('.section-head-center').forEach(function(head) {
      if (!head.classList.contains('lp-reveal')) {
        head.classList.add('lp-reveal');
      }
    });

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.lp-reveal').forEach(function(el) {
        el.classList.add('is-revealed');
      });
      return;
    }

    var revealObs = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.lp-reveal').forEach(function(el) {
      revealObs.observe(el);
    });

    desktopCleanups.push(function() {
      revealObs.disconnect();
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

        safeDesktopTimeout(function() {
          if (icon) icon.className = 'fas fa-circle-check text-emerald';
          if (text) text.textContent = 'Cloud Synced';
        }, 900);
      }
    }

    var feedInterval = safeDesktopInterval(addLiveRow, 7500);
    desktopCleanups.push(function() {
      clearDesktopInterval(feedInterval);
    });

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
      desktopCleanups.push(function() { obs.disconnect(); });
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
    var section = document.getElementById('motion') || document.getElementById('features');
    if (!section) return;

    var tabs = document.querySelectorAll('.motion-tab-btn');
    var scenes = document.querySelectorAll('.motion-scene');
    var cursor = document.getElementById('motion-cursor');
    var ripple = document.getElementById('motion-ripple');
    var stage = document.querySelector('.motion-stage') || section;
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
        var tid = sceneTimeouts.pop();
        clearDesktopTimeout(tid);
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

        var t0a = safeDesktopTimeout(function() {
          var amtPt = getElementCenterInStage(amtBox);
          cursor.style.transform = 'translate(' + amtPt.x + 'px, ' + amtPt.y + 'px)';

          var t0b = safeDesktopTimeout(function() {
            var s1Amt = document.getElementById('scene1-amt-text');
            if (s1Amt) {
              s1Amt.textContent = '1';
              setTimeout(function() { s1Amt.textContent = '12'; }, 100);
              setTimeout(function() { s1Amt.textContent = '120'; }, 200);
              setTimeout(function() { s1Amt.textContent = '1,200'; }, 300);
            }

            var t0c = safeDesktopTimeout(function() {
              var s1Tag = document.getElementById('scene1-cat-tag');
              if (s1Tag) s1Tag.innerHTML = '<i class="fas fa-tag"></i> Groceries';

              var btnPt = getElementCenterInStage(submitBtn);
              cursor.style.transform = 'translate(' + btnPt.x + 'px, ' + btnPt.y + 'px)';

              var t0d = safeDesktopTimeout(function() {
                if (submitBtn) submitBtn.classList.add('sim-pressed');
                triggerRipple(btnPt.x, btnPt.y);

                var t0e = safeDesktopTimeout(function() {
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
            }, 500);
            sceneTimeouts.push(t0c);
          }, 350);
          sceneTimeouts.push(t0b);
        }, 250);
        sceneTimeouts.push(t0a);

      } else if (idx === 1) {
        var actionBtn2 = document.getElementById('scene2-action-btn');
        cursor.style.transform = 'translate(60px, 60px)';

        var t1a = safeDesktopTimeout(function() {
          var btnPt2 = getElementCenterInStage(actionBtn2);
          cursor.style.transform = 'translate(' + btnPt2.x + 'px, ' + btnPt2.y + 'px)';

          var t1b = safeDesktopTimeout(function() {
            if (actionBtn2) actionBtn2.classList.add('sim-pressed');
            triggerRipple(btnPt2.x, btnPt2.y);

            var t1c = safeDesktopTimeout(function() {
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

        var t2a = safeDesktopTimeout(function() {
          var btnPt3 = getElementCenterInStage(addBtn3);
          cursor.style.transform = 'translate(' + btnPt3.x + 'px, ' + btnPt3.y + 'px)';

          var t2b = safeDesktopTimeout(function() {
            if (addBtn3) addBtn3.classList.add('sim-pressed');
            triggerRipple(btnPt3.x, btnPt3.y);

            var t2c = safeDesktopTimeout(function() {
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

        var t3a = safeDesktopTimeout(function() {
          var btnPt4 = getElementCenterInStage(repayBtn4);
          cursor.style.transform = 'translate(' + btnPt4.x + 'px, ' + btnPt4.y + 'px)';

          var t3b = safeDesktopTimeout(function() {
            if (repayBtn4) repayBtn4.classList.add('sim-pressed');
            triggerRipple(btnPt4.x, btnPt4.y);

            var t3c = safeDesktopTimeout(function() {
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

    var actionButtons = [
      { id: 'scene1-submit-btn', idx: 0 },
      { id: 'scene2-action-btn', idx: 1 },
      { id: 'scene3-add-btn', idx: 2 },
      { id: 'scene4-repay-btn', idx: 3 }
    ];
    actionButtons.forEach(function(item) {
      var btn = document.getElementById(item.id);
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          clearSceneTimeouts();
          if (cursor) cursor.style.opacity = '0';
          activeIdx = item.idx;
          renderFinalState(item.idx);
          startTime = performance.now();
        });
      }
    });

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
      animFrame = safeDesktopRaf(tick);
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
      desktopCleanups.push(function() { observer.disconnect(); });
    } else {
      isVisible = true;
    }

    document.addEventListener('visibilitychange', function() {
      isPaused = document.hidden;
    });

    if (!isReducedMotion) {
      animFrame = safeDesktopRaf(tick);
    } else {
      for (var k = 0; k < scenes.length; k++) {
        renderFinalState(k);
      }
    }

    desktopCleanups.push(function() {
      if (animFrame) cancelDesktopRaf(animFrame);
      clearSceneTimeouts();
    });
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
          row.innerHTML = '<span>' + r.note + '</span> <span class="tabular-nums">' + r.amt + '</span>';
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

    if (window.IntersectionObserver) {
      var thresholds = [];
      for (var i = 0; i <= 20; i++) {
        thresholds.push(i / 20);
      }
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var ratio = entry.intersectionRatio;
          var litCount = Math.floor(ratio * words.length);
          words.forEach(function(word, idx) {
            if (idx <= litCount) {
              word.classList.add('lit');
            } else {
              word.classList.remove('lit');
            }
          });
        });
      }, { threshold: thresholds });
      obs.observe(manifesto);
      desktopCleanups.push(function() { obs.disconnect(); });
    }
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
      slider.style.background = 'linear-gradient(to right, #10b981 ' + pct.toFixed(1) + '%, rgba(255, 255, 255, 0.12) ' + pct.toFixed(1) + '%)';
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

  function initDesktopExperience() {
    if (isDesktopActive) return;
    isDesktopActive = true;
    initHeroSpotlightAndTilt();
    initHeroLedgerTitle();
    initHeroPreviewSidebar();
    initPaperCardsEmeraldSpotlight();
    initHeroDashboardLiveFeed();
    initChartScrubbing();
    initMotionTour();
    initCategoryInspector();
    initInteractiveDonut();
    initPwaCard();
    initPaperInteractions();
    initPullThePlugDemo();
    initManifestoScrollIllumination();
  }

  function teardownDesktopExperience() {
    if (!isDesktopActive) return;
    isDesktopActive = false;

    // Clear all desktop timers, intervals, and animation frames
    while (desktopTimers.length > 0) clearTimeout(desktopTimers.pop());
    while (desktopIntervals.length > 0) clearInterval(desktopIntervals.pop());
    while (desktopAnimFrames.length > 0) cancelAnimationFrame(desktopAnimFrames.pop());

    // Run cleanups (observers, listeners)
    while (desktopCleanups.length > 0) {
      try {
        var cleanup = desktopCleanups.pop();
        if (typeof cleanup === 'function') cleanup();
      } catch (e) {}
    }
  }

  /* =========================================================================
     Screen.Movie Motion System: Appear Observer, Scroll Lift & Demos
     ========================================================================= */
  function initAppearObserver() {
    var appearEls = document.querySelectorAll('[data-appear]');
    if (!appearEls.length) return;

    if (isReducedMotion || !('IntersectionObserver' in window)) {
      appearEls.forEach(function(el) {
        el.classList.add('is-appeared');
      });
      return;
    }

    var appearObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-appeared');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.20,
      rootMargin: '0px 0px -40px 0px'
    });

    appearEls.forEach(function(el) {
      appearObserver.observe(el);
    });

    // Reveal hero initial elements smoothly
    setTimeout(function() {
      var heroAppears = document.querySelectorAll('#hero [data-appear]');
      heroAppears.forEach(function(el) {
        el.classList.add('is-appeared');
      });
    }, 60);
  }

  function initNavScrollPill() {
    var nav = document.getElementById('landing-nav-pill');
    if (!nav) return;

    function onScroll() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (scrollY > 30) {
        nav.classList.add('is-scrolled');
      } else {
        nav.classList.remove('is-scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initScrollDrivenProductWindow() {
    var frame = document.getElementById('hero-product-frame');
    if (!frame) return;

    var isTicking = false;
    function updateWindowTransform() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var hero = document.getElementById('hero');
      var heroHeight = hero ? hero.offsetHeight : 800;
      var progress = Math.min(Math.max(scrollY / (heroHeight * 0.7), 0), 1);

      var scale = 0.94 + (0.06 * progress);
      var translateY = (1 - progress) * 20;
      frame.style.transform = 'scale(' + scale.toFixed(4) + ') translateY(' + translateY.toFixed(1) + 'px)';
      isTicking = false;
    }

    window.addEventListener('scroll', function() {
      if (!isTicking) {
        window.requestAnimationFrame(updateWindowTransform);
        isTicking = true;
      }
    }, { passive: true });

    updateWindowTransform();
  }

  function initDemoVisibilityObservers() {
    if (!('IntersectionObserver' in window)) return;

    var demoSections = document.querySelectorAll('.feature-section, #offline-demo, #simulator');
    var demoObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var isVis = entry.isIntersecting;
        entry.target.setAttribute('data-demo-active', isVis ? 'true' : 'false');
      });
    }, { threshold: 0.40 });

    demoSections.forEach(function(sec) {
      demoObserver.observe(sec);
    });
  }

  function initAll() {
    var desktopMql = window.matchMedia('(min-width: 768px)');

    function handleDesktopBreakpoint(e) {
      if (e.matches) {
        initDesktopExperience();
      } else {
        teardownDesktopExperience();
      }
    }

    if (desktopMql.addEventListener) {
      desktopMql.addEventListener('change', handleDesktopBreakpoint);
    } else if (desktopMql.addListener) {
      desktopMql.addListener(handleDesktopBreakpoint);
    }

    if (desktopMql.matches) {
      initDesktopExperience();
    }

    // Shared features across all viewports
    initSimulatorSliders();
    initScrollReveal();
    initAppearObserver();
    initNavScrollPill();
    initScrollDrivenProductWindow();
    initDemoVisibilityObservers();
    window.__ledgio_landingReady = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }


})();
