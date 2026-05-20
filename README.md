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

## How the scoring works

The scoring logic lives in `src/scoring.js`. It is a deterministic browser-side matcher, not an AI model and not a real employer ATS. The goal is to give a fast local signal about which resume version overlaps most with a job description.

The flow is:

1. Job descriptions are imported with `parseImportedJobs()`.
   - JSON exports from the extension are parsed as structured jobs.
   - Plain text imports are split by dividers such as `---`, `###`, or `===`.
   - The first non-empty line becomes the job title.

2. Text is normalized with `normalizeText()` and `extractAttributes()`.
   - Text is lowercased.
   - Common stop words are ignored.
   - Short aliases are expanded, such as `js` to `javascript`, `ts` to `typescript`, `ui` to `interface`, and `a11y` to `accessibility`.
   - A small phrase list keeps important multi-word attributes together, such as `design systems`, `machine learning`, `full stack`, and `stakeholder interviews`.

3. Each resume is scored against each job with `scoreResumeAgainstJob()`.
   - The app extracts attributes from the resume and the job.
   - Matched attributes are job attributes found in the resume.
   - Missing attributes are job attributes not found in the resume.
   - Score is calculated as:

```text
matched job attributes / total job attributes * 100
```

4. `rankResumeMatches()` compares every resume version against every job.
   - For each job, resume matches are sorted from highest score to lowest score.
   - The best resume version is shown as the top match for that job.

5. `clusterJobs()` groups similar jobs.
   - Each job is represented by its extracted attributes.
   - Jobs are compared with Jaccard similarity, which measures overlap between two attribute sets.
   - If a job overlaps enough with an existing cluster, it joins that cluster.
   - Otherwise, a new cluster is created.
   - The cluster tracks how often each attribute appears across its jobs.

6. `suggestMissingAttributes()` uses cluster frequency to suggest improvements.
   - It looks at the best resume for a selected job.
   - It finds cluster attributes missing from that resume.
   - Suggestions are sorted by prevalence across the cluster, so attributes that appear in more related jobs rank higher.

Because everything runs in the browser, the scoring is private and fast, but it is only as smart as the extracted text. Better resume text and cleaner job descriptions produce better matches.

## How the web app stores data

The scoring app UI lives in `src/app.js`.

- Resume versions, jobs, results, clusters, and last run metadata are stored in browser `localStorage`.
- The app can export and re-import its whole workspace as JSON with the header icon buttons.
- Resume and job uploads are read locally in the browser.
- TXT, Markdown, CSV, JSON, PDF, and DOCX files are supported where the browser can extract text.
- Extension exports can be uploaded through the job description file input.

No app data is sent to a server by this project.

## How the extension works

The extension is a Manifest V3 Chromium extension in `extension/`.

Important files:

- `extension/manifest.json` declares the extension, popup, content script, and permissions.
- `extension/content.js` runs on normal web pages and extracts job information from the current page.
- `extension/src/popup.js` drives the popup UI, storage, date selection, and downloads.
- `extension/src/job-data.js` contains the testable data helpers for normalization, grouping, filtering, and export formatting.

The extension flow is:

1. The user opens a job posting page and clicks the extension button.
2. `popup.js` asks the active tab for job data by sending an `ATS_COLLECT_JOB` message.
3. `content.js` responds with:
   - page URL
   - best title candidate
   - best company candidate
   - longest likely job description block from common page selectors
4. `normalizeCapturedJob()` cleans the capture and adds:
   - a unique id
   - `collectedAt`, an ISO timestamp
   - `collectedDate`, a local `YYYY-MM-DD` date key
5. Jobs are saved in `chrome.storage.local`.
6. `groupJobsByDate()` renders saved jobs under the date they were collected.
7. The user selects one or more dates.
8. Export buttons download a file:
   - TXT uses divider-separated job descriptions for bulk paste/file import.
   - JSON uses the structured format understood by `parseImportedJobs()`.

The extension does not directly send data into the ATS scorer. It only downloads files. The user manually imports those files into the scoring app.

## Extension permissions

The extension uses a small permission set:

- `activeTab`: read the current tab when the user clicks capture.
- `storage`: save captured jobs locally in extension storage.
- `downloads`: download selected date exports as TXT or JSON files.

Content scripts run on `http://*/*` and `https://*/*` so the capture button can work across common job boards. Data stays in local extension storage unless the user downloads an export file.
