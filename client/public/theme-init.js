// Apply the saved/system theme before React and the stylesheet load.
(() => {
  let preference;
  try { preference = localStorage.getItem('petday.theme'); } catch { /* Storage is optional. */ }
  const theme = ['light', 'dark'].includes(preference) ? preference : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const background = theme === 'dark' ? '#201c24' : '#fff8ec';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
})();
