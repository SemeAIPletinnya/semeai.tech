(() => {
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const links = [
    { href: "index.html", label: "Home" },
    { href: "index.html#demo", label: "Demo" },
    { href: "gate.html", label: "Contract" },
    { href: "self-hosted.html", label: "Self-hosted" },
    { href: "article.html", label: "Thesis" },
    { href: "register.html?v=20260716r", label: "Register" },
    { href: "dashboard.html?v=20260713b", label: "Dashboard", cta: true },
  ];

  function renderNav(target) {
    if (!target) return;
    target.innerHTML = `
      <div class="page nav-inner">
        <a class="brand" href="index.html"><span class="mark">SG</span><span>SemeAI</span></a>
        <nav class="links" aria-label="Primary">
          ${links
            .map((l) => {
              const active = !l.external && l.href.toLowerCase() === current ? "active" : "";
              const cls = [active, l.cta ? "cta" : ""].filter(Boolean).join(" ");
              const rel = l.external ? ' rel="noopener"' : "";
              const targetAttr = l.external ? ' target="_blank"' : "";
              return `<a class="${cls}" href="${l.href}"${rel}${targetAttr}>${l.label}</a>`;
            })
            .join("")}
        </nav>
      </div>`;
  }

  function renderFooter(target) {
    if (!target) return;
    target.innerHTML = `
      <div class="page">
        <strong style="color:var(--text-strong)">SemeAI Gate</strong> —
        generation is not release authority.
        Machine values remain canonical: SHOW / REVIEW / BLOCK → PROCEED / NEEDS_REVIEW / SILENCE.<br/>
        Pilot billing: USDT/TRC20 · feedback
        <a href="mailto:support@semeai.tech">support@semeai.tech</a> ·
        <a href="https://github.com/SemeAIPletinnya/semeai-gate-basic">Gate</a> ·
        <a href="https://github.com/SemeAIPletinnya/silence-as-control">SaC</a> ·
        <a href="https://x.com/adelayida210519" target="_blank" rel="noopener">@adelayida210519</a> ·
        <a href="https://gate.semeai.tech/demo/saas_visible.html">Ecosystem demo</a> ·
        <a href="https://api.semeai.tech/health">API health</a>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderNav(document.querySelector("[data-semeai-nav]"));
    renderFooter(document.querySelector("[data-semeai-footer]"));
  });
})();
