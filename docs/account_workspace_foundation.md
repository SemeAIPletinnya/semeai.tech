# SemeAI Account & Workspace Foundation v0.1

## Product boundary

```text
Public SemeAI
  -> Account (identity and access)
  -> Workspace (governed context container)
  -> Operator Dashboard (Gate operations)
```

Generation is not release authority. Workspace access is not release authority. The existing SaC/PoR Gate remains the final release authority.

## Current persistence authority

v0.1 represents one account as one real governed workspace. The current account API does not expose user-facing workspace list, create-secondary, rename, or delete endpoints, so the client does not simulate those capabilities.

Connected through the existing `assets/js/api.js` contract:

- registration and email verification;
- email/password session login and logout;
- account and workspace identity;
- usage and remaining checks;
- subscription and billing state;
- retained decision receipts;
- immutable bounded skill-candidate evidence snapshots.

Structurally present but explicitly not connected in v0.1:

- conversations;
- sources;
- memory;
- evidence.

Those surfaces render no localStorage records, sample files, fabricated counts, or fake activity.

## Routes

- `/account/` — signed-out access and signed-in identity summary.
- `/workspace/` — authenticated governed-context shell.
- `/account.html` — compatibility redirect that preserves query and hash data.
- `/dashboard.html` — unchanged operator / Gate console.

The shared public header uses locally known session storage only to select `/account/` or `/workspace/`. It performs no speculative authentication request.

## Data handling

The new client uses the existing bearer-session handling in `assets/js/api.js`. API data is rendered with DOM node creation and `textContent`. Receipt filesystem paths are not displayed. Verification API keys are shown from the one-time response only and are not persisted by the new page.

Both private routes declare `noindex,nofollow,noarchive` and restrict their page-level CSP to local assets plus `https://api.semeai.tech`.

## Deliberately absent

- multi-workspace simulation;
- social authentication;
- local conversation/source/memory/evidence persistence;
- Gate, Benchmark, receipt, or SaC/PoR changes.

Skill candidate retention uses the workspace session and stores no raw skill source. Admission is a separate, operator-authorized contract, disabled by default, and never becomes SaC/PoR release authority.
