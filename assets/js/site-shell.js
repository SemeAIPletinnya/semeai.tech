(() => {
  const path = (location.pathname || "").toLowerCase();
  const routes = [
    { key: "gate", i18n: "shell.nav.gate", href: "/gate.html" },
    { key: "benchmark", i18n: "shell.nav.benchmark", href: "/benchmark/" },
    { key: "genesis", i18n: "shell.nav.genesis", href: "/genesis/" },
    { key: "book", i18n: "shell.nav.book", href: "/book/" },
    { key: "research", i18n: "shell.nav.research", href: "/research.html" },
  ];

  function t(key, fallback) {
    const api = window.SemeAI_I18n;
    if (!api || typeof api.t !== "function") return fallback;
    const value = api.t(key);
    return value && value !== key ? value : fallback;
  }

  function currentRoute() {
    if (path === "/" || (path.endsWith("/index.html") && !path.includes("/book/") && !path.includes("/genesis/") && !path.includes("/benchmark/"))) return "home";
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
    const label = route.i18n ? t(route.i18n, route.label || route.key) : route.label;
    const link = element("a", { class: className, href: route.href }, label);
    if (route.i18n) link.setAttribute("data-i18n", route.i18n);
    if (currentRoute() === route.key) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    return link;
  }

  function languageSwitch(className = "") {
    const current = window.SemeAI_I18n?.lang || "en";
    const group = element("div", {
      class: `lang-switch ${className}`.trim(),
      role: "group",
      "aria-label": t("shell.lang", "Language"),
    });
    [["en", "EN"], ["uk", "UA"], ["ru", "RU"]].forEach(([value, label]) => {
      const button = element(
        "button",
        {
          type: "button",
          class: `lang-btn${current === value ? " active" : ""}`,
          "data-lang": value,
          "aria-pressed": String(current === value),
        },
        label
      );
      group.append(button);
    });
    return group;
  }

  function buildHeader() {
    const header = element("header", { class: "site-header", "data-semeai-header": "" });
    const inner = element("div", { class: "site-header-inner" });
    const brand = element("a", {
      class: "brand",
      href: "/",
      "aria-label": t("shell.home", "SemeAI home"),
      "data-i18n-aria": "shell.home",
    });
    appendBrandIdentity(brand);
    if (currentRoute() === "home") brand.setAttribute("aria-current", "page");

    const nav = element("nav", {
      class: "site-nav",
      "aria-label": t("shell.nav.primary", "Primary"),
      "data-i18n-aria": "shell.nav.primary",
    });
    routes.forEach((route) => nav.append(routeLink(route, "nav-link")));

    const actions = element("div", { class: "header-actions" });
    const dashboard = routeLink(
      { key: "dashboard", i18n: "shell.nav.dashboard", label: "Open dashboard", href: "/dashboard.html" },
      "btn-ghost header-dashboard"
    );
    const burger = element("button", {
      type: "button",
      class: "nav-burger",
      "aria-label": t("shell.nav.open", "Open navigation"),
      "data-i18n-aria": "shell.nav.open",
      "aria-expanded": "false",
      "aria-controls": "site-mobile-nav",
    });
    burger.append(element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }));
    actions.append(languageSwitch("header-lang"), dashboard, burger);

    const mobile = element("div", { class: "mobile-nav", id: "site-mobile-nav", hidden: "" });
    const mobileInner = element("div", { class: "mobile-nav-inner" });
    const mobileLanguage = element("div", { class: "mobile-lang" });
    mobileLanguage.append(languageSwitch());
    const mobileNav = element("nav", {
      class: "mobile-section",
      "aria-label": t("shell.nav.mobile", "Mobile primary"),
      "data-i18n-aria": "shell.nav.mobile",
    });
    const mobileTitle = element("span", { class: "mobile-section-title", "data-i18n": "shell.nav.navigate" }, t("shell.nav.navigate", "Navigate SemeAI"));
    mobileNav.append(mobileTitle);
    routes.forEach((route) => mobileNav.append(routeLink(route, "mobile-link")));
    mobileNav.append(
      routeLink(
        { key: "dashboard", i18n: "shell.nav.dashboard", label: "Open dashboard", href: "/dashboard.html" },
        "mobile-link mobile-dashboard"
      )
    );
    mobileInner.append(mobileLanguage, mobileNav);
    mobile.append(mobileInner);

    inner.append(brand, nav, actions);
    header.append(inner, mobile);
    return header;
  }

  function footerColumn(titleKey, titleFallback, items) {
    const column = element("div", { class: "footer-col" });
    column.append(element("h4", { "data-i18n": titleKey }, t(titleKey, titleFallback)));
    items.forEach((item) => {
      const link = element("a", { href: item.href }, t(item.i18n, item.label));
      if (item.i18n) link.setAttribute("data-i18n", item.i18n);
      column.append(link);
    });
    return column;
  }

  function buildFooter() {
    const footer = element("footer", { class: "site-footer", "data-semeai-footer-built": "" });
    const grid = element("div", { class: "site-footer-grid" });
    const identity = element("div", { class: "footer-brand-col" });
    const brand = element("a", {
      class: "brand",
      href: "/",
      "aria-label": t("shell.home", "SemeAI home"),
      "data-i18n-aria": "shell.home",
    });
    appendBrandIdentity(brand);
    identity.append(
      brand,
      element("p", { class: "footer-tagline", "data-i18n": "shell.footer.tagline" }, t("shell.footer.tagline", "Generation creates a candidate. Release is a separate decision.")),
      element("p", { class: "footer-copy", "data-i18n": "shell.footer.copy" }, t("shell.footer.copy", "SemeAI · release control after generation"))
    );
    grid.append(
      identity,
      footerColumn("shell.footer.principle", "Principle", [
        { label: "Genesis", i18n: "shell.footer.genesis", href: "/genesis/" },
        { label: "SemeAI Gate", i18n: "shell.footer.gate", href: "/gate.html" },
        { label: "Repository Evidence Benchmark", i18n: "shell.footer.benchmark", href: "/benchmark/" },
      ]),
      footerColumn("shell.footer.method", "Method", [
        { label: "Engineering Book", i18n: "shell.footer.book", href: "/book/" },
        { label: "Research", i18n: "shell.footer.research", href: "/research.html" },
      ]),
      footerColumn("shell.footer.use", "Use", [
        { label: "Open dashboard", i18n: "shell.nav.dashboard", href: "/dashboard.html" },
        { label: "Support", i18n: "shell.footer.support", href: "mailto:support@semeai.tech" },
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
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.isConnected && header.classList.contains("mobile-open")) {
        event.preventDefault();
        closeMobile(header, true);
      }
    });
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth >= 1060 && header.classList.contains("mobile-open")) closeMobile(header);
      },
      { passive: true }
    );
  }

  function openMobile(header) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    panel.removeAttribute("hidden");
    header.classList.add("mobile-open");
    if (burger) {
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", t("shell.nav.close", "Close navigation"));
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
      burger.setAttribute("aria-label", t("shell.nav.open", "Open navigation"));
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
    let w = 0,
      h = 0,
      particles = [],
      raf = 0;
    let mx = 0.5,
      my = 0.3,
      tmx = 0.5,
      tmy = 0.3;
    const COUNT = 42,
      LINK = 110;

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
          const a = particles[i],
            b = particles[j];
          const dx = a.x - b.x,
            dy = a.y - b.y;
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
    window.addEventListener("resize", () => {
      resize();
      seed();
    });
    window.addEventListener(
      "pointermove",
      (event) => {
        tmx = event.clientX / Math.max(w, 1);
        tmy = event.clientY / Math.max(h, 1);
      },
      { passive: true }
    );
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
    return header;
  }

  function remountShell() {
    const oldHeader = document.querySelector("[data-semeai-header]");
    if (oldHeader) {
      const next = buildHeader();
      oldHeader.replaceWith(next);
      bindNav(next);
    }
    const oldFooter = document.querySelector("footer.site-footer[data-semeai-footer-built], footer.site-footer");
    if (oldFooter && (oldFooter.hasAttribute("data-semeai-footer-built") || document.querySelector("[data-semeai-footer]") === null)) {
      // Only remount footers we built (or the single site footer on product pages)
      if (oldFooter.classList.contains("site-footer")) {
        oldFooter.replaceWith(buildFooter());
      }
    }
    window.SemeAI_I18n?.apply?.(document);
  }

  function revealHashTarget() {
    if (!location.hash) return;
    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {}
    const target = document.getElementById(id);
    const disclosure = target?.closest("details");
    if (disclosure) disclosure.open = true;
  }

  function boot() {
    if (window.SemeAI_I18nArch?.merge) window.SemeAI_I18nArch.merge();
    if (window.SemeAI_I18n && !document.documentElement.dataset.i18nBoot) {
      SemeAI_I18n.apply(document);
      document.documentElement.dataset.i18nBoot = "1";
    }
    mountShell();
    // Re-apply after shell injects translated labels
    window.SemeAI_I18n?.apply?.(document);
    revealHashTarget();
    startCanvas();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("hashchange", revealHashTarget);
  window.addEventListener("semeai:lang", () => {
    remountShell();
  });
})();
