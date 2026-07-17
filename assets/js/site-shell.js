(() => {
  const V = "20260717b";
  const path = (location.pathname || "").toLowerCase();
  const current = (path.split("/").pop() || "index.html").split("?")[0];
  const isHome = current === "index.html" || current === "" || current === "/";
  const inPilots = path.includes("/pilots/");
  const base = inPilots ? "../" : "";
  const isPilotSupport = path.includes("pilots/support") || current === "support.html";

  function t(key) {
    return window.SemeAI_I18n ? SemeAI_I18n.t(key) : key;
  }

  function links() {
    return {
      home: `${base}index.html?v=${V}`,
      problem: `${base}index.html?v=${V}#problem`,
      how: `${base}index.html?v=${V}#how`,
      impact: `${base}index.html?v=${V}#impact`,
      demo: isHome ? "#demo" : `${base}index.html?v=${V}#demo`,
      pricing: isHome ? "#pricing" : `${base}index.html?v=${V}#pricing`,
      howLocal: isHome ? "#how" : `${base}index.html?v=${V}#how`,
      problemLocal: isHome ? "#problem" : `${base}index.html?v=${V}#problem`,
      impactLocal: isHome ? "#impact" : `${base}index.html?v=${V}#impact`,
      gate: `${base}gate.html?v=${V}`,
      selfHosted: `${base}self-hosted.html?v=${V}`,
      research: `${base}research.html?v=${V}`,
      thesis: `${base}article.html?v=${V}`,
      register: `${base}register.html?v=${V}`,
      dashboard: `${base}dashboard.html?v=${V}`,
      pilot: inPilots ? `support.html?v=${V}` : `${base}pilots/support.html?v=${V}`,
      console: "https://gate.semeai.tech/demo/saas_visible.html",
      github: "https://github.com/SemeAIPletinnya/semeai-gate-basic",
      sac: "https://github.com/SemeAIPletinnya/silence-as-control",
      ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6613718",
      zenodo: "https://zenodo.org/records/20525820",
      apiHealth: "https://api.semeai.tech/health",
      support: "mailto:support@semeai.tech",
    };
  }

  function extAttrs(external) {
    return external ? ' target="_blank" rel="noopener"' : "";
  }

  function isActiveMatch(match, matchAny) {
    if (matchAny && matchAny.some((m) => m === current || (m === "pilot" && isPilotSupport))) return true;
    if (match === "pilot" && isPilotSupport) return true;
    if (match && match === current) return true;
    return false;
  }

  function dropdownHtml(item) {
    const active = isActiveMatch(item.match, item.matchAny) || item.items.some((c) => isActiveMatch(c.match))
      ? "active"
      : "";
    const items = item.items
      .map((c) => {
        const childActive = isActiveMatch(c.match) ? "active" : "";
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
    const active = isActiveMatch(item.match, item.matchAny) ? "active" : "";
    const cls = item.emphasis ? `nav-link nav-link-em ${active}` : `nav-link ${active}`;
    return `<a class="${cls}" href="${item.href}"${extAttrs(item.external)}>${item.label}</a>`;
  }

  function primaryItems(p) {
    return [
      { type: "link", label: t("nav.demo"), href: p.demo, match: null },
      {
        type: "dropdown",
        label: t("nav.product"),
        id: "nav-product",
        matchAny: ["gate.html", "self-hosted.html", "pilot"],
        items: [
          { label: t("nav.how"), desc: t("nav.how.desc"), href: p.howLocal },
          { label: t("nav.pricing"), desc: t("nav.pricing.desc"), href: p.pricing },
          { label: t("nav.contract"), desc: t("nav.contract.desc"), href: p.gate, match: "gate.html" },
          { label: t("nav.selfhosted"), desc: t("nav.selfhosted.desc"), href: p.selfHosted, match: "self-hosted.html" },
          { label: t("nav.pilot"), desc: t("nav.pilot.desc"), href: p.pilot, match: "pilot" },
          { label: t("nav.live"), desc: t("nav.live.desc"), href: p.console, external: true },
        ],
      },
      {
        type: "dropdown",
        label: t("nav.research"),
        id: "nav-research",
        matchAny: ["research.html", "article.html"],
        items: [
          { label: t("nav.researchHub"), desc: t("nav.researchHub.desc"), href: p.research, match: "research.html" },
          { label: t("nav.thesis"), desc: t("nav.thesis.desc"), href: p.thesis, match: "article.html" },
          { label: t("nav.ssrn"), desc: t("nav.ssrn.desc"), href: p.ssrn, external: true },
          { label: t("nav.zenodo"), desc: t("nav.zenodo.desc"), href: p.zenodo, external: true },
        ],
      },
      {
        type: "link",
        label: t("nav.register"),
        href: p.register,
        match: "register.html",
        emphasis: true,
      },
      {
        type: "link",
        label: t("nav.dashboard"),
        href: p.dashboard,
        match: "dashboard.html",
      },
    ];
  }

  function desktopNavHtml(p) {
    return primaryItems(p)
      .map((item) => (item.type === "dropdown" ? dropdownHtml(item) : linkHtml(item)))
      .join("");
  }

  function langSwitchHtml() {
    const lang = (window.SemeAI_I18n && SemeAI_I18n.lang) || "en";
    return `
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" class="lang-btn ${lang === "en" ? "active" : ""}" data-lang="en" aria-pressed="${lang === "en"}">EN</button>
        <button type="button" class="lang-btn ${lang === "uk" ? "active" : ""}" data-lang="uk" aria-pressed="${lang === "uk"}">UA</button>
        <button type="button" class="lang-btn ${lang === "ru" ? "active" : ""}" data-lang="ru" aria-pressed="${lang === "ru"}">RU</button>
      </div>`;
  }

  function mobileSectionsHtml(p) {
    const sections = [
      {
        title: t("mobile.getStarted"),
        links: [
          { label: t("mobile.demo"), href: p.demo },
          { label: t("mobile.pricing"), href: p.pricing },
          { label: t("mobile.register"), href: p.register },
          { label: t("mobile.dashboard"), href: p.dashboard },
          { label: t("mobile.console"), href: p.console, external: true },
        ],
      },
      {
        title: t("mobile.product"),
        links: [
          { label: t("mobile.how"), href: p.howLocal },
          { label: t("mobile.problem"), href: p.problemLocal },
          { label: t("mobile.impact"), href: p.impactLocal },
          { label: t("mobile.contract"), href: p.gate },
          { label: t("mobile.selfhosted"), href: p.selfHosted },
          { label: t("mobile.pilot"), href: p.pilot },
        ],
      },
      {
        title: t("mobile.research"),
        links: [
          { label: t("mobile.researchHub"), href: p.research },
          { label: t("mobile.thesis"), href: p.thesis },
          { label: t("nav.ssrn"), href: p.ssrn, external: true },
          { label: t("nav.zenodo"), href: p.zenodo, external: true },
          { label: "silence-as-control", href: p.sac, external: true },
        ],
      },
      {
        title: t("mobile.support"),
        links: [
          { label: t("mobile.email"), href: p.support },
          { label: t("nav.github"), href: p.github, external: true },
          { label: t("mobile.api"), href: p.apiHealth, external: true },
        ],
      },
    ];

    return sections
      .map((sec) => {
        const linksHtml = sec.links
          .map((l) => {
            const arrow = l.external ? " ↗" : "";
            return `<a class="mobile-link" href="${l.href}"${extAttrs(l.external)}>${l.label}${arrow}</a>`;
          })
          .join("");
        return `
          <div class="mobile-section">
            <div class="mobile-section-title">${sec.title}</div>
            ${linksHtml}
          </div>`;
      })
      .join("");
  }

  function navHtml() {
    const p = links();
    return `
      <header class="site-header" data-semeai-header>
        <div class="site-header-inner">
          <a class="brand" href="${isHome ? "#top" : p.home}">
            <span class="brand-mark">SG</span>
            <span>SemeAI Gate</span>
          </a>
          <nav class="site-nav" aria-label="Primary">
            ${desktopNavHtml(p)}
          </nav>
          <div class="header-actions">
            ${langSwitchHtml()}
            <a class="header-gh" href="${p.github}" target="_blank" rel="noopener">${t("nav.github")}</a>
            <a class="btn-ghost header-console" href="${p.console}" target="_blank" rel="noopener">${t("nav.console")}</a>
            <a class="btn-primary" href="${p.register}">${t("nav.start")}</a>
            <button type="button" class="nav-burger" aria-label="${t("nav.menu")}" aria-expanded="false" aria-controls="site-mobile-nav">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
        <div class="mobile-nav" id="site-mobile-nav" hidden>
          <div class="mobile-nav-inner">
            <div class="mobile-lang">${langSwitchHtml()}</div>
            ${mobileSectionsHtml(p)}
            <div class="mobile-cta">
              <a class="btn-primary" href="${p.register}">${t("nav.startFree")}</a>
              <a class="btn-ghost" href="${p.demo}">${t("nav.tryFree")}</a>
            </div>
          </div>
        </div>
      </header>`;
  }

  function footerHtml() {
    const p = links();
    return `
      <footer class="site-footer">
        <div class="site-footer-grid">
          <div class="footer-brand-col">
            <div class="brand">
              <span class="brand-mark" style="width:1.75rem;height:1.75rem;font-size:0.6rem">SG</span>
              <span>SemeAI Gate</span>
            </div>
            <p class="footer-tagline">${t("footer.tagline")}</p>
            <p class="footer-copy">${t("footer.copy")}</p>
          </div>
          <div class="footer-col">
            <h4>${t("footer.product")}</h4>
            <a href="${p.demo}">${t("footer.demo")}</a>
            <a href="${p.pricing}">${t("footer.pricing")}</a>
            <a href="${p.gate}">${t("footer.contract")}</a>
            <a href="${p.selfHosted}">${t("footer.selfhosted")}</a>
            <a href="${p.pilot}">${t("footer.pilot")}</a>
            <a href="${p.console}" target="_blank" rel="noopener">${t("footer.console")}</a>
          </div>
          <div class="footer-col">
            <h4>${t("footer.research")}</h4>
            <a href="${p.research}">${t("footer.researchHub")}</a>
            <a href="${p.thesis}">${t("footer.thesis")}</a>
            <a href="${p.ssrn}" target="_blank" rel="noopener">SSRN ↗</a>
            <a href="${p.zenodo}" target="_blank" rel="noopener">Zenodo ↗</a>
            <a href="${p.sac}" target="_blank" rel="noopener">silence-as-control ↗</a>
          </div>
          <div class="footer-col">
            <h4>${t("footer.account")}</h4>
            <a href="${p.register}">${t("footer.register")}</a>
            <a href="${p.dashboard}">${t("footer.dashboard")}</a>
            <a href="${p.support}">${t("footer.support")}</a>
            <a href="${p.github}" target="_blank" rel="noopener">${t("footer.github")}</a>
            <a href="${p.apiHealth}" target="_blank" rel="noopener">${t("footer.api")}</a>
          </div>
        </div>
      </footer>`;
  }

  function bindNav(header) {
    if (!header) return;

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

    document.addEventListener("click", onDocClick);
    function onDocClick(e) {
      if (!header.isConnected) {
        document.removeEventListener("click", onDocClick);
        return;
      }
      if (!header.contains(e.target)) {
        header.querySelectorAll(".has-dropdown.open").forEach((w) => {
          w.classList.remove("open");
          const b = w.querySelector(".nav-drop-trigger");
          if (b) b.setAttribute("aria-expanded", "false");
        });
      }
    }

    document.addEventListener("keydown", onEsc);
    function onEsc(e) {
      if (!header.isConnected) {
        document.removeEventListener("keydown", onEsc);
        return;
      }
      if (e.key === "Escape") {
        header.querySelectorAll(".has-dropdown.open").forEach((w) => {
          w.classList.remove("open");
          const b = w.querySelector(".nav-drop-trigger");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        closeMobile(header);
      }
    }

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

    // Language buttons inside this header
    header.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.SemeAI_I18n) SemeAI_I18n.setLang(btn.getAttribute("data-lang"));
      });
    });
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
      for (const pt of particles) {
        pt.x += pt.vx; pt.y += pt.vy;
        if (pt.x < 0 || pt.x > w) pt.vx *= -1;
        if (pt.y < 0 || pt.y > h) pt.vy *= -1;
        const dx = pt.x - mpx, dy = pt.y - mpy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const pull = (1 - dist / 180) * 0.02;
          pt.vx += (-dx / (dist || 1)) * pull;
          pt.vy += (-dy / (dist || 1)) * pull;
        }
        pt.vx *= 0.996; pt.vy *= 0.996;
        ctx.beginPath();
        ctx.fillStyle = `rgba(244, 244, 245, ${pt.a * 0.5})`;
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
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

  function mountShell() {
    const navSlot = document.querySelector("[data-semeai-nav]");
    const footSlot = document.querySelector("[data-semeai-footer]");
    // If already mounted, replace existing header/footer by slots or by markers
    const existingHeader = document.querySelector("[data-semeai-header]");
    const existingFooter = document.querySelector("footer.site-footer");

    if (navSlot) {
      navSlot.outerHTML = navHtml();
    } else if (existingHeader) {
      existingHeader.outerHTML = navHtml();
    }

    if (footSlot) {
      footSlot.outerHTML = footerHtml();
    } else if (existingFooter) {
      existingFooter.outerHTML = footerHtml();
    }

    const headerEl = document.querySelector("[data-semeai-header]");
    bindNav(headerEl);
  }

  function boot() {
    // Ensure i18n has run
    if (window.SemeAI_I18n && !document.documentElement.dataset.i18nBoot) {
      SemeAI_I18n.apply(document);
      document.documentElement.dataset.i18nBoot = "1";
    }
    mountShell();
    startCanvas();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("semeai:lang", () => {
    mountShell();
    if (window.SemeAI_I18n) SemeAI_I18n.apply(document);
  });
})();
