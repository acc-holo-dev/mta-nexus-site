/** Static beforeInteractive theme bootstrap — no user input. */
export const themeInitScript = `
(function() {
  var preference = 'system';

  try {
    var stored = localStorage.getItem('nexus-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      preference = stored;
    }
  } catch (e) {
    // Storage can be unavailable in hardened browser modes. System theme remains safe.
  }

  var prefersDark =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  var useDark =
    preference === 'dark' || (preference === 'system' && prefersDark);

  document.documentElement.classList.toggle('dark', useDark);
  document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
})();
`;
