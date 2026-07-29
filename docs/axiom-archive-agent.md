# Axiom archive-agent integration

Status: Phases 0–5 are implemented and tested on isolated public-site and backend branches. Production release remains held behind the draft PR and deployment authority.

Axiom is a view over system state and admitted evidence. It does not create evidence, authentication, release decisions, receipts, or execution authority. Candidate generation remains upstream of the SaC/PoR Gate.

## Frozen execution inputs

The integration started from public-site commit `02ee1f2f4110421318672e286224fe4ac3617f2e`.

| Input | SHA-256 | Meaning |
| --- | --- | --- |
| hatch-pet method | `ac22ec3cbabc95ba03ee3d7cf43a1209fcd139d56c69d35b10c57b9b5f794da0` | Asset validation method, not admission |
| GET JOB method | `3b030d109ad876294cc6fe57525dfd5c190cbd61134ab0715f261de46db35c59` | Execution method, not release authority |
| GET VIS method | `a0ed0f0a2e6522729aadce18b891f0aed1c8acc18b424253ff165aabcb6bddbd` | Visual evaluation method, not product authority |
| Accepted v2 atlas | `26b0f128ab3f37463e12620bdcd582e87e2218229c1de7ab330bb9256076fcd1` | Validated production sprite asset |
| Public pet manifest | `211b6f4e9c887151e7938e9df659d5669d3b403190cf82c7af26e2ccbc97ac6a` | Runtime metadata; never Gate authority |
| Public evidence index | `62eb0078bc1cf431daafc2f622336600b5528438bb373b2a87fc45f25c9959cc` | Curated retrieval input; retrieval is not truth |

The colocated candidate PNG was not accepted for runtime use because deterministic v2 validation found the required `idle[6]` cell empty. The accepted atlas is the repaired, separately validated hatch-pet package. The rejected candidate remains evidence of an input artifact; it is not silently substituted in place.

## Phase 1 contract

The selected public routes are Home, Genesis, Benchmark, Gate, and Skill Forge.

The runtime:

- reads the versioned public manifest and accepted 8 by 11 atlas;
- supports `idle`, `waiting`, `running`, `review`, `failed`, `waving`, `jumping`, directional movement, and all 16 look directions;
- maps system state to animation and never derives system state from animation;
- exposes an explicit `window.SemeAI_Axiom.setState(...)` adapter for real application events;
- uses look direction only for visual orientation;
- provides keyboard open, close, source inspection, and Escape handling;
- provides a static frame under reduced motion;
- contains itself at mobile viewports;
- provides an honest no-JavaScript fallback.

The panel is an evidence interface rather than a general support chatbot. It
accepts one bounded public-archive question, sends the explicit route context,
and renders an answer only after a valid Gate `SHOW / PROCEED` response. It
does not retain conversation history or imply private Workspace access.

## Protected boundaries

- Axiom does not emit `PROCEED`, `NEEDS_REVIEW`, or `SILENCE`.
- Axiom does not translate animation into `SHOW`, `REVIEW`, or `BLOCK`.
- Axiom does not manufacture a candidate answer, evidence bundle, decision, or receipt.
- Public mode exposes only committed public routes and metadata.
- No raw archive content, credentials, local paths, private URLs, or session data enter the public manifest.
- No user-visible output is mutated after a Gate decision.

## Phase 2 contract

`/assets/data/axiom-public-evidence.json` exposes nine curated first-party evidence objects with stable source IDs, repository-relative provenance, file hashes, dates, versions, visibility, admission state, route contexts, bounded summaries, and structured facts.

`window.SemeAI_AxiomArchive.search(...)` provides deterministic in-browser retrieval only. It:

- returns a typed evidence bundle, never a candidate answer;
- filters the index to `PUBLIC` entries;
- treats retrieved content as untrusted data;
- returns an explicit no-evidence result instead of reconstructing missing history;
- performs no online ingestion;
- exposes no private archive, session, credential, or local-path data;
- states that retrieval is neither truth nor release authority.

The validator recomputes every referenced evidence-file hash and rejects non-public entries, duplicate source IDs, unsupported admission states, missing repository evidence, sensitive local/runtime strings, and authority drift.

## Phase 3 and 4 backend contract

The isolated `semeai-gate-basic` branch now provides
`POST /v0/archive/query`. It mirrors the frozen public index by hash, performs
the same PUBLIC-only retrieval, creates a deterministic evidence candidate, and
passes that candidate through the existing Gate.

- No external model, network retrieval, private archive, raw archive, or online
  ingestion is used.
- The candidate remains distinct from the released answer.
- `SHOW / PROCEED` returns the exact candidate.
- `REVIEW / NEEDS_REVIEW` and `BLOCK / SILENCE` return `releasedAnswer: null`.
- No fallback text or warning substitutes for a held candidate after the Gate.
- The release-decision receipt preserves the legacy `receipt_id` alias.
- The execution receipt remains a distinct, uncreated artifact because the
  query endpoint performs no downstream execution.

## Phase 5 route context and frontend release handling

The public shell sends the current bounded route key (`home`, `genesis`,
`benchmark`, `gate`, or `skills`) with every question. Returned citations
deep-link to their public evidence objects.

The frontend validates the response schema, PUBLIC visibility, untrusted-data
marker, canonical action mapping, decision-receipt alias, absent execution
receipt, and candidate-text exclusion. For `SHOW`, it recomputes SHA-256 over
`releasedAnswer` and compares it with the Gate-evaluated candidate hash before
rendering. For `REVIEW` or `BLOCK`, the answer region remains empty; no fallback
or warning substitutes for the held candidate.

The endpoint is connected in the branch but is not claimed as production-live.
The site and backend PRs remain draft until independent release authority
accepts and deploys them.
