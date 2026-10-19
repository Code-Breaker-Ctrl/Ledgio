/**
 * Ledgio Living Hero Experience
 * 1. WebGL Animated Gradient Mesh Backdrop (falling back to CSS gradient)
 * 2. Canvas Verlet Physics Engine (Glowing ₹ Coins & Receipts settling into 5 Ledgio Bins)
 * 3. CSS 3D Phone Chassis Controller (Pointer spring tracking, idle wobble, specular glare, scroll-out fade)
 * 4. Live HTML Mini-Dashboard (Real DOM nodes, counters, income tap-flip, sync chip loop, 5 sliding transactions)
 *
 * Rules:
 * - 0 new DOM injection sinks (all DOM updates strictly via textContent / DOM APIs)
 * - 0 memory allocations inside the rAF loops
 * - Paused via IntersectionObserver when off-screen and on document.hidden
 * - Respects prefers-reduced-motion and low-spec hardware
 */

(function () {
  'use strict';

  // Environment & capability checks
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isLowHardware = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const isMobile = window.innerWidth < 768;
  const shouldDisableMotion = prefersReducedMotion || isLowHardware;

  // Global DPR capped at 2 to preserve frame budget
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Active theme detector ('dark' or 'light')
  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  // =========================================================================
  // Layer 3: WebGL Animated Aurora Gradient Backdrop
  // =========================================================================
  function initHeroShader(heroEl) {
    const canvas = document.getElementById('hero-gl-canvas');
    if (!canvas) return;

    if (shouldDisableMotion) {
      canvas.style.display = 'none';
      return;
    }

    let gl = null;
    try {
      gl = canvas.getContext('webgl', { powerPreference: 'low-power', alpha: true, antialias: false }) ||
           canvas.getContext('experimental-webgl', { powerPreference: 'low-power', alpha: true, antialias: false });
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      canvas.style.display = 'none';
      heroEl.classList.add('has-css-backdrop');
      return;
    }

    const vsSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_theme;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = uv;
        p.x *= aspect;

        float t = u_time * 0.12;
        float wave1 = sin(p.x * 2.2 + t * 1.5 + cos(p.y * 1.8 + t)) * 0.5 + 0.5;
        float wave2 = cos(p.y * 2.8 - t * 1.2 + sin(p.x * 2.0 - t)) * 0.5 + 0.5;
        float mixWave = (wave1 + wave2) * 0.5;

        vec3 darkBase = vec3(0.035, 0.043, 0.055);
        vec3 darkEmerald = vec3(0.063, 0.725, 0.505);
        vec3 darkTeal = vec3(0.051, 0.580, 0.533);
        vec3 darkIndigo = vec3(0.120, 0.106, 0.294);

        vec3 lightBase = vec3(0.973, 0.980, 0.988);
        vec3 lightMint = vec3(0.55, 0.88, 0.75);
        vec3 lightCyan = vec3(0.70, 0.85, 0.95);
        vec3 lightSage = vec3(0.85, 0.92, 0.88);

        vec3 col;
        if (u_theme < 0.5) {
          vec3 blend1 = mix(darkBase, darkIndigo, uv.y * 0.7);
          vec3 blend2 = mix(darkTeal, darkEmerald, wave1);
          col = mix(blend1, blend2, mixWave * 0.28);
          float vig = smoothstep(1.3, 0.2, length(uv - vec2(0.3, 0.45)));
          col = mix(darkBase, col, vig);
        } else {
          vec3 blend1 = mix(lightBase, lightSage, uv.y * 0.5);
          vec3 blend2 = mix(lightCyan, lightMint, wave1);
          col = mix(blend1, blend2, mixWave * 0.20);
          float vig = smoothstep(1.3, 0.2, length(uv - vec2(0.3, 0.45)));
          col = mix(lightBase, col, vig);
        }

        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (grain - 0.5) * 0.016;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function createShader(glCtx, type, source) {
      const s = glCtx.createShader(type);
      glCtx.shaderSource(s, source);
      glCtx.compileShader(s);
      return s;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(prog, 'u_resolution');
    const timeLoc = gl.getUniformLocation(prog, 'u_time');
    const themeLoc = gl.getUniformLocation(prog, 'u_theme');

    let w = 0;
    let h = 0;
    function resize() {
      const rect = heroEl.getBoundingClientRect();
      w = Math.max(320, Math.floor(rect.width));
      h = Math.max(480, Math.floor(rect.height));
      const rw = Math.min(1920, Math.floor(w * Math.min(dpr, 1.5)));
      const rh = Math.min(1080, Math.floor(h * Math.min(dpr, 1.5)));
      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
        gl.viewport(0, 0, rw, rh);
      }
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let isVisible = true;
    let animId = null;
    let startTime = performance.now();

    function render(now) {
      if (!isVisible) return;
      const elapsed = (now - startTime) * 0.001;
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, elapsed);
      gl.uniform1f(themeLoc, getCurrentTheme() === 'light' ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isVisible = entry && entry.isIntersecting && !document.hidden;
      if (isVisible && !animId) {
        animId = requestAnimationFrame(render);
      } else if (!isVisible && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }, { threshold: 0.05 });
    observer.observe(heroEl);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      } else if (!document.hidden && isVisible && !animId) {
        animId = requestAnimationFrame(render);
      }
    });

    animId = requestAnimationFrame(render);
  }

  // =========================================================================
  // Layer 1: Canvas Verlet Physics Engine (5 Category Bins)
  // =========================================================================
  function initHeroPhysics(heroEl) {
    const canvas = document.getElementById('hero-physics-canvas');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const BINS = [
      { name: 'Food & Dining', color: '#f59e0b', rgb: '245, 158, 11', glow: 0 },
      { name: 'Bills & Utilities', color: '#3b82f6', rgb: '59, 130, 246', glow: 0 },
      { name: 'Transport', color: '#8b5cf6', rgb: '139, 92, 246', glow: 0 },
      { name: 'Shopping', color: '#ec4899', rgb: '236, 72, 153', glow: 0 },
      { name: 'Savings', color: '#10b981', rgb: '16, 185, 129', glow: 0 }
    ];

    // Mobile (< 768px): zero physics bodies over text (calm, clean presentation)
    // Desktop: pool of 50 bodies (up to 40 resting + 10 in-flight)
    const MAX_BODIES = isMobile ? 0 : 50;
    let width = 0;
    let height = 0;
    const BIN_HEIGHT = 44;

    let textColliders = [];
    let headerRightX = 0;

    function updateColliders() {
      const canvasRect = canvas.getBoundingClientRect();
      textColliders = [];

      const selectors = [
        '.hero-badge-pill',
        '.hero-editorial-title',
        '.hero-subline',
        '.hero-cta-group',
        '.hero-proof-strip'
      ];

      selectors.forEach(sel => {
        const el = heroEl.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          textColliders.push({
            left: Math.max(0, r.left - canvasRect.left - 18),
            right: r.right - canvasRect.left + 22,
            top: r.top - canvasRect.top - 14,
            bottom: r.bottom - canvasRect.top + 16
          });
        }
      });

      const headerBlock = heroEl.querySelector('.hero-header-block');
      if (headerBlock && width >= 1024) {
        const hr = headerBlock.getBoundingClientRect();
        headerRightX = Math.max(0, hr.right - canvasRect.left + 24);
        textColliders.push({
          left: 0,
          right: headerRightX,
          top: Math.max(0, hr.top - canvasRect.top - 12),
          bottom: hr.bottom - canvasRect.top + 20
        });
      } else {
        headerRightX = 0;
      }
    }

    function resize() {
      const rect = heroEl.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateColliders();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const particles = [];
    for (let i = 0; i < MAX_BODIES; i++) {
      particles.push({
        active: false,
        type: 'coin',
        x: 0,
        y: 0,
        oldX: 0,
        oldY: 0,
        angle: 0,
        oldAngle: 0,
        radius: 13.0,
        colorIndex: 0,
        isSavings: false,
        settled: false,
        settledAt: 0,
        settledBin: -1,
        hasLanded: false,
        fading: false,
        opacity: 1.0,
        inFlight: false,
        flightElapsed: 0,
        flightDuration: 1.0,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        trail: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        trailCount: 0
      });
    }

    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
      radius: 120,
      strength: 700
    };

    function updatePointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
      mouse.active = (mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height);
    }

    heroEl.addEventListener('mousemove', (e) => {
      updatePointer(e.clientX, e.clientY);
    }, { passive: true });

    heroEl.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    heroEl.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    heroEl.addEventListener('touchend', () => {
      mouse.active = false;
    });

    function launchCoin(startX, startY, targetX, targetY, targetBin, isIncome) {
      if (MAX_BODIES === 0 || shouldDisableMotion) return;

      const b = Math.max(0, Math.min(BINS.length - 1, targetBin));
      const dist = Math.abs(targetX - startX);
      const totalT = Math.max(0.75, Math.min(1.35, 0.65 + dist * 0.00085));

      // Find particle: inactive first, or oldest settled
      let p = null;
      for (let i = 0; i < MAX_BODIES; i++) {
        if (!particles[i].active) {
          p = particles[i];
          break;
        }
      }
      if (!p) {
        let oldestTime = Infinity;
        for (let i = 0; i < MAX_BODIES; i++) {
          if (particles[i].settled && particles[i].settledAt < oldestTime) {
            oldestTime = particles[i].settledAt;
            p = particles[i];
          }
        }
      }
      if (!p) p = particles[0];

      p.active = true;
      p.type = 'coin';
      p.settled = false;
      p.settledAt = 0;
      p.settledBin = -1;
      p.hasLanded = false;
      p.fading = false;
      p.opacity = 1.0;
      p.inFlight = true;
      p.flightElapsed = 0;
      p.flightDuration = totalT;
      p.startX = startX;
      p.startY = startY;
      p.targetX = targetX;
      p.targetY = targetY;
      p.x = startX;
      p.y = startY;
      p.oldX = startX;
      p.oldY = startY;
      p.angle = Math.random() * Math.PI * 2;
      p.oldAngle = p.angle;
      p.radius = 12.0 + Math.random() * 2.5; // diameter 24-29px (22-30px budget)
      p.colorIndex = b;
      p.isSavings = !!isIncome || b === 4;
      p.trailCount = 0;
      for (let k = 0; k < p.trail.length; k++) {
        p.trail[k].x = startX;
        p.trail[k].y = startY;
      }
    }

    function launchCoinFromRow(rowEl, targetBin, isIncome) {
      if (shouldDisableMotion || isMobile) return;
      const canvasRect = canvas.getBoundingClientRect();
      const binW = width / BINS.length;
      const b = Math.max(0, Math.min(BINS.length - 1, targetBin));

      // Calculate targetX inside bin b (staying in readable tray zones)
      let targetX = 0;
      if (b === 3) {
        // Shopping: place in left portion of bin 3 (visible to left of phone)
        targetX = b * binW + 28 + Math.random() * 40;
      } else if (b === 4) {
        // Savings: place in right portion of bin 4 (visible to right of phone)
        targetX = b * binW + 40 + Math.random() * Math.max(20, binW - 70);
      } else {
        const pad = 24;
        const minX = b * binW + pad;
        const maxX = (b + 1) * binW - pad;
        targetX = minX + Math.random() * Math.max(12, maxX - minX);
      }
      const targetY = height - 16;

      let startX = 0;
      let startY = 0;

      if (rowEl) {
        const rowRect = rowEl.getBoundingClientRect();
        // Emerge from behind the phone chassis edge
        if (targetX > rowRect.left - canvasRect.left + 50) {
          startX = rowRect.right - canvasRect.left - 8;
        } else {
          startX = rowRect.left - canvasRect.left + 8;
        }
        startY = rowRect.top - canvasRect.top + rowRect.height * 0.5;
      } else {
        const phone = heroEl.querySelector('.phone-chassis-3d');
        if (phone) {
          const pr = phone.getBoundingClientRect();
          if (targetX > pr.left - canvasRect.left + 50) {
            startX = pr.right - canvasRect.left - 8;
          } else {
            startX = pr.left - canvasRect.left + 8;
          }
          startY = pr.top - canvasRect.top + pr.height * 0.68;
        } else {
          startX = width * 0.72;
          startY = height * 0.65;
        }
      }

      launchCoin(startX, startY, targetX, targetY, b, isIncome);
    }

    // Seed initial resting coins across bins so bins have subtle presence on load
    if (!isMobile && !shouldDisableMotion) {
      const seedBins = [0, 1, 2, 3, 4, 0, 2, 4];
      const binW = width / BINS.length;
      for (let k = 0; k < seedBins.length; k++) {
        const b = seedBins[k];
        const px = b * binW + binW * (0.28 + (k % 3) * 0.22);
        const py = height - 16;
        const p = particles[k];
        p.active = true;
        p.type = 'coin';
        p.settled = true;
        p.settledAt = performance.now() - (seedBins.length - k) * 4000;
        p.settledBin = b;
        p.hasLanded = true;
        p.x = px;
        p.y = py;
        p.oldX = px;
        p.oldY = py;
        p.radius = 12.0 + (k % 3);
        p.colorIndex = b;
        p.isSavings = (b === 4);
        p.opacity = 1.0;
        p.fading = false;
        p.trailCount = 0;
      }
    }

    heroEl.addEventListener('click', (e) => {
      if (isMobile || MAX_BODIES === 0 || shouldDisableMotion) return;
      if (e.target.closest('a') || e.target.closest('button')) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (clickY > height * 0.45) {
        const binW = width / BINS.length;
        const clickedBin = Math.max(0, Math.min(BINS.length - 1, Math.floor(clickX / binW)));
        const isInc = (clickedBin === 4);
        launchCoinFromRow(null, clickedBin, isInc);
      }
    });

    let lastSpawnTime = performance.now();
    let isVisible = true;
    let animId = null;
    let lastTime = performance.now();

    function stepPhysics(dt) {
      if (MAX_BODIES === 0) return;
      const gravity = 760;
      const drag = 0.99;
      const floorY = height - 16;
      const binW = width / BINS.length;

      for (let i = 0; i < MAX_BODIES; i++) {
        const p = particles[i];
        if (!p.active) continue;

        if (p.fading) {
          p.opacity -= dt * 1.5;
          if (p.opacity <= 0) {
            p.active = false;
            p.settled = false;
            p.fading = false;
            p.opacity = 1.0;
            continue;
          }
        }

        // In-flight kinematic trajectory: stays strictly in the bottom band
        if (p.inFlight) {
          p.flightElapsed += dt;
          const s = Math.min(1.0, p.flightElapsed / p.flightDuration);

          // Rotate disc highlight
          p.angle += dt * 4.2;
          p.oldAngle = p.angle;

          // Horizontal easing: smooth departure and deceleration
          const sx = 1 - Math.pow(1 - s, 1.25);
          p.x = p.startX + (p.targetX - p.startX) * sx;

          // Vertical flight: swoops into bottom band (>= height - 110) and arcs into bin
          const yBand = Math.max(p.startY + 20, height - 110);
          const s1 = 0.22;
          if (s <= s1) {
            const q = s / s1;
            p.y = p.startY + (yBand - p.startY) * (3 * q * q - 2 * q * q * q);
          } else {
            const u = (s - s1) / (1 - s1);
            p.y = yBand + (p.targetY - yBand) * u - 18 * 4 * u * (1 - u);
          }

          // Update motion trail
          for (let k = p.trail.length - 1; k > 0; k--) {
            p.trail[k].x = p.trail[k - 1].x;
            p.trail[k].y = p.trail[k - 1].y;
          }
          p.trail[0].x = p.x;
          p.trail[0].y = p.y;
          if (p.trailCount < p.trail.length) p.trailCount++;

          // Touchdown
          if (s >= 1.0) {
            p.inFlight = false;
            p.hasLanded = true;
            p.x = p.targetX;
            p.y = p.targetY;
            BINS[p.colorIndex].glow = 1.0;

            // Small bounce
            const bounceVy = -65 - Math.random() * 35;
            const bounceVx = (p.targetX > p.startX ? 1 : -1) * (15 + Math.random() * 25);
            p.oldY = p.y - bounceVy * 0.016;
            p.oldX = p.x - bounceVx * 0.016;
          }
          continue;
        }

        if (p.settled && !mouse.active) {
          continue;
        }

        const vx = (p.x - p.oldX) * drag;
        const vy = (p.y - p.oldY) * drag;
        p.oldX = p.x;
        p.oldY = p.y;
        p.x += vx;
        p.y += vy + gravity * dt * dt;

        const vRot = (p.angle - p.oldAngle) * drag;
        p.oldAngle = p.angle;
        p.angle += vRot;

        // Motion trail record for in-flight coins
        if (!p.settled) {
          for (let k = p.trail.length - 1; k > 0; k--) {
            p.trail[k].x = p.trail[k - 1].x;
            p.trail[k].y = p.trail[k - 1].y;
          }
          p.trail[0].x = p.x;
          p.trail[0].y = p.y;
          if (p.trailCount < p.trail.length) p.trailCount++;
        }

        // Pointer repulsion field
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const rSq = mouse.radius * mouse.radius;
          if (distSq < rSq && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / mouse.radius) * mouse.strength * dt;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
            p.settled = false;
          }
        }

        // Text collider deflection & repulsion: text must NEVER be covered
        for (let c = 0; c < textColliders.length; c++) {
          const b = textColliders[c];
          const pad = p.radius + 6;
          if (p.x > b.left - pad && p.x < b.right + pad && p.y > b.top - pad && p.y < b.bottom + pad) {
            p.x = b.right + pad;
            p.oldX = p.x + Math.abs(vx) * 0.35 + 30 * dt;
            p.settled = false;
          }
        }

        // Floor collision & landing
        if (p.y >= floorY - p.radius) {
          p.y = floorY - p.radius;
          p.oldY = p.y + vy * 0.32;

          const binIdx = Math.max(0, Math.min(BINS.length - 1, Math.floor(p.x / binW)));
          if (!p.hasLanded) {
            p.hasLanded = true;
            BINS[binIdx].glow = 1.0;
          }

          const speedSq = (p.x - p.oldX) * (p.x - p.oldX) + (p.y - p.oldY) * (p.y - p.oldY);
          if (speedSq < 0.12) {
            p.settled = true;
            p.settledAt = performance.now();
            p.settledBin = binIdx;
          }
        }

        // Left / right canvas boundaries
        if (p.x < p.radius + 6) {
          p.x = p.radius + 6;
          p.oldX = p.x + Math.abs(vx) * 0.35;
        } else if (p.x > width - p.radius - 6) {
          p.x = width - p.radius - 6;
          p.oldX = p.x - Math.abs(vx) * 0.35;
        }

        // Tray divider collisions
        const dividerTop = height - BIN_HEIGHT;
        if (p.y > dividerTop) {
          for (let b = 1; b < BINS.length; b++) {
            const wallX = b * binW;
            const distToWall = p.x - wallX;
            if (Math.abs(distToWall) < p.radius) {
              if (distToWall < 0) {
                p.x = wallX - p.radius;
                p.oldX = p.x + Math.abs(vx) * 0.3;
              } else {
                p.x = wallX + p.radius;
                p.oldX = p.x - Math.abs(vx) * 0.3;
              }
            }
          }
        }

        // Inter-particle elastic collisions
        for (let j = i + 1; j < MAX_BODIES; j++) {
          const q = particles[j];
          if (!q.active || q.inFlight) continue;
          const cdx = q.x - p.x;
          const cdy = q.y - p.y;
          const minDist = p.radius + q.radius;
          const cDistSq = cdx * cdx + cdy * cdy;
          if (cDistSq < minDist * minDist && cDistSq > 0.01) {
            const cDist = Math.sqrt(cDistSq);
            const overlap = (minDist - cDist) * 0.5;
            const cnx = cdx / cDist;
            const cny = cdy / cDist;
            p.x -= cnx * overlap;
            p.y -= cny * overlap;
            q.x += cnx * overlap;
            q.y += cny * overlap;
          }
        }
      }

      // Max 40 resting coins eviction: oldest fade out
      let settledCount = 0;
      for (let k = 0; k < MAX_BODIES; k++) {
        if (particles[k].active && particles[k].settled) settledCount++;
      }
      if (settledCount > 40) {
        let oldest = null;
        let oldestTime = Infinity;
        for (let k = 0; k < MAX_BODIES; k++) {
          const pt = particles[k];
          if (pt.active && pt.settled && !pt.fading && pt.settledAt < oldestTime) {
            oldestTime = pt.settledAt;
            oldest = pt;
          }
        }
        if (oldest) {
          oldest.fading = true;
        }
      }

      // Bin tick glow decay
      for (let b = 0; b < BINS.length; b++) {
        if (BINS[b].glow > 0) {
          BINS[b].glow = Math.max(0, BINS[b].glow - dt * 2.4);
        }
      }
    }

    function drawScene() {
      ctx.clearRect(0, 0, width, height);
      const isDark = getCurrentTheme() === 'dark';
      const binW = width / BINS.length;
      const dividerTop = height - BIN_HEIGHT;

      // 1. Draw In-Flight Motion Trails (Smooth Tapered Streak / Motion Blur)
      for (let i = 0; i < MAX_BODIES; i++) {
        const p = particles[i];
        if (!p.active || p.settled || p.trailCount < 2) continue;

        // Collect trail points starting at the coin center (p.x, p.y)
        const pts = [{ x: p.x, y: p.y }];
        let totalLen = 0;
        const maxLen = 60; // Max ~60px streak length

        for (let k = 0; k < p.trailCount; k++) {
          const tp = p.trail[k];
          const lastPt = pts[pts.length - 1];
          const dx = tp.x - lastPt.x;
          const dy = tp.y - lastPt.y;
          const segDist = Math.sqrt(dx * dx + dy * dy);
          if (segDist < 0.5) continue;

          if (totalLen + segDist > maxLen) {
            const rem = maxLen - totalLen;
            const f = rem / segDist;
            pts.push({
              x: lastPt.x + dx * f,
              y: lastPt.y + dy * f
            });
            totalLen = maxLen;
            break;
          } else {
            pts.push({ x: tp.x, y: tp.y });
            totalLen += segDist;
          }
        }

        if (pts.length < 2 || totalLen < 4) continue;

        const isSavings = p.isSavings;
        const headPt = pts[0];
        const tailPt = pts[pts.length - 1];

        // Tapered streak width: thinner than the coin (coin diameter ~25px, streak width ~10px)
        const maxHalfW = Math.min(5.2, p.radius * 0.40);

        // Compute cumulative distances
        const dists = [0];
        let dAcc = 0;
        for (let k = 1; k < pts.length; k++) {
          const ddx = pts[k].x - pts[k - 1].x;
          const ddy = pts[k].y - pts[k - 1].y;
          dAcc += Math.sqrt(ddx * ddx + ddy * ddy);
          dists.push(dAcc);
        }

        // Compute normal offsets for smooth tapered ribbon
        const leftEdge = [];
        const rightEdge = [];

        for (let k = 0; k < pts.length; k++) {
          let tx = 0;
          let ty = 0;
          if (k === 0) {
            tx = pts[1].x - pts[0].x;
            ty = pts[1].y - pts[0].y;
          } else if (k === pts.length - 1) {
            tx = pts[k].x - pts[k - 1].x;
            ty = pts[k].y - pts[k - 1].y;
          } else {
            tx = pts[k + 1].x - pts[k - 1].x;
            ty = pts[k + 1].y - pts[k - 1].y;
          }
          const tLen = Math.sqrt(tx * tx + ty * ty) || 1;
          const nx = -ty / tLen;
          const ny = tx / tLen;

          const prog = dists[k] / totalLen; // 0 at head, 1 at tail
          const w = maxHalfW * Math.pow(1 - prog, 1.15);

          leftEdge.push({ x: pts[k].x + nx * w, y: pts[k].y + ny * w });
          rightEdge.push({ x: pts[k].x - nx * w, y: pts[k].y - ny * w });
        }

        ctx.save();

        // 1A. Outer Tapered Motion Blur Ribbon
        ctx.beginPath();
        ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
        for (let k = 1; k < leftEdge.length; k++) {
          ctx.lineTo(leftEdge[k].x, leftEdge[k].y);
        }
        ctx.lineTo(tailPt.x, tailPt.y);
        for (let k = rightEdge.length - 1; k >= 0; k--) {
          ctx.lineTo(rightEdge[k].x, rightEdge[k].y);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(headPt.x, headPt.y, tailPt.x, tailPt.y);
        if (isDark) {
          if (isSavings) {
            grad.addColorStop(0.0, `rgba(52, 211, 153, ${0.75 * p.opacity})`);
            grad.addColorStop(0.35, `rgba(16, 185, 129, ${0.40 * p.opacity})`);
            grad.addColorStop(0.75, `rgba(5, 150, 105, ${0.12 * p.opacity})`);
            grad.addColorStop(1.0, 'rgba(6, 78, 59, 0)');
          } else {
            grad.addColorStop(0.0, `rgba(245, 158, 11, ${0.75 * p.opacity})`);
            grad.addColorStop(0.35, `rgba(217, 119, 6, ${0.40 * p.opacity})`);
            grad.addColorStop(0.75, `rgba(180, 83, 9, ${0.12 * p.opacity})`);
            grad.addColorStop(1.0, 'rgba(120, 53, 15, 0)');
          }
        } else {
          // Light theme: use slightly darker gold/emerald for crisp visibility
          if (isSavings) {
            grad.addColorStop(0.0, `rgba(4, 120, 87, ${0.78 * p.opacity})`);
            grad.addColorStop(0.35, `rgba(5, 150, 105, ${0.42 * p.opacity})`);
            grad.addColorStop(0.75, `rgba(16, 185, 129, ${0.15 * p.opacity})`);
            grad.addColorStop(1.0, 'rgba(4, 120, 87, 0)');
          } else {
            grad.addColorStop(0.0, `rgba(180, 83, 9, ${0.82 * p.opacity})`);
            grad.addColorStop(0.35, `rgba(194, 65, 12, ${0.45 * p.opacity})`);
            grad.addColorStop(0.75, `rgba(217, 119, 6, ${0.18 * p.opacity})`);
            grad.addColorStop(1.0, 'rgba(180, 83, 9, 0)');
          }
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // 1B. Central Motion Blur Core Spine
        ctx.beginPath();
        ctx.moveTo(headPt.x, headPt.y);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
        const spineGrad = ctx.createLinearGradient(headPt.x, headPt.y, tailPt.x, tailPt.y);
        if (isDark) {
          const col = isSavings ? '167, 243, 208' : '254, 240, 138';
          spineGrad.addColorStop(0.0, `rgba(${col}, ${0.85 * p.opacity})`);
          spineGrad.addColorStop(0.5, `rgba(${col}, ${0.30 * p.opacity})`);
          spineGrad.addColorStop(1.0, `rgba(${col}, 0)`);
        } else {
          const col = isSavings ? '4, 120, 87' : '180, 83, 9';
          spineGrad.addColorStop(0.0, `rgba(${col}, ${0.85 * p.opacity})`);
          spineGrad.addColorStop(0.5, `rgba(${col}, ${0.30 * p.opacity})`);
          spineGrad.addColorStop(1.0, `rgba(${col}, 0)`);
        }
        ctx.strokeStyle = spineGrad;
        ctx.lineWidth = Math.min(3.5, p.radius * 0.28);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.restore();
      }

      // 2. Draw Coins (Layered behind bottom shelf labels)
      for (let i = 0; i < MAX_BODIES; i++) {
        const p = particles[i];
        if (!p.active) continue;

        const cx = p.x;
        const cy = p.y;
        const r = p.radius;
        const isSavings = p.isSavings;

        ctx.save();
        if (p.fading) {
          ctx.globalAlpha = Math.max(0, p.opacity);
        }

        // Drop shadow
        ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.18)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2.5;

        // Metallic gradient rotated by p.angle
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);
        const gx0 = cx - r * cosA;
        const gy0 = cy - r * sinA;
        const gx1 = cx + r * cosA;
        const gy1 = cy + r * sinA;

        const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        if (isSavings) {
          grad.addColorStop(0.0, '#a7f3d0');
          grad.addColorStop(0.25, '#34d399');
          grad.addColorStop(0.55, '#10b981');
          grad.addColorStop(0.8, '#059669');
          grad.addColorStop(1.0, '#064e3b');
        } else {
          grad.addColorStop(0.0, '#fef9c3');
          grad.addColorStop(0.25, '#f59e0b');
          grad.addColorStop(0.55, '#d97706');
          grad.addColorStop(0.8, '#b45309');
          grad.addColorStop(1.0, '#78350f');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner rim light
        ctx.strokeStyle = isSavings
          ? (isDark ? 'rgba(167, 243, 208, 0.6)' : 'rgba(255, 255, 255, 0.8)')
          : (isDark ? 'rgba(254, 240, 138, 0.7)' : 'rgba(255, 255, 255, 0.9)');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 0.75, 0, Math.PI * 2);
        ctx.stroke();

        // Upright ₹ currency glyph
        ctx.fillStyle = isSavings
          ? (isDark ? '#022c22' : '#047857')
          : (isDark ? '#451a03' : '#78350f');
        ctx.font = `700 ${Math.floor(r * 1.05)}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('₹', cx, cy + 0.5);

        ctx.restore();
      }

      // 3. Draw Subtle Glass Trays Shelf along Bottom
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(9, 9, 11, 0.70)' : 'rgba(255, 255, 255, 0.78)';
      ctx.fillRect(0, dividerTop, width, BIN_HEIGHT);

      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, dividerTop);
      ctx.lineTo(width, dividerTop);
      ctx.stroke();

      // 4. Draw Bin Tick Glow Flares
      for (let b = 0; b < BINS.length; b++) {
        const bin = BINS[b];
        if (bin.glow > 0.01) {
          const bx = b * binW;
          const glowGrad = ctx.createLinearGradient(0, height, 0, dividerTop - 30);
          glowGrad.addColorStop(0, `rgba(${bin.rgb}, ${0.36 * bin.glow})`);
          glowGrad.addColorStop(0.5, `rgba(${bin.rgb}, ${0.12 * bin.glow})`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(bx, dividerTop - 25, binW, BIN_HEIGHT + 25);
        }
      }

      // 5. Draw Dividers and Labels on top of shelf (always readable above coins)
      for (let b = 0; b < BINS.length; b++) {
        const bin = BINS[b];
        const bx = b * binW;

        if (b > 0) {
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, dividerTop + 6);
          ctx.lineTo(bx, height - 6);
          ctx.stroke();
        }

        ctx.save();
        ctx.font = '600 11.5px "Plus Jakarta Sans", -apple-system, sans-serif';
        const label = (width < 640) ? bin.name.split(' ')[0] : bin.name;
        const textMetrics = ctx.measureText(label);
        const totalW = 6 + 7 + textMetrics.width;
        const startX = bx + (binW - totalW) * 0.5;
        const centerY = dividerTop + BIN_HEIGHT * 0.5;

        // Accent dot (pulsing if bin has tick glow)
        ctx.fillStyle = bin.color;
        ctx.beginPath();
        ctx.arc(startX + 3, centerY, 3 + 2.0 * bin.glow, 0, Math.PI * 2);
        ctx.fill();

        // Label text with crisp contrast
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, startX + 13, centerY);
        ctx.restore();
      }
      ctx.restore();
    }

    function frame(now) {
      if (!isVisible) return;
      const dt = Math.min((now - lastTime) * 0.001, 0.033);
      lastTime = now;

      stepPhysics(dt);
      drawScene();

      animId = requestAnimationFrame(frame);
    }

    if (shouldDisableMotion || isMobile) {
      drawScene();
    } else {
      animId = requestAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isVisible = entry && entry.isIntersecting && !document.hidden;
      if (isVisible && !animId && !shouldDisableMotion && !isMobile) {
        lastTime = performance.now();
        animId = requestAnimationFrame(frame);
      } else if (!isVisible && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }, { threshold: 0.05 });
    observer.observe(heroEl);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      } else if (!document.hidden && isVisible && !animId && !shouldDisableMotion && !isMobile) {
        lastTime = performance.now();
        animId = requestAnimationFrame(frame);
      }
    });

    return {
      launchCoinFromRow: launchCoinFromRow
    };
  }

  // =========================================================================
  // Layer 2: Real 3D Phone Chassis Controller
  // =========================================================================
  function initHeroPhone3D(heroEl) {
    const chassis = document.getElementById('hero-phone-chassis');
    const glare = document.getElementById('hero-phone-glare');
    if (!chassis) return;

    if (shouldDisableMotion) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let curRotX = 0;
    let curRotY = 0;
    let curGlareX = 50;
    let curGlareY = 50;
    let targetGlareX = 50;
    let targetGlareY = 50;

    let isHovering = false;
    let heroRect = heroEl.getBoundingClientRect();

    function updateHeroRect() {
      heroRect = heroEl.getBoundingClientRect();
    }
    window.addEventListener('resize', updateHeroRect, { passive: true });
    window.addEventListener('scroll', updateHeroRect, { passive: true });

    heroEl.addEventListener('mousemove', (e) => {
      if (window.innerWidth < 1024) return;
      isHovering = true;
      const x = (e.clientX - heroRect.left) / heroRect.width;
      const y = (e.clientY - heroRect.top) / heroRect.height;

      targetRotY = (x - 0.5) * 36;
      targetRotX = -(y - 0.5) * 28;

      targetGlareX = x * 100;
      targetGlareY = y * 100;
    }, { passive: true });

    heroEl.addEventListener('mouseleave', () => {
      isHovering = false;
      targetRotX = 0;
      targetRotY = 0;
      targetGlareX = 50;
      targetGlareY = 50;
    });

    let animId = null;
    let isVisible = true;
    let startTime = performance.now();

    function updateFrame(now) {
      if (!isVisible) return;

      let idleRotZ = 0;
      let idleRotX = 0;
      let idleRotY = 0;
      if (!isHovering) {
        const t = (now - startTime) * 0.001;
        idleRotZ = Math.sin(t * 1.2) * 1.6;
        idleRotX = Math.cos(t * 0.9) * 2.2;
        idleRotY = Math.sin(t * 0.7) * 3.5;
      }

      const spring = 0.08;
      curRotX += ((targetRotX + idleRotX) - curRotX) * spring;
      curRotY += ((targetRotY + idleRotY) - curRotY) * spring;
      curGlareX += (targetGlareX - curGlareX) * spring;
      curGlareY += (targetGlareY - curGlareY) * spring;

      const scrollY = window.scrollY || window.pageYOffset || 0;
      const heroH = heroRect.height || 800;
      const scrollProgress = Math.min(1, Math.max(0, scrollY / heroH));

      const scrollRotY = scrollProgress * -35;
      const scrollRotX = scrollProgress * 12;
      const scrollTransZ = scrollProgress * -260;
      const scrollScale = 1.0 - scrollProgress * 0.28;
      const opacity = Math.max(0, 1.0 - Math.pow(scrollProgress, 1.3) * 1.2);

      const finalRotX = curRotX + scrollRotX;
      const finalRotY = curRotY + scrollRotY;
      const finalRotZ = idleRotZ;

      chassis.style.transform = `perspective(1200px) translate3d(0, 0, ${scrollTransZ}px) scale(${scrollScale}) rotateX(${finalRotX}deg) rotateY(${finalRotY}deg) rotateZ(${finalRotZ}deg)`;
      chassis.style.opacity = opacity.toFixed(3);

      if (glare) {
        glare.style.background = `radial-gradient(circle at ${curGlareX}% ${curGlareY}%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.08) 45%, transparent 70%)`;
      }

      animId = requestAnimationFrame(updateFrame);
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isVisible = entry && entry.isIntersecting && !document.hidden;
      if (isVisible && !animId) {
        animId = requestAnimationFrame(updateFrame);
      } else if (!isVisible && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }, { threshold: 0.02 });
    observer.observe(heroEl);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      } else if (!document.hidden && isVisible && !animId) {
        animId = requestAnimationFrame(updateFrame);
      }
    });

    animId = requestAnimationFrame(updateFrame);
  }

  // =========================================================================
  // Layer 4: Live HTML Mini-Dashboard Interactive Engine
  // =========================================================================
  function initMiniDashboard(heroEl, physics) {
    const incomeCard = document.getElementById('mini-dash-income-card');
    const incomeVal = document.querySelector('.mini-dash-income-val');
    const incomeSub = document.querySelector('.mini-dash-income-sub');
    const incomeIcon = document.getElementById('mini-dash-income-icon');

    const statusBadge = document.getElementById('mini-dash-status-badge');
    const statusDot = document.getElementById('mini-dash-status-dot');
    const statusText = document.getElementById('mini-dash-status-text');

    const surplusVal = document.querySelector('.mini-dash-surplus-val');
    const expenseVal = document.querySelector('.mini-dash-expense-val');
    const barFills = document.querySelectorAll('.mini-dash-bar-fill');
    const recentRows = document.querySelectorAll('.slide-in-row');

    // 1. Entrance count-up animation
    if (!shouldDisableMotion) {
      let startTime = null;
      const duration = 1200;

      function animateCounters(now) {
        if (!startTime) startTime = now;
        const progress = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic easeOut

        if (surplusVal) {
          const cur = Math.floor(ease * 9101);
          surplusVal.textContent = `₹${cur.toLocaleString('en-IN')}`;
        }
        if (expenseVal) {
          const curExp = Math.floor(ease * 14);
          expenseVal.textContent = `${curExp}%`;
        }

        if (progress < 1) {
          requestAnimationFrame(animateCounters);
        } else {
          if (surplusVal) surplusVal.textContent = '₹9,101';
          if (expenseVal) expenseVal.textContent = '14%';
        }
      }

      requestAnimationFrame(animateCounters);

      // Animate progress bar fills
      barFills.forEach((bar) => {
        const fillTarget = bar.getAttribute('data-fill') || '40%';
        bar.style.width = '0%';
        setTimeout(() => {
          bar.style.transition = 'width 1s cubic-bezier(0.16, 1, 0.3, 1)';
          bar.style.width = fillTarget;
        }, 300);
      });

      // Category mapping for the 5 transactions
      // Food & Dining, Groceries->Shopping, Bills & Utilities, Transport, Monthly Salary->Savings
      const TX_CONFIGS = [
        { bin: 0, isIncome: false, name: 'Food & Dining' },
        { bin: 3, isIncome: false, name: 'Shopping' },
        { bin: 1, isIncome: false, name: 'Bills & Utilities' },
        { bin: 2, isIncome: false, name: 'Transport' },
        { bin: 4, isIncome: true,  name: 'Savings' }
      ];

      function triggerTxCoin(rowIdx) {
        if (!recentRows[rowIdx]) return;
        const row = recentRows[rowIdx];
        const cfg = TX_CONFIGS[rowIdx] || TX_CONFIGS[0];

        // Visual pulse on the transaction row
        row.classList.add('tx-active-pulse');
        setTimeout(() => {
          row.classList.remove('tx-active-pulse');
        }, 650);

        if (physics && typeof physics.launchCoinFromRow === 'function') {
          physics.launchCoinFromRow(row, cfg.bin, cfg.isIncome);
        }
      }

      window.__ledgio_launchHeroCoin = function(rowIndex, targetBin, isIncome) {
        if (rowIndex !== undefined && recentRows[rowIndex]) {
          triggerTxCoin(rowIndex);
        } else {
          const b = (targetBin !== undefined) ? targetBin : 0;
          const inc = (isIncome !== undefined) ? isIncome : (b === 4);
          if (physics && typeof physics.launchCoinFromRow === 'function') {
            physics.launchCoinFromRow(null, b, inc);
          }
        }
      };

      // Staggered entrance: each row slides in and launches its coin
      recentRows.forEach((row, idx) => {
        row.style.opacity = '0';
        row.style.transform = 'translateX(-6px)';
        row.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
        row.style.cursor = 'pointer';

        setTimeout(() => {
          row.style.opacity = '1';
          row.style.transform = 'none';
          triggerTxCoin(idx);
        }, 250 + idx * 240);

        // Click to launch coin
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerTxCoin(idx);
        });
      });

      // Keep loop going so bins slowly fill
      const initialSeqEnd = 250 + recentRows.length * 240 + 600;
      setTimeout(() => {
        let cycleIdx = 0;
        setInterval(() => {
          if (document.hidden) return;
          triggerTxCoin(cycleIdx);
          cycleIdx = (cycleIdx + 1) % recentRows.length;
        }, 1600);
      }, initialSeqEnd);
    }

    // 2. Income card tap-flip between "55% saved" and "₹2,580 total"
    let incomeFlipped = false;
    let flipTimer = null;

    function toggleIncomeFlip() {
      incomeFlipped = !incomeFlipped;
      if (incomeCard) {
        incomeCard.style.transform = 'scale(0.96)';
        setTimeout(() => {
          incomeCard.style.transform = 'scale(1)';
        }, 150);
      }
      if (incomeIcon) {
        incomeIcon.style.transition = 'transform 0.4s ease';
        incomeIcon.style.transform = incomeFlipped ? 'rotate(180deg)' : 'rotate(0deg)';
      }
      if (incomeVal && incomeSub) {
        if (incomeFlipped) {
          incomeVal.textContent = '₹2,580';
          incomeSub.textContent = 'Total earned ₹16,540';
        } else {
          incomeVal.textContent = '55% saved';
          incomeSub.textContent = 'saved this month';
        }
      }
    }

    if (incomeCard) {
      incomeCard.addEventListener('click', () => {
        toggleIncomeFlip();
        resetFlipTimer();
      });
      incomeCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleIncomeFlip();
          resetFlipTimer();
        }
      });
    }

    function resetFlipTimer() {
      if (shouldDisableMotion) return;
      if (flipTimer) clearInterval(flipTimer);
      flipTimer = setInterval(toggleIncomeFlip, 4000);
    }
    resetFlipTimer();

    // 3. Truthful Sync Status Chip loop
    // Cycles: "Saved on device" -> "Syncing…" -> "Synced"
    if (statusBadge && statusText && statusDot && !shouldDisableMotion) {
      const syncStates = [
        { text: 'Saved on device', dotClass: 'dot-emerald', title: 'Local-first copy on device' },
        { text: 'Syncing…', dotClass: 'dot-blue', title: 'Syncing changes to cloud vault' },
        { text: 'Synced', dotClass: 'dot-emerald', title: 'Cloud copy verified' }
      ];
      let syncIdx = 0;

      setInterval(() => {
        syncIdx = (syncIdx + 1) % syncStates.length;
        const cur = syncStates[syncIdx];
        statusText.textContent = cur.text;
        statusBadge.title = cur.title;
        statusDot.className = `mini-dash-status-dot ${cur.dotClass}`;
      }, 3500);
    }
  }

  // =========================================================================
  // Initialization on DOM Ready
  // =========================================================================
  function initLivingHero() {
    const heroEl = document.getElementById('hero');
    if (!heroEl) return;

    heroEl.classList.add('hero-loaded');
    initHeroShader(heroEl);
    const physics = initHeroPhysics(heroEl);
    initHeroPhone3D(heroEl);
    initMiniDashboard(heroEl, physics);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLivingHero);
  } else {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(initLivingHero, { timeout: 120 });
    } else {
      setTimeout(initLivingHero, 16);
    }
  }
})();
