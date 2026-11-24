window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  window.petdayInstallPrompt = event;
});
// Cache only the public offline message. Account responses and photos never enter CacheStorage.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
