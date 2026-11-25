# Changelog

## M6 — 2026-11-25

- Shipped optional encrypted sync with PHP/SQLite and Worker/D1/R2 backends,
  same-origin HTTPS, cursor/LWW merges, tombstones, quotas and rate limits.
- Shipped actual Setup checks, encrypted round-trip verification, recovery codes,
  atomic passphrase/key replacement, device unlock and explicit sync opt-in.
- Added background/manual sync, offline retention, disconnect and confirmed
  server-vault deletion. Device keys, credentials and codes stay out of exports.
- Added a reproducible self-hosting ZIP, external private PHP configuration,
  Worker samples, server protocol/install docs and local PHP lint/package checks.
- All 100 tests and release checks pass, including a clean Git archive, actual
  PHP SQLite, Worker storage fakes/SQL and native setup/recovery flows. Static
  demo and release package are verified on Pages. M7 remains in progress.

## M5 — 2026-11-25

- Shipped the installable/offline workspace, native file and job-share review,
  versioned local caches, offline banner and explicit update/reload flow.
- Shipped the keyboard command palette, private input links, read-only autorun,
  six validated WebMCP tools and in-page application confirmation.
- Shipped Settings, workspace restore with deterministic merges, supported
  folder backups, live storage status and the human /agents/ guide.
- Expanded agent docs and hooks, corrected stale landing availability labels,
  and added executable service-worker/native-view contract tests. All 83 tests
  and release checks pass. Encrypted sync and supporting tools remain M6/M7.

## M4 — 2026-11-25

- Shipped GPA target planning, saved terms/courses, locked greedy mixes,
  difficulty controls, retake comparisons and grade-scale editing.
- Shipped linked final-exam targets with saved assessment categories and the full
  grade ladder, plus method-labelled scale conversions, cohort-dependent ECTS,
  custom institution tables and exports.
- Added local scale data, private study-input links, trend table twins, workspace
  backup support, and one-time demo upgrades that respect cleared samples.
- All 66 tests and release checks pass, including every M4 arithmetic fixture
  and view/storage integration. Fixed repeated work in matching batches while
  preserving separate report evidence; the 300 ms benchmark remains unchanged.
- Corrected conflicting mockup labels using the specified formulas; details are
  in PROGRESS.md. GitHub Pages recovered; M2, M3 and M4 are now verified live.

## M3 — 2026-11-25

- Shipped Today, application board/table tracking, stage history, next steps,
  per-resume response rates, workspace export and reviewed Clipper/file imports.
- Upgraded Waypost Clipper to MV3 v2 with click-only capture, local resume quick
  matches, private fragment handoffs, compatible TXT/JSON exports and optional
  per-origin chips. No always-on all-URL content script remains.
- Added schema validation, UTF-8 link encoding, protected sample dependencies,
  mobile navigation, and a generated extension bundle using the same core.
- All 56 tests and release checks pass. GitHub Pages reported generic M2 build
  failures; the newer build is pending, so live deployment is not yet verified.

## M2 — 2026-11-25

- Shipped the Honest Match workspace with worker scoring, bulk import, tier
  filters, resume tabs, requirement evidence, peer gaps and knockout handling.
- Shipped Parse check and Resumes: local PDF/DOCX/TXT/JSON Resume imports,
  reading-order and content checks, exact text export, line and word diffs,
  common-job effects and resume usage counts.
- Added IndexedDB workspace storage, UUIDv7 metadata, one-time demo seeding,
  backed-up legacy migration, persistence requests and OPFS original uploads.
- Vendored and integrity-pinned PDF.js and Mammoth, with local supporting files
  and licenses. Added an attributed O*NET® skill-label subset.
- Northwind and hero fixtures pass. All 44 tests and static checks pass; the
  250-report benchmark remains below 300 ms.

## M1 — 2026-11-25

- Built the landing page from the desktop and mobile Figma frames, with light,
  dark and system appearance, local assets, and visible Soon labels.
- Added a real match widget: paste a job, choose the sample or upload a text
  resume, inspect exact requirement evidence, copy or download the report JSON.
- Added shared pure matching with BM25, Porter stemming, aliases, contextual
  evidence, merged tenure, knockout handling and stuffing warnings. The Figma
  hero fixture passes: Good, four met, one partial, one missing.
- Added source-linked pricing verified on 2026-11-25, privacy details, FAQ and
  application JSON-LD, local asset checks, and full concatenated agent docs.

## M0 — 2026-11-25

- Renamed the public repository to Waypost and enabled branch-based Pages.
- Added the static app foundation, 17 generated tool routes, base-path detection,
  demo seed, exact Figma tokens, local fonts, logo and navigation assets.
- Added MIT and font licenses, workspace schema, agent docs, progress tracking,
  route synchronization, static accessibility, and external-resource checks.
