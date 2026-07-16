# Namecheap Private Email for semeai.tech

Operator checklist for corporate mailboxes (you create them in Namecheap UI —
this is not automated).

## Open the panel

1. Sign in: https://ap.www.namecheap.com/
2. Domain List → **semeai.tech** → manage
3. Or open Private Email product:  
   https://ap.www.namecheap.com/domains/dcp/privateemail/4271503/semeai.tech

## Recommended mailboxes

| Address | Purpose |
|---------|---------|
| `noreply@semeai.tech` | Transactional: verification, receipts (Resend/SMTP From) |
| `support@semeai.tech` | Pilot / human support |
| `billing@semeai.tech` | USDT / invoice questions |
| `anton@semeai.tech` or `hello@semeai.tech` | Founder / sales |

Minimum for SaaS launch: **noreply@** + **support@** (or route support to founder).

## Create a mailbox (Private Email)

1. Private Email dashboard for `semeai.tech`
2. **Add mailbox** / Manage mailboxes
3. Create e.g. `noreply` → set a strong password (password manager)
4. Note webmail URL (usually `https://privateemail.com/`)

## DNS (if not already set)

Namecheap usually injects MX for Private Email when the product is active:

- MX → Private Email hosts (per Namecheap docs for your plan)
- Optional: SPF `v=spf1 include:spf.efwd.registrar-servers.com ~all` (confirm in panel)
- DKIM / DMARC as offered in Private Email settings

Propagation: 15 min – 48 h. Check:

```text
https://mxtoolbox.com/SuperTool.aspx?action=mx%3asemeai.tech
```

## Wire Resend (recommended for product mail)

Product API already uses Resend-style env:

- `SEMEAI_GATE_EMAIL_FROM=noreply@semeai.tech`
- `SEMEAI_GATE_EMAIL_FROM_NAME=SemeAI Gate`
- `SEMEAI_GATE_RESEND_API_KEY=re_...`

In Resend:

1. Add domain `semeai.tech`
2. Add the DNS records Resend shows (SPF/DKIM)
3. Verify domain
4. Send only from verified addresses (e.g. `noreply@semeai.tech`)

**Note:** Private Email (human inbox) and Resend (transactional) can coexist.
SPF should authorize both if you use both — merge carefully (one SPF record).

## Fly secrets (API)

```powershell
fly secrets set SEMEAI_GATE_EMAIL_FROM=noreply@semeai.tech SEMEAI_GATE_EMAIL_FROM_NAME="SemeAI Gate" -a semeai-gate-api
# set RESEND key separately if rotated
```

## After creation

1. Log into webmail as `noreply@` and `support@`
2. Send a test to Gmail/Outlook — check spam
3. Update site contact when ready: prefer `support@semeai.tech` over personal Gmail
4. Keep personal Gmail as operator backup until DNS/Resend is fully green
