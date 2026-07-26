# Repository Evidence Benchmark v1 golden authority suite

This local suite freezes the analytical authority of the current Repository
Evidence Benchmark before further visual work.

> Visual evolution is allowed. Authority drift is not.

## Run

From the repository root:

```text
node benchmark/tests/golden.browser.mjs
```

The command uses Node built-ins for the authority tests and the Playwright
browser installation already provided by the local Codex environment. If
Playwright is supplied elsewhere, expose its existing `node_modules` directory
through `NODE_PATH` or `PLAYWRIGHT_NODE_MODULES`. The suite does not add or
install a package manager.

The browser harness serves the unchanged repository files over a temporary
loopback HTTP server. It loads the real `/benchmark/` page and production
scripts, and intercepts GitHub requests only inside the test browser. No live
GitHub request is used as a golden oracle.

## Protected authority

The suite executes the current production `SemeAIBenchmarkCore` directly and
freezes:

- repository input normalization;
- scoring policy and policy version;
- normalized evidence to category-score behavior;
- total score and indicators;
- Presentation Gate decision;
- visual seed and phase;
- receipt schema, contents, canonicalization and SHA-256 integrity hash;
- fallback snapshot integrity and behavior.

The fixed built-in `silence-as-control` fallback is the canonical authority
fixture. Its timestamp and evidence are already part of the committed snapshot,
so its receipt hash is deterministic:

```text
8fae1c025eb703961011df2ea083ec8d74cd85cf61b170b895b8e06e503f4897
```

The tests never replace that hash when a run differs. A mismatch requires root
cause analysis of production behavior, fixture integrity, canonicalization, or
nondeterministic input.

## Presentation metadata

Rank, artifact geometry, category focus and animation occur after analytical
authority. Rank mapping is frozen as a separate public presentation contract,
including all 40 codes and the canonical SS-4 Archive Crown result.

Artifact rendering is invoked before and after receipt construction in the
browser. SHOW/REVIEW/BLOCK visual inputs, category highlighting, reduced
motion and repeated rendering may change markup, but may not mutate the
candidate, evidence, category scores, indicators, Gate, receipt, receipt hash,
seed or phase.

Visual geometry and motion may evolve deliberately after visual approval. Such
work must not update analytical goldens unless an explicit policy task
authorizes authority changes.

## BLOCK versus collection failure

A valid low-evidence snapshot still produces an internal analytical score. Its
Presentation Gate returns BLOCK, and the browser must withhold the public
score, rank family, normal artifact and receipt.

A collection failure happens before a valid candidate exists. It must not be
interpreted as repository weakness and must not receive an F rank, normal
artifact, Gate admission or fabricated receipt.

Malformed repository identities are denied before collection. The browser
harness asserts that the GitHub request count remains zero.

## Known SS edge case

The suite documents current behavior for a manually inconsistent 100-point
candidate with insufficient indicators: it falls through to SS-1. This test is
named as a current-behavior record, not as a desired future semantic contract.
Changing it requires a separate rank-policy decision; this suite does not fix
production behavior.

## Fixtures

- `canonical-authority.expected.json` — score, categories, indicators, Gate,
  seed, phase, rank, policy hash and protected production-function hashes.
- `canonical-fallback.expected.json` — receipt object shape, canonical byte
  digest, downloadable JSON digest and golden receipt hash.
- `low-evidence.json` — valid deterministic candidate whose internal score is
  withheld by BLOCK.
- `malformed-input.json` — repository identities denied before networking.
- `rank-mutation-cases.json` — public rank ranges, SS cases and
  presentation-only permutations.

The saved historical `semeai.tech` receipt is intentionally not a current
golden. It contains a historical snapshot timestamp and remains external audit
evidence rather than a current repository-score expectation.
