/**
 * Ledgio v2 — Closing Section ASCII Accent (Phase B)
 * Ascending voxel-staircase of ₹ $ 0 1 characters with strict text exclusion clearance.
 * Desktop >= 1024px only. Budget <= 1200 cells.
 */
(function() {
  'use strict';

  function initClosingAscii() {
    if (window.innerWidth < 1024) return;

    var section = document.getElementById('closing-cta');
    if (!section) return;

    var canvas = document.getElementById('closing-ascii-canvas');
    if (window.innerWidth < 1024) {
      if (canvas) canvas.remove();
      return;
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'closing-ascii-canvas';
      canvas.id = 'closing-ascii-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      section.insertBefore(canvas, section.firstChild);
    }

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isReduced = Boolean(motionQuery && motionQuery.matches);

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 1);
    var width = 0;
    var height = 0;
    var cellW = 16;
    var cellH = 20;
    var cells = [];
    var avoidRects = [];
    var rafId = null;
    var isIntersecting = false;

    var chars = ['₹', '$', '0', '1', '+', ':', '·'];

    function computeAvoidanceRects() {
      avoidRects = [];
      var secRect = section.getBoundingClientRect();
      var targets = section.querySelectorAll('.closing-title, .closing-desc, .closing-actions, .closing-guarantee, .section-pill');
      targets.forEach(function(el) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          avoidRects.push({
            left: (r.left - secRect.left) - 24,
            top: (r.top - secRect.top) - 24,
            right: (r.right - secRect.left) + 24,
            bottom: (r.bottom - secRect.top) + 24
          });
        }
      });
    }

    function buildCells() {
      computeAvoidanceRects();
      cells = [];
      var cols = Math.floor(width / cellW);
      var rows = Math.floor(height / cellH);

      for (var r = 0; r < rows; r++) {
        var y = r * cellH + cellH / 2;
        var ny = y / height;
        for (var c = 0; c < cols; c++) {
          var x = c * cellW + cellW / 2;
          var nx = x / width;

          // Check avoidance boxes
          var insideAvoid = false;
          for (var i = 0; i < avoidRects.length; i++) {
            var b = avoidRects[i];
            if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
              insideAvoid = true;
              break;
            }
          }
          if (insideAvoid) continue;

          // Staircase path: rising diagonally from bottom-left (nx ~0, ny ~0.9) to top-right (nx ~1, ny ~0.1)
          var stepTargetY = (1 - Math.floor(nx * 8) / 8) * height * 0.75 + 40;
          var distY = Math.abs(y - stepTargetY);

          var isStair = distY < 64;
          var isTopRightScatter = (nx > 0.7 && ny < 0.42 && (Math.sin(c * 2.7 + r * 4.3) > 0.25));
          var isBottomLeftScatter = (nx < 0.28 && ny > 0.58 && (Math.cos(c * 3.1 + r * 2.1) > 0.15));

          if (isStair || isTopRightScatter || isBottomLeftScatter) {
            var charIdx = Math.abs((c * 5 + r * 11)) % chars.length;
            var baseBrightness = 0.25 + (Math.sin(c * 0.5 + r * 0.7) + 1) * 0.35;
            cells.push({
              x: x,
              y: y,
              char: chars[charIdx],
              baseBrightness: baseBrightness,
              phase: (c * 0.4 + r * 0.8) % (Math.PI * 2)
            });
          }
        }
      }

      // Hard clamp budget <= 1200 cells
      if (cells.length > 1200) {
        cells = cells.slice(0, 1200);
      }

      // Expose test hooks
      window.__LEDGIO_CLOSING_ASCII = {
        cells: cells,
        avoidRects: avoidRects,
        getCellCount: function() { return cells.length; },
        getAvoidRects: function() { return avoidRects; },
        isReduced: function() { return isReduced; }
      };
    }

    function resize() {
      if (window.innerWidth < 1024) {
        canvas.style.display = 'none';
        return;
      }
      canvas.style.display = 'block';
      var rect = section.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildCells();
      if (isIntersecting) renderFrame(0);
    }

    function renderFrame(time) {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      ctx.font = '12px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var t = time * 0.0015;
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var alpha = cell.baseBrightness;
        if (!isReduced) {
          alpha += Math.sin(t + cell.phase) * 0.18;
          alpha = Math.max(0.12, Math.min(0.9, alpha));
        }
        ctx.fillStyle = 'rgba(77, 243, 224, ' + alpha.toFixed(3) + ')';
        ctx.fillText(cell.char, cell.x, cell.y);
      }
    }

    function loop(now) {
      if (!isIntersecting || document.hidden || isReduced) {
        rafId = null;
        return;
      }
      renderFrame(now);
      rafId = null;
    }

    function startLoop() {
      if (isReduced) {
        renderFrame(0);
        return;
      }
      if (!rafId && isIntersecting && !document.hidden) {
        rafId = requestAnimationFrame(loop);
      }
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // Scroll Intersection Observer
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          isIntersecting = entry.isIntersecting;
          if (isIntersecting) {
            startLoop();
          } else {
            stopLoop();
          }
        });
      }, { threshold: 0.05 });
      obs.observe(section);
    } else {
      isIntersecting = true;
      startLoop();
    }

    // Tab visibility pause
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        stopLoop();
      } else if (isIntersecting) {
        startLoop();
      }
    });

    window.addEventListener('resize', function() {
      resize();
    }, { passive: true });

    resize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClosingAscii);
  } else {
    initClosingAscii();
  }
})();
