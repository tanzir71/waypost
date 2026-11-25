/* The URL of this script makes one build work at / and /waypost/. */
(() => {
  const script = document.currentScript;
  const defaults = {
    mode: 'auto', basePath: null, syncUrl: null, icsUrl: null,
    ai: { provider: null },
  };
  const config = { ...defaults, ...window.WAYPOST_CONFIG };
  config.basePath ??= new URL('.', script.src).pathname;
  config.basePath = `/${config.basePath.split('/').filter(Boolean).join('/')}/`.replace('//', '/');
  if (config.mode === 'auto') {
    config.mode = location.hostname.endsWith('.github.io') ? 'demo' : 'pwa';
  }
  window.WAYPOST_CONFIG = config;
  try {
    const theme = localStorage.getItem('waypost:theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch { /* Private browsing can disable localStorage. */ }
})();
