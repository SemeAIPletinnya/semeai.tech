# SemeAI Cinematic Interaction Engine

Isolated reusable proof built from the frozen functional baseline `1fc5b22ba1d83ed0de5cfff6e6e4ec2e02ebadf0`.

The engine proves three connected worlds without changing SaC/PoR/Gate authority:

1. Release Field — a candidate has motion and weight while the authority boundary remains fixed.
2. Gate Chamber — SHOW, REVIEW, BLOCK, and transport ERROR acquire distinct physical consequences only after an authoritative response.
3. Evidence Observatory — the existing Benchmark analyzer assembles seven real repository signals before announcing a score.

Axiom is an in-world witness. It reacts to events and continuity but never chooses or modifies a release state.

## Run

```powershell
node cinematic-engine/dev-server.mjs
```

Open `http://127.0.0.1:8765/cinematic-engine/`.

The loopback server exists because the production Gate does not allow a browser request from localhost. It proxies only the three published deterministic Gate scenarios to `https://api.semeai.tech/v0/demo/check`. It can optionally use `SEMEAI_CINEMATIC_GITHUB_TOKEN` upstream to avoid anonymous GitHub rate limits; no credential enters the browser or a receipt. On a non-loopback origin, the engine uses the existing SemeAI Gate wrapper and direct GitHub API path.

## Verify

```powershell
node cinematic-engine/tests/cinematic-engine.browser.mjs
```

The browser test covers exact-candidate hash verification, SHOW/REVIEW/BLOCK/ERROR, non-release leakage, receipts, the live seven-signal Benchmark path, EN/UA/RU, desktop/mobile overflow, reduced motion, no-JS meaning, Axiom state, and measured render cost.

## Boundary

This route is intentionally `noindex`. It is not a production PR, merge, or deployment. The protected external dependency `D:\SemeAi\silence-as-control` is never modified.
