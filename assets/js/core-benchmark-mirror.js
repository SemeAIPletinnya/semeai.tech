(() => {
  "use strict";
  if (!document.documentElement.classList.contains("core-product")) return;
  if ((document.body.dataset.v2Route || "") !== "lab") return;

  const score = document.getElementById("total-score");
  const mirror = document.getElementById("cp-score-mirror");
  const gate = document.getElementById("gate-decision");
  const gateMirror = document.getElementById("cp-gate-mirror");
  const source = document.getElementById("source-mode");
  const sourceMirror = document.getElementById("cp-source-mirror");
  const commit = document.getElementById("source-commit");
  const commitMirror = document.getElementById("cp-commit-mirror");
  const receipt = document.getElementById("receipt-hash");
  const receiptMirror = document.getElementById("cp-receipt-mirror");

  function sync() {
    if (mirror && score) mirror.textContent = score.textContent?.trim() || "—";
    if (gateMirror && gate) gateMirror.textContent = gate.textContent?.trim() || "—";
    if (sourceMirror && source) sourceMirror.textContent = source.textContent?.trim() || "NOT CAPTURED";
    if (commitMirror && commit) commitMirror.textContent = commit.textContent?.trim() || "—";
    if (receiptMirror && receipt) receiptMirror.textContent = receipt.textContent?.trim() || "—";
    document.querySelectorAll("#category-grid .category-card, #category-grid [data-score]").forEach((card, index) => {
      const slot = document.querySelector(`[data-cp-sig="${index}"]`);
      if (!slot) return;
      const text = card.textContent || "";
      const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      slot.textContent = match ? `${match[1]}/${match[2]}` : "—";
    });
  }

  const observer = new MutationObserver(sync);
  ["benchmark-result", "category-grid", "total-score", "gate-decision", "source-mode", "source-commit", "receipt-hash"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) observer.observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
  });
  window.addEventListener("semeai:evidence-visible", sync);
  window.setInterval(sync, 1200);
  sync();
})();
