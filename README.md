# Waypost

An honest, local-first toolkit for students and jobseekers. Evidence-based resume
matching, GPA planning, application tracking, and offer comparison, from one
private workspace. MIT licensed. Made by [tanziro.com](https://tanziro.com).

[Live demo](https://tanzir71.github.io/waypost/) ·
[Milestone progress](PROGRESS.md) · [Implementation spec](HANDOVER.md) ·
[Agent documentation](llms.txt)

## Current release

M2 ships [Honest Match](https://tanzir71.github.io/waypost/app/match/),
[Parse check](https://tanzir71.github.io/waypost/app/parse/), and
[Resumes](https://tanzir71.github.io/waypost/app/resumes/), alongside the landing
demo. Paste or bulk-import jobs, compare every saved resume in a worker, and
inspect exact evidence, knockout questions and gaps across similar jobs.

Import PDF, DOCX, plain text or JSON Resume files. Parse check shows reading
order, sections and flagged lines, with an exact plain-text download. Resume
versions include side-by-side and inline diffs, word highlights, median match
tiers, and an effect comparison over common scored jobs. The landing demo also
accepts these file formats. PDF.js and Mammoth load only when needed, from
vendor/ on this origin; licenses and a SHA-256 file manifest are included.

Workspace records live in IndexedDB (`waypost`, version 1); original uploads live
in OPFS where supported. If original-file storage is unavailable, the app says
so and retains the extracted text. Legacy ats-scoring:v1 data is migrated once,
recomputing evidence reports and keeping the original localStorage backup.
Demo mode seeds twelve jobs and three versions once. Clear sample data keeps
personal records. Light, Dark and System appearance are available in the footer.
Study, tracking and supporting tools remain Coming soon until their milestones.
Pricing sources are dated in data/competitors.json.

The shared match engine uses BM25 evidence retrieval, skill aliases, Porter
stemming, dated tenure with overlap merging, and separate knockout questions.
Required coverage determines the match with a conservative preferred bonus of
at most 0.02 (below the handover's 0.05 cap). Keyword coverage is secondary.
The hero fixture reproduces Good: four met, one partial, one missing. The Northwind
fixture reproduces Strong: nine of eleven required and three of four preferred
met. The 50-jobs × 5-versions benchmark must finish below 300 ms in Node.
The vocabulary includes an attributed O*NET® subset; see data/skills/LICENSE.md.

## Run and verify

Node 20+ is the only test prerequisite. No npm installation, network, browser,
or account is needed to run checks.

```sh
npm run check
python -m http.server 4173
```

Serve this directory, then open http://localhost:4173/. To test a subdirectory,
serve its parent and open /ats-scoring/; config.js detects the deployment root.
On GitHub Pages, mode auto becomes demo; other hosts default to pwa. Sync and AI
remain off. Later milestones add offline installation and optional sync.

## Develop and deploy

Edit app/_shell.html, then run `node scripts/build-routes.mjs` and commit the
generated pages. Pure business logic belongs in core/. No frameworks, runtime
npm dependencies, CDNs, analytics, or GitHub Actions. Static Pages deploys the
root of main directly, including .nojekyll. HANDOVER.md defines M0–M7.

Fonts and their OFL licenses live in assets/fonts/. Figma design tokens are
copied unchanged from handover/tokens.css to ui/tokens.css. `npm run check` also
checks JavaScript syntax, pinned parser integrity, static accessibility, local
asset references and route synchronization. Tests use Node and contract fakes;
no browser automation, network, npm installs or owner QA is required.
