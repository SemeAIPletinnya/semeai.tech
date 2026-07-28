# Skill Forge candidate and admission boundary

Skill Forge is currently an evidence and review foundation, not an autonomous skill marketplace.

```text
recurring workflow evidence
  -> method extraction
  -> skill candidate
  -> evaluation and human review
  -> explicit admission or rejection
  -> registry metadata
```

A generated `SKILL.md` is only a candidate. Codex, a repository, a benchmark score, or a successful test run cannot unilaterally admit it.

## Candidate evidence

A candidate record may retain:

- source method hash and provenance;
- exact job-artifact hashes where publication is permitted;
- starting and final repository commits when captured;
- commits and test commands;
- blockers and human interventions;
- missing measurements represented as `null`, never invented;
- compatibility and capability declarations;
- a review state.

Authenticated workspaces can retain the bounded public candidate-evidence snapshot through the deployed API. Retention stores metadata and evidence, not raw skill content. It cannot set admission, availability, installation, or a decision receipt.

## Registry state

The public registry currently contains the GET JOB and GET VIS candidates in `REVIEW` with zero admitted skills. A separate operator-only admission endpoint exists, but its authority is independently configured and admission is disabled by default. An admission decision creates a distinct append-only decision receipt; it does not create runtime release authority.

Distribution and commerce remain dependency-held until useful admitted skills, installation, versioning, evaluation, provenance, permissions, demand, payment, legal, and operator contracts exist.

Skill admission does not itself create marketplace readiness or runtime release authority.
