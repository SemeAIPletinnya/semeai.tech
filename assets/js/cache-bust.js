// Prevent stale HTML when users press Back (bfcache) or hit long CDN TTL.
(function () {
  const VERSION = "20260713d";

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      // Restored from browser back-forward cache — force fresh document.
      location.reload();
      return;
    }
  });

  // If an older HTML shell is still open, soft-nudge to versioned entry once.
  try {
    const key = "semeai_asset_version";
    const prev = sessionStorage.getItem(key);
    if (prev && prev !== VERSION && !location.search.includes("v=")) {
      sessionStorage.setItem(key, VERSION);
      const url = new URL(location.href);
      url.searchParams.set("v", VERSION);
      location.replace(url.toString());
      return;
    }
    sessionStorage.setItem(key, VERSION);
  } catch (_) {
    /* ignore */
  }
})();
