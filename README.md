# Waypost

An honest, local-first toolkit for students and jobseekers. Evidence-based resume
matching, GPA planning, application tracking, and offer comparison, from one
private workspace. MIT licensed. Made by [tanziro.com](https://tanziro.com).

[Live demo](https://tanzir71.github.io/waypost/) ·
[Milestone progress](PROGRESS.md) · [Implementation spec](HANDOVER.md) ·
[Agent documentation](llms.txt)

## Current release

M6 adds optional encrypted sync with PHP/SQLite or a Cloudflare Worker, real
[setup checks](https://tanzir71.github.io/waypost/app/setup/), recovery codes,
and a [self-hosting package](downloads/waypost-self-host.zip). Read the
[server guide](server/README.md) for deployment and the encryption protocol.
M5 added offline support, a keyboard command palette,
[Settings](https://tanzir71.github.io/waypost/app/settings/) and
[agent tools](https://tanzir71.github.io/waypost/app/agents/).
The study tools include [GPA planning](https://tanzir71.github.io/waypost/app/gpa/),
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
Offer comparison, Deadlines, Letters & outreach, Story bank and Contacts are
available as M7 features. Optional AI writing is available and stays off by default.
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

Offer compare uses your annual compensation, vesting/cliff details, benefits
value and cost-of-living index; no salary, exchange-rate, tax or index service
is queried. Import `city,index` CSV data and explicitly apply a city while
editing an offer. Priority sliders must total 100%; compensation is relative
to the best entered adjusted total, while growth/flexibility/team ratings come
from you. Missing ratings leave weighted scores uncomputed. A partial-year
cliff needs an explicit vested-equity estimate. The labelled year-1 cash
estimate includes entered benefits and target bonus and is not take-home pay.
Fixtures reproduce £110,600 total, £105,488 adjusted and £98,600 year-1 cash.
Offers and priorities survive exports/imports and encrypted sync. Private input
links prefill without saving; calculation needs Compare offers or autorun=1.

Deadlines has a Monday-start month calendar and a next-ten-days agenda. Saved
entries join Tracker next steps, offer decisions and dated finals, with linked
course target details from the shared final calculator. Add/edit/delete entries
or save an optional exam date in Final needed. Today also includes upcoming
offer/final dates. Static ICS downloads work offline and use RFC 5545 all-day
events, stable UIDs, CRLF endings and UTF-8 folding at 75 octets.

Calendar subscriptions require sync plus a separate publishing acknowledgement.
Selected titles/dates become plaintext on your server, accessible to anyone with
the revocable URL. Any unlocked synced device can keep the feed current. URL
tokens stay out of exports and result JSON. Revocation, key recovery and vault
deletion invalidate URLs; disconnecting sync leaves published feeds online.
Calendar apps may keep prior copies. See [server setup and upgrade notes](server/README.md)
for PHP's in-place migration and the one-time M6 D1 upgrade script.

Letters & outreach composes cover letters, referral/advice requests and
follow-ups from the evidence blocks you choose. Resume evidence comes from
the same requirement matcher; saved STAR stories contribute their action and
result text. Map blocks to requirements, add your own facts, edit the subject
and draft, save/copy drafts, and copy or download TXT. No message is sent.
Private input links and unsaved Match reports can prefill writing inputs
without saving their source text. Saved drafts retain copied evidence and its
provenance, and protect referenced sample stories/contacts when samples clear.

Story bank supports editable situation/task/action/result fields and skill
tags, including explicitly labelled incomplete drafts. Contacts stores people,
notes, safe links, interaction history and reminder dates. Tracker can link
contacts to applications; contact reminders appear in Today, and a contact can
prefill an outreach recipient. All these records work offline, survive reviewed
workspace backups and use the existing encrypted sync when it is enabled.

Optional AI rewrites English text selected in the letter editor (or the whole
draft, up to 12,000 characters). Settings offers Off, Chrome built-in and OpenAI
BYOK. Chrome availability is feature-detected; model preparation/download is an
explicit action and writing stays on-device. BYOK requires your own same-origin
HTTPS PHP/Worker relay, a model ID and API key; it is disabled on GitHub Pages.
The request dialog shows the selected text and off-device warning before sending.
Only that selection and writing instructions are sent, without resume/job context.
Every suggestion shows a complete accept/reject diff. Quantified sentences are
locked verbatim; suggestions adding/changing/removing them are rejected. Review
the other facts and meaning yourself. Accept changes only the editor, then save
separately. Errors, cancellation, rejection and stale reviews preserve your text.
Keys stay in internal device settings, excluded from exports, sync and result
JSON. Forget AI key turns AI off and removes the stored key. Imported workspaces
always leave connections off. See [optional relay setup](server/README.md#optional-ai-relay).

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
remain off until explicitly enabled. Encrypted sync requires a same-origin HTTPS
PHP or Worker deployment; GitHub Pages serves the static demo and package only.

## Offline and browser integration

The app registers a versioned service worker and caches the shell, every route,
fonts, scripts, scale data and documentation. PDF/DOCX parsers are loaded and
cached on first use; use them once online before opening those formats offline.
Updates wait for the “New version ready — Reload” action. The offline banner
shows when the browser reports no connection. Nothing is synced until you opt in.
After setup, encrypted sync follows local edits and reconnects automatically;
Settings also offers manual sync, disconnect and server-vault deletion. Recovery
replaces keys atomically and invalidates the old passphrase and recovery codes.
Device keys, authentication and recovery codes never enter workspace exports.

Installation is offered after a second browser session, never the first visit.
iOS shows Share → Add to Home Screen instructions.
File handlers and OS job sharing are available where the browser supports them.
Opened files and shared jobs are reviewed before saving. Workspace JSON imports
merge by update time, keep newer local records, and leave connections off.
JSON exports and supported folder backups exclude credentials and original files.

Ctrl+K / ⌘K opens a command dialog with tools, actions and saved-record jumps.
Try “plan gpa 3.6”. Commands are ordinary URLs. Private tool inputs stay in
fragments; without `autorun=1`, input links only prefill. Autorun calculations
do not save raw inputs, course edits or application records. Agent application
writes require an in-page confirmation. WebMCP is feature-detected through
`document.modelContext`, with a legacy `navigator.modelContext` fallback;
unsupported browsers retain the native controls and links. See
[the current browser API](https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools).

## Develop and deploy

Edit app/_shell.html, then run `node scripts/build-routes.mjs` and commit the
generated pages. After changing shared core, schema, tokens or bundled assets,
run `node scripts/build-extension.mjs`; its committed bundle is checked against
the canonical sources and uses the same matching engine. Pure logic belongs in core/. No frameworks, runtime
npm dependencies, CDNs, analytics, or GitHub Actions. Static Pages deploys the
root of main directly, including .nojekyll. HANDOVER.md defines M0–M7.

After changing runtime files or docs, run `node scripts/build-docs.mjs` followed
by `node scripts/build-precache.mjs`. Commit precache.js: its content hash drives
offline updates and the release check verifies it is current. PWA icons are
committed PNGs rendered from the unchanged local Figma Logo A; the optional
asset-build script uses PyMuPDF and is not needed to run tests or deploy.

Fonts and their OFL licenses live in assets/fonts/. Figma design tokens are
copied unchanged from handover/tokens.css to ui/tokens.css. `npm run check` also
checks JavaScript syntax, pinned parser integrity, static accessibility, local
asset references and route synchronization. Tests use Node and contract fakes;
no browser automation, network, npm installs or owner QA is required.
