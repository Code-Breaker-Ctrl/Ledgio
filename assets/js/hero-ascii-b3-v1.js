/**
 * Ledgio Hero ASCII/Dither Assemble Layer (Phase A5, v1.11.4)
 * Desktop >= 1024px only.
 *
 * Renders an ASCII character dither overlay aligned to hero-art.webp.
 * Features:
 * - 1.6s assemble ease-in from scattered offsets (cubic-bezier(.23,1,.32,1))
 * - ~120 random cell character flickers every 600-1800ms
 * - 10s brightness sweep wave traveling along the voxel staircase
 * - Upper-right pixel cluster drifting upward and respawning
 * - Fine-pointer hover displacement (cells within 90px displace up to 8px and spring back)
 * - 30fps throttle, DPR capped at 2, IntersectionObserver & visibilitychange pause
 * - prefers-reduced-motion static draw
 * - Headline and subtitle avoidance preserving text contrast >= 4.5:1
 */
(function() {
  'use strict';

  // Desktop guard: >= 1024px only
  if (typeof window === 'undefined') return;

  var container = null;
  var heroSection = null;
  var canvas = null;
  var ctx = null;
  var rafId = null;
  var isRunning = false;
  var isVisible = true;
  var isTabActive = true;
  var prefersReducedMotion = false;
  var isFinePointer = false;

  // Source image native dimensions
  var SRC_W = 1672;
  var SRC_H = 941;
  var SRC_ASPECT = SRC_W / SRC_H;

  // Viewport & render geometry
  var containerW = 0;
  var containerH = 0;
  var dpr = 1;
  var rw = 0;
  var rh = 0;
  var ox = 0;
  var oy = 0;

  // Avoidance rects (headline & subtitle in container coordinates)
  var textAvoidRects = [];

  // Animation timing
  var startTime = 0;
  var lastFrameTime = 0;
  var FPS_INTERVAL = 1000 / 30; // 30fps cap (~33.3ms)

  // Assemble parameters
  var ASSEMBLE_TOTAL_DURATION = 1600; // ms
  var CELL_ASSEMBLE_DURATION = 1000;  // ms
  var STAGGER_SPAN = 600;            // ms

  // Pointer interaction
  var mouseX = -9999;
  var mouseY = -9999;
  var mouseActive = false;
  var MAX_HOVER_DIST = 90;
  var MAX_DISPLACE = 8;

  // Cell state caches
  var cellCount = 0;
  var scatterX = null;
  var scatterY = null;
  var cellStagger = null;
  var cellStairS = null;
  var cellPtrDx = null;
  var cellPtrDy = null;
  var isClusterCell = null;
  var clusterDriftPhase = null;

  // Idle flicker descriptors
  var FLICKER_COUNT = 120;
  var flickerIndices = [];
  var flickerNextSwap = [];
  var flickerCharIndices = [];

  // Opacity map for brightness levels 1..4
  var BASE_OPACITIES = [0, 0.25, 0.45, 0.75, 1.00];

  // Emil Kowalski / Apple ease-out cubic-bezier(.23, 1, .32, 1) evaluator
  function solveCubicBezier(p1x, p1y, p2x, p2y) {
    return function(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      // Newton-Raphson iteration to find parametric t for x
      var x = t;
      for (var i = 0; i < 6; i++) {
        var currentX = 3 * (1 - x) * (1 - x) * x * p1x + 3 * (1 - x) * x * x * p2x + x * x * x;
        var currentSlope = 3 * (1 - x) * (1 - x) * p1x + 6 * (1 - x) * x * (p2x - p1x) + 3 * x * x * (1 - p2x);
        if (Math.abs(currentSlope) < 1e-6) break;
        var dx = currentX - t;
        x -= dx / currentSlope;
        if (x < 0) x = 0;
        if (x > 1) x = 1;
      }
      return 3 * (1 - x) * (1 - x) * x * p1y + 3 * (1 - x) * x * x * p2y + x * x * x;
    };
  }
  var easeAssemble = solveCubicBezier(0.23, 1.0, 0.32, 1.0);

  // Simple deterministic hash for consistent initial scatter vectors
  function hash2(i, seed) {
    var h = (i * 374761393 + seed * 668265263) ^ 0x5bf03635;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function initCellState() {
    var data = window.__LEDGIO_HERO_ASCII;
    if (!data || !data.count) return;

    cellCount = data.count;
    scatterX = new Float32Array(cellCount);
    scatterY = new Float32Array(cellCount);
    cellStagger = new Float32Array(cellCount);
    cellStairS = new Float32Array(cellCount);
    cellPtrDx = new Float32Array(cellCount);
    cellPtrDy = new Float32Array(cellCount);
    isClusterCell = new Uint8Array(cellCount);
    clusterDriftPhase = new Float32Array(cellCount);

    var xs = data.x;
    var ys = data.y;

    for (var i = 0; i < cellCount; i++) {
      var nx = xs[i] / 100.0;
      var ny = ys[i] / 100.0;

      // Staircase progression s from bottom-left to top-right
      var s = 0.5 * nx + 0.5 * (1.0 - ny);
      if (s < 0) s = 0;
      if (s > 1) s = 1;
      cellStairS[i] = s;
      cellStagger[i] = s * STAGGER_SPAN;

      // Scatter vector: radius ~50..120px
      var angle = hash2(i, 1) * Math.PI * 2;
      var radius = 50 + hash2(i, 2) * 70;
      scatterX[i] = Math.cos(angle) * radius;
      scatterY[i] = Math.sin(angle) * radius;

      // Upper-right pixel cluster (x >= 76%, y <= 42%)
      if (xs[i] >= 76.0 && ys[i] <= 42.0) {
        isClusterCell[i] = 1;
        clusterDriftPhase[i] = hash2(i, 3);
      } else {
        isClusterCell[i] = 0;
        clusterDriftPhase[i] = 0;
      }
    }

    // Initialize ~120 idle flicker cells
    flickerIndices = [];
    flickerNextSwap = [];
    flickerCharIndices = [];
    var step = Math.max(1, Math.floor(cellCount / FLICKER_COUNT));
    for (var f = 0; f < cellCount && flickerIndices.length < FLICKER_COUNT; f += step) {
      flickerIndices.push(f);
      flickerNextSwap.push(ASSEMBLE_TOTAL_DURATION + 600 + Math.random() * 1200);
      flickerCharIndices.push(data.c[f]);
    }
  }

  function updateGeometry() {
    if (!container || !canvas) return;

    var rect = container.getBoundingClientRect();
    containerW = rect.width;
    containerH = rect.height;

    if (containerW <= 0 || containerH <= 0) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(containerW * dpr);
    canvas.height = Math.round(containerH * dpr);
    canvas.style.width = containerW + 'px';
    canvas.style.height = containerH + 'px';

    ctx = canvas.getContext('2d', { alpha: true });
    ctx.scale(dpr, dpr);

    // Cover crop math with object-position: right bottom
    var containerAspect = containerW / containerH;
    if (containerAspect > SRC_ASPECT) {
      // Container is wider than image
      rw = containerW;
      rh = containerW / SRC_ASPECT;
      ox = 0;
      oy = containerH - rh;
    } else {
      // Container is taller/narrower than image
      rh = containerH;
      rw = containerH * SRC_ASPECT;
      oy = 0;
      ox = containerW - rw;
    }

    // Cache headline, subtitle, CTA and trust-row bounding boxes for contrast preservation (Phase A6)
    textAvoidRects = [];
    var titleEl = document.querySelector('.hero-v3-title');
    var subEl = document.querySelector('.hero-v3-subline');
    var ctaEl = document.querySelector('.hero-v3-actions');
    var trustEl = document.querySelector('.hero-v3-proof');
    var pad = 24;

    [titleEl, subEl, ctaEl, trustEl].forEach(function(el) {
      if (el) {
        var elRect = el.getBoundingClientRect();
        textAvoidRects.push({
          left: elRect.left - rect.left - pad,
          top: elRect.top - rect.top - pad,
          right: elRect.right - rect.left + pad,
          bottom: elRect.bottom - rect.top + pad
        });
      }
    });

    if (typeof window !== 'undefined') {
      window.__LEDGIO_HERO_ASCII_TEST = {
        getAvoidRects: function() { return textAvoidRects; },
        isOverlappingText: isOverlappingText
      };
    }
  }

  function isOverlappingText(px, py) {
    for (var i = 0; i < textAvoidRects.length; i++) {
      var r = textAvoidRects[i];
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        return true;
      }
    }
    return false;
  }

  function drawStatic() {
    var data = window.__LEDGIO_HERO_ASCII;
    if (!data || !ctx) return;

    ctx.clearRect(0, 0, containerW, containerH);
    ctx.font = '11px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var xs = data.x;
    var ys = data.y;
    var bs = data.b;
    var cs = data.c;
    var chars = data.chars;

    for (var i = 0; i < cellCount; i++) {
      var px = ox + (xs[i] / 100.0) * rw;
      var py = oy + (ys[i] / 100.0) * rh;

      if (px < -15 || px > containerW + 15 || py < -15 || py > containerH + 15) continue;
      if (isOverlappingText(px, py)) continue;

      var b = bs[i];
      var alpha = BASE_OPACITIES[b] || 0.5;
      ctx.fillStyle = 'rgba(77, 243, 224, ' + alpha.toFixed(2) + ')';
      ctx.fillText(chars[cs[i]], px, py);
    }
  }

  var lastScrollAt = -Infinity;
  window.addEventListener('scroll', function() { lastScrollAt = performance.now(); }, {passive:true});
  function tick(timestamp) {
    if (!isRunning || !isVisible || !isTabActive) return;
    if (timestamp - lastScrollAt < 160) { rafId = requestAnimationFrame(tick); return; }

    // Throttle to 30fps
    var elapsedSinceLast = timestamp - lastFrameTime;
    if (elapsedSinceLast < FPS_INTERVAL) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastFrameTime = timestamp - (elapsedSinceLast % FPS_INTERVAL);

    if (!startTime) startTime = timestamp;
    var now = timestamp - startTime;

    var data = window.__LEDGIO_HERO_ASCII;
    if (!data || !ctx) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    ctx.clearRect(0, 0, containerW, containerH);
    ctx.font = '11px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var xs = data.x;
    var ys = data.y;
    var bs = data.b;
    var cs = data.c;
    var chars = data.chars;

    var isAssembling = now < ASSEMBLE_TOTAL_DURATION;

    // Idle: 10-second slow brightness wave along staircase
    var wavePhase = ((now - ASSEMBLE_TOTAL_DURATION) % 10000) / 10000;
    if (wavePhase < 0) wavePhase += 1.0;

    // Idle: update ~120 flicker cells
    if (!isAssembling) {
      for (var f = 0; f < flickerIndices.length; f++) {
        if (now >= flickerNextSwap[f]) {
          var origIdx = cs[flickerIndices[f]];
          // Alternate character ramp neighbor
          var randOffset = (Math.random() > 0.5 ? 1 : -1);
          var nextChar = origIdx + randOffset;
          if (nextChar < 0) nextChar = 1;
          if (nextChar >= chars.length) nextChar = chars.length - 2;
          flickerCharIndices[f] = nextChar;
          flickerNextSwap[f] = now + 600 + Math.random() * 1200;
        }
      }
    }

    // Render cells
    for (var i = 0; i < cellCount; i++) {
      var targetX = ox + (xs[i] / 100.0) * rw;
      var targetY = oy + (ys[i] / 100.0) * rh;

      // Quick viewport culling
      if (targetX < -40 || targetX > containerW + 40 || targetY < -40 || targetY > containerH + 40) {
        continue;
      }

      // Strict avoidance of headline and subtitle text
      if (isOverlappingText(targetX, targetY)) {
        continue;
      }

      var alpha = BASE_OPACITIES[bs[i]] || 0.5;
      var curX = targetX;
      var curY = targetY;
      var charToDraw = chars[cs[i]];

      if (isAssembling) {
        var stag = cellStagger[i];
        if (now < stag) {
          // Has not started assembling yet
          continue;
        }
        var prog = (now - stag) / CELL_ASSEMBLE_DURATION;
        if (prog < 1.0) {
          var ease = easeAssemble(prog);
          var rem = 1.0 - ease;
          curX = targetX + scatterX[i] * rem;
          curY = targetY + scatterY[i] * rem;
          alpha *= ease;
        }
      } else {
        // Idle mode enhancements
        // 1. Slow brightness wave sweep along steps
        var s = cellStairS[i];
        var distToWave = Math.abs(s - wavePhase);
        if (distToWave < 0.12) {
          var waveBoost = Math.cos((distToWave / 0.12) * (Math.PI / 2)) * 0.35;
          alpha = Math.min(1.0, alpha + waveBoost);
        }

        // 2. Upper-right pixel cluster drifting upward and respawning
        if (isClusterCell[i]) {
          var driftProg = ((now / 6000) + clusterDriftPhase[i]) % 1.0;
          curY -= driftProg * 16.0; // drift upward by up to 16px
          var fade = Math.sin(driftProg * Math.PI); // fade in and out
          alpha *= (0.4 + fade * 0.6);
        }
      }

      // 3. Pointer displacement (fine pointer hover within 90px)
      if (isFinePointer && mouseActive) {
        var mdx = curX - mouseX;
        var mdy = curY - mouseY;
        var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < MAX_HOVER_DIST && mdist > 0.01) {
          var disp = (1.0 - mdist / MAX_HOVER_DIST) * MAX_DISPLACE;
          var targetPtrX = (mdx / mdist) * disp;
          var targetPtrY = (mdy / mdist) * disp;
          cellPtrDx[i] += (targetPtrX - cellPtrDx[i]) * 0.25;
          cellPtrDy[i] += (targetPtrY - cellPtrDy[i]) * 0.25;
        } else {
          cellPtrDx[i] += (0 - cellPtrDx[i]) * 0.2;
          cellPtrDy[i] += (0 - cellPtrDy[i]) * 0.2;
        }
      } else if (cellPtrDx[i] !== 0 || cellPtrDy[i] !== 0) {
        // Spring back to 0
        cellPtrDx[i] += (0 - cellPtrDx[i]) * 0.2;
        cellPtrDy[i] += (0 - cellPtrDy[i]) * 0.2;
        if (Math.abs(cellPtrDx[i]) < 0.05) cellPtrDx[i] = 0;
        if (Math.abs(cellPtrDy[i]) < 0.05) cellPtrDy[i] = 0;
      }

      curX += cellPtrDx[i];
      curY += cellPtrDy[i];

      // Draw character
      if (alpha > 0.04) {
        ctx.fillStyle = 'rgba(77, 243, 224, ' + alpha.toFixed(2) + ')';
        ctx.fillText(charToDraw, curX, curY);
      }
    }

    // Substitute flicker chars for active flicker cells during idle
    if (!isAssembling) {
      for (var k = 0; k < flickerIndices.length; k++) {
        var fIdx = flickerIndices[k];
        var fTargetX = ox + (xs[fIdx] / 100.0) * rw + cellPtrDx[fIdx];
        var fTargetY = oy + (ys[fIdx] / 100.0) * rh + cellPtrDy[fIdx];
        if (isOverlappingText(fTargetX, fTargetY)) continue;
        if (fTargetX < 0 || fTargetX > containerW || fTargetY < 0 || fTargetY > containerH) continue;

        var fAlpha = Math.min(1.0, (BASE_OPACITIES[bs[fIdx]] || 0.5) * 1.25);
        ctx.fillStyle = 'rgba(77, 243, 224, ' + fAlpha.toFixed(2) + ')';
        ctx.fillText(chars[flickerCharIndices[k]], fTargetX, fTargetY);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (!isRunning) return;
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function handleResize() {
    if (window.innerWidth < 1024) {
      stopLoop();
      if (canvas) canvas.style.display = 'none';
      return;
    }

    if (canvas) canvas.style.display = 'block';
    updateGeometry();

    if (prefersReducedMotion) {
      drawStatic();
    } else if (isVisible && isTabActive && !isRunning) {
      startLoop();
    }
  }

  function init() {
    if (window.innerWidth < 1024) {
      // Zero canvas, zero ASCII layer on < 1024px
      window.addEventListener('resize', debounce(handleResize, 150));
      return;
    }

    container = document.querySelector('.hero-art-container');
    heroSection = document.getElementById('hero') || document.querySelector('.hero-v3');
    if (!container || !heroSection) return;

    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isFinePointer = window.matchMedia('(pointer: fine)').matches;

    // Create canvas layer inside .hero-art-container
    canvas = document.createElement('canvas');
    canvas.className = 'hero-ascii-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2'; // sits behind foreground text, above art base
    container.appendChild(canvas);

    initCellState();
    updateGeometry();

    // IntersectionObserver to pause loop when scrolled out of view
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          isVisible = entry.isIntersecting;
          if (isVisible && isTabActive && !isRunning && !prefersReducedMotion) {
            startLoop();
          } else if (!isVisible && isRunning) {
            stopLoop();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(heroSection);
    }

    // Page visibility to pause loop when tab is hidden
    document.addEventListener('visibilitychange', function() {
      isTabActive = !document.hidden;
      if (isTabActive && isVisible && !isRunning && !prefersReducedMotion) {
        startLoop();
      } else if (!isTabActive && isRunning) {
        stopLoop();
      }
    });

    // Pointer movement tracking on hero
    if (isFinePointer) {
      heroSection.addEventListener('pointermove', function(e) {
        var rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        mouseActive = true;
      }, { passive: true });

      heroSection.addEventListener('pointerleave', function() {
        mouseActive = false;
        mouseX = -9999;
        mouseY = -9999;
      }, { passive: true });
    }

    // Debounced resize handler
    window.addEventListener('resize', debounce(handleResize, 150));

    if (prefersReducedMotion) {
      drawStatic();
    } else {
      startLoop();
    }
  }

  function debounce(fn, wait) {
    var timeout;
    return function() {
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        fn.apply(null, args);
      }, wait);
    };
  }

  // Ensure DOM and ASCII data are available before initializing
  function bootstrap() {
    if (window.__LEDGIO_HERO_ASCII) {
      init();
    } else {
      var checkAttempts = 0;
      var interval = setInterval(function() {
        checkAttempts++;
        if (window.__LEDGIO_HERO_ASCII) {
          clearInterval(interval);
          init();
        } else if (checkAttempts > 50) {
          clearInterval(interval);
        }
      }, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
