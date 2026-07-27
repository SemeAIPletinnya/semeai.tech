# Runtime decision contract

This repository documents the client-facing boundary of the SemeAI Gate. The executable API authority lives in the related `semeai-gate-basic` runtime and the protected SaC/PoR architecture.

## Canonical runtime states

| State | Meaning |
| --- | --- |
| `PROCEED` | Current policy admits release or execution |
| `NEEDS_REVIEW` | Current policy requires a bounded human or operator review path |
| `SILENCE` | Release or execution is withheld and the audit evidence remains |

`SILENCE` is not deletion. Candidate material and audit evidence remain distinct from released output.

## Required sequence

```text
candidate
  -> evidence and policy evaluation
  -> release decision
  -> decision receipt
  -> release or withholding
```

No metadata layer, retrieved context, model output, memory signal, repository result, rank, or UI animation is Gate authority.

The runtime must not mutate, substitute, append fallback language to, or otherwise change the user-visible candidate after the Gate. Any fallback or warning intended for release must be part of the pre-Gate candidate or evaluated as a new candidate.

## Presentation boundary

The public Repository Evidence Benchmark uses `SHOW`, `REVIEW`, and `BLOCK` to control whether its own analytical result is presented. Those labels do not replace the runtime states above and do not grant SaC/PoR release authority.

## Verification surfaces

- `gate.html` explains the public contract.
- `dashboard.html` exercises the API-backed operator surface.
- `book/#gate`, `book/#runtime`, and `book/#evidence` provide the engineering narrative.
- Browser tests verify public route behavior and Book navigation.
- The related backend test suite verifies API behavior and retained receipts.
