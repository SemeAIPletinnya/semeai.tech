(() => {
  "use strict";

  const motion = window.SemeAIMotion;
  const hero = document.querySelector(".hero");
  const stage = document.querySelector(".ecosystem-stage");
  const canvas = document.getElementById("bg-canvas");
  if (!motion || !hero || !stage || !canvas) return;

  window.SemeAIHomeMotion = Object.freeze({ version: "living-system-v1" });

  const outcomes = ["show", "review", "block"];
  let outcomeIndex = 0;
  let previousPhase = "";
  stage.dataset.motionOutcome = outcomes[outcomeIndex];
  hero.dataset.motionOutcome = outcomes[outcomeIndex];

  motion.watch(stage, null, { threshold: 0.08, rootMargin: "80px 0px" });
  motion.cycle(hero, {
    phases: [
      { name: "candidate", duration: 2600 },
      { name: "evidence", duration: 3400 },
      { name: "boundary", duration: 2700 },
      { name: "decision", duration: 2500 },
      { name: "trace", duration: 4300 },
    ],
    reducedPhase: 4,
    threshold: 0.08,
    rootMargin: "80px 0px",
    onPhase(phase) {
      stage.dataset.motionPhase = phase;
      if (phase === "candidate" && previousPhase === "trace") {
        outcomeIndex = (outcomeIndex + 1) % outcomes.length;
        stage.dataset.motionOutcome = outcomes[outcomeIndex];
        hero.dataset.motionOutcome = outcomes[outcomeIndex];
      }
      previousPhase = phase;
    },
  });

  document.querySelectorAll(".system-spine, .chapter-visual, .boundary-visual, .route-index").forEach((element) => {
    motion.watch(element, null, { threshold: 0.04, rootMargin: "120px 0px" });
  });

  const context = canvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let loop = null;

  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function path(start, controlA, controlB, end, color, lineWidth = 1) {
    context.beginPath();
    context.moveTo(start[0], start[1]);
    context.bezierCurveTo(controlA[0], controlA[1], controlB[0], controlB[1], end[0], end[1]);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function point(x, y, color, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function draw(time, state = {}) {
    const phase = state.reduced ? 0.68 : (time * 0.000035) % 1;
    const wave = Math.sin(phase * Math.PI * 2);
    const originX = width * 0.54;
    const originY = height * 0.34;
    const fieldWidth = Math.min(width * 0.34, 440);
    const fieldHeight = Math.min(height * 0.32, 280);

    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(originX, originY, 0, originX, originY, Math.max(width, height) * 0.44);
    glow.addColorStop(0, "rgba(114,231,239,0.075)");
    glow.addColorStop(0.42, "rgba(151,134,171,0.025)");
    glow.addColorStop(1, "rgba(3,5,6,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.setLineDash([2, 28]);
    context.lineDashOffset = state.reduced ? -14 : -phase * 60;
    for (let index = 0; index < 7; index += 1) {
      const side = index % 2 ? 1 : -1;
      const level = (index + 1) / 8;
      const startX = originX + side * fieldWidth * (0.52 + level * 0.4);
      const startY = originY + (level - 0.5) * fieldHeight * 1.5;
      const endY = originY + (level - 0.5) * fieldHeight * 0.45 + wave * (index - 3) * 0.7;
      path(
        [startX, startY],
        [originX + side * fieldWidth * 0.44, startY],
        [originX + side * fieldWidth * 0.16, endY],
        [originX, endY],
        index % 3 === 0 ? "rgba(217,189,120,0.065)" : "rgba(114,231,239,0.07)",
        index === 3 ? 1.1 : 0.75
      );
      point(startX, startY, index % 3 === 0 ? "rgba(217,189,120,0.18)" : "rgba(244,239,230,0.15)", 1.2);
    }
    context.setLineDash([]);

    path(
      [originX, height * 0.08],
      [originX - 16, height * 0.25],
      [originX + 14, height * 0.58],
      [originX, height * 0.92],
      "rgba(114,231,239,0.075)",
      1
    );
    point(originX, originY, "rgba(217,189,120,0.34)", 2.1);
  }

  resize();
  loop = motion.frameLoop(hero, draw, { fps: 15, threshold: 0.04, rootMargin: "100px 0px" });
  window.addEventListener(
    "resize",
    () => {
      resize();
      loop?.request();
    },
    { passive: true }
  );
})();
