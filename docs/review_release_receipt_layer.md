# Review and release receipt layers

SemeAI retains decision traces in typed domains. Receipt presence does not prove truth, correctness, safety, certification, or release authority outside the receipt's stated domain.

## Distinct artifacts

1. **Candidate artifact** — content proposed upstream of release authority.
2. **Release-decision receipt** — records the Gate evaluation and its `PROCEED`, `NEEDS_REVIEW`, or `SILENCE` outcome.
3. **Execution/result receipt** — records an execution or result that was permitted after the decision. It remains a distinct linked artifact.
4. **Repository presentation receipt** — records the bounded repository snapshot, fixed policy result, Presentation Gate state, visual metadata, and integrity hash.
5. **Skill review record** — may record candidate provenance and a review/admission decision without becoming a runtime release receipt.

Legacy `receipt_id` readers must continue to work where that identifier is part of an existing API contract.

## Integrity boundary

The Repository Evidence Benchmark canonicalizes its own receipt and produces an integrity hash. That hash detects byte-level changes to the canonical payload; it is not a signature and is not a SaC/PoR release receipt.

The Benchmark Presentation Gate states mean:

- `SHOW` — visible evidence is sufficient to display the analytical result under current business rules.
- `REVIEW` — the analytical result remains inspectable but requires evidence review.
- `BLOCK` — the score is withheld; admitted audit evidence is not deleted.

## Retention and linking

Typed receipts may reference a source commit, policy version, previous receipt, decision identifier, or execution identifier. They should not be collapsed into one universal schema when doing so would weaken the authority boundary.

Workspace access and receipt retention are not release authority. A retained trace describes what the relevant decision system observed and decided at that time.
