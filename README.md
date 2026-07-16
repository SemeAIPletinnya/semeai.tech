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
| `account.html` | Redirect → dashboard | — |

## Shared assets

- `assets/css/site.css` — product site design system (void / cyan)
- `assets/js/site-shell.js` — sticky nav, footer, canvas
- `assets/js/api.js` — API client for `https://api.semeai.tech`
- `assets/css/semeai.css` / `product.css` / `shell.js` — legacy (phasing out)

## API dependency

Site talks to [semeai-gate-basic](https://github.com/SemeAIPletinnya/semeai-gate-basic) on `api.semeai.tech`.

Governance source: [silence-as-control](https://github.com/SemeAIPletinnya/silence-as-control).

## Partner docs (in gate-basic)

- [Pilot packet (1-pager)](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/pilot_packet.md)
- [Integration checklist](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/integration_checklist.md)
- [Architecture ADR](https://github.com/SemeAIPletinnya/semeai-gate-basic/blob/master/docs/architecture_adr_v0_1.md)

## Pilot billing

- USDT / TRC20: `TJmrrUrpsRpG3u9H4FE9oVyCRPYQYEpG27`
- Default: 25 USDT
- Review email: `support@semeai.tech` · founder: `anton_semenenko@semeai.tech`
