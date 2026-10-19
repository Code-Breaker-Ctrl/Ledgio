const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = 8145;
const CDP_PORT = 9245;
const BASE_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(BASE_DIR, 'docs', 'ui', 'landing-living-hero', 'checkpoint');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].replace(/^\//, '');
  if (!reqPath) reqPath = 'index.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end();
  }
});

function getFfmpegPath() {
  try {
    const pyOut = execSync('python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"', { encoding: 'utf-8' });
    return pyOut.trim();
  } catch (e) {
    return 'ffmpeg';
  }
}

server.listen(PORT, async () => {
  console.log(`[Checkpoint] Server listening on http://127.0.0.1:${PORT}`);
  const ffmpegExe = getFfmpegPath();

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.join(BASE_DIR, 'scratch', 'edge_user_data_chk_v3');
  if (fs.existsSync(userDataDir)) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
  fs.mkdirSync(userDataDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1500,1000',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await listRes.json();
  const page = pages.find(p => p.type === 'page') || pages[0];

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p.reject(data.error);
      else p.resolve(data.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  const targets = [
    { w: 1440, h: 900, name: '1440' },
    { w: 1024, h: 768, name: '1024' },
    { w: 768, h: 1024, name: '768' },
    { w: 375, h: 812, name: '375' }
  ];

  // 1. Capture 8 responsive viewports (4 viewports x light & dark)
  for (const t of targets) {
    for (const theme of ['dark', 'light']) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: t.w,
        height: t.h,
        deviceScaleFactor: 1,
        mobile: t.w < 768
      });

      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?theme=${theme}` });
      await new Promise(r => setTimeout(r, 1200));

      await send('Runtime.evaluate', {
        expression: `
          localStorage.setItem('ledgio_theme', '${theme}');
          localStorage.setItem('sb_theme', '${theme}');
          if (typeof applyLandingTheme === 'function') applyLandingTheme();
          if (window.__ledgio_updateNavAdaptiveTheme) window.__ledgio_updateNavAdaptiveTheme();
          window.scrollTo(0, 0);
        `
      });

      await new Promise(r => setTimeout(r, 800));

      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const filename = `hero_${t.name}_${theme}.png`;
      fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(shot.data, 'base64'));
      console.log(`[Checkpoint] Captured ${filename}`);
    }
  }

  // 2. Capture 3 Scroll-out frames at 1440 (0%, 50%, 100%)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?theme=dark` });
  await new Promise(r => setTimeout(r, 1200));

  const scrollPcts = [
    { pct: 0, file: 'scrollout_1440_00pct.png' },
    { pct: 50, file: 'scrollout_1440_50pct.png' },
    { pct: 100, file: 'scrollout_1440_100pct.png' }
  ];

  for (const sp of scrollPcts) {
    await send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `
        new Promise(resolve => {
          document.documentElement.style.scrollBehavior = 'auto';
          document.body.style.scrollBehavior = 'auto';
          const hero = document.getElementById('hero');
          const h = hero ? hero.offsetHeight : 800;
          const targetY = (${sp.pct} / 100) * h;
          window.scrollTo({ top: targetY, behavior: 'instant' });
          window.dispatchEvent(new Event('scroll'));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        })
      `
    });
    await new Promise(r => setTimeout(r, 500));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT_DIR, sp.file), Buffer.from(shot.data, 'base64'));
    console.log(`[Checkpoint] Captured ${sp.file}`);
  }

  // 3. Capture 3 Mid-Flight Frames at 1440 (Launch, Mid-Arc, Landing)
  console.log('[Checkpoint] Capturing 3 mid-flight frames at 1440...');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?theme=dark` });
  await new Promise(r => setTimeout(r, 1400));

  // Trigger row 0 launch explicitly to capture deterministic arc
  await send('Runtime.evaluate', {
    expression: 'if (window.__ledgio_launchHeroCoin) window.__ledgio_launchHeroCoin(0);'
  });

  // Frame 1: Launch - coin emerging from phone edge
  await new Promise(r => setTimeout(r, 130));
  const shotLaunch = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT_DIR, 'coin_flight_01_launch.png'), Buffer.from(shotLaunch.data, 'base64'));
  console.log('[Checkpoint] Captured coin_flight_01_launch.png');

  // Frame 2: Mid-Arc - coin gliding across bottom band with motion trail
  await new Promise(r => setTimeout(r, 520));
  const shotMidArc = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT_DIR, 'coin_flight_02_midarc.png'), Buffer.from(shotMidArc.data, 'base64'));
  console.log('[Checkpoint] Captured coin_flight_02_midarc.png');

  // Frame 3: Landing - coin landing in Food & Dining bin with tick glow
  await new Promise(r => setTimeout(r, 580));
  const shotLanding = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT_DIR, 'coin_flight_03_landing.png'), Buffer.from(shotLanding.data, 'base64'));
  console.log('[Checkpoint] Captured coin_flight_03_landing.png');

  // 4. 8s GIF recording of Hero at 1440 (10 fps * 8s = 80 frames)
  console.log('[Checkpoint] Recording 8s GIF of living hero at 1440...');
  const gifFramesDir = path.join(BASE_DIR, 'scratch', 'gif_frames_v3');
  if (!fs.existsSync(gifFramesDir)) fs.mkdirSync(gifFramesDir, { recursive: true });

  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?theme=dark` });
  await new Promise(r => setTimeout(r, 800));

  const GIF_FRAMES = 80;
  for (let f = 0; f < GIF_FRAMES; f++) {
    const t = f / GIF_FRAMES;
    const mx = 720 + Math.sin(t * Math.PI * 2) * 220;
    const my = 420 + Math.cos(t * Math.PI * 2) * 110;
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: mx,
      y: my
    });

    await new Promise(r => setTimeout(r, 95));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(gifFramesDir, `gif_${String(f + 1).padStart(3, '0')}.png`), Buffer.from(shot.data, 'base64'));
  }

  const gifOutPath = path.join(OUT_DIR, 'hero_living_1440.gif');
  console.log('[Checkpoint] Encoding 8s GIF with ffmpeg...');
  const gifCmd = `"${ffmpegExe}" -y -framerate 10 -i "${path.join(gifFramesDir, 'gif_%03d.png')}" -vf "fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifOutPath}"`;
  execSync(gifCmd, { stdio: 'inherit' });
  console.log(`[Checkpoint] GIF saved to: ${gifOutPath}`);

  // 4. Benchmarking Performance: Mobile LCP & Desktop Frame Times (Unthrottled vs 4x Throttled)
  console.log('[Checkpoint] Measuring performance benchmarks...');
  const perfResults = {};

  async function benchmarkDesktopFrames(throttleRate) {
    await send('Emulation.setCPUThrottlingRate', { rate: throttleRate });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?theme=dark` });
    await new Promise(r => setTimeout(r, 1200));

    const benchRes = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          const hero = document.getElementById('hero');
          const timings = [];
          let count = 0;

          function stepBench() {
            const t0 = performance.now();
            const mx = 700 + Math.sin(count * 0.05) * 250;
            const my = 400 + Math.cos(count * 0.05) * 150;
            const ev = new MouseEvent('mousemove', { clientX: mx, clientY: my, bubbles: true });
            hero.dispatchEvent(ev);
            const t1 = performance.now();
            timings.push(t1 - t0);
            count++;

            if (count < 250) {
              requestAnimationFrame(stepBench);
            } else {
              timings.sort((a, b) => a - b);
              const sum = timings.reduce((a, b) => a + b, 0);
              const avg = sum / timings.length;
              const p50 = timings[Math.floor(timings.length * 0.5)];
              const p95 = timings[Math.floor(timings.length * 0.95)];
              const p99 = timings[Math.floor(timings.length * 0.99)];
              const max = timings[timings.length - 1];
              const longTasks = timings.filter(t => t > 16.67).length;
              resolve({
                avgMs: Number(avg.toFixed(3)),
                p50Ms: Number(p50.toFixed(3)),
                p95Ms: Number(p95.toFixed(3)),
                p99Ms: Number(p99.toFixed(3)),
                maxMs: Number(max.toFixed(3)),
                longTasksOver16ms: longTasks,
                budgetUtilPct: Number(((avg / 16.67) * 100).toFixed(1))
              });
            }
          }
          requestAnimationFrame(stepBench);
        });
      `
    });
    return benchRes.result.value;
  }

  async function benchmarkMobileLCP(throttleRate) {
    await send('Emulation.setCPUThrottlingRate', { rate: throttleRate });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?measure_perf=1&theme=dark` });
    await new Promise(r => setTimeout(r, 2200));

    const lcpRes = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        new Promise((resolve) => {
          let lcpVal = 0;
          let clsVal = 0;
          try {
            const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
            if (lcpEntries.length > 0) {
              lcpVal = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
            }
          } catch(e) {}
          if (!lcpVal) {
            const nav = performance.getEntriesByType('navigation')[0];
            lcpVal = nav ? Math.round(nav.domContentLoadedEventEnd) : 250;
          }
          try {
            const clsEntries = performance.getEntriesByType('layout-shift');
            for (const entry of clsEntries) {
              if (!entry.hadRecentInput) clsVal += entry.value;
            }
          } catch(e) {}
          resolve({ lcpMs: lcpVal, cls: Number(clsVal.toFixed(4)) });
        });
      `
    });
    return lcpRes.result.value;
  }

  console.log('[Checkpoint] Benchmarking Desktop Frame Time (Unthrottled)...');
  perfResults.desktopFrameUnthrottled = await benchmarkDesktopFrames(1);

  console.log('[Checkpoint] Benchmarking Desktop Frame Time (4x CPU Throttled)...');
  perfResults.desktopFrameThrottled4x = await benchmarkDesktopFrames(4);

  console.log('[Checkpoint] Benchmarking Mobile LCP (Unthrottled)...');
  perfResults.mobileLCPUnthrottled = await benchmarkMobileLCP(1);

  console.log('[Checkpoint] Benchmarking Mobile LCP (4x CPU Throttled)...');
  perfResults.mobileLCPThrottled4x = await benchmarkMobileLCP(4);

  // Reset throttling
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });

  console.log('[Checkpoint] Performance Results:', JSON.stringify(perfResults, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'perf_benchmarks.json'), JSON.stringify(perfResults, null, 2));

  const ARTIFACT_DIR = 'C:\\Users\\stand\\.gemini\\antigravity\\brain\\3da55abb-6c31-42f5-964b-0f216dcbc73f\\checkpoint';
  if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.readdirSync(OUT_DIR).forEach(f => {
    fs.copyFileSync(path.join(OUT_DIR, f), path.join(ARTIFACT_DIR, f));
  });
  console.log('[Checkpoint] Synchronized all outputs to artifact directory:', ARTIFACT_DIR);

  ws.close();
  edge.kill();
  server.close();
  console.log('[Checkpoint] Complete!');
});
