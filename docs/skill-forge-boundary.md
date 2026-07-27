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

## Registry state

The initial public registry may contain `CANDIDATE` or `REVIEW` entries while containing zero admitted skills. Distribution and commerce remain dependency-held until multiple useful admitted skills, installation, versioning, evaluation, provenance, permissions, demand, payment, legal, and operator contracts exist.

Skill admission does not itself create marketplace readiness or runtime release authority.
