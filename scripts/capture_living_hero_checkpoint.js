const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PORT = 8135;
const CDP_PORT = 9235;
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
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
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
  const userDataDir = path.join(BASE_DIR, 'scratch', 'edge_user_data_living_chk');
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

  const targets = [
    { w: 1440, h: 900, name: '1440' },
    { w: 1024, h: 768, name: '1024' },
    { w: 768, h: 1024, name: '768' },
    { w: 375, h: 812, name: '375' }
  ];

  for (const t of targets) {
    for (const theme of ['dark', 'light']) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: t.w,
        height: t.h,
        deviceScaleFactor: 1,
        mobile: t.w < 768
      });

      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
      await new Promise(r => setTimeout(r, 1000));

      // Set theme and trigger loaded
      await send('Runtime.evaluate', {
        expression: `
          document.documentElement.setAttribute('data-theme', '${theme}');
          localStorage.setItem('ledgio_theme', '${theme}');
          window.scrollTo(0, 0);
        `
      });

      await new Promise(r => setTimeout(r, 1200));

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filename = `hero_${t.name}_${theme}.png`;
      fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(shot.data, 'base64'));
      console.log(`[Checkpoint] Captured ${filename}`);
    }
  }

  // 3 Scroll-out frames at 1440 (0%, 50%, 100%)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await new Promise(r => setTimeout(r, 1200));

  const scrollPcts = [
    { pct: 0, file: 'scrollout_1440_00pct.png' },
    { pct: 50, file: 'scrollout_1440_50pct.png' },
    { pct: 100, file: 'scrollout_1440_100pct.png' }
  ];

  for (const sp of scrollPcts) {
    await send('Runtime.evaluate', {
      expression: `
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        const hero = document.getElementById('hero');
        const h = hero ? hero.offsetHeight : 800;
        const targetY = (${sp.pct} / 100) * h;
        window.scrollTo({ top: targetY, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
      `
    });
    await new Promise(r => setTimeout(r, 600));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, sp.file), Buffer.from(shot.data, 'base64'));
    console.log(`[Checkpoint] Captured ${sp.file}`);
  }

  // 5s GIF recording of Hero at 1440 (12 fps * 5s = 60 frames)
  console.log('[Checkpoint] Recording 5s GIF of living hero at 1440...');
  const gifFramesDir = path.join(BASE_DIR, 'scratch', 'gif_frames');
  if (!fs.existsSync(gifFramesDir)) fs.mkdirSync(gifFramesDir, { recursive: true });

  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
  await new Promise(r => setTimeout(r, 600));

  const GIF_FRAMES = 50;
  for (let f = 0; f < GIF_FRAMES; f++) {
    // Simulate gentle mouse motion across hero
    const t = f / GIF_FRAMES;
    const mx = 720 + Math.sin(t * Math.PI * 2) * 200;
    const my = 400 + Math.cos(t * Math.PI * 2) * 100;
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: mx,
      y: my
    });

    await new Promise(r => setTimeout(r, 80));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(gifFramesDir, `gif_${String(f + 1).padStart(3, '0')}.png`), Buffer.from(shot.data, 'base64'));
  }

  const gifOutPath = path.join(OUT_DIR, 'hero_living_1440.gif');
  console.log('[Checkpoint] Encoding GIF with ffmpeg...');
  const gifCmd = `"${ffmpegExe}" -y -framerate 10 -i "${path.join(gifFramesDir, 'gif_%03d.png')}" -vf "fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifOutPath}"`;
  execSync(gifCmd, { stdio: 'inherit' });
  console.log(`[Checkpoint] GIF saved to: ${gifOutPath}`);

  ws.close();
  edge.kill();
  server.close();
  console.log('[Checkpoint] Complete!');
});
