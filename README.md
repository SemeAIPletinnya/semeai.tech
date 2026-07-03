# semeai.tech

Static public landing page for SemeAI.

This repo is intentionally small:

- `index.html` is the main public landing page.
- `gate.html` is the business-readable SemeAI Gate product contract page.
- `article.html` explains the "Generation is not release authority" thesis
  with Ukrainian and Russian UI summaries.
- `research.html` collects public proof links: SSRN, Zenodo, GitHub, and
  Silence-as-Control.
- `self-hosted.html` explains the private/VPC deployment path for companies
  that cannot send documents outside their infrastructure.
- `register.html` is the early-access registration entry point and links back
  to the live registration form.
- `account.html` is a browser-safe account console. It asks the user to paste
  their issued API key locally, then calls `/v0/account`, `/v0/receipts`, and a
  protected deterministic `/v0/check` smoke test. It does not embed a shared API
  key and does not store the key in browser storage.
- `CNAME` binds GitHub Pages to `semeai.tech`.
- The early-access registration section is a static intake surface. It does
  not collect passwords and does not store customer data server-side.

Related surfaces:

- Product demo: <https://gate.semeai.tech>
- SemeAI Gate page: <https://semeai.tech/gate.html>
- Self-hosted deployment: <https://semeai.tech/self-hosted.html>
- Article: <https://semeai.tech/article.html>
- Research links: <https://semeai.tech/research.html>
- Registration entry: <https://semeai.tech/register.html>
- Account console: <https://semeai.tech/account.html>
- API health: <https://api.semeai.tech/health>
- Basic open-source gate: <https://github.com/SemeAIPletinnya/semeai-gate-basic>

Canonical values remain unchanged:

- Business actions: `SHOW`, `REVIEW`, `BLOCK`
- Internal decisions: `PROCEED`, `NEEDS_REVIEW`, `SILENCE`
- Mapping: `SHOW = PROCEED`, `REVIEW = NEEDS_REVIEW`, `BLOCK = SILENCE`
