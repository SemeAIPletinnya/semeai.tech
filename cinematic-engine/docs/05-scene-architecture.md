# 05 — Scene architecture

## Runtime

- One capped-DPR Canvas 2D renderer.
- One animation clock and one RAF loop.
- Three scene functions: Field, Gate, Benchmark.
- Semantic DOM remains the accessible source of labels, controls, states, answers, and receipts.
- Visibility pause, resize handling, bounded frame history, and explicit reduced-motion still rendering.

## Continuity model

The same hexagonal trace changes context rather than identity. The renderer blends the outgoing and incoming palettes while the DOM world transition remains readable. Axiom uses the admitted sprite atlas and a semantic state adapter; it does not call Gate or Benchmark and cannot alter their results.

## Data bridges

`GateBridge` validates the production response and releases the only browser-held published candidate only after SHA-256 equality. `BenchmarkBridge` calls the existing live collector, scorer, presentation Gate, indicators, visual phase, and receipt builder. BLOCK returns decision reasons but no score candidate.

## Local proof boundary

`dev-server.mjs` binds to `127.0.0.1`, serves the static candidate, proxies only the published Gate scenarios, and optionally adds a local GitHub credential upstream. Paths and bodies are bounded. Credentials never enter the browser. Non-loopback builds use the existing production API wrapper and direct GitHub API.
