const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8137;
const CDP_PORT = 9237;
const BASE_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(BASE_DIR, 'docs', 'ui', 'landing-living-hero', 'checkpoint');

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
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, async () => {
  console.log(`Server on http://127.0.0.1:${PORT}`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.join(BASE_DIR, 'scratch', 'edge_user_data_scroll');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

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

  await new Promise(r => setTimeout(r, 1200));

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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 1500));

  const scrollPcts = [
    { pct: 0, file: 'scrollout_1440_00pct.png' },
    { pct: 50, file: 'scrollout_1440_50pct.png' },
    { pct: 100, file: 'scrollout_1440_100pct.png' }
  ];

  for (const sp of scrollPcts) {
    const scrollInfo = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
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
            requestAnimationFrame(() => {
              resolve({
                scrollY: window.scrollY,
                heroH: h,
                targetY: targetY
              });
            });
          });
        })
      `
    });
    console.log(`[Scrollout] Target: ${sp.pct}%, Info:`, scrollInfo.result.value);
    await new Promise(r => setTimeout(r, 400));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT_DIR, sp.file), Buffer.from(shot.data, 'base64'));
    console.log(`Captured ${sp.file}`);
  }

  // Also measure pure CPU compute time of physics + rendering over 300 cycles
  console.log('Measuring physics + render frame compute time...');
  await send('Runtime.evaluate', {
    expression: 'window.scrollTo({ top: 0, behavior: "instant" });'
  });
  await new Promise(r => setTimeout(r, 400));

  const benchRes = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      new Promise((resolve) => {
        // Measure 300 consecutive physics simulation and pointer dispatch cycles
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

          if (count < 300) {
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
            const budgetUtilPct = (avg / 16.67) * 100;
            resolve({
              avgMs: Number(avg.toFixed(3)),
              p50Ms: Number(p50.toFixed(3)),
              p95Ms: Number(p95.toFixed(3)),
              p99Ms: Number(p99.toFixed(3)),
              maxMs: Number(max.toFixed(3)),
              longFramesOver16ms: longTasks,
              budgetUtilizationPct: Number(budgetUtilPct.toFixed(1)),
              sampleCount: timings.length
            });
          }
        }
        requestAnimationFrame(stepBench);
      });
    `
  });

  console.log('Interaction Bench:', JSON.stringify(benchRes.result.value, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'interaction_bench.json'), JSON.stringify(benchRes.result.value, null, 2));

  ws.close();
  edge.kill();
  server.close();
  console.log('Done!');
});
