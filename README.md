# Waypost

An honest, local-first toolkit for students and jobseekers. Evidence-based resume
matching, GPA planning, application tracking, and offer comparison, from one
private workspace. MIT licensed. Made by [tanziro.com](https://tanziro.com).

[Live demo](https://tanzir71.github.io/waypost/) ·
[Milestone progress](PROGRESS.md) · [Implementation spec](HANDOVER.md) ·
[Agent documentation](llms.txt)

## Current release

M4 adds [GPA planning](https://tanzir71.github.io/waypost/app/gpa/),
[Final needed](https://tanzir71.github.io/waypost/app/finals/), and
[Scale converter](https://tanzir71.github.io/waypost/app/scales/).
The workspace also includes [Today](https://tanzir71.github.io/waypost/app/),
[Tracker](https://tanzir71.github.io/waypost/app/tracker/),
and [reviewed imports](https://tanzir71.github.io/waypost/app/import/) to
[Honest Match](https://tanzir71.github.io/waypost/app/match/),
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
Supporting tools, PWA installation and sync remain Coming soon until their milestones.
Pricing sources are dated in data/competitors.json.

Today derives next actions, recent pipeline counts and per-resume reply rates
from your records. Tracker has a board, a sortable table, native Move to controls,
N for a new job and M to move the selected card. Keep the resume used, notes,
contacts, next step/date and stage history with each application. Export JSON
from Today saves the workspace without credentials or internal keys.

GPA planning shows the needed average, actual formula and maximum achievable
CGPA. Save terms and courses, pin target grades, set difficulty 1–3, and solve a
deterministic greedy mix for a semester or all planned terms. Trend bars have a
table twin; reported term GPAs are labelled. Retake what-ifs support replace,
average and both-count policies. Edit a scale to save a custom copy.

Final needed validates a total weight of 100%, computes every grade cutoff,
and can save categories to a linked GPA course. Scale conversions show their
methods, confidence and limitations. ECTS requires real cohort counts; custom
institution tables are editable and exportable. All study inputs and custom
tables are retained in workspace exports. Share links keep inputs in fragments.

Study fixtures reproduce 3.78 needed, a 3.81 supplied mix, final targets
61.8 / 74.3 / 49.3 / 36.8 (maximum 90.3), and 72.4% / 9.05 conversions.
The mockup's UK 2:1 label conflicts with its percentage method: 72.4% falls in
the First band, so this implementation labels it First (estimate), following
[the published UK bands](https://student.sussex.ac.uk/your-studies/degree).
The supplied mix is distinct from the greedy solver's concentrated upgrades.

Waypost Clipper 2 is an MV3 extension. Reading is click-triggered; its required
permissions are exactly activeTab, storage, downloads and scripting. Configure
the app URL and a local default resume in Options. Send to Waypost opens a private
fragment import for review and confirmation. TXT/JSON date exports remain
compatible. Optional site chips need per-origin opt-in and permission; no content
script runs on every site by default. See extension/README.md.

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
generated pages. After changing shared core, schema, tokens or bundled assets,
run `node scripts/build-extension.mjs`; its committed bundle is checked against
the canonical sources and uses the same matching engine. Pure logic belongs in core/. No frameworks, runtime
npm dependencies, CDNs, analytics, or GitHub Actions. Static Pages deploys the
root of main directly, including .nojekyll. HANDOVER.md defines M0–M7.

Fonts and their OFL licenses live in assets/fonts/. Figma design tokens are
copied unchanged from handover/tokens.css to ui/tokens.css. `npm run check` also
checks JavaScript syntax, pinned parser integrity, static accessibility, local
asset references and route synchronization. Tests use Node and contract fakes;
no browser automation, network, npm installs or owner QA is required.
