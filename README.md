# semeai.tech

Public product site for **SemeAI Gate**.

## Pages

| Page | Role | Visual system |
| --- | --- | --- |
| `index.html` | Marketing home | void/cyan (standalone) |
| `register.html` | Workspace registration + verify | void/cyan (standalone) |
| `dashboard.html` | Keys, checks, receipts, billing | void/cyan (standalone) |
| `gate.html` | Product contract | shared `site.css` |
| `self-hosted.html` | Deployment modes | shared `site.css` |
| `research.html` | Public proof links | shared `site.css` |
| `article.html` | Thesis (EN/UA/RU) | shared `site.css` |
| `account.html` | Redirect -> dashboard | shared `site.css` |
| `book/index.html` | Engineering Book | standalone `book.css` |

## Shared assets

- `assets/css/site.css` - product site design system (void / cyan)
- `assets/css/book.css` - Engineering Book publication system
- `assets/js/site-shell.js` - sticky nav, footer, canvas
- `assets/js/book-content.js` / `book.js` - Engineering Book content and renderer
- `assets/js/api.js` - API client for `https://api.semeai.tech`
- `assets/css/semeai.css` / `product.css` / `shell.js` - legacy (phasing out)

## API dependency

Site talks to [semeai-gate-basic](https://github.com/SemeAIPletinnya/semeai-gate-basic) on `api.semeai.tech`.

Governance source: [silence-as-control](https://github.com/SemeAIPletinnya/silence-as-control).

## Engineering Book

The Engineering Book is a premium static publication at `/book/`.

It explains Anton Semenenko and the SemeAI ecosystem without turning the site into a resume or a generic SaaS landing page. The editable content lives in `assets/js/book-content.js`, and the print/PDF workflow is documented in `docs/engineering_book_maintenance.md`.

## Ecosystem role

SemeAI is organized as dependent layers:

- `silence-as-control` - governance source context and benchmark evidence;
- `semeai-gate-basic` - open-source adapter, API contract, examples, receipts, and pilot runtime;
- `semeai.tech` - landing, registration, account shell, live demo, and research links.

## Deployment modes

The product story is intentionally hybrid:

- Open Source - teams can inspect and run the basic release-control adapter themselves.
- Self-hosted Enterprise - sensitive teams can deploy inside their own infrastructure or VPC so documents do not leave their boundary.
- SaaS API - teams that want the fastest start can call the hosted `api.semeai.tech` endpoint.

This matters for privacy objections: SemeAI does not require a company to send sensitive documents to the hosted SaaS. The same contract can be run locally or self-hosted when data residency matters.

The canonical dependency contract lives in
[docs/ecosystem_contract.md](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/ecosystem_contract.md).

## Partner docs (in gate-basic)

- [Pilot packet (1-pager)](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/pilot_packet.md)
- [Integration checklist](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/integration_checklist.md)
- [Architecture ADR](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/architecture_adr_v0_1.md)

## Pilot billing

- USDT / TRC20: `TJmrrUrpsRpG3u9H4FE9oVyCRPYQYEpG27`
- Default: 25 USDT
- Review email: `support@semeai.tech` / founder: `anton_semenenko@semeai.tech`
