# Waypost progress

Live demo: https://tanzir71.github.io/waypost/

| Milestone | Status | Tag | Look at |
|---|---|---|---|
| M0 Rename, scaffold, Pages | done | m0 | / and /app/ |
| M1 Landing | done | m1 | / |
| M2 Match, parse, resumes | done | m2 | /app/match/, /app/parse/, /app/resumes/ |
| M3 Today, tracker, clipper | done | m3 | /app/, /app/tracker/, /app/import/ |
| M4 Study tools | done | m4 | /app/gpa/, /app/finals/, /app/scales/ |
| M5 PWA, agents, settings | done | m5 | /app/settings/, /app/agents/, /agents/, /app/share/ |
| M6 Encrypted sync | done | m6 | /app/setup/, /downloads/waypost-self-host.zip |
| M7 Offers and supporting tools | in progress | | /app/offers/, /app/deadlines/, /app/letters/, /app/contacts/ |

## M0

- History scan found no secret-pattern matches in the two original commits.
- Renamed tanzir71/ats-scoring to tanzir71/waypost and made it public.
- Configured GitHub Pages to publish main from / with no Actions workflow.
- Committed line-ending normalization independently.
- Added 17 committed route pages, auto-mode config, local fonts and licenses,
  Figma tokens and icons, demo seed, schema, MIT license, and offline local checks.
- Tool routes currently show Coming soon. The landing page is a placeholder.
- Validation: 16 Node tests pass, route pages match the shell, and the runtime
  source scan finds no external URLs. Removed the retired UI's PDF CDN loader;
  M2 will replace it with self-hosted parsers. Original scoring tests still pass.
- Following HANDOVER.md §12.0's direct-main workflow; AGENTS.md's PR instruction
  conflicts with the task's explicit handover implementation workflow.

## M1

- Implemented the desktop and mobile landing sections with the supplied tokens,
  downloaded Figma assets, native controls, and light/dark/system appearance.
- Live hero matching calls core/match; the committed Figma fixture reproduces
  Good with four met, one partial and one missing. Exact resume lines are shown;
  missing requirements never receive invented evidence.
- Plain text resume upload, JSON copy/download, mobile navigation, and expandable
  mobile tool list work locally. PDF/DOCX upload and full tool views remain M2.
- Added dated, source-linked pricing and privacy/FAQ documentation. Unshipped
  tools, PWA installation, and sync remain explicitly marked Soon.
- Preferred evidence contributes a conservative bonus of at most 0.02, below
  the handover's 0.05 ceiling, preserving the hero's Good fixture.
- Validation: 27 Node tests, static accessibility, same-origin asset/import
  references at /waypost/, route synchronization, no-external-resource scan,
  JavaScript syntax and git whitespace checks. No browser or owner QA required.
- Pages URL: https://tanzir71.github.io/waypost/

## M2

- Added the complete Honest Match workspace: bulk import, tier filters, per-resume
  tabs, required/preferred evidence, checks, peer gaps, explicit knockout answers,
  JSON exports, letter handoff and confirmed tracker saves. Scoring runs in a
  module worker with prepared resume/job indexes and the same pure core as the hero.
- Northwind fixture passes: Strong, 9/11 required and 3/4 preferred met, six dated
  years. The 50 jobs × 5 versions benchmark runs below the 300 ms gate.
- Parse check shows exact extracted text, sections, reading-order warnings, contact
  placement, dates, glyphs, Unicode quality, length and quantified bullets. Font
  embedding is labelled unverified when the parser does not expose that metadata.
- Resumes supports PDF, DOCX, TXT and JSON Resume imports; editable text versions;
  side-by-side/inline line and word diffs; common-job matching effects; default
  resume selection; and truthful sent/reply counts from application history.
- Added IndexedDB v1, UUIDv7 record metadata, atomic one-time demo seeding and
  legacy migration, tombstones, change records, persistence requests, OPFS originals
  where supported, and a clear storage-failure message. Legacy scores are archived
  and recomputed as evidence reports; the localStorage original and backup remain.
- Vendored PDF.js 6.5.438 and Mammoth 1.13.0 with supporting local resources,
  licenses, version records and SHA-256 integrity checks. Parsers load on upload.
- Added an attributed O*NET® 31.0 Software Skills label subset under CC BY 4.0.
- Updated the landing widget's uploads, shipped tool labels, docs, privacy,
  appearance control and route pages. No external runtime requests were added.
- Validation: 44 Node tests (including storage/parser contract fakes), route and
  base-path checks, static accessibility, no-external-resource scan, JavaScript
  syntax and vendor integrity. All pass without browser automation or owner QA.
- Pages URLs: /app/match/, /app/parse/, /app/resumes/ under the live demo root.

## M3

- Added Today with due follow-ups, interviews, near deadlines, unique unanswered
  knockouts, recent pipeline counts, shared per-resume reply rates, recent best
  matches, local storage estimate and credential-free workspace JSON export.
- Added Tracker board and sortable native table, all six stages with Closed
  collapsed, native Move to selects, N/M shortcuts, editable role/company/link,
  resume used, next step/date, notes, contacts and append-only stage history.
- Added reviewed imports for private #job links, Clipper TXT/JSON exports, pasted
  descriptions and resume files. Save jobs, Save & score and Save to tracker
  require an explicit in-page action. UTF-8 payloads round-trip; large links use
  file export/import without truncating job text.
- Upgraded Waypost Clipper to MV3 version 2. Required permissions are exactly
  activeTab, storage, downloads and scripting. Removed all-URL content scripts.
  Capture injects on click; default resume and deployment URL are set in Options.
  Optional site chips require both per-origin opt-in and a granted permission.
- The extension's committed bundle is generated from the app's canonical core,
  schemas, data, styles and local assets; matcher parity and bundle sync are tested.
  JSON data modules support extension service workers without import assertions.
- Preserved capture date TXT/JSON formats and description paragraph structure.
  Added safe URL validation, schema bounds, sample dependency protection, one-time
  M3 examples for existing demos, mobile tool navigation and Figma-aligned cards.
- Validation: 56 Node tests pass, including extension API/service-worker fakes,
  schema validation, UTF-8 private links, stage transitions, response rates, Today
  aggregation and migration. Static a11y, routes, syntax, same-origin resources,
  vendor integrity and extension bundle checks also pass. No owner QA required.

## M4

- Shipped GPA planning with current/target CGPA, completed/remaining credits,
  reachability, maximum achievable CGPA and the actual formula. Save terms and
  courses, select a semester or all planned terms, lock target grades, set
  difficulty 1–3, and solve the deterministic greedy mix. Today uses the saved
  result. Each course links to its final exam calculator.
- Added replace, average and both-count retake what-ifs with explicit counted
  credit assumptions; reported or computed term trends with a real table twin;
  and editable custom grade scales. Built-in tables cover Bangladesh UGC, an
  illustrative US plus/minus pattern, and the labelled common Indian pattern.
- Final needed validates a 100% weight total and exactly one unknown category,
  saves categories to linked courses, and shows every cutoff, reachability and
  maximum score. Scale conversion shows methods, confidence, cohort-based ECTS
  only with supplied counts, and editable/exportable institution tables.
- Study settings and institution tables survive workspace exports; arbitrary
  credential fields are excluded. Existing demos receive the study examples once;
  clearing samples prevents them from being silently seeded again.
- Validation: all 66 Node tests and release checks pass. Fixtures reproduce
  3.78 needed; the supplied mix 3.81; final targets 61.8 / 74.3 / 49.3 / 36.8
  with maximum 90.3; and 72.4% / 9.05 conversions. Native DOM/IDB contract tests
  exercise real views, fresh workspace saves, course-linked finals and custom
  institution mappings. Static accessibility, nested paths, routes, local assets,
  parser integrity, syntax and extension parity also pass.
- The complete check exposed a cold-batch performance failure. Reused normalized
  inputs, job preparation and requirement evidence within one batch, with separate
  mutable report rows and no retained text cache. The unchanged 250-report gate
  now passes at about 136 ms in the full suite. Standalone-vs-batch evidence,
  independent rows and per-job knockout answers have regression coverage.
- Figma/spec discrepancies are resolved through the stated formulas: the UK
  percentage method maps 72.4% to First (estimate), not the mockup's 2:1, following
  [published UK bands](https://student.sussex.ac.uk/your-studies/degree). The supplied
  A/A/A+/A/A mix averages 3.81; the mandated greedy rule may concentrate upgrades
  differently. The C→A three-credit replace retake computes 3.71 needed, rather
  than the mockup's 3.69. No invented thresholds or course outcomes were added.
- Pages URLs: https://tanzir71.github.io/waypost/app/gpa/,
  https://tanzir71.github.io/waypost/app/finals/,
  https://tanzir71.github.io/waypost/app/scales/.

## M5

- Added the base-path-aware manifest, real Logo A icons (192/512/maskable),
  shortcuts, PDF/DOCX/JSON file handlers, GET share target and focus-existing
  launches. OS-opened files and shared jobs are reviewed before explicit saves.
- Added a content-versioned service worker and committed precache inventory for
  every route, UI/core module, local font/icon/data file and documentation page.
  Vendor parsers cache on first use; use PDF/DOCX once online before opening
  those formats offline. Auth/sync/AI/external requests are excluded. Shared
  parameters never become cache keys or forwarded network queries. Offline
  navigation falls back to Today at a valid URL; updates wait for Reload.
- Added offline status, installation after a second browser session, iOS native
  instructions, and capability detection. Runtime behavior is conditional on
  browser support; no support claim is inferred solely from contract fakes.
- Added Ctrl+K / Command+K and mobile command sheets with a labelled combobox,
  listbox, Tools/Actions/Jump to groups, arrow/Enter navigation, URL commands,
  saved-record jumps and the “plan gpa 3.6” intent.
- Added bounded UTF-8 private fragments for every route, the documented flat
  GPA/final/scale grammar, legacy M4 links, read-only autorun and per-view Share
  controls. Missing scale/record references do not silently compute a fallback.
  Private matching links keep raw text and reports unsaved until explicit actions.
- Registered all six WebMCP tools through document.modelContext with legacy
  navigator fallback, JSON Schema validation, shared core, live result JSON and
  actual registration status. Application writes wait for in-page confirmation;
  cancellation and abort leave records untouched. Added /agents/ human alias,
  link builder, hooks table, agent etiquette and refreshed llms documentation.
- Added Settings for real storage/quota/persistence, JSON and native folder
  backups, reviewed workspace merges, appearance, keyboard help and optional
  connection controls. Demo hides sync. Imports keep newer local records and
  leave AI/sync off; originals are explicitly excluded from JSON backups. Today
  recomputes the saved GPA input so restored plans do not show stale results.
- Validation: 83 Node tests and all release checks pass, including fake service
  worker/cache execution, policy exclusions and offline navigation, manifest/icon
  checks, every-route link round-trips, actual view prefill/autorun, native agent
  confirmation, file-launch review, folder writes, command keyboard navigation
  and backup restore. Syntax, static a11y, nested assets, route generation, parser
  integrity, extension parity and precache-content freshness are also checked.
- Source feature commit a892011 has built on Pages. HTTP checks confirm Settings,
  both Agents paths, Share, the manifest and worker scripts return 200 with the
  correct HTML/manifest/JavaScript MIME types. M6/M7 remain active work.

## M6

- Added optional same-origin HTTPS sync for PHP 8.1+/PDO SQLite and Cloudflare
  Worker/D1/R2, with shared encrypted envelopes, cursor pagination, timestamp /
  device LWW, tombstones, atomic quota enforcement and bounded requests/rates.
  Large Worker records use immutable R2 objects; concurrency checks protect
  record pointers and recovery commits. Original files remain local.
- Added WebCrypto PBKDF2-SHA256 at 600,000 iterations, separate HKDF keys,
  AES-GCM with authenticated record metadata, nonextractable device keys and
  eight 160-bit recovery codes shown once. Passphrases and codes never reach
  the server or workspace exports. Recovery derives fresh keys and stages a
  complete snapshot; concurrent edits reject the atomic commit without loss.
- Added Figma's centered Setup flow with real server checks, create/unlock /
  recovery, explicit code-save acknowledgement, cancellation, actual encrypted
  round-trip timing and opt-in enable. Demo performs no sync API calls and
  offers the deployment package. Settings reports status and offers manual
  sync, disconnect and explicitly confirmed server deletion, keeping local data.
- Added automatic encrypted sync after opt-in, on local edits and reconnect,
  offline retention, cross-tab coordination and abortable/bounded retries. Only
  safe study/appearance preferences cross devices; connections stay local.
- Added the deterministic 3.06 MB self-hosting ZIP, secret/database exclusion,
  HTTPS/private-file rules, external PHP configuration, Worker samples and
  deployment/protocol documentation. Fixed dark Logo A use in the app shell.
- Validation: all 100 tests and release checks pass in this workspace and a
  clean Git archive. Coverage includes real PHP/SQLite API/recovery, Worker
  HTTP with both model and SQLite-backed in-memory D1/R2, two-device merges,
  pagination, tamper/auth/limit failures, lost commit replies, concurrent
  cancellation/deletion and native Setup/Settings flows. All three PHP files
  pass php -l; ZIP contents and exact freshness are checked.
- Commit cd7d779 built on Pages. HTTP checks confirm Setup, encryption/setup
  modules, the server guide, precache and ZIP return 200 with correct MIME;
  deployed precache and ZIP bytes match local release artifacts. Pages serves
  the static demo/package; optional PHP/Worker execution needs self-hosting.
- M7 and the final full-spec audit remain active work.

## M7 (in progress)

- Added the Figma offer comparison, editable current job/offers, user-supplied
  cost-index CSV, adjusted-total bars with their table twin, priority sliders
  and explicit personal ratings. The three monetary fixtures pass; missing
  ratings and partial-year vesting assumptions stay uncomputed. Benefits and
  target-bonus inclusion are disclosed beside year-1 cash estimates.
- Offer priorities survive reviewed backups and encrypted sync through a shared
  safe preference projection. Private input links prefill without saving;
  native view tests exercise real create/edit/delete and imported city values.
- All 106 Node tests and release checks pass for the offer feature, including
  all earlier arithmetic fixtures, PHP lint and current extension/cache/ZIP builds.
- Added the Figma month calendar and ten-day agenda, native CRUD, linked source
  dates, optional saved final dates and real offline ICS downloads. Today also
  includes offer/final deadlines. Core fixtures cover weekday/year/leap handling,
  stable UIDs, exclusive all-day ends, exact RFC snapshot and UTF-8 byte folding.
- Added explicit calendar publication on both backends with a title/date-only
  format, random-nonce-derived bearer URL, public HTTPS reads and authenticated
  versioned publish/update/revoke. All synced devices can refresh an opted-in
  feed. URL credentials stay out of backups, private links and result JSON.
  Old confirmations and updates cannot resurrect a revoked feed; recovery and
  vault deletion revoke feeds atomically. The UI discloses plaintext/cached-copy
  behavior and preserves the distinction between disconnecting and revoking.
- PHP upgrades existing vaults under a database lock; D1 has a one-time migration.
  Tests execute both upgrades against real SQLite and preserve actual encrypted
  history. All 121 tests and release checks pass, including multi-device feed
  updates, open-view refresh, native publication/revocation acknowledgement,
  no demo network calls, asset callsites, PHP lint and exact deployment ZIP.
- Added Letters & outreach with the shared matcher's exact resume evidence,
  requirement-mapped blocks, selected story actions/results, cover/referral /
  follow-up templates, manual blocks, editable drafts/copies and local TXT/copy
  actions. No messages are sent. Private Match inputs can carry into writing
  without being saved; unavailable references do not substitute another record.
- Added searchable STAR Story bank, skill tags, truthful incomplete status,
  per-story links, and explicit save/delete. Added Contacts with safe links,
  email copying, history, reminder dates, Tracker associations and outreach
  handoff. Actual due reminders appear in Today.
- Added typed letter/story/history exports and shared source-reference mapping.
  Personal drafts protect their sample story/contact sources when samples clear;
  new demo examples seed once and cleared samples do not return. All 131 tests
  and release checks pass for the local tools, including native CRUD, exact
  evidence, private prefill, backups, sync projection and zero-fetch behavior.
- Added optional English letter rewrites via Chrome's on-device Prompt API and
  same-origin OpenAI BYOK relays for PHP/Worker. Settings stays off by default;
  Chrome model preparation and each request are explicit. Every suggestion is a
  complete accept/reject diff, edits only the selected editor text, and needs a
  separate save. Quantified sentences stay verbatim; fabricated metrics, stale
  edits, cancellation and errors cannot replace the draft.
- Keys stay in internal device settings, excluded from backups, sync, links and
  result JSON. BYOK is disabled in the demo. Fixed upstreams, HTTPS/origin
  checks, per-IP rate limits, redacted errors, bounded requests/output and
  timeout/cancel behavior are tested without network, accounts or real keys.
- All 143 tests and release checks pass, including provider fakes, actual PHP
  adapter execution, native review controls, default-off settings, key exclusion,
  no automatic model download, and changed-provider warning guards.
- The final full-spec audit remains active work. No M7 tag has been created.

## Deployment status

- Pages is still configured for main from / with .nojekyll and no workflows.
- Pages recovered on commit 62c9989, which the API reports built. HTTP smoke checks
  confirmed the current workspace app script, Match, Parse, Resumes, Tracker,
  Import and GPA core return 200. M2 and M3 are now deployed.
- Older M2/M3 builds reported only “Page build failed.” The newer successful
  deployment supersedes those failures. Commit d661dff is built; HTTP checks
  confirm the GPA, Finals and Scales routes, view modules, bundled scale table,
  and updated application entry point are live at the /waypost/ base path.
- Continue checking the Pages build API while implementing the remaining
  milestones. No Actions workflows, force pushes or owner approval are needed.

## Owner decisions (non-blocking)

- Logo: using A · Signpost.
- Custom domain, deployed sync credentials, and optional AI keys can be added later.
