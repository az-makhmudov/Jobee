/* global localStorage, matchMedia, document */
(() => {
  let theme = 'system';
  try {
    theme = localStorage.getItem('jobee.theme') || 'system';
  } catch {
    /* Storage can be unavailable. */
  }
  const dark =
    theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
