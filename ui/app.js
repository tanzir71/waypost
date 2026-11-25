const config = window.WAYPOST_CONFIG;
if (config.mode === 'demo') {
  document.querySelector('#demo-banner').hidden = false;
  document.querySelectorAll('[data-status-pill]').forEach(node => { node.textContent = 'Demo'; });
}
document.querySelector('#clear-demo').addEventListener('click', () => {
  sessionStorage.setItem('waypost:demo-cleared', '1');
  document.querySelector('#announcement').textContent = 'Sample data cleared. Your own records are kept.';
});
if (config.mode === 'demo' && !sessionStorage.getItem('waypost:demo-cleared')) {
  try {
    const response = await fetch(`${config.basePath}data/demo.json`);
    if (!response.ok) throw new Error('Demo data could not be loaded.');
    const seed = await response.json();
    document.querySelector('#result-data').textContent = JSON.stringify({ demo: true, records: seed });
  } catch (error) { document.querySelector('#announcement').textContent = error.message; }
}
