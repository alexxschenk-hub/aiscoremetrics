(() => {
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const key = 'aiscoremetrics.theme';
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  if (preference !== 'light' && preference !== 'dark') preference = null;
  const apply = () => {
    const dark = preference ? preference === 'dark' : system.matches;
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0E1215' : '#F1F3F4';
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.setAttribute('aria-checked', String(dark));
  };
  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const english = root.lang === 'en';
    toggle.setAttribute('aria-label', english ? 'Dark mode' : 'Dunkler Modus');
    toggle.querySelector('.theme-label').textContent = english ? 'Dark mode' : 'Dark Mode';
    toggle.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
    apply();
  });
})();
