(() => {
  const currentScript = document.currentScript;
  if (!currentScript) return;

  const runtimeUrl = new URL('store-locator.min.js', currentScript.src).href;
  if (document.querySelector(`script[data-dm-runtime="${runtimeUrl}"]`)) return;

  const runtime = document.createElement('script');
  runtime.src = runtimeUrl;
  runtime.defer = true;
  runtime.dataset.dmRuntime = runtimeUrl;
  document.head.appendChild(runtime);
})();
