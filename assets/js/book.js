(() => {
  const data = window.SEMEAI_ENGINEERING_BOOK;
  const main = document.getElementById("book-main");
  const nav = document.getElementById("book-nav-list");
  const progress = document.getElementById("book-progress-bar");
  const menuButton = document.getElementById("book-menu-button");
  const printButton = document.getElementById("book-print-button");
  const startOrientation = document.getElementById("book-start");

  if (!data || !main || !nav) return;

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

  const chapterHead = (chapter) => `
    <div class="book-chapter-meta">
      <span>${escapeHtml(chapter.number)}</span>
      ${chapter.kicker ? `<span>${escapeHtml(chapter.kicker)}</span>` : ""}
    </div>`;

  function renderCover(chapter) {
    return `
      <section class="book-page book-page--cover" id="${chapter.id}" data-chapter="${chapter.number}">
        <div class="book-field" aria-hidden="true">${renderSignalField()}</div>
        <div class="book-cover-copy">
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h1>${titleLines(chapter.title)}</h1>
          <p class="book-cover-subtitle">${sentenceLines(chapter.subtitle)}</p>
        </div>
        <div class="book-cover-footer">
          ${(chapter.meta || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </section>`;
  }

  function renderStatement(chapter) {
    return `
      <section class="book-page book-page--statement ${chapter.emphasis ? "book-page--emphasis" : ""}" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <h2>${titleLines(chapter.title)}</h2>
          ${chapter.metadata ? `<p class="book-inline-meta">${escapeHtml(chapter.metadata)}</p>` : ""}
          ${chapter.note ? `<p class="book-statement-note">${escapeHtml(chapter.note)}</p>` : ""}
        </div>
      </section>`;
  }

  function renderEditorial(chapter) {
    return `
      <section class="book-page book-page--editorial" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div class="book-editorial-copy">
          <h2>${escapeHtml(chapter.title)}</h2>
          ${paragraphs(chapter.body)}
        </div>
      </section>`;
  }

  function renderAuthor(chapter) {
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
      </section>`;
  }

  function renderFlow(chapter) {
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
                (step, index) => `
                  <div class="release-flow-step">
                    <span>${String(index + 1).padStart(2, "0")}</span>
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
      </section>`;
  }

  function renderEcosystem(chapter) {
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
            .map((node, index) => `<button class="ecosystem-node ecosystem-node--${index + 1}" type="button">${escapeHtml(node)}</button>`)
            .join("")}
        </div>
      </section>`;
  }

  function renderProduct(chapter) {
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
      </section>`;
  }

  function renderStack(chapter) {
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
      </section>`;
  }

  function renderMetrics(chapter) {
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
      </section>`;
  }

  function renderMethod(chapter) {
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
            ${(chapter.cycle || []).map((item, index) => `<li><span>${index + 1}</span>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </div>
      </section>`;
  }

  function renderPrinciples(chapter) {
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
      </section>`;
  }

  function renderTimeline(chapter) {
    return `
      <section class="book-page book-page--timeline" id="${chapter.id}" data-chapter="${chapter.number}">
        ${chapterHead(chapter)}
        <div>
          <p class="book-kicker">${escapeHtml(chapter.kicker)}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
        </div>
        <ol class="evolution-line">
          ${(chapter.stages || []).map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(item)}</li>`).join("")}
        </ol>
      </section>`;
  }

  function renderProof(chapter) {
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
      </section>`;
  }

  function renderNegative(chapter) {
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
      </section>`;
  }

  function renderFocus(chapter) {
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
      </section>`;
  }

  function renderBack(chapter) {
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
      </section>`;
  }

  function renderSignalField() {
    return Array.from({ length: 22 }, (_, index) => `<span style="--i:${index}"></span>`).join("");
  }

  function renderChapter(chapter) {
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
    return (map[chapter.layout] || renderEditorial)(chapter);
  }

  main.innerHTML = data.chapters.map(renderChapter).join("");
  if (startOrientation) main.firstElementChild?.after(startOrientation);
  nav.innerHTML = data.chapters
    .map(
      (chapter) => `
        <li>
          <a href="#${escapeHtml(chapter.id)}" data-chapter-link="${escapeHtml(chapter.id)}">
            <span>${escapeHtml(chapter.number)}</span>
            ${escapeHtml(chapter.nav)}
          </a>
        </li>`
    )
    .join("");

  const appendContextLinks = (chapterId, items) => {
    const chapter = document.getElementById(chapterId);
    if (!chapter) return;
    const links = document.createElement("nav");
    links.className = "book-context-links";
    links.setAttribute("aria-label", "Related SemeAI routes");
    items.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      links.append(link);
    });
    chapter.append(links);
  };

  appendContextLinks("gate", [
    { label: "See this principle in the Benchmark", href: "/benchmark/" },
    { label: "Return to the product Gate", href: "/gate.html" },
  ]);
  appendContextLinks("proof", [
    { label: "Run the Repository Evidence Benchmark", href: "/benchmark/" },
    { label: "View the research boundary", href: "/research.html" },
  ]);
  appendContextLinks("not-claims", [
    { label: "Inspect research limitations", href: "/research.html" },
  ]);

  const navLinks = Array.from(document.querySelectorAll("[data-chapter-link]"));
  const pages = Array.from(document.querySelectorAll(".book-page"));

  const setActive = (id) => {
    navLinks.forEach((link) => {
      const active = link.dataset.chapterLink === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { threshold: [0.35, 0.55, 0.75] }
    );
    pages.forEach((page) => observer.observe(page));
  }

  const updateProgress = () => {
    if (!progress) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
    progress.style.transform = `scaleX(${pct})`;
  };

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  menuButton?.addEventListener("click", () => {
    const open = document.body.classList.toggle("book-nav-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("book-nav-open")) {
      event.preventDefault();
      document.body.classList.remove("book-nav-open");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton?.focus();
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("book-nav-open");
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });

  printButton?.addEventListener("click", () => window.print());

  if (new URLSearchParams(window.location.search).has("print")) {
    document.body.classList.add("book-print-intent");
  }
})();
