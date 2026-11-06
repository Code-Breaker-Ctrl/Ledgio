'use strict';

// Decorative motion sleeps whenever the artwork cannot be seen.
const authArt = document.querySelector('.c1-auth .auth-brand-panel');
if (authArt) {
  let visible = false;
  const update = () => authArt.style.setProperty('--art-play', visible && !document.hidden ? 'running' : 'paused');
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(authArt);
  document.addEventListener('visibilitychange', update);
}
