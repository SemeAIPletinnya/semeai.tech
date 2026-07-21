# SemeAI Engineering Book Maintenance

The Engineering Book lives at:

- `book/index.html`
- public route: `https://semeai.tech/book/`

It is intentionally implemented as a static publication so the public site can stay on GitHub Pages without adding a framework or build step.

## Edit content

Most editable text is centralized in:

- `assets/js/book-content.js`

Update only verified public links and conservative claims. Do not add customer, revenue, certification, production adoption, grant, or security claims unless there is evidence that can be shared.

## Edit visual system

The book-specific visual system is:

- `assets/css/book.css`

The book does not depend on the main landing page CSS. This keeps the editorial publication isolated from ordinary product pages.

## Print / PDF workflow

1. Open `https://semeai.tech/book/`.
2. Use the `Print / PDF` control in the book navigation, or open browser print manually.
3. Destination: `Save as PDF`.
4. Layout: `Landscape`.
5. Background graphics: enabled.
6. Margins: default or none, depending browser preview.

The print stylesheet uses A4 landscape page breaks and hides interactive navigation.

Optional local headless export, without browser headers or footers:

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = "file:///D:/SemeAi/from%20git/semeai.tech/book/index.html?print=1"
& $chrome --headless=new --disable-gpu --allow-file-access-from-files --print-to-pdf="$env:TEMP\semeai_engineering_book.pdf" --no-pdf-header-footer $url
```

## Local verification

Open locally:

```powershell
Start-Process "D:\SemeAi\from git\semeai.tech\book\index.html"
```

Recommended checks:

```powershell
git diff --check
```

For deployment, the existing GitHub Pages workflow uploads the static site artifact.

## Claim discipline

Safe framing:

> SemeAI is an independently built AI engineering ecosystem exploring observable AI systems, local knowledge workspaces, release-control architecture, runtime governance, memory, evidence, receipts, replay, and inspectable decision processes.

Core thesis:

> Generation creates a candidate. Release is a separate decision.

Avoid:

- AGI
- universal AI safety
- universal hallucination prevention
- certified compliance
- production-grade security
- autonomous governance
- guaranteed correctness
- industry-leading
- enterprise customer claims without proof
