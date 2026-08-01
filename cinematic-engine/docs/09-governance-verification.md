# 09 — Governance and leakage verification

## Gate invariants

- Public/canonical pairs are validated: SHOW/PROCEED, REVIEW/NEEDS_REVIEW, BLOCK/SILENCE.
- `show_to_user` must match SHOW.
- Non-SHOW states must preserve audit evidence.
- SHOW requires a registered pre-Gate candidate and an exact SHA-256 match.
- REVIEW, BLOCK, hash mismatch, unknown state, malformed response, and transport error clear and hide the released-answer surface.
- Legacy compatibility uses `receipt_id || audit_id`.
- Release-decision receipt and execution receipt remain distinct.
- No post-Gate mutation, fallback text, or rephrasing is introduced.

## Adversarial browser proof

The deterministic governance test injects `LEAK-ME-REVIEW` and `LEAK-ME-BLOCK` into mocked non-release responses. Neither sentinel reaches DOM or the bridge result. The same test verifies that only the exact SHOW candidate appears.

## Benchmark boundary

The existing scoring policy and presentation Gate remain authoritative for display. BLOCK returns no score candidate. Retrieval remains described as bounded public evidence, not truth or certification.

## Repository boundary

`D:\SemeAi\silence-as-control` was not touched. SaC/PoR semantics were not changed. No production backend, production route, PR, merge, or deploy was created.
