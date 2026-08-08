const SEMANTIC_ROWS = Object.freeze({
  IDLE: { row: 0, frames: 7, fps: 3.2 },
  ATTENTIVE: { row: 9, frames: 8, fps: 5 },
  WORKING: { row: 7, frames: 6, fps: 6 },
  RESULT: { row: 3, frames: 4, fps: 4.2 },
  REVIEW: { row: 8, frames: 6, fps: 3.5 },
  HELD: { row: 6, frames: 6, fps: 2.8 },
  ERROR: { row: 5, frames: 8, fps: 3 }
});

export class AxiomWitness {
  constructor(element, { reducedMotion = false } = {}) {
    this.element = element;
    this.sprite = element?.querySelector(".axiom-witness__sprite");
    this.stateNode = element?.querySelector("[data-axiom-state]");
    this.messageNode = element?.querySelector("[data-axiom-message]");
    this.reducedMotion = reducedMotion;
    this.state = "IDLE";
    this.message = "";
    this.lookBias = 0;
    this.setState("IDLE");
  }

  setState(next, message = this.message) {
    const state = Object.hasOwn(SEMANTIC_ROWS, next) ? next : "IDLE";
    this.state = state;
    this.message = message || "";
    if (this.element) this.element.dataset.semanticState = state;
    if (this.stateNode) this.stateNode.textContent = state;
    if (this.messageNode && message) {
      this.messageNode.removeAttribute("data-copy");
      this.messageNode.textContent = message;
    }
    this.tick(performance.now());
  }

  setMessage(message) {
    this.message = message;
    if (this.messageNode) {
      this.messageNode.removeAttribute("data-copy");
      this.messageNode.textContent = message;
    }
  }

  look(normalizedX) {
    this.lookBias = Math.max(-1, Math.min(1, Number(normalizedX) || 0));
  }

  tick(now) {
    if (!this.sprite) return;
    const spec = SEMANTIC_ROWS[this.state];
    const frame = this.reducedMotion ? 0 : Math.floor((now / 1000) * spec.fps) % spec.frames;
    const directed = this.state === "ATTENTIVE"
      ? Math.max(0, Math.min(7, Math.round(3.5 + this.lookBias * 3.5)))
      : frame;
    this.sprite.style.setProperty("--axiom-x", `${(directed / 7) * 100}%`);
    this.sprite.style.setProperty("--axiom-y", `${(spec.row / 10) * 100}%`);
  }
}
