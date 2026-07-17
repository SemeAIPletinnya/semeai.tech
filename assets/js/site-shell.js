(() => {
  const V = "20260717a";
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase().split("?")[0];
  const isHome = current === "index.html" || current === "" || current === "/";

  const p = {
    home: `index.html?v=${V}`,
    problem: `index.html?v=${V}#problem`,
    how: `index.html?v=${V}#how`,
    impact: `index.html?v=${V}#impact`,
    demo: `index.html?v=${V}#demo`,
    pricing: `index.html?v=${V}#pricing`,
    gate: `gate.html?v=${V}`,
    selfHosted: `self-hosted.html?v=${V}`,
    research: `research.html?v=${V}`,
    thesis: `article.html?v=${V}`,
    register: `register.html?v=${V}`,
    dashboard: `dashboard.html?v=${V}`,
    console: "https://gate.semeai.tech/demo/saas_visible.html",
    github: "https://github.com/SemeAIPletinnya/semeai-gate-basic",
    sac: "https://github.com/SemeAIPletinnya/silence-as-control",
    ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6613718",
    zenodo: "https://zenodo.org/records/20525820",
    apiHealth: "https://api.semeai.tech/health",
    support: "mailto:support@semeai.tech",
  };

  /** @type {{type:string,label:string,href?:string,match?:string|null,items?:Array,external?:boolean}[]} */
  const primary = [
    {
      type: "link",
      label: "Demo",
      href: isHome ? "#demo" : p.demo,
      match: null,
    },
    {
      type: "dropdown",
      label: "Product",
      id: "nav-product",
      matchAny: ["gate.html", "self-hosted.html"],
      items: [
        { label: "How it works", desc: "SHOW · REVIEW · BLOCK flow", href: isHome ? "#how" : p.how },
        { label: "Pricing", desc: "Free checks & USDT pilot", href: isHome ? "#pricing" : p.pricing },
        { label: "Product contract", desc: "API shape & invariants", href: p.gate, match: "gate.html" },
        { label: "Self-hosted", desc: "Run Gate in your stack", href: p.selfHosted, match: "self-hosted.html" },
        { label: "Live console", desc: "Interactive SaaS demo", href: p.console, external: true },
      ],
    },
    {
      type: "dropdown",
      label: "Research",
      id: "nav-research",
      matchAny: ["research.html", "article.html"],
      items: [
        { label: "Research hub", desc: "Benchmarks & method", href: p.research, match: "research.html" },
        { label: "Thesis", desc: "Silence-as-control", href: p.thesis, match: "article.html" },
        { label: "SSRN paper", desc: "Academic reference", href: p.ssrn, external: true },
        { label: "Zenodo", desc: "Archived release", href: p.zenodo, external: true },
      ],
    },
    {
      type: "link",
      label: "Dashboard",
      href: p.dashboard,
      match: "dashboard.html",
    },
  ];

  function isActiveLink(item) {
    if (item.match && item.match === current) return true;
    if (item.matchAny && item.matchAny.includes(current)) return true;
    if (item.items) return item.items.some((c) => c.match && c.match === current);
    return false;
  }

  function extAttrs(external) {
    return external ? ' target="_blank" rel="noopener"' : "";
  }

  function dropdownHtml(item) {
    const active = isActiveLink(item) ? "active" : "";
    const items = item.items
      .map((c) => {
        const childActive = c.match && c.match === current ? "active" : "";
        const arrow = c.external ? '<span class="nav-ext" aria-hidden="true">↗</span>' : "";
        return `
          <a class="nav-drop-item ${childActive}" href="${c.href}"${extAttrs(c.external)}>
            <span class="nav-drop-label">${c.label}${arrow}</span>
            ${c.desc ? `<span class="nav-drop-desc">${c.desc}</span>` : ""}
          </a>`;
      })
      .join("");
    return `
      <div class="nav-item has-dropdown" data-dropdown="${item.id}">
        <button type="button" class="nav-link nav-drop-trigger ${active}" aria-expanded="false" aria-controls="${item.id}" id="${item.id}-btn">
          ${item.label}
          <svg class="nav-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="nav-dropdown" id="${item.id}" role="menu" aria-labelledby="${item.id}-btn">
          ${items}
        </div>
      </div>`;
  }

  function linkHtml(item) {
    const active = isActiveLink(item) ? "active" : "";
    return `<a class="nav-link ${active}" href="${item.href}"${extAttrs(item.external)}>${item.label}</a>`;
  }

  function desktopNavHtml() {
    return primary
      .map((item) => (item.type === "dropdown" ? dropdownHtml(item) : linkHtml(item)))
      .join("");
  }

  function mobileSectionsHtml() {
    const sections = [
      {
        title: "Get started",
        links: [
          { label: "Free demo checks", href: isHome ? "#demo" : p.demo },
          { label: "Pricing", href: isHome ? "#pricing" : p.pricing },
          { label: "Register workspace", href: p.register },
          { label: "Dashboard", href: p.dashboard },
          { label: "Live console", href: p.console, external: true },
        ],
      },
      {
        title: "Product",
        links: [
          { label: "How it works", href: isHome ? "#how" : p.how },
          { label: "Problem", href: isHome ? "#problem" : p.problem },
          { label: "Impact", href: isHome ? "#impact" : p.impact },
          { label: "Product contract", href: p.gate },
          { label: "Self-hosted", href: p.selfHosted },
        ],
      },
      {
        title: "Research",
        links: [
          { label: "Research hub", href: p.research },
          { label: "Thesis", href: p.thesis },
          { label: "SSRN paper", href: p.ssrn, external: true },
          { label: "Zenodo", href: p.zenodo, external: true },
          { label: "silence-as-control", href: p.sac, external: true },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Email support", href: p.support },
          { label: "GitHub", href: p.github, external: true },
          { label: "API health", href: p.apiHealth, external: true },
        ],
      },
    ];

    return sections
      .map((sec) => {
        const links = sec.links
          .map((l) => {
            const arrow = l.external ? " ↗" : "";
            return `<a class="mobile-link" href="${l.href}"${extAttrs(l.external)}>${l.label}${arrow}</a>`;
          })
          .join("");
        return `
          <div class="mobile-section">
            <div class="mobile-section-title">${sec.title}</div>
            ${links}
          </div>`;
      })
      .join("");
  }

  function navHtml() {
    return `
      <header class="site-header" data-semeai-header>
        <div class="site-header-inner">
          <a class="brand" href="${isHome ? "#top" : p.home}">
            <span class="brand-mark">SG</span>
            <span>SemeAI Gate</span>
          </a>
          <nav class="site-nav" aria-label="Primary">
            ${desktopNavHtml()}
          </nav>
          <div class="header-actions">
            <a class="header-gh" href="${p.github}" target="_blank" rel="noopener">GitHub</a>
            <a class="btn-ghost header-console" href="${p.console}" target="_blank" rel="noopener">Console</a>
            <a class="btn-primary" href="${p.register}">Start pilot</a>
            <button type="button" class="nav-burger" aria-label="Open menu" aria-expanded="false" aria-controls="site-mobile-nav">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
        <div class="mobile-nav" id="site-mobile-nav" hidden>
          <div class="mobile-nav-inner">
            ${mobileSectionsHtml()}
            <div class="mobile-cta">
              <a class="btn-primary" href="${p.register}">Start free pilot</a>
              <a class="btn-ghost" href="${isHome ? "#demo" : p.demo}">Try free checks</a>
            </div>
          </div>
        </div>
      </header>`;
  }

  function footerHtml() {
    return `
      <footer class="site-footer">
        <div class="site-footer-grid">
          <div class="footer-brand-col">
            <div class="brand">
              <span class="brand-mark" style="width:1.75rem;height:1.75rem;font-size:0.6rem">SG</span>
              <span>SemeAI Gate</span>
            </div>
            <p class="footer-tagline">Generation is not release authority. Runtime control for LLM answers: SHOW · REVIEW · BLOCK.</p>
            <p class="footer-copy">© SemeAI · Payment is never gate authority</p>
          </div>
          <div class="footer-col">
            <h4>Product</h4>
            <a href="${isHome ? "#demo" : p.demo}">Demo</a>
            <a href="${isHome ? "#pricing" : p.pricing}">Pricing</a>
            <a href="${p.gate}">Contract</a>
            <a href="${p.selfHosted}">Self-hosted</a>
            <a href="${p.console}" target="_blank" rel="noopener">Live console ↗</a>
          </div>
          <div class="footer-col">
            <h4>Research</h4>
            <a href="${p.research}">Research hub</a>
            <a href="${p.thesis}">Thesis</a>
            <a href="${p.ssrn}" target="_blank" rel="noopener">SSRN ↗</a>
            <a href="${p.zenodo}" target="_blank" rel="noopener">Zenodo ↗</a>
            <a href="${p.sac}" target="_blank" rel="noopener">silence-as-control ↗</a>
          </div>
          <div class="footer-col">
            <h4>Account</h4>
            <a href="${p.register}">Register</a>
            <a href="${p.dashboard}">Dashboard</a>
            <a href="${p.support}">Support</a>
            <a href="${p.github}" target="_blank" rel="noopener">GitHub ↗</a>
            <a href="${p.apiHealth}" target="_blank" rel="noopener">API health ↗</a>
          </div>
        </div>
      </footer>`;
  }

  function bindNav(header) {
    if (!header) return;

    // Desktop dropdowns: click toggle + outside close
    header.querySelectorAll(".has-dropdown").forEach((wrap) => {
      const btn = wrap.querySelector(".nav-drop-trigger");
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const open = wrap.classList.contains("open");
        header.querySelectorAll(".has-dropdown.open").forEach((w) => {
          w.classList.remove("open");
          const b = w.querySelector(".nav-drop-trigger");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        if (!open) {
          wrap.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (!header.contains(e.target)) {
        header.querySelectorAll(".has-dropdown.open").forEach((w) => {
          w.classList.remove("open");
          const b = w.querySelector(".nav-drop-trigger");
          if (b) b.setAttribute("aria-expanded", "false");
        });
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        header.querySelectorAll(".has-dropdown.open").forEach((w) => {
          w.classList.remove("open");
          const b = w.querySelector(".nav-drop-trigger");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        closeMobile(header);
      }
    });

    // Mobile burger
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (burger && panel) {
      burger.addEventListener("click", () => {
        const open = !panel.hasAttribute("hidden");
        if (open) closeMobile(header);
        else openMobile(header);
      });
      panel.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => closeMobile(header));
      });
    }
  }

  function openMobile(header) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    panel.removeAttribute("hidden");
    header.classList.add("mobile-open");
    if (burger) burger.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-locked");
  }

  function closeMobile(header) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    panel.setAttribute("hidden", "");
    header.classList.remove("mobile-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-locked");
  }

  /** Lightweight canvas — same language as landing, lower density for secondary pages */
  function startCanvas() {
    if (document.body.hasAttribute("data-semeai-custom-bg")) return;
    const canvas = document.getElementById("bg-canvas");
    if (!canvas || canvas.dataset.bound === "1") return;
    canvas.dataset.bound = "1";
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, particles = [], raf = 0;
    let mx = 0.5, my = 0.3, tmx = 0.5, tmy = 0.3;
    const COUNT = 42, LINK = 110;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    function seed() {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.2 + 0.35,
        a: Math.random() * 0.4 + 0.2,
      }));
    }
    function frame() {
      mx += (tmx - mx) * 0.04;
      my += (tmy - my) * 0.04;
      const mpx = mx * w, mpy = my * h;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mpx, dy = p.y - mpy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const pull = (1 - dist / 180) * 0.02;
          p.vx += (-dx / (dist || 1)) * pull;
          p.vy += (-dy / (dist || 1)) * pull;
        }
        p.vx *= 0.996; p.vy *= 0.996;
        ctx.beginPath();
        ctx.fillStyle = `rgba(244, 244, 245, ${p.a * 0.5})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = 0.05 * (1 - Math.sqrt(d2) / LINK);
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener("resize", () => { resize(); seed(); });
    window.addEventListener("pointermove", (e) => {
      tmx = e.clientX / Math.max(w, 1);
      tmy = e.clientY / Math.max(h, 1);
    }, { passive: true });
    resize(); seed();
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector("[data-semeai-nav]");
    const foot = document.querySelector("[data-semeai-footer]");
    let headerEl = null;
    if (nav) {
      nav.outerHTML = navHtml();
      headerEl = document.querySelector("[data-semeai-header]");
      bindNav(headerEl);
    }
    if (foot) foot.outerHTML = footerHtml();
    startCanvas();
  });
})();
