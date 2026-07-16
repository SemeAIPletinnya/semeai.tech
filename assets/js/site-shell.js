(() => {
  const V = "20260716t";
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase().split("?")[0];

  const links = [
    { href: `index.html?v=${V}`, label: "Home", match: "index.html" },
    { href: `index.html?v=${V}#demo`, label: "Demo", match: null },
    { href: `gate.html?v=${V}`, label: "Contract", match: "gate.html" },
    { href: `self-hosted.html?v=${V}`, label: "Self-hosted", match: "self-hosted.html" },
    { href: `research.html?v=${V}`, label: "Research", match: "research.html" },
    { href: `article.html?v=${V}`, label: "Thesis", match: "article.html" },
    { href: `register.html?v=20260716r`, label: "Register", match: "register.html" },
    { href: `dashboard.html?v=20260716s`, label: "Dashboard", match: "dashboard.html" },
  ];

  function navHtml() {
    return `
      <header class="site-header">
        <div class="site-header-inner">
          <a class="brand" href="index.html?v=${V}">
            <span class="brand-mark">SG</span>
            <span>SemeAI Gate</span>
          </a>
          <nav class="site-nav" aria-label="Primary">
            ${links
              .map((l) => {
                const active = l.match && l.match === current ? "active" : "";
                return `<a class="nav-link ${active}" href="${l.href}">${l.label}</a>`;
              })
              .join("")}
          </nav>
          <div class="header-actions">
            <a class="header-gh" href="https://github.com/SemeAIPletinnya/semeai-gate-basic" target="_blank" rel="noopener">GitHub</a>
            <a class="btn-primary" href="register.html?v=20260716r">Start pilot</a>
          </div>
        </div>
      </header>`;
  }

  function footerHtml() {
    return `
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div class="brand">
            <span class="brand-mark" style="width:1.75rem;height:1.75rem;font-size:0.6rem">SG</span>
            <span>SemeAI Gate</span>
          </div>
          <div class="footer-links">
            <a href="index.html?v=${V}">Home</a>
            <a href="register.html?v=20260716r">Register</a>
            <a href="dashboard.html?v=20260716s">Dashboard</a>
            <a href="https://gate.semeai.tech/demo/saas_visible.html" target="_blank" rel="noopener">Console</a>
            <a href="mailto:support@semeai.tech">Support</a>
          </div>
          <p class="footer-copy">© SemeAI · Generation is not release authority</p>
        </div>
      </footer>`;
  }

  /** Lightweight canvas — same language as landing, lower density for secondary pages */
  function startCanvas() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
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
    if (nav) nav.outerHTML = navHtml();
    if (foot) foot.outerHTML = footerHtml();
    startCanvas();
  });
})();
