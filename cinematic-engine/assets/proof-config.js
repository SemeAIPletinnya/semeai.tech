(() => {
  if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  // The loopback proof server may add local GitHub authentication upstream.
  // No credential is ever placed in the browser or the rendered receipt.
  window.SEMEAI_BENCHMARK_API_ROOT = `${window.location.origin}/__cinematic__/github`;
})();
