// Menu hamburger cho tablet/mobile — dùng chung index & trang hướng dẫn
(function () {
  const btn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.classList.toggle('is-active', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  }

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  const mq = window.matchMedia('(min-width: 861px)');
  mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
})();
