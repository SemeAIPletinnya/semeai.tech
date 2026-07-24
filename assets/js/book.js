(() => {
  const base = window.SEMEAI_ENGINEERING_BOOK;
  const main = document.getElementById("book-main");
  const nav = document.getElementById("book-nav-list");
  const progress = document.getElementById("book-progress-bar");
  const progressRoot = document.getElementById("book-progress");
  const menuButton = document.getElementById("book-menu-button");
  const printButton = document.getElementById("book-print-button");
  const startOrientation = document.getElementById("book-start");
  const collapseButton = document.getElementById("book-collapse-button");
  const railExpand = document.getElementById("book-rail-expand");
  const navRail = document.getElementById("book-nav-rail");
  const railChapter = document.getElementById("book-rail-chapter");
  const railProgress = document.getElementById("book-rail-progress");
  const navAside = document.getElementById("book-nav");
  const SIDEBAR_KEY = "semeai.book.sidebar.collapsed";

  if (!base || !main || !nav) return;

  function deepMergeChapter(enChapter, overlay) {
    if (!overlay) return { ...enChapter };
    const merged = { ...enChapter, ...overlay };
    ["body", "steps", "nodes", "bullets", "layers", "cycle", "stages", "items", "claims", "focus", "meta", "title"].forEach((key) => {
      if (overlay[key] !== undefined) merged[key] = overlay[key];
    });
    if (overlay.decisions) merged.decisions = overlay.decisions;
    if (overlay.principles) merged.principles = overlay.principles;
    if (overlay.links) merged.links = overlay.links;
    return merged;
  }

  function localizedData() {
    const lang = window.SemeAI_I18n?.lang || "en";
    const pack = window.SEMEAI_BOOK_LOCALES?.[lang];
    if (!pack || lang === "en") return base;
    const chapters = (base.chapters || []).map((chapter) => deepMergeChapter(chapter, pack.chapters?.[chapter.id]));
    const metrics = (base.metrics || []).map((metric, index) => ({
      ...metric,
      ...(pack.metrics?.[index] || {}),
    }));
    return {
      ...base,
      meta: { ...base.meta, ...(pack.meta || {}) },
      metrics,
      chapters,
      _context: pack.context || null,
    };
  }

  let data = localizedData();
  let pageObserver = null;
  let activeChapterId = data.chapters?.[0]?.id || "cover";
  let coverRaf = 0;
  let coverVisible = true;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const external = (href) => /^https?:\/\//i.test(href);
  const linkAttrs = (href) => (external(href) ? ' target="_blank" rel="noopener"' : "");
  const paragraphs = (items = []) => items.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  const titleLines = (title) => {
    if (Array.isArray(title)) return title.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
    return escapeHtml(title);
  };
  const sentenceLines = (text) =>
    escapeHtml(text)
      .split(". ")
      .map((line, index, lines) => {
        const suffix = index < lines.length - 1 && !line.endsWith(".") ? "." : "";
        return `<span>${line}${suffix}</span>`;
      })
      .join("");

  const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const chapterHead = (chapter) => `
    <div class="book-chapter-meta">
      <span>${escapeHtml(chapter.number)}</span>
      ${chapter.kicker ? `<span>${escapeHtml(chapter.kicker)}</span>` : ""}
    </div>`;

  function chapterNavFooter(chapter, index) {
    const chapters = data.chapters || [];
    const prev = chapters[index - 1];
    const next = chapters[index + 1];
    if (!prev && !next) return "";
    return `
      <nav class="book-chapter-turn" aria-label="Chapter navigation">
        ${
          prev
            ? `<a class="book-turn book-turn--prev" href="#${escapeHtml(prev.id)}">
                <small>Previous</small>
                <strong><span>${escapeHtml(prev.number)}</span> ${escapeHtml(prev.nav)}</strong>
              </a>`
            : `<span class="book-turn book-turn--empty"></span>`
        }
        ${
          next
            ? `<a class="book-turn book-turn--next" href="#${escapeHtml(next.id)}">
                <small>Next</small>
                <strong><span>${escapeHtml(next.number)}</span> ${escapeHtml(next.nav)}</strong>
              </a>`
            : `<span class="book-turn book-turn--empty"></span>`
        }
      </nav>`;
  }

  function renderCoverVisual() {
    // Static SVG structure; motion is applied by CSS / rAF controller.
    return `
      <div class="book-field" aria-hidden="true">
        <svg class="book-field-svg" viewBox="0 0 640 640" role="presentation" focusable="false">
          <defs>
            <radialGradient id="bookFieldCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#72e7ef" stop-opacity="0.28"/>
              <stop offset="45%" stop-color="#72e7ef" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="#72e7ef" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <circle class="book-field-glow" cx="320" cy="320" r="210" fill="url(#bookFieldCore)"/>
          <g class="book-field-rings">
            <circle cx="320" cy="320" r="78" fill="none" stroke="rgba(114,231,239,0.22)" stroke-width="1"/>
            <circle cx="320" cy="320" r="128" fill="none" stroke="rgba(114,231,239,0.14)" stroke-width="1"/>
            <circle cx="320" cy="320" r="176" fill="none" stroke="rgba(217,189,120,0.1)" stroke-width="1"/>
            <circle cx="320" cy="320" r="214" fill="none" stroke="rgba(114,231,239,0.1)" stroke-width="1"/>
          </g>
          <g class="book-field-grid" opacity="0.18">
            ${Array.from({ length: 9 }, (_, i) => {
              const p = 80 + i * 60;
              return `<line x1="${p}" y1="70" x2="${p}" y2="570" stroke="rgba(114,231,239,0.35)" stroke-width="0.5"/>
                <line x1="70" y1="${p}" x2="570" y2="${p}" stroke="rgba(114,231,239,0.28)" stroke-width="0.5"/>`;
            }).join("")}
          </g>
          <g class="book-field-paths">
            ${Array.from({ length: 18 }, (_, i) => {
              const angle = (i / 18) * Math.PI * 2;
              const released = i % 5 !== 2 && i % 7 !== 3;
              const outer = released ? 210 : 150 + (i % 3) * 12;
              const x2 = 320 + Math.cos(angle) * outer;
              const y2 = 320 + Math.sin(angle) * outer;
              const mid = 320 + Math.cos(angle) * (outer * 0.55);
              const midY = 320 + Math.sin(angle) * (outer * 0.55);
              return `<path class="book-field-path ${released ? "is-released" : "is-held"}" data-i="${i}"
                d="M 320 320 Q ${mid.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"
                fill="none" stroke="${released ? "rgba(114,231,239,0.42)" : "rgba(114,231,239,0.16)"}"
                stroke-width="${released ? 1.15 : 0.8}" />`;
            }).join("")}
          </g>
          <g class="book-field-points">
            ${Array.from({ length: 10 }, (_, i) => {
              const angle = (i / 10) * Math.PI * 2 + 0.2;
              const r = 96 + (i % 4) * 28;
              const x = 320 + Math.cos(angle) * r;
              const y = 320 + Math.sin(angle) * r;
              return `<circle class="book-field-point" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2"
                fill="${i % 3 === 0 ? "#d9bd78" : "#72e7ef"}" opacity="0.85"/>`;
            }).join("")}
          </g>
          <circle class="book-field-core" cx="320" cy="320" r="7" fill="#b4f7fa" opacity="0.95"/>
          <circle class="book-field-core-ring" cx="320" cy="320" r="16" fill="none" stroke="rgba(180,247,250,0.45)" stroke-width="1"/>
        </svg>
      </div>`;
  }

  function renderCover(chapter, index) {
    return `
      <section class="book-page book-page--cover" id="${chapter.id}" data-chapter="${chapter.number}">
        ${renderCoverVisual()}
        <div class="book-cover-copy">
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h1>${titleLines(chapter.title)}</h1>
          <p class="book-cover-subtitle">${sentenceLines(chapter.subtitle)}</p>
        </div>
        <div class="book-cover-footer">
          <div class="book-cover-author">
            ${(chapter.meta || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          <span class="book-cover-number" aria-hidden="true">${escapeHtml(chapter.number)}</span>
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderStatement(chapter, index) {
    return `
      <section class="book-page book-page--statement ${chapter.emphasis ? "book-page--emphasis" : ""}" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <h2>${titleLines(chapter.title)}</h2>
          ${chapter.metadata ? `<p class="book-inline-meta">${escapeHtml(chapter.metadata)}</p>` : ""}
          ${chapter.note ? `<p class="book-statement-note">${escapeHtml(chapter.note)}</p>` : ""}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderEditorial(chapter, index) {
    return `
      <section class="book-page book-page--editorial" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-editorial-copy">
          <h2>${escapeHtml(chapter.title)}</h2>
          ${paragraphs(chapter.body)}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderAuthor(chapter, index) {
    return `
      <section class="book-page book-page--author" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-author-grid">
          <div>
            <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
            <h2>${escapeHtml(chapter.title)}</h2>
            <p class="book-lead">${escapeHtml(chapter.subtitle)}</p>
          </div>
          <div class="book-author-card" aria-label="Portrait placeholder">
            <div class="book-portrait-placeholder">
              <span>AS</span>
              <small>Portrait area reserved</small>
            </div>
          </div>
          <div class="book-author-body">${paragraphs(chapter.body)}</div>
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderFlow(chapter, index) {
    return `
      <section class="book-page book-page--diagram" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-diagram-grid">
          <div>
            <h2>${escapeHtml(chapter.title)}</h2>
            <p class="book-note">${escapeHtml(chapter.note)}</p>
          </div>
          <div class="release-flow" aria-label="Release control flow">
            ${(chapter.steps || [])
              .map(
                (step, stepIndex) => `
                  <div class="release-flow-step">
                    <span>${String(stepIndex + 1).padStart(2, "0")}</span>
                    <strong>${escapeHtml(step)}</strong>
                  </div>`
              )
              .join("")}
          </div>
        </div>
        <div class="decision-row">
          ${(chapter.decisions || [])
            .map(
              (item) => `
                <article class="decision-tile">
                  <strong>${escapeHtml(item.public)}</strong>
                  <span>${escapeHtml(item.internal)}</span>
                  <p>${escapeHtml(item.desc)}</p>
                </article>`
            )
            .join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderEcosystem(chapter, index) {
    return `
      <section class="book-page book-page--ecosystem" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-ecosystem-copy">
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
        <div class="ecosystem-diagram" aria-label="SemeAI ecosystem map">
          <div class="ecosystem-core">${escapeHtml(chapter.center)}</div>
          ${(chapter.nodes || [])
            .map((node, nodeIndex) => `<button class="ecosystem-node ecosystem-node--${nodeIndex + 1}" type="button">${escapeHtml(node)}</button>`)
            .join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderProduct(chapter, index) {
    return `
      <section class="book-page book-page--product" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-product-grid">
          <div>
            <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
            <h2>${escapeHtml(chapter.title)}</h2>
            ${paragraphs(chapter.body)}
          </div>
          <div class="book-product-frame">
            <div class="frame-top"><span></span><span></span><span></span></div>
            <div class="frame-lines">
              ${(chapter.bullets || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            </div>
          </div>
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderStack(chapter, index) {
    return `
      <section class="book-page book-page--stack" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-stack-grid">
          <div>
            <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
            <h2>${escapeHtml(chapter.title)}</h2>
            <p>${escapeHtml(chapter.note)}</p>
          </div>
          <ol class="runtime-stack">
            ${(chapter.layers || []).map((item) => `<li><span></span><strong>${escapeHtml(item)}</strong></li>`).join("")}
          </ol>
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderMetrics(chapter, index) {
    return `
      <section class="book-page book-page--metrics" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="metrics-title">
          <h2>${titleLines(chapter.title)}</h2>
          <p>${escapeHtml(chapter.note)}</p>
        </div>
        <div class="metrics-grid">
          ${(data.metrics || [])
            .map(
              (metric) => `
                <article>
                  <strong>${escapeHtml(metric.value)}</strong>
                  <span>${escapeHtml(metric.label)}</span>
                  <p>${escapeHtml(metric.note)}</p>
                </article>`
            )
            .join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderMethod(chapter, index) {
    return `
      <section class="book-page book-page--method" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-method-grid">
          <div>
            <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
            <h2>${escapeHtml(chapter.title)}</h2>
            ${paragraphs(chapter.body)}
          </div>
          <ol class="method-cycle">
            ${(chapter.cycle || []).map((item, cycleIndex) => `<li><span>${cycleIndex + 1}</span>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderPrinciples(chapter, index) {
    return `
      <section class="book-page book-page--principles" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="principles-head">
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
        <div class="principles-grid">
          ${(chapter.principles || [])
            .map(
              ([title, body]) => `
                <article>
                  <strong>${escapeHtml(title)}</strong>
                  <p>${escapeHtml(body)}</p>
                </article>`
            )
            .join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderTimeline(chapter, index) {
    return `
      <section class="book-page book-page--timeline" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
        <ol class="evolution-line">
          ${(chapter.stages || []).map((item, stageIndex) => `<li><span>${String(stageIndex + 1).padStart(2, "0")}</span>${escapeHtml(item)}</li>`).join("")}
        </ol>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderProof(chapter, index) {
    return `
      <section class="book-page book-page--proof" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
        <div class="proof-grid">
          ${(chapter.items || []).map((item) => `<article>${escapeHtml(item)}</article>`).join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderNegative(chapter, index) {
    return `
      <section class="book-page book-page--negative" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
          <p>${escapeHtml(chapter.body)}</p>
        </div>
        <ul class="not-claims">
          ${(chapter.claims || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderFocus(chapter, index) {
    return `
      <section class="book-page book-page--focus" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
          <p>${escapeHtml(chapter.body)}</p>
        </div>
        <div class="focus-row">
          ${(chapter.focus || []).map((item) => `<article>${escapeHtml(item)}</article>`).join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderBack(chapter, index) {
    return `
      <section class="book-page book-page--back" id="${chapter.id}" data-chapter="${chapter.number}">
        <div>
          <h2>${escapeHtml(chapter.title)}</h2>
          <p>${escapeHtml(chapter.subtitle)}</p>
        </div>
        <div class="back-links">
          ${(chapter.links || [])
            .map(([label, href]) => `<a href="${escapeHtml(href)}"${linkAttrs(href)}>${escapeHtml(label)}<span>${escapeHtml(href)}</span></a>`)
            .join("")}
        </div>
        ${chapterNavFooter(chapter, index)}
      </section>`;
  }

  function renderChapter(chapter, index) {
    const map = {
      cover: renderCover,
      statement: renderStatement,
      poster: renderStatement,
      editorial: renderEditorial,
      author: renderAuthor,
      flow: renderFlow,
      ecosystem: renderEcosystem,
      product: renderProduct,
      stack: renderStack,
      metrics: renderMetrics,
      method: renderMethod,
      principles: renderPrinciples,
      timeline: renderTimeline,
      proof: renderProof,
      negative: renderNegative,
      focus: renderFocus,
      back: renderBack,
    };
    return (map[chapter.layout] || renderEditorial)(chapter, index);
  }

  function defaultContext(id) {
    const map = {
      gate: [
        { label: "See this principle in the Benchmark", href: "/benchmark/" },
        { label: "Return to the product Gate", href: "/gate.html" },
      ],
      proof: [
        { label: "Run the Repository Evidence Benchmark", href: "/benchmark/" },
        { label: "View the research boundary", href: "/research.html" },
      ],
      "not-claims": [{ label: "Inspect research limitations", href: "/research.html" }],
    };
    return map[id] || [];
  }

  function appendContextLinks(chapterId, items) {
    const chapter = document.getElementById(chapterId);
    if (!chapter || !items?.length) return;
    const turn = chapter.querySelector(".book-chapter-turn");
    const links = document.createElement("nav");
    links.className = "book-context-links";
    links.setAttribute("aria-label", "Related SemeAI routes");
    items.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      links.append(link);
    });
    if (turn) chapter.insertBefore(links, turn);
    else chapter.append(links);
  }

  function setActiveChapter(id, options = {}) {
    if (!id) return;
    const chapters = data.chapters || [];
    const index = chapters.findIndex((chapter) => chapter.id === id);
    if (index < 0) return;
    const previousId = activeChapterId;
    activeChapterId = id;
    const chapter = chapters[index];
    const total = chapters.length;
    const ratio = total > 1 ? index / (total - 1) : 0;

    document.querySelectorAll("[data-chapter-link]").forEach((link) => {
      const active = link.dataset.chapterLink === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    if (progress) progress.style.transform = `scaleX(${ratio || 0.02})`;
    if (progressRoot) {
      progressRoot.setAttribute("aria-valuenow", String(index + 1));
      progressRoot.setAttribute("aria-valuemax", String(total));
      progressRoot.setAttribute("aria-label", `Chapter ${chapter.number} of ${total}: ${chapter.nav}`);
    }
    if (railChapter) railChapter.textContent = chapter.number;
    if (railProgress) railProgress.style.transform = `scaleY(${Math.max(0.08, ratio)})`;

    if (options.animate && previousId && previousId !== id && !prefersReducedMotion()) {
      const page = document.getElementById(id);
      if (page) {
        page.classList.remove("is-entering");
        // force reflow
        void page.offsetWidth;
        page.classList.add("is-entering");
      }
    }
  }

  function closeMobileNav() {
    document.body.classList.remove("book-nav-open");
    menuButton?.setAttribute("aria-expanded", "false");
  }

  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("book-nav-collapsed", collapsed);
    if (collapseButton) collapseButton.setAttribute("aria-expanded", String(!collapsed));
    if (navRail) navRail.hidden = !collapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
  }

  function isInteractiveTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(
      target.closest("a, button, input, textarea, select, summary, [contenteditable='true'], [role='button'], [role='link'], [role='menuitem']")
    );
  }

  function goToChapterOffset(delta) {
    const chapters = data.chapters || [];
    const index = chapters.findIndex((chapter) => chapter.id === activeChapterId);
    const next = chapters[index + delta];
    if (!next) return;
    const target = document.getElementById(next.id);
    if (!target) return;
    setActiveChapter(next.id, { animate: true });
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${next.id}`);
  }

  function startCoverMotion() {
    cancelAnimationFrame(coverRaf);
    if (prefersReducedMotion()) return;
    const field = document.querySelector(".book-field-svg");
    if (!field) return;
    const points = Array.from(field.querySelectorAll(".book-field-point"));
    const paths = Array.from(field.querySelectorAll(".book-field-path"));
    const rings = field.querySelector(".book-field-rings");
    let t0 = performance.now();

    const tick = (now) => {
      if (document.hidden || !coverVisible) {
        coverRaf = requestAnimationFrame(tick);
        return;
      }
      const t = (now - t0) / 1000;
      if (rings) rings.style.transform = `rotate(${t * 2.2}deg)`;
      points.forEach((point, index) => {
        const baseAngle = (index / points.length) * Math.PI * 2 + 0.2;
        const radius = 96 + (index % 4) * 28 + Math.sin(t * 0.55 + index) * 6;
        const angle = baseAngle + t * 0.12 * (index % 2 === 0 ? 1 : -1);
        point.setAttribute("cx", (320 + Math.cos(angle) * radius).toFixed(1));
        point.setAttribute("cy", (320 + Math.sin(angle) * radius).toFixed(1));
        point.setAttribute("opacity", (0.45 + (Math.sin(t * 1.3 + index) + 1) * 0.25).toFixed(2));
      });
      paths.forEach((path, index) => {
        const pulse = 0.55 + (Math.sin(t * 0.8 + index * 0.4) + 1) * 0.22;
        path.style.opacity = path.classList.contains("is-released") ? String(0.55 + pulse * 0.35) : String(0.2 + pulse * 0.15);
      });
      coverRaf = requestAnimationFrame(tick);
    };
    coverRaf = requestAnimationFrame(tick);
  }

  function observeCoverVisibility() {
    const field = document.querySelector(".book-field");
    if (!field || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        coverVisible = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.12 }
    );
    observer.observe(field);
  }

  function paintBook() {
    data = localizedData();
    main.innerHTML = data.chapters.map((chapter, index) => renderChapter(chapter, index)).join("");

    if (startOrientation) {
      const firstPage = main.querySelector(".book-page");
      if (firstPage) firstPage.after(startOrientation);
      else main.prepend(startOrientation);
    }

    nav.innerHTML = data.chapters
      .map(
        (chapter) => `
        <li>
          <a href="#${escapeHtml(chapter.id)}" data-chapter-link="${escapeHtml(chapter.id)}">
            <span class="book-nav-num">${escapeHtml(chapter.number)}</span>
            <span class="book-nav-title">${escapeHtml(chapter.nav)}</span>
          </a>
        </li>`
      )
      .join("");

    const ctx = data._context || {};
    ["gate", "proof", "not-claims"].forEach((id) => {
      appendContextLinks(id, ctx[id] || defaultContext(id));
    });

    if (pageObserver) pageObserver.disconnect();
    const pages = Array.from(document.querySelectorAll(".book-page"));
    if ("IntersectionObserver" in window) {
      pageObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible) setActiveChapter(visible.target.id);
        },
        { rootMargin: "-20% 0px -45% 0px", threshold: [0.2, 0.4, 0.65] }
      );
      pages.forEach((page) => pageObserver.observe(page));
    }

    document.querySelectorAll("[data-chapter-link]").forEach((link) => {
      link.addEventListener("click", () => {
        closeMobileNav();
        setActiveChapter(link.dataset.chapterLink, { animate: true });
      });
    });

    document.querySelectorAll(".book-turn").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      link.addEventListener("click", () => {
        const id = link.getAttribute("href")?.slice(1);
        if (id) setActiveChapter(id, { animate: true });
      });
    });

    const hashId = location.hash.replace(/^#/, "");
    if (hashId && document.getElementById(hashId)) setActiveChapter(hashId);
    else if (data.chapters[0]) setActiveChapter(data.chapters[0].id);

    window.SemeAI_I18n?.apply?.(document);
    startCoverMotion();
    observeCoverVisibility();
  }

  // Sidebar collapse persistence (desktop)
  try {
    if (localStorage.getItem(SIDEBAR_KEY) === "1") setSidebarCollapsed(true);
  } catch (_) {
    /* ignore */
  }

  collapseButton?.addEventListener("click", () => {
    setSidebarCollapsed(!document.body.classList.contains("book-nav-collapsed"));
  });
  railExpand?.addEventListener("click", () => setSidebarCollapsed(false));

  menuButton?.addEventListener("click", () => {
    const open = document.body.classList.toggle("book-nav-open");
    menuButton.setAttribute("aria-expanded", String(open));
    if (open) nav.querySelector("a")?.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("book-nav-open")) {
      event.preventDefault();
      closeMobileNav();
      menuButton?.focus();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (isInteractiveTarget(event.target)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    goToChapterOffset(event.key === "ArrowRight" ? 1 : -1);
  });

  printButton?.addEventListener("click", () => window.print());

  if (new URLSearchParams(window.location.search).has("print")) {
    document.body.classList.add("book-print-intent");
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !prefersReducedMotion()) startCoverMotion();
  });

  paintBook();
  window.addEventListener("semeai:lang", () => paintBook());
  window.addEventListener("hashchange", () => {
    const id = location.hash.replace(/^#/, "");
    if (id) setActiveChapter(id, { animate: true });
  });
})();
