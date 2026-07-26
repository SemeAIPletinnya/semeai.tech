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
    const canvas = document.getElementById("bg-canvas");
    if (!canvas || canvas.dataset.bound === "1") return;
    canvas.dataset.bound = "1";
    canvas.dataset.motionKind = currentRoute() === "research" ? "provenance" : "authority";
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function line(x1, y1, x2, y2, color, width = 1) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function curve(start, controlA, controlB, end, color, width = 1) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.moveTo(start[0], start[1]);
      ctx.bezierCurveTo(controlA[0], controlA[1], controlB[0], controlB[1], end[0], end[1]);
      ctx.stroke();
    }

    function anchor(x, y, color, radius = 2) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawAuthority(time, isReduced) {
      const phase = isReduced ? 0.72 : (time * 0.000055) % 1;
      const drift = Math.sin(phase * Math.PI * 2) * Math.min(5, w * 0.004);
      const boundaryX = w * 0.62;
      const sourceX = Math.max(42, w * 0.08);
      const receiptX = Math.min(w - 44, w * 0.9);
      const centerY = h * 0.43;

      const glow = ctx.createLinearGradient(boundaryX - 90, 0, boundaryX + 110, 0);
      glow.addColorStop(0, "rgba(217,189,120,0)");
      glow.addColorStop(0.5, "rgba(217,189,120,0.055)");
      glow.addColorStop(1, "rgba(114,231,239,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(boundaryX - 90, 0, 200, h);

      line(boundaryX, h * 0.12, boundaryX, h * 0.86, "rgba(217,189,120,0.16)");
      line(boundaryX + 8, h * 0.19, boundaryX + 8, h * 0.78, "rgba(217,189,120,0.055)");

      const rows = [-0.22, 0, 0.22];
      rows.forEach((row, index) => {
        const startY = centerY + h * row;
        const endY = centerY + h * row * 0.72;
        const stopX = index === 0 ? boundaryX - 18 : index === 1 ? receiptX : boundaryX - 5;
        const hue = index === 1 ? "114,231,239" : index === 2 ? "151,134,171" : "217,189,120";
        ctx.setLineDash(index === 1 ? [14, 26] : [5, 18]);
        ctx.lineDashOffset = isReduced ? -18 : -phase * (index === 1 ? 80 : 44);
        curve(
          [sourceX, startY],
          [w * 0.28, startY + drift * (index - 1)],
          [boundaryX - w * 0.08, endY - drift],
          [stopX, endY],
          `rgba(${hue},${index === 1 ? 0.22 : 0.13})`,
          index === 1 ? 1.2 : 0.85
        );
        anchor(sourceX, startY, `rgba(${hue},0.28)`, 1.6);
        anchor(stopX, endY, `rgba(${hue},${index === 1 ? 0.48 : 0.25})`, index === 1 ? 2.2 : 1.6);
      });
      ctx.setLineDash([]);

      line(receiptX - 8, centerY - 8, receiptX + 8, centerY - 8, "rgba(217,189,120,0.24)");
      line(receiptX + 8, centerY - 8, receiptX + 8, centerY + 8, "rgba(217,189,120,0.24)");
      line(receiptX + 8, centerY + 8, receiptX - 8, centerY + 8, "rgba(217,189,120,0.24)");
      line(receiptX - 8, centerY + 8, receiptX - 8, centerY - 8, "rgba(217,189,120,0.24)");
    }

    function drawProvenance(time, isReduced) {
      const phase = isReduced ? 0.64 : (time * 0.00004) % 1;
      const spineX = w * 0.72;
      const sourceX = Math.max(38, w * 0.09);
      const top = h * 0.18;
      const spacing = h * 0.145;

      line(spineX, h * 0.12, spineX, h * 0.86, "rgba(217,189,120,0.12)");
      for (let index = 0; index < 5; index += 1) {
        const y = top + spacing * index;
        const admittedY = h * (0.24 + index * 0.12);
        const offset = Math.sin(phase * Math.PI * 2 + index * 0.9) * 4;
        ctx.setLineDash([4 + index, 18 + index * 2]);
        ctx.lineDashOffset = isReduced ? -12 : -phase * (38 + index * 7);
        curve(
          [sourceX + index * w * 0.035, y],
          [w * 0.34, y + offset],
          [spineX - w * 0.1, admittedY - offset],
          [spineX, admittedY],
          index % 2 ? "rgba(114,231,239,0.12)" : "rgba(217,189,120,0.14)",
          index === 2 ? 1.15 : 0.8
        );
        anchor(sourceX + index * w * 0.035, y, "rgba(244,239,230,0.2)", 1.5);
        anchor(spineX, admittedY, index % 2 ? "rgba(114,231,239,0.4)" : "rgba(217,189,120,0.38)", 1.9);
      }
      ctx.setLineDash([]);
      line(spineX, h * 0.82, Math.min(w - 36, spineX + w * 0.18), h * 0.82, "rgba(217,189,120,0.1)");
    }

    function draw(time, state = {}) {
      ctx.clearRect(0, 0, w, h);
      if (canvas.dataset.motionKind === "provenance") drawProvenance(time, state.reduced);
      else drawAuthority(time, state.reduced);
    }

    window.addEventListener("resize", () => {
      resize();
      loop?.request();
    }, { passive: true });
    resize();
    let loop = window.SemeAIMotion?.frameLoop(canvas, draw, { fps: 20, threshold: 0 }) || null;
    if (!loop) draw(0, { reduced: true });
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
