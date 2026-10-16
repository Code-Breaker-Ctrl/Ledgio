(function() {
  const el = document.createElement('div');
  el.id = 'debug-viewport-overlay';
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:50vh;overflow-y:auto;background:rgba(0,0,0,0.92);color:#0f0;font:10px/1.25 monospace;padding:6px;z-index:99999999;border-top:2px solid #0f0;pointer-events:none;white-space:pre-wrap;';
  function update(evt) {
    if (!document.body) return;
    if (!document.getElementById('debug-viewport-overlay')) document.body.appendChild(el);
    const vv = window.visualViewport || {};
    const de = document.documentElement;
    const body = document.body || {};
    const vp = document.querySelector('meta[name="viewport"]');
    const offenders = [];
    document.querySelectorAll('*').forEach(n => {
      if (n === el || n.contains(el)) return;
      const r = n.getBoundingClientRect();
      if (r.right > window.innerWidth + 1) {
        const clsStr = (n.className && typeof n.className === 'string') ? n.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        offenders.push({ tag: n.tagName.toLowerCase(), id: n.id, cls: clsStr, right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    offenders.sort((a, b) => b.right - a.right);
    const top5 = offenders.slice(0, 5).map(o => `${o.tag}${o.id ? '#' + o.id : ''}${o.cls ? '.' + o.cls : ''} (r:${o.right} w:${o.w})`).join('\n  ') || 'none';
    const cls = [de.classList.contains('is-mobile-device') ? 'is-mob' : '', de.classList.contains('force-mobile-layout') ? 'force-mob' : ''].filter(Boolean).join(',') || 'none';
    el.innerText = `[VIEWPORT DEBUG: ${evt}]
win: ${window.innerWidth}x${window.innerHeight} | scr.w: ${screen.width} | dpr: ${window.devicePixelRatio}
vv: w:${vv.width ? Math.round(vv.width) : 0} scale:${vv.scale ? vv.scale.toFixed(3) : 1}
de.clientW: ${de.clientWidth} | de.scrollW: ${de.scrollWidth} | body.scrollW: ${body.scrollWidth || 0}
classes: ${cls}
meta: ${vp ? vp.getAttribute('content') : 'none'}
offenders (${offenders.length}):
  ${top5}`;
  }
  document.addEventListener('DOMContentLoaded', () => update('DOMContentLoaded'));
  window.addEventListener('load', () => update('load'));
  [250, 1000, 3000].forEach(t => setTimeout(() => update(`+${t}ms`), t));
  update('init');
})();
