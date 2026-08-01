(() => {
  const path = (location.pathname || "").toLowerCase();
  const routes = [
    { key: "product", i18n: "shell.nav.product", label: "Product", href: "/#product" },
    { key: "how", i18n: "shell.nav.how", label: "How it works", href: "/#how-it-works" },
    { key: "use-cases", i18n: "shell.nav.useCases", label: "Use cases", href: "/#use-cases" },
    { key: "evidence-anchor", i18n: "shell.nav.evidence", label: "Evidence", href: "/#evidence" },
  ];
  const publicRouteContexts = [
    {
      key: "home",
      href: "/",
      number: "01",
      title: "Home",
      titleI18n: "shell.route.home",
      role: "System",
      roleI18n: "shell.route.home.role",
      summary: "Release-control overview",
      summaryI18n: "shell.route.home.summary",
    },
    {
      key: "gate",
      href: "/gate.html",
      number: "02",
      title: "Gate",
      titleI18n: "shell.nav.gate",
      role: "Authority",
      roleI18n: "shell.route.gate.role",
      summary: "Release-decision contract",
      summaryI18n: "shell.route.gate.summary",
    },
    {
      key: "benchmark",
      href: "/benchmark/",
      number: "03",
      title: "Benchmark",
      titleI18n: "shell.nav.benchmark",
      role: "Instrument",
      roleI18n: "shell.route.benchmark.role",
      summary: "Visible repository evidence",
      summaryI18n: "shell.route.benchmark.summary",
    },
    {
      key: "genesis",
      href: "/genesis/",
      number: "04",
      title: "Genesis",
      titleI18n: "shell.nav.genesis",
      role: "Trace",
      roleI18n: "shell.route.genesis.role",
      summary: "Admitted historical chronology",
      summaryI18n: "shell.route.genesis.summary",
    },
    {
      key: "book",
      href: "/book/",
      number: "05",
      title: "Book",
      titleI18n: "shell.nav.book",
      role: "Method",
      roleI18n: "shell.route.book.role",
      summary: "Engineering rationale",
      summaryI18n: "shell.route.book.summary",
    },
    {
      key: "research",
      href: "/research.html",
      number: "06",
      title: "Research",
      titleI18n: "shell.nav.research",
      role: "Boundary",
      roleI18n: "shell.route.research.role",
      summary: "Public evidence and claim limits",
      summaryI18n: "shell.route.research.summary",
    },
  ];
  let shellNavigationController = null;

  function t(key, fallback) {
    const api = window.SemeAI_I18n;
    if (!api || typeof api.t !== "function") return fallback;
    const value = api.t(key);
    return value && value !== key ? value : fallback;
  }

  function currentRoute() {
    if (path === "/workspace/" || path.endsWith("/workspace/index.html")) return "workspace";
    if (path === "/account/" || path.endsWith("/account/index.html") || path.endsWith("/account.html")) return "account";
    if (path.includes("/skills/")) return "skills";
    if (path.includes("/roadmap/")) return "roadmap";
    if (path === "/" || (path.endsWith("/index.html") && !path.includes("/book/") && !path.includes("/genesis/") && !path.includes("/benchmark/"))) return "home";
    if (path.includes("/benchmark/")) return "benchmark";
    if (path.includes("/genesis/")) return "genesis";
    if (path.includes("/book/")) return "book";
    if (path.endsWith("/gate.html")) return "gate";
    if (path.endsWith("/research.html")) return "research";
    if (path.endsWith("/dashboard.html")) return "dashboard";
    return "";
  }

  function privateEntryRoute() {
    let token = "";
    try {
      token =
        window.SemeAI?.getStoredToken?.() ||
        sessionStorage.getItem("semeai_session_token") ||
        sessionStorage.getItem("semeai_dashboard_api_key") ||
        localStorage.getItem("semeai_session_token") ||
        "";
    } catch {}
    return token.trim()
      ? { key: "workspace", i18n: "shell.nav.workspace", label: "Pilot workspace", href: "/workspace/" }
      : { key: "account", i18n: "shell.nav.pilotSignIn", label: "Pilot sign in", href: "/account/" };
  }

  function systemMapGroups() {
    const publicRoute = (key, i18n, label, href) => {
      const context = routeContext(key);
      return {
        key,
        i18n,
        label,
        href,
        role: context?.role || "",
        roleI18n: context?.roleI18n || "",
        summary: context?.summary || "",
        summaryI18n: context?.summaryI18n || "",
      };
    };
    const privateRoute = {
      ...privateEntryRoute(),
      role: "Product",
      roleI18n: "shell.system.workspace.role",
      summary: "Governed account context",
      summaryI18n: "shell.system.workspace.summary",
    };

    return [
      {
        key: "public",
        label: "Public",
        i18n: "shell.system.public",
        routes: [
          publicRoute("home", "shell.route.home", "Home", "/"),
          publicRoute("gate", "shell.nav.gate", "Gate", "/gate.html"),
          publicRoute("book", "shell.nav.book", "Book", "/book/"),
          {
            key: "roadmap",
            i18n: "shell.footer.roadmap",
            label: "Product Roadmap",
            href: "/roadmap/",
            role: "Plan",
            roleI18n: "shell.system.roadmap.role",
            summary: "Working, held, and future phases",
            summaryI18n: "shell.system.roadmap.summary",
          },
        ],
      },
      {
        key: "evidence",
        label: "Evidence",
        i18n: "shell.system.evidence",
        routes: [
          publicRoute("benchmark", "shell.nav.benchmark", "Benchmark", "/benchmark/"),
          publicRoute("genesis", "shell.nav.genesis", "Genesis", "/genesis/"),
          publicRoute("research", "shell.nav.research", "Research", "/research.html"),
        ],
      },
      {
        key: "method",
        label: "Method",
        i18n: "shell.system.method",
        routes: [
          {
            key: "skills",
            i18n: "shell.footer.skills",
            label: "Skill Forge",
            href: "/skills/",
            role: "Evaluation",
            roleI18n: "shell.system.skills.role",
            summary: "Candidate evidence and admission boundary",
            summaryI18n: "shell.system.skills.summary",
          },
        ],
      },
      {
        key: "product",
        label: "Product",
        i18n: "shell.system.product",
        routes: [
          privateRoute,
          {
            key: "dashboard",
            i18n: "shell.system.dashboard.label",
            label: "Operator dashboard",
            href: "/dashboard.html",
            role: "Operation",
            roleI18n: "shell.system.dashboard.role",
            summary: "Gate operator console",
            summaryI18n: "shell.system.dashboard.summary",
          },
        ],
      },
    ];
  }

  function resourceGroups() {
    return [
      {
        key: "proof",
        label: "Proof",
        i18n: "shell.resources.proof",
        routes: [
          { key: "gate", i18n: "shell.nav.gate", label: "Live Gate", href: "/gate.html", role: "Public proof", summary: "SHOW / REVIEW / BLOCK and receipts" },
          { key: "benchmark", i18n: "shell.nav.benchmark", label: "Benchmark", href: "/benchmark/", role: "Public proof", summary: "Bounded repository evidence" },
          { key: "research", i18n: "shell.nav.research", label: "Research", href: "/research.html", role: "Boundaries", summary: "Evidence and claim limits" },
        ],
      },
      {
        key: "method",
        label: "Method and history",
        i18n: "shell.resources.method",
        routes: [
          { key: "genesis", i18n: "shell.nav.genesis", label: "Genesis", href: "/genesis/", role: "History", summary: "Admitted chronology" },
          { key: "book", i18n: "shell.nav.book", label: "Engineering Book", href: "/book/", role: "Method", summary: "Architecture and rationale" },
          { key: "roadmap", i18n: "shell.footer.roadmap", label: "Product Roadmap", href: "/roadmap/", role: "Plan", summary: "Working, held, and future" },
          { key: "github", label: "GitHub", href: "https://github.com/SemeAIPletinnya", role: "Implementation", summary: "Public repositories" },
        ],
      },
      {
        key: "access",
        label: "Approved access",
        i18n: "shell.resources.access",
        routes: [
          { ...privateEntryRoute(), role: "Private beta", summary: "Approved-pilot access only" },
        ],
      },
    ];
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

  function routeContext(routeKey) {
    return publicRouteContexts.find((route) => route.key === routeKey) || null;
  }

  function applyCurrentRoute(link, routeKey) {
    if (currentRoute() !== routeKey) return;
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  function mobileRouteLink(route) {
    const context =
      routeContext(route.key) ||
      (route.roleI18n && route.summaryI18n ? route : null);
    if (!context) return routeLink(route, "mobile-link");

    const link = element("a", {
      class: "mobile-link mobile-link--described",
      href: route.href,
    });
    const label = element(
      "strong",
      { "data-i18n": route.i18n },
      t(route.i18n, route.label || route.key),
    );
    const descriptor = element("small", { class: "mobile-link__descriptor" });
    descriptor.append(
      element(
        "span",
        { "data-i18n": context.roleI18n },
        t(context.roleI18n, context.role),
      ),
      document.createTextNode(" · "),
      element(
        "span",
        { "data-i18n": context.summaryI18n },
        t(context.summaryI18n, context.summary),
      ),
    );
    link.append(label, descriptor);
    applyCurrentRoute(link, route.key);
    return link;
  }

  function systemMapLink(route) {
    const link = element("a", {
      class: "system-map-link",
      href: route.href,
      "data-system-route": route.key,
    });
    const heading = element("span", { class: "system-map-link__heading" });
    const label = element(
      "strong",
      route.i18n ? { "data-i18n": route.i18n } : {},
      t(route.i18n, route.label),
    );
    const role = element(
      "small",
      route.roleI18n ? { "data-i18n": route.roleI18n } : {},
      t(route.roleI18n, route.role),
    );
    heading.append(label, role);
    const summary = element(
      "span",
      route.summaryI18n ? { "data-i18n": route.summaryI18n } : {},
      t(route.summaryI18n, route.summary),
    );
    link.append(heading, summary);
    applyCurrentRoute(link, route.key);
    return link;
  }

  function buildSystemMap() {
    const item = element("div", { class: "nav-item system-map" });
    const trigger = element("button", {
      type: "button",
      class: "nav-link system-map-trigger",
      "aria-expanded": "false",
      "aria-controls": "site-system-map",
      "aria-label": t("shell.resources.aria", "Open SemeAI resources"),
      "data-i18n-aria": "shell.resources.aria",
    });
    trigger.append(
      element(
        "span",
        { "data-i18n": "shell.nav.resources" },
        t("shell.nav.resources", "Resources"),
      ),
      element("span", { class: "nav-chevron", "aria-hidden": "true" }, "⌄"),
    );

    const panel = element("div", {
      class: "system-map-panel",
      id: "site-system-map",
      role: "group",
      hidden: "",
      "aria-label": t("shell.resources.aria", "SemeAI resources"),
      "data-i18n-aria": "shell.resources.aria",
    });
    resourceGroups().forEach((group) => {
      const titleId = `system-map-${group.key}-title`;
      const section = element("div", {
        class: `system-map-group system-map-group--${group.key}`,
        role: "group",
        "aria-labelledby": titleId,
      });
      section.append(
        element(
          "p",
          { id: titleId, class: "system-map-group__title", "data-i18n": group.i18n },
          t(group.i18n, group.label),
        ),
      );
      group.routes.forEach((route) => section.append(systemMapLink(route)));
      panel.append(section);
    });
    item.append(trigger, panel);
    return item;
  }

  function buildRouteContext() {
    return null;
    /* Legacy public-route counter retained below for backwards source compatibility.
       Commercial navigation intentionally does not render it. */
    const route = routeContext(currentRoute());
    if (!route) return null;
    const routeIndex = publicRouteContexts.indexOf(route);
    const next = publicRouteContexts[(routeIndex + 1) % publicRouteContexts.length];
    const context = element("nav", {
      class: "site-route-context",
      "aria-label": t("shell.route.aria", "Public route context"),
      "data-i18n-aria": "shell.route.aria",
    });
    const inner = element("div", { class: "site-route-context__inner" });
    const current = element("div", { class: "site-route-context__current" });
    current.append(
      element(
        "span",
        { class: "site-route-context__position", "aria-hidden": "true" },
        `${route.number} / ${String(publicRouteContexts.length).padStart(2, "0")}`,
      ),
      element(
        "strong",
        { class: "site-route-context__role", "data-i18n": route.roleI18n },
        t(route.roleI18n, route.role),
      ),
      element(
        "span",
        { class: "site-route-context__summary", "data-i18n": route.summaryI18n },
        t(route.summaryI18n, route.summary),
      ),
    );

    const nextLink = element("a", {
      class: "site-route-context__next",
      href: next.href,
    });
    nextLink.append(
      element(
        "small",
        { "data-i18n": "shell.route.next" },
        t("shell.route.next", "Next lens"),
      ),
      element(
        "strong",
        { "data-i18n": next.titleI18n },
        t(next.titleI18n, next.title),
      ),
      element("span", { "aria-hidden": "true" }, "→"),
    );
    inner.append(current, nextLink);
    context.append(inner);
    return context;
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
    nav.append(buildSystemMap());

    const actions = element("div", { class: "header-actions" });
    const pilot = routeLink({ key: "pilot", i18n: "shell.nav.pilot", label: "Request a pilot", href: "/#pilot" }, "btn-primary header-pilot");
    const burger = element("button", {
      type: "button",
      class: "nav-burger",
      "aria-label": t("shell.nav.open", "Open navigation"),
      "data-i18n-aria": "shell.nav.open",
      "aria-expanded": "false",
      "aria-controls": "site-mobile-nav",
    });
    burger.append(element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }), element("span", { "aria-hidden": "true" }));
    actions.append(languageSwitch("header-lang"), pilot, burger);

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
    routes.forEach((route) => mobileNav.append(mobileRouteLink(route)));
    mobileNav.append(mobileRouteLink({ key: "pilot", i18n: "shell.nav.pilot", label: "Request a pilot", href: "/#pilot" }));

    const mobileSystem = element("nav", {
      class: "mobile-section mobile-section--system",
      "aria-label": t("shell.resources.aria", "SemeAI resources"),
      "data-i18n-aria": "shell.resources.aria",
    });
    mobileSystem.append(
      element(
        "span",
        {
          class: "mobile-section-title",
          "data-i18n": "shell.nav.resources",
        },
        t("shell.nav.resources", "Resources"),
      ),
    );
    resourceGroups()
      .flatMap((group) => group.routes)
      .forEach((route) => {
        const link = mobileRouteLink(route);
        link.classList.add("mobile-system-link");
        mobileSystem.append(link);
      });
    mobileInner.append(mobileLanguage, mobileNav, mobileSystem);
    mobile.append(mobileInner);

    inner.append(brand, nav, actions);
    header.append(inner);
    const routeContext = buildRouteContext();
    if (routeContext) header.append(routeContext);
    header.append(mobile);
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
      footerColumn("shell.footer.productColumn", "Product", [
        { label: "SemeAI Gate", i18n: "shell.footer.gate", href: "/gate.html" },
        { label: "Live Gate", i18n: "shell.footer.gateDemo", href: "https://gate.semeai.tech/" },
        { label: "Gate Pilot", i18n: "shell.footer.pilot", href: "/#pilot" },
        { label: "Integration contract", i18n: "shell.footer.contract", href: "/gate.html#contract" },
      ]),
      footerColumn("shell.footer.evidenceColumn", "Evidence", [
        { label: "Decision receipts", i18n: "shell.footer.receipts", href: "/gate.html#receipt" },
        { label: "Public repository", i18n: "shell.footer.repository", href: "https://github.com/SemeAIPletinnya/semeai-gate-basic" },
        { label: "Repository Evidence Benchmark", i18n: "shell.footer.benchmark", href: "/benchmark/" },
        { label: "Research", i18n: "shell.footer.research", href: "/research.html" },
      ]),
      footerColumn("shell.footer.resourcesColumn", "Resources", [
        { label: "Genesis", i18n: "shell.footer.genesis", href: "/genesis/" },
        { label: "Engineering Book", i18n: "shell.footer.book", href: "/book/" },
        { label: "Skill Forge", i18n: "shell.footer.skills", href: "/skills/" },
        { label: "Product Roadmap", i18n: "shell.footer.roadmap", href: "/roadmap/" },
      ]),
      footerColumn("shell.footer.accessColumn", "Access", [
        { label: "Request a pilot", i18n: "shell.nav.pilot", href: "/#pilot" },
        privateEntryRoute(),
        { label: "Support", i18n: "shell.footer.support", href: "mailto:support@semeai.tech" },
      ])
    );
    grid.append(element("p", { class: "footer-boundary", "data-i18n": "shell.footer.boundary" }, t("shell.footer.boundary", "SemeAI Gate controls release after generation. It does not replace the model or provide universal truth, safety, or compliance approval.")));

    const bridge = element("div", {
      class: "site-ecosystem-bridge",
      "data-semeai-ecosystem-bridge": "",
      role: "navigation",
      "aria-label": t("shell.footer.ecosystem", "Ecosystem surfaces"),
    });
    const bridgeLabel = element(
      "span",
      { class: "site-ecosystem-bridge__label", "data-i18n": "shell.footer.ecosystem" },
      t("shell.footer.ecosystem", "Ecosystem"),
    );
    const bridgeLinks = element("div", { class: "site-ecosystem-bridge__links" });
    [
      { href: "https://semeai.tech/", label: "semeai.tech", current: true },
      { href: "https://www.semeai.tech/", label: "www" },
      { href: "https://gate.semeai.tech/", label: "gate.semeai.tech" },
      { href: "https://api.semeai.tech/", label: "api.semeai.tech" },
    ].forEach((item) => {
      const link = element("a", { href: item.href, rel: "noopener" }, item.label);
      if (item.current) link.setAttribute("aria-current", "true");
      if (item.href.startsWith("http") && !item.href.includes(location.host)) {
        link.setAttribute("target", "_blank");
      }
      bridgeLinks.append(link);
    });
    bridge.append(bridgeLabel, bridgeLinks);
    footer.append(grid, bridge);
    return footer;
  }

  function bindNav(header) {
    if (!header || header.dataset.navigationBound === "true") return;
    shellNavigationController?.abort();
    const controller = new AbortController();
    shellNavigationController = controller;
    const { signal } = controller;
    header.dataset.navigationBound = "true";
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    const systemMap = header.querySelector(".system-map");
    const systemTrigger = header.querySelector(".system-map-trigger");
    const systemPanel = header.querySelector(".system-map-panel");

    burger?.addEventListener("click", () => {
      if (panel?.hasAttribute("hidden")) openMobile(header);
      else closeMobile(header);
    }, { signal });
    panel?.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => closeMobile(header), { signal }),
    );
    header.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        window.SemeAI_I18n?.setLang(button.getAttribute("data-lang"));
      }, { signal });
    });

    systemTrigger?.addEventListener("click", () => {
      setSystemMap(header, systemPanel?.hasAttribute("hidden") === true);
    }, { signal });
    systemTrigger?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      setSystemMap(header, true);
      systemPanel?.querySelector("a")?.focus();
    }, { signal });
    systemPanel?.querySelectorAll("a").forEach((link) =>
      link.addEventListener("click", () => setSystemMap(header, false), { signal }),
    );
    systemMap?.addEventListener("focusout", () => {
      window.requestAnimationFrame(() => {
        if (systemMap.isConnected && !systemMap.contains(document.activeElement)) {
          setSystemMap(header, false);
        }
      });
    }, { signal });
    document.addEventListener("pointerdown", (event) => {
      if (systemMap?.classList.contains("open") && !systemMap.contains(event.target)) {
        setSystemMap(header, false);
      }
    }, { signal });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !header.isConnected) return;
      if (systemMap?.classList.contains("open")) {
        event.preventDefault();
        setSystemMap(header, false, true);
      } else if (header.classList.contains("mobile-open")) {
        event.preventDefault();
        closeMobile(header, true);
      }
    }, { signal });
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth >= 1060 && header.classList.contains("mobile-open")) closeMobile(header);
        if (window.innerWidth < 1060 && systemMap?.classList.contains("open")) setSystemMap(header, false);
      },
      { passive: true, signal }
    );
  }

  function setSystemMap(header, open, restoreFocus = false) {
    const item = header?.querySelector(".system-map");
    const trigger = header?.querySelector(".system-map-trigger");
    const panel = header?.querySelector(".system-map-panel");
    if (!item || !trigger || !panel) return;
    item.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    if (!open && restoreFocus) trigger.focus();
  }

  function openMobile(header) {
    const burger = header.querySelector(".nav-burger");
    const panel = header.querySelector(".mobile-nav");
    if (!panel) return;
    setSystemMap(header, false);
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
