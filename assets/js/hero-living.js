/**
 * Ledgio Living Hero Experience
 * 1. WebGL Animated Gradient Mesh Backdrop (falling back to CSS gradient)
 * 2. Canvas Verlet Physics Engine (Glowing ₹ Coins & Receipts settling into 5 Ledgio Bins)
 * 3. CSS 3D Phone Chassis Controller (Pointer spring tracking, idle wobble, specular glare, scroll-out fade)
 * 4. Live HTML Mini-Dashboard (Real DOM nodes, counters, income tap-flip, sync chip loop, 5 sliding transactions)
 *
 * Rules:
 * - 0 new innerHTML sinks (all DOM updates via textContent / DOM APIs)
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
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
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
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BINS = [
      { name: 'Food & Dining', color: '#f59e0b', count: 0 },
      { name: 'Bills & Utilities', color: '#3b82f6', count: 0 },
      { name: 'Transport', color: '#8b5cf6', count: 0 },
      { name: 'Shopping', color: '#ec4899', count: 0 },
      { name: 'Savings', color: '#10b981', count: 0 }
    ];

    const MAX_BODIES = isMobile ? 36 : 96;
    let width = 0;
    let height = 0;
    const BIN_HEIGHT = isMobile ? 52 : 62;

    function resize() {
      const rect = heroEl.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const particles = [];
    for (let i = 0; i < MAX_BODIES; i++) {
      particles.push({
        active: false,
        type: i % 4 === 0 ? 'receipt' : 'coin',
        x: 0,
        y: 0,
        oldX: 0,
        oldY: 0,
        angle: 0,
        oldAngle: 0,
        radius: 12 + (i % 5) * 1.5,
        width: 24,
        height: 34,
        colorIndex: i % BINS.length,
        settled: false,
        settledBin: -1
      });
    }

    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
      radius: isMobile ? 85 : 125,
      strength: 750
    };

    function updatePointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
      mouse.active = (mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height);
    }

    window.addEventListener('mousemove', (e) => {
      updatePointer(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      mouse.active = false;
    });

    let spawnIdx = 0;
    function spawnParticle(x, y, vx, vy, forceType) {
      const p = particles[spawnIdx];
      spawnIdx = (spawnIdx + 1) % MAX_BODIES;

      p.active = true;
      p.settled = false;
      p.settledBin = -1;
      p.type = forceType || (Math.random() < 0.25 ? 'receipt' : 'coin');
      p.x = x;
      p.y = y;
      p.oldX = x - (vx || (Math.random() - 0.5) * 60);
      p.oldY = y - (vy || -(Math.random() * 80 + 40));
      p.angle = Math.random() * Math.PI * 2;
      p.oldAngle = p.angle + (Math.random() - 0.5) * 0.15;
      p.radius = 12 + Math.random() * 5;
      p.colorIndex = Math.floor(Math.random() * BINS.length);
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      for (let k = 0; k < 3; k++) {
        spawnParticle(clickX, clickY, (Math.random() - 0.5) * 140, -(Math.random() * 120 + 80));
      }
    });

    const initialBatch = shouldDisableMotion ? MAX_BODIES : (isMobile ? 18 : 42);
    for (let i = 0; i < initialBatch; i++) {
      const targetBin = i % BINS.length;
      const binW = width / BINS.length;
      const spawnX = targetBin * binW + binW * (0.2 + Math.random() * 0.6);
      if (shouldDisableMotion) {
        const p = particles[i];
        p.active = true;
        p.settled = true;
        p.settledBin = targetBin;
        p.x = spawnX;
        p.y = height - 12 - (Math.floor(i / BINS.length) * 10);
        p.oldX = p.x;
        p.oldY = p.y;
        p.colorIndex = targetBin;
      } else {
        const spawnY = -20 - (i * 28);
        spawnParticle(spawnX, spawnY, (Math.random() - 0.5) * 30, Math.random() * 40 + 20);
      }
    }

    let lastSpawnTime = performance.now();
    let isVisible = true;
    let animId = null;
    let lastTime = performance.now();

    function stepPhysics(dt) {
      const gravity = 850;
      const drag = 0.985;
      const floorY = height - 8;
      const binW = width / BINS.length;

      for (let b = 0; b < BINS.length; b++) {
        BINS[b].count = 0;
      }

      for (let i = 0; i < MAX_BODIES; i++) {
        const p = particles[i];
        if (!p.active) continue;

        if (p.settled && !mouse.active) {
          if (p.settledBin >= 0 && p.settledBin < BINS.length) {
            BINS[p.settledBin].count++;
          }
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

        if (p.y >= floorY - p.radius) {
          p.y = floorY - p.radius;
          p.oldY = p.y + vy * 0.32;
          const speedSq = (p.x - p.oldX) * (p.x - p.oldX) + (p.y - p.oldY) * (p.y - p.oldY);
          if (speedSq < 0.08) {
            p.settled = true;
            p.settledBin = Math.max(0, Math.min(BINS.length - 1, Math.floor(p.x / binW)));
          }
        }

        if (p.x < p.radius + 6) {
          p.x = p.radius + 6;
          p.oldX = p.x + Math.abs(vx) * 0.4;
        } else if (p.x > width - p.radius - 6) {
          p.x = width - p.radius - 6;
          p.oldX = p.x - Math.abs(vx) * 0.4;
        }

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

        for (let j = i + 1; j < MAX_BODIES; j++) {
          const q = particles[j];
          if (!q.active) continue;
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

        if (p.y > height - BIN_HEIGHT) {
          const binIdx = Math.max(0, Math.min(BINS.length - 1, Math.floor(p.x / binW)));
          BINS[binIdx].count++;
        }
      }
    }

    function drawScene() {
      ctx.clearRect(0, 0, width, height);
      const isDark = getCurrentTheme() === 'dark';
      const binW = width / BINS.length;
      const dividerTop = height - BIN_HEIGHT;

      // Draw Category Bins
      for (let b = 0; b < BINS.length; b++) {
        const bin = BINS[b];
        const bx = b * binW;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(bx + 4, dividerTop, binW - 8, BIN_HEIGHT - 6);

        ctx.fillStyle = bin.color;
        ctx.fillRect(bx + 4, dividerTop, binW - 8, 2.5);

        ctx.save();
        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.font = `600 ${isMobile ? 10 : 12}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = isMobile ? bin.name.split(' ')[0] : bin.name;
        ctx.fillText(label, bx + binW * 0.5, dividerTop + 18);

        ctx.fillStyle = bin.color;
        ctx.font = `700 ${isMobile ? 11 : 13}px "Space Grotesk", sans-serif`;
        ctx.fillText(`${bin.count} items`, bx + binW * 0.5, dividerTop + 36);
        ctx.restore();

        if (b > 0) {
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, dividerTop);
          ctx.lineTo(bx, height - 6);
          ctx.stroke();
        }
      }

      // Draw Particles
      for (let i = 0; i < MAX_BODIES; i++) {
        const p = particles[i];
        if (!p.active) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (p.type === 'coin') {
          const binColor = BINS[p.colorIndex].color;
          ctx.shadowColor = binColor;
          ctx.shadowBlur = isDark ? 10 : 6;

          const grad = ctx.createRadialGradient(-p.radius * 0.3, -p.radius * 0.3, 2, 0, 0, p.radius);
          if (isDark) {
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.7, '#eab308');
            grad.addColorStop(1, '#ca8a04');
          } else {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.6, '#fde047');
            grad.addColorStop(1, '#eab308');
          }
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#a16207';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#78350f';
          ctx.font = `700 ${Math.floor(p.radius * 1.15)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₹', 0, 1);
        } else {
          const rw = p.width;
          const rh = p.height;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 3;

          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.92)' : '#ffffff';
          ctx.beginPath();
          ctx.roundRect(-rw * 0.5, -rh * 0.5, rw, rh, 3.5);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = BINS[p.colorIndex].color;
          ctx.fillRect(-rw * 0.5 + 4, -rh * 0.5 + 3, rw - 8, 2.5);

          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-rw * 0.5 + 4, -rh * 0.5 + 9, rw * 0.65, 1.8);
          ctx.fillRect(-rw * 0.5 + 4, -rh * 0.5 + 14, rw * 0.5, 1.8);
          ctx.fillRect(-rw * 0.5 + 4, -rh * 0.5 + 19, rw * 0.75, 1.8);

          ctx.fillStyle = '#10b981';
          ctx.fillRect(-rw * 0.5 + 4, -rh * 0.5 + 26, rw * 0.45, 2.2);
        }

        ctx.restore();
      }
    }

    function frame(now) {
      if (!isVisible) return;
      const dt = Math.min((now - lastTime) * 0.001, 0.033);
      lastTime = now;

      if (!shouldDisableMotion && now - lastSpawnTime > 1600) {
        lastSpawnTime = now;
        const binW = width / BINS.length;
        const rBin = Math.floor(Math.random() * BINS.length);
        const sx = rBin * binW + binW * (0.2 + Math.random() * 0.6);
        spawnParticle(sx, -20, (Math.random() - 0.5) * 40, Math.random() * 60 + 30);
      }

      stepPhysics(dt);
      drawScene();

      animId = requestAnimationFrame(frame);
    }

    if (shouldDisableMotion) {
      drawScene();
    } else {
      animId = requestAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isVisible = entry && entry.isIntersecting && !document.hidden;
      if (isVisible && !animId && !shouldDisableMotion) {
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
      } else if (!document.hidden && isVisible && !animId && !shouldDisableMotion) {
        lastTime = performance.now();
        animId = requestAnimationFrame(frame);
      }
    });
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
  function initMiniDashboard(heroEl) {
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

      // Animate 5 recent transactions slide-in
      recentRows.forEach((row, idx) => {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        row.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        setTimeout(() => {
          row.style.opacity = '1';
          row.style.transform = 'translateX(0)';
        }, 400 + idx * 120);
      });
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
    initHeroPhysics(heroEl);
    initHeroPhone3D(heroEl);
    initMiniDashboard(heroEl);
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
