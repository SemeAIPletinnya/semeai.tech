(() => {
  const path = (location.pathname || "").toLowerCase();
  const routes = [
    { key: "gate", label: "Gate", href: "/gate.html" },
    { key: "benchmark", label: "Benchmark", href: "/benchmark/" },
    { key: "genesis", label: "Genesis", href: "/genesis/" },
    { key: "book", label: "Book", href: "/book/" },
    { key: "research", label: "Research", href: "/research.html" },
  ];

  function currentRoute() {
    if (path === "/" || path.endsWith("/index.html") && !path.includes("/book/") && !path.includes("/genesis/") && !path.includes("/benchmark/")) return "home";
    if (path.includes("/benchmark/")) return "benchmark";
    if (path.includes("/genesis/")) return "genesis";
    if (path.includes("/book/")) return "book";
    if (path.endsWith("/gate.html")) return "gate";
    if (path.endsWith("/research.html")) return "research";
    if (path.endsWith("/dashboard.html") || path.endsWith("/account.html")) return "dashboard";
    return "";
  }

  function element(name, attributes = {}, textValue = "") {
    const node = document.createElement(name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== false) node.setAttribute(key, String(value));
    });
    if (textValue) node.textContent = textValue;
    return node;
  }

  function appendBrandIdentity(brand) {
    brand.append(
      element("img", {
        class: "brand-mark semeai-mark",
        src: "/assets/brand/semeai-mark.svg",
        alt: "",
        width: "32",
        height: "32",
        "aria-hidden": "true",
      }),
      element("span", { class: "semeai-wordmark" }, "SemeAI")
    );
  }

  function routeLink(route, className) {
    const link = element("a", { class: className, href: route.href }, route.label);
    if (currentRoute() === route.key) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    return link;
  }

  function languageSwitch(className = "") {
    const current = window.SemeAI_I18n?.lang || "en";
    const group = element("div", { class: `lang-switch ${className}`.trim(), role: "group", "aria-label": "Language" });
    [["en", "EN"], ["uk", "UA"], ["ru", "RU"]].forEach(([value, label]) => {
      const button = element("button", { type: "button", class: `lang-btn${current === value ? " active" : ""}`, "data-lang": value, "aria-pressed": String(current === value) }, label);
      group.append(button);
    });
    return group;
  }

  function buildHeader() {
    const header = element("header", { class: "site-header", "data-semeai-header": "" });
    const inner = element("div", { class: "site-header-inner" });
    const brand = element("a", { class: "brand", href: "/", "aria-label": "SemeAI home" });
    appendBrandIdentity(brand);
    if (currentRoute() === "home") brand.setAttribute("aria-current", "page");

    const nav = element("nav", { class: "site-nav", "aria-label": "Primary" });
    routes.forEach((route) => nav.append(routeLink(route, "nav-link")));

    const actions = element("div", { class: "header-actions" });
    const dashboard = routeLink({ key: "dashboard", label: "Open dashboard", href: "/dashboard.html" }, "btn-ghost header-dashboard");
    const burger = element("button", {
      type: "button",
      class: "nav-burger",
      "aria-label": "Open navigation",
      "aria-expanded": "false",
      "aria-controls": "site-mobile-nav",
    });
    burger.append(element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }));
    actions.append(languageSwitch("header-lang"), dashboard, burger);

    const mobile = element("div", { class: "mobile-nav", id: "site-mobile-nav", hidden: "" });
    const mobileInner = element("div", { class: "mobile-nav-inner" });
    const mobileLanguage = element("div", { class: "mobile-lang" });
    mobileLanguage.append(languageSwitch());
    const mobileNav = element("nav", { class: "mobile-section", "aria-label": "Mobile primary" });
    mobileNav.append(element("span", { class: "mobile-section-title" }, "Navigate SemeAI"));
    routes.forEach((route) => mobileNav.append(routeLink(route, "mobile-link")));
    mobileNav.append(routeLink({ key: "dashboard", label: "Open dashboard", href: "/dashboard.html" }, "mobile-link mobile-dashboard"));
    mobileInner.append(mobileLanguage, mobileNav);
    mobile.append(mobileInner);

    inner.append(brand, nav, actions);
    header.append(inner, mobile);
    return header;
  }

  function footerColumn(title, items) {
    const column = element("div", { class: "footer-col" });
    column.append(element("h4", {}, title));
    items.forEach((item) => column.append(element("a", { href: item.href }, item.label)));
    return column;
  }

  function buildFooter() {
    const footer = element("footer", { class: "site-footer" });
    const grid = element("div", { class: "site-footer-grid" });
    const identity = element("div", { class: "footer-brand-col" });
    const brand = element("a", { class: "brand", href: "/", "aria-label": "SemeAI home" });
    appendBrandIdentity(brand);
    identity.append(
      brand,
      element("p", { class: "footer-tagline" }, "Generation creates a candidate. Release is a separate decision."),
      element("p", { class: "footer-copy" }, "SemeAI · release control after generation")
    );
    grid.append(
      identity,
      footerColumn("Principle", [
        { label: "Genesis", href: "/genesis/" },
        { label: "SemeAI Gate", href: "/gate.html" },
        { label: "Repository Evidence Benchmark", href: "/benchmark/" },
      ]),
      footerColumn("Method", [
        { label: "Engineering Book", href: "/book/" },
        { label: "Research", href: "/research.html" },
      ]),
      footerColumn("Use", [
        { label: "Open dashboard", href: "/dashboard.html" },
        { label: "Support", href: "mailto:support@semeai.tech" },
      ])
    );
    footer.append(grid);
    return footer;
  }

  function bindNav(header) {
    if (!header || header.dataset.navigationBound === "true") return;
    header.dataset.navigationBound = "true";
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");

    burger?.addEventListener("click", () => {
      if (panel?.hasAttribute("hidden")) openMobile(header);
      else closeMobile(header);
    });
    panel?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closeMobile(header)));
    header.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        window.SemeAI_I18n?.setLang(button.getAttribute("data-lang"));
        header.querySelectorAll("[data-lang]").forEach((candidate) => {
          const active = candidate.getAttribute("data-lang") === button.getAttribute("data-lang");
          candidate.classList.toggle("active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.isConnected && header.classList.contains("mobile-open")) {
        event.preventDefault();
        closeMobile(header, true);
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1060 && header.classList.contains("mobile-open")) closeMobile(header);
    }, { passive: true });
  }

  function openMobile(header) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    panel.removeAttribute("hidden");
    header.classList.add("mobile-open");
    if (burger) {
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Close navigation");
    }
    document.body.classList.add("nav-locked");
    window.requestAnimationFrame(() => panel.querySelector("a")?.focus());
  }

  function closeMobile(header, restoreFocus = false) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    panel.setAttribute("hidden", "");
    header.classList.remove("mobile-open");
    if (burger) {
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open navigation");
      if (restoreFocus) burger.focus();
    }
    document.body.classList.remove("nav-locked");
  }

  function startCanvas() {
    if (document.body.hasAttribute("data-semeai-custom-bg")) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
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
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.5 + Math.random() * 1.2,
      }));
    }
    function frame() {
      mx += (tmx - mx) * 0.035;
      my += (tmy - my) * 0.035;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx + (mx - 0.5) * 0.02;
        p.y += p.vy + (my - 0.5) * 0.02;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(134,237,245,0.18)";
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(134,237,245,${(1 - d / LINK) * 0.055})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener("resize", () => { resize(); seed(); });
    window.addEventListener("pointermove", (event) => {
      tmx = event.clientX / Math.max(w, 1);
      tmy = event.clientY / Math.max(h, 1);
    }, { passive: true });
    resize();
    seed();
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    });
  }

  function mountShell() {
    const navSlot = document.querySelector("[data-semeai-nav]");
    const footerSlot = document.querySelector("[data-semeai-footer]");
    const existingHeader = document.querySelector("[data-semeai-header]");
    let header = existingHeader;

    if (navSlot) {
      header = buildHeader();
      navSlot.replaceWith(header);
    } else if (!header) {
      header = buildHeader();
      document.querySelector(".content")?.prepend(header);
    }
    if (footerSlot) footerSlot.replaceWith(buildFooter());
    bindNav(header);
  }

  function revealHashTarget() {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch {}
    const target = document.getElementById(id);
    const disclosure = target?.closest("details");
    if (disclosure) disclosure.open = true;
  }

  function boot() {
    if (window.SemeAI_I18n && !document.documentElement.dataset.i18nBoot) {
      SemeAI_I18n.apply(document);
      document.documentElement.dataset.i18nBoot = "1";
    }
    mountShell();
    revealHashTarget();
    startCanvas();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("hashchange", revealHashTarget);
})();
