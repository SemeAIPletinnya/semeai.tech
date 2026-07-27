# Genesis historical evidence policy

Genesis history is generated from structured, inspectable manifests. The archive preserves selected source material; it does not automatically admit that material into the public narrative.

## Admission states

- `ARCHIVED`: preserved original, not automatically part of the narrative.
- `REVIEWED`: provenance, date, and context were inspected.
- `ADMITTED`: supports a specific bounded Genesis transition.
- `WITHHELD`: preserved but excluded because provenance, relevance, or context is insufficient.

Public X posts are idea and public-framing traces. They are not implementation proof. Repository commits are implementation evidence, not proof of idea origin. Forks and external references never increase first-party repository counts.

Early emergence, AGI, self-awareness, consciousness, or similar language is retained only as historical framing. It is not current SemeAI technical authority.

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
   ```

4. Verify source hashes, admission boundaries, fork separation, era references, milestones, and generated output:

   ```powershell
   node genesis/tests/manifest.test.mjs
   ```

The committed output contains selected public records and their media only. Account records, IP logs, contacts, direct messages, advertising data, and other private export material are never ingested.
