# 01 — Authority recovery

## Recovered authority

- Task source: `SEMEAI_CINEMATIC_INTERACTION_ENGINE_CODEX_TASK.pdf`.
- Frozen production baseline: `1fc5b22ba1d83ed0de5cfff6e6e4ec2e02ebadf0`.
- Candidate branch: `agent/cinematic-interaction-engine-proof-20260801` in an isolated worktree.
- Permitted: frontend redesign inside the isolated candidate, a reusable rendering engine, local proof helpers, local commits, prototype bundle, rendered evidence.
- Forbidden: production PR, merge, deployment, Gate/SaC/PoR semantic changes, protected dependency edits, candidate leakage, staged Benchmark replacement.

## Authority boundary

The engine receives state; it does not invent state. Gate choreography is neutral while the request is pending. SHOW/REVIEW/BLOCK motion begins only after the production response passes pair, reason, audit, `show_to_user`, and exact-candidate hash validation. ERROR is explicitly a local transport-fault proof and is never represented as a Gate decision.

Benchmark animation consumes the existing `SemeAIBenchmarkCore`. A bounded export exposes the already-existing live collector and fallback loader to reusable consumers; scoring policy and presentation decisions remain unchanged.

## Frozen evidence

Baseline tests were run before implementation and passed. The candidate retains the exact baseline history, public routes, Genesis manifests, Axiom atlas, Gate API wrapper, and Benchmark policy.
