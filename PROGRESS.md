# Waypost progress

Live demo: https://tanzir71.github.io/waypost/

| Milestone | Status | Tag | Look at |
|---|---|---|---|
| M0 Rename, scaffold, Pages | done | m0 | / and /app/ |
| M1 Landing | done | m1 | / |
| M2 Match, parse, resumes | implemented; Pages pending | m2 | /app/match/, /app/parse/, /app/resumes/ |
| M3 Today, tracker, clipper | implemented; Pages pending | m3 | /app/, /app/tracker/, /app/import/ |
| M4 Study tools | pending | | |
| M5 PWA, agents, settings | pending | | |
| M6 Encrypted sync | pending | | |
| M7 Offers and supporting tools | pending | | |

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

## Deployment status

- Pages is still configured for main from / with .nojekyll and no workflows.
- M1 is the last independently verified live release.
- The M2 builds were reported errored by the Pages API with only “Page build
  failed.” The M3 feature build is running. Source, tags and all local release
  checks are available; newer live deployment remains unverified.
- Continue checking the Pages build API while implementing the remaining
  milestones. No Actions workflows, force pushes or owner approval are needed.

## Owner decisions (non-blocking)

- Logo: using A · Signpost.
- Custom domain, deployed sync credentials, and optional AI keys can be added later.
