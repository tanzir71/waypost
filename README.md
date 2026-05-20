# ATS Resume Toolkit

Static GitHub Pages toolkit for resume matching and job collection. The root page is a landing page, the scorer lives at `/app/`, and the browser extension lives in `extension/`.

All scoring data is stored in browser `localStorage`. Extension captures are stored in extension-local browser storage until the user downloads an export file.

## Local checks

```bash
npm test
python -m http.server 4173
```

Open:

- Landing page: `http://localhost:4173`
- ATS scorer: `http://localhost:4173/app/`

## Browser extension

Load `extension/` as an unpacked Chromium extension. Use the popup on a job page to capture the title, link, and visible job description text. Jobs are grouped by collection date; select one or more dates and download TXT or JSON. Import that downloaded file manually in the ATS scorer.
