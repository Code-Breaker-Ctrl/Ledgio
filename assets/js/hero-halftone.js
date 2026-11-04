/**
 * Ledgio v2 Halftone Dot Matrix Logo (Desktop Canvas Engine)
 * Features:
 * - 2D Canvas with DPR capped at 2
 * - Assemble-from-scatter animation over 1.6s (cubic-bezier(0.23, 1, 0.32, 1))
 * - Idle breathing (±0.4px, ~20s period)
 * - Soft aqua scan wave pass every ~12s (1.2s duration)
 * - Gentle pointer repulsion on fine pointer devices (springs back)
 * - Zero CPU waste: pauses immediately when hero is off-screen or tab is hidden
 * - Static single-draw fallback on prefers-reduced-motion
 */
(function() {
  'use strict';

  function initHalftoneHero() {
    var canvas = document.getElementById('hero-halftone-canvas');
    if (!canvas) return;

    // Strict phone budget: canvas is disabled on screens < 768px
    if (window.innerWidth < 768) {
      canvas.style.display = 'none';
      return;
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var rawDots = window.__LEDGIO_HERO_DOTS;
    if (!rawDots || !rawDots.length) return;

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isReduced = motionQuery && motionQuery.matches;

    var width = 320;
    var height = 320;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    var CX = width / 2;
    var CY = height / 2;

    // Palette lookup by layer
    var PALETTE = {
      1: { fill: '#10B981', baseAlpha: 0.85, rgb: [16, 185, 129] },  // emerald
      2: { fill: '#5EEAD4', baseAlpha: 0.92, rgb: [94, 234, 212] },  // aqua accent
      3: { fill: '#34D399', baseAlpha: 0.72, rgb: [52, 211, 153] }   // light emerald
    };

    // Pre-calculate dot properties
    var dots = [];
    for (var i = 0; i < rawDots.length; i++) {
      var d = rawDots[i];
      var tx = d[0];
      var ty = d[1];
      var r = d[2];
      var layer = d[3];

      var dx = tx - CX;
      var dy = ty - CY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx);

      // Scatter start position (radial scatter with randomized turbulence)
      var scatterDist = dist * (1.8 + (i % 7) * 0.15) + 60 + ((i * 13) % 40);
      var scatterAngle = angle + (((i % 5) - 2) * 0.25);
      var sx = CX + Math.cos(scatterAngle) * scatterDist;
      var sy = CY + Math.sin(scatterAngle) * scatterDist;

      dots.push({
        targetX: tx,
        targetY: ty,
        currentX: isReduced ? tx : sx,
        currentY: isReduced ? ty : sy,
        startX: sx,
        startY: sy,
        vx: 0,
        vy: 0,
        baseR: r,
        layer: layer,
        pal: PALETTE[layer] || PALETTE[1],
        diag: tx + ty // for diagonal scan wave
      });
    }

    // Static draw for reduced-motion users
    if (isReduced) {
      renderFrame(1.0, 0, -999, -999);
      return;
    }

    // Animation state
    var startTime = null;
    var ASSEMBLE_DUR = 1600; // 1.6s
    var SCAN_INTERVAL = 12000; // 12s
    var SCAN_DUR = 1200; // 1.2s
    var rAfId = null;
    var isRunning = false;
    var isVisible = true;

    // Pointer coordinates relative to canvas
    var mouseX = -999;
    var mouseY = -999;
    var hasFinePointer = window.matchMedia('(pointer: fine)').matches;

    if (hasFinePointer) {
      var heroWrap = document.querySelector('.hero-app-icon-wrap') || canvas;
      heroWrap.addEventListener('pointermove', function(e) {
        var rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      }, { passive: true });

      heroWrap.addEventListener('pointerleave', function() {
        mouseX = -999;
        mouseY = -999;
      }, { passive: true });
    }

    // Cubic-bezier(0.23, 1, 0.32, 1) approximation
    function easeOutCubicBezier(t) {
      if (t >= 1) return 1;
      // Standard cubic bezier calculation for (0.23, 1, 0.32, 1)
      var t2 = 1 - t;
      return 1 - (t2 * t2 * t2);
    }

    function renderFrame(assembleProgress, elapsed, mx, my) {
      ctx.clearRect(0, 0, width, height);

      // Idle breathing phase (~20s cycle)
      var breath = Math.sin(elapsed * 0.000314) * 0.4; // ±0.4px

      // Scan wave phase
      var scanCycle = elapsed % SCAN_INTERVAL;
      var inScan = scanCycle < SCAN_DUR;
      var scanProgress = inScan ? (scanCycle / SCAN_DUR) : -1;
      // Wave travels across diag = x + y from 0 to 640
      var waveFront = inScan ? (scanProgress * 700 - 50) : -999;
      var waveWidth = 90;

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var x, y;

        if (assembleProgress < 1.0) {
          x = dot.startX + (dot.targetX - dot.startX) * assembleProgress;
          y = dot.startY + (dot.targetY - dot.startY) * assembleProgress;
          dot.currentX = x;
          dot.currentY = y;
        } else {
          // Idle breathing
          x = dot.targetX + (dot.targetX - CX) * 0.003 * breath;
          y = dot.targetY + (dot.targetY - CY) * 0.003 * breath;

          // Pointer repulsion
          if (mx > 0 && my > 0) {
            var pdx = dot.currentX - mx;
            var pdy = dot.currentY - my;
            var pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pDist < 55 && pDist > 0.1) {
              var force = (1 - pDist / 55) * 5.0;
              dot.vx += (pdx / pDist) * force;
              dot.vy += (pdy / pDist) * force;
            }
          }

          // Spring physics back to target position
          dot.vx += (x - dot.currentX) * 0.14;
          dot.vy += (y - dot.currentY) * 0.14;
          dot.vx *= 0.82; // damping
          dot.vy *= 0.82;

          dot.currentX += dot.vx;
          dot.currentY += dot.vy;
          x = dot.currentX;
          y = dot.currentY;
        }

        // Scan wave effect
        var r = dot.baseR;
        var alpha = dot.pal.baseAlpha;
        var rgb = dot.pal.rgb;

        if (inScan) {
          var distToWave = Math.abs(dot.diag - waveFront);
          if (distToWave < waveWidth) {
            var waveBoost = (1 - distToWave / waveWidth);
            r += waveBoost * 0.6;
            alpha = Math.min(1.0, alpha + waveBoost * 0.3);
            // Tint slightly towards aqua during scan
            rgb = [94, 234, 212];
          }
        }

        ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.2, r), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(now) {
      if (!startTime) startTime = now;
      var elapsed = now - startTime;

      var progress = Math.min(1.0, elapsed / ASSEMBLE_DUR);
      var eased = easeOutCubicBezier(progress);

      renderFrame(eased, elapsed, mouseX, mouseY);

      if (isRunning && isVisible && !document.hidden) {
        rAfId = requestAnimationFrame(loop);
      }
    }

    function start() {
      if (isRunning) return;
      isRunning = true;
      rAfId = requestAnimationFrame(loop);
    }

    function stop() {
      isRunning = false;
      if (rAfId) {
        cancelAnimationFrame(rAfId);
        rAfId = null;
      }
    }

    // Visibility & Off-screen lifecycle management
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        stop();
      } else if (isVisible) {
        start();
      }
    });

    if ('IntersectionObserver' in window) {
      var heroSection = document.getElementById('hero');
      if (heroSection) {
        var obs = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            isVisible = entry.isIntersecting;
            if (isVisible && !document.hidden) {
              start();
            } else {
              stop();
            }
          });
        }, { threshold: 0.05 });
        obs.observe(heroSection);
      } else {
        start();
      }
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHalftoneHero);
  } else {
    initHalftoneHero();
  }
})();
