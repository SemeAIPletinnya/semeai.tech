(() => {
  "use strict";

  if (window.SemeAIDashboardMotion) return;
  window.SemeAIDashboardMotion = true;

  const motion = window.SemeAIMotion;
  const canvas = document.getElementById("bg-canvas");

  function drawOperationalField() {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const boundary = Math.round(width * 0.68) + 0.5;
    context.lineWidth = 1;
    context.strokeStyle = "rgba(217, 189, 120, 0.075)";
    context.beginPath();
    context.moveTo(boundary, 0);
    context.lineTo(boundary, height);
    context.stroke();

    const seed = motion?.seed("semeai-dashboard-operational-field") || 1;
    const rows = Math.max(4, Math.min(8, Math.floor(height / 120)));
    for (let index = 0; index < rows; index += 1) {
      const unit = motion?.seededUnit(seed, index + 1) ?? ((index + 1) / (rows + 1));
      const y = Math.round((index + 1) * height / (rows + 1)) + 0.5;
      const start = Math.round(width * (0.08 + unit * 0.12));
      const stop = Math.round(boundary - 30 - unit * 110);
      context.strokeStyle = index % 3 === 0
        ? "rgba(155, 128, 191, 0.07)"
        : "rgba(114, 231, 239, 0.055)";
      context.beginPath();
      context.moveTo(start, y);
      context.bezierCurveTo(start + width * 0.12, y, stop - width * 0.08, y + (unit - 0.5) * 24, stop, y);
      context.stroke();
      context.fillStyle = "rgba(217, 189, 120, 0.11)";
      context.beginPath();
      context.arc(stop, y, 1.25, 0, Math.PI * 2);
      context.fill();
    }
  }

  function observeDecision() {
    const card = document.getElementById("result-card");
    if (!card) return;
    let lastDecision = "";
    let transitionTimer = 0;
    const decisions = ["SHOW", "REVIEW", "BLOCK"];

    const observer = new MutationObserver(() => {
      const nextDecision = decisions.find((decision) => card.classList.contains(decision)) || "";
      if (!nextDecision || nextDecision === lastDecision) return;
      lastDecision = nextDecision;
      window.clearTimeout(transitionTimer);
      card.classList.remove("is-transitioning");
      void card.offsetWidth;
      card.classList.add("is-transitioning");
      transitionTimer = window.setTimeout(() => card.classList.remove("is-transitioning"), 620);
    });
    observer.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function observeReceipts() {
    const list = document.getElementById("receipt-list");
    if (!list) return;

    const admit = () => {
      list.querySelectorAll(".receipt-row:not(.is-admitted)").forEach((row) => {
        row.classList.add("is-admitted");
      });
    };
    new MutationObserver(admit).observe(list, { childList: true, subtree: true });
    admit();
  }

  drawOperationalField();
  window.addEventListener("resize", drawOperationalField, { passive: true });
  observeDecision();
  observeReceipts();
})();
