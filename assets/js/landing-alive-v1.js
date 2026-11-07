/* Landing alive layer: scroll progress, a drifting glow, sections that connect as they enter, a cursor spotlight on cards.
   Everything is skipped for prefers-reduced-motion; all content is visible without this file. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  root.classList.add('alive-ready');

  var bar = document.createElement('div');
  bar.className = 'alive-progress';
  bar.setAttribute('aria-hidden', 'true');
  var glow = document.createElement('div');
  glow.className = 'alive-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(glow, document.body.firstChild);
  document.body.appendChild(bar);

  var queued = false;
  function update() {
    queued = false;
    var max = root.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    glow.style.transform = 'translate3d(' + ((p - 0.5) * 30).toFixed(2) + 'vw,' + (p * 60 - 10).toFixed(2) + 'vh,0)';
  }
  window.addEventListener('scroll', function () {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.section-problem,.section-steps,.section-faq,.section-closing,.feature-section,.feature-demo-frame,.half-frame')
      .forEach(function (n) { io.observe(n); });
  } else {
    root.classList.remove('alive-ready'); // no observer: leave everything in its final state
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', function (ev) {
      var t = ev.target;
      var card = t && t.closest ? t.closest('.feature-demo-frame,.half-frame,.why-card,.step-card') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    }, { passive: true });
  }
})();
