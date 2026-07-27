# SemeAI system architecture

This document describes the public architecture visible in this repository. It is an implementation map, not a security certification or a release receipt.

## Product spine

```text
public explanation and evidence
  -> account identity and access
  -> one governed workspace per current account API
  -> operator Gate console
  -> retained decision receipt
```

The public site, private product surfaces, and evidence surfaces have distinct roles:

| Domain | Surfaces | Role |
| --- | --- | --- |
| Public | Home, Gate, Engineering Book | Explain candidate, authority, decision, and receipt boundaries |
| Product | Account, Workspace, Dashboard | Authenticate, present the governed context, and operate the Gate API |
| Evidence | Genesis, Repository Evidence Benchmark, Research, Skills | Retain provenance, inspect bounded signals, and state claim boundaries |

Account is identity and access. Workspace is a governed context container. Dashboard is the operator console. None of them replace SaC/PoR release authority.

## Authority flow

```text
candidate
  -> evidence and policy
  -> SaC/PoR Gate
  -> PROCEED | NEEDS_REVIEW | SILENCE
  -> release or withholding
  -> retained decision trace
```

`SILENCE` means release or execution is withheld while the audit trace remains. It does not mean deletion.

The Repository Evidence Benchmark has a separate display-only Presentation Gate:

```text
bounded public repository snapshot
  -> fixed evidence policy
  -> score and indicators
  -> SHOW | REVIEW | BLOCK
  -> local presentation receipt
```

`SHOW`, `REVIEW`, and `BLOCK` must not be substituted for the runtime states `PROCEED`, `NEEDS_REVIEW`, and `SILENCE`.

## Repository evidence workspace

The separate Repository Workspace implementation is designed for a GitHub App with read-only Metadata and Contents permissions:

```text
GitHub user authorization
  -> opaque server-side session
GitHub App installation and explicit repository selection
  -> short-lived installation token
  -> bounded evidence capture
  -> canonical browser analyzer
  -> retained normalized result and presentation receipt
```

Raw repository source is not retained. Installation access tokens are generated server-side for a bounded operation and discarded. Private repositories are never inferred from a matching login and do not feed public result pages.

Production GitHub connection must remain visibly unavailable until the API has both real GitHub App configuration and the exact canonical analyzer configured. A structural UI is not proof that this external dependency is live.

## Current persistence boundary

The existing account API backs identity, one workspace identity, usage, billing state, and retained Gate receipts. Conversations, sources, memory, evidence, and skills are honest structural surfaces when their persistence endpoints are unavailable.

The Repository Workspace backend uses a separate immutable GitHub numeric user identity. It is not automatically merged into the email/password account model. Any future link requires an explicit authenticated linking contract.

## Shared invariants

- Generation is not release authority.
- Candidate output is not a released answer.
- Runtime does not mutate user-visible output after the Gate.
- Retrieval is not truth.
- Raw archive is not admitted memory.
- A GitHub commit is implementation evidence, not proof of idea origin.
- A Benchmark score is not a universal repository-quality, security, or production-readiness judgment.
- A skill candidate is not an admitted skill.
- A receipt is a retained decision trace, not proof of truth.
