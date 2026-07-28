# Genesis historical evidence policy

Genesis history is generated from structured, inspectable manifests. The archive preserves selected source material; it does not automatically admit that material into the public narrative.

## Historical admission states

- `ADMIT`: provenance, timestamp, privacy, materiality, and claim boundary support a public derivative.
- `REVIEW`: provenance, timestamp, public status, conflict, or causal wording still requires human judgment.
- `WITHHOLD`: private, unsafe, irrelevant, unknown, duplicate-only, or evidence-exceeding material remains outside the public manifest.

These states belong to historical admission only. They do not replace runtime
`PROCEED / NEEDS_REVIEW / SILENCE`, Presentation Gate `SHOW / REVIEW / BLOCK`,
or SaC/PoR release authority.

Public X posts are idea and public-framing traces. They are not implementation proof. Repository commits are implementation evidence, not proof of idea origin. Forks and external references never increase first-party repository counts.

Early emergence, AGI, self-awareness, consciousness, or similar language is retained only as historical framing. It is not current SemeAI technical authority.

## Local-to-public boundary

```text
raw original
  → resumable local metadata index
  → candidate
  → provenance and privacy analysis
  → bounded claim
  → corroboration
  → historical admission
  → sanitized public derivative
```

The local index stores hashes and candidate metadata, not private transcript
text. Its archive locations are runtime arguments and never enter public
manifests. Public Genesis can be built and tested without either private
archive.

## Regeneration

1. Capture public repository facts:

   ```powershell
   node genesis/tools/capture-repository-inventory.mjs
   ```

2. Import only the curated public X records from a local archive export:

   ```powershell
   node genesis/tools/import-genesis-archive.mjs --twitter-archive "D:\path\to\twitter-export"
   ```

3. Build deterministic narrative manifests:

   ```powershell
   node genesis/tools/build-genesis-manifest.mjs
   node genesis/tools/build-historical-evidence.mjs
   ```

4. Verify source hashes, admission boundaries, fork separation, era references, milestones, and generated output:

   ```powershell
   node genesis/tests/manifest.test.mjs
   ```

The committed output contains selected public records and their media plus
sanitized, bounded historical derivatives. Account records, IP logs, contacts,
direct messages, advertising data, private conversations, and other protected
export material are never admitted.
