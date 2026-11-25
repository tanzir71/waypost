# Waypost progress

Live demo: https://tanzir71.github.io/waypost/

| Milestone | Status | Tag | Look at |
|---|---|---|---|
| M0 Rename, scaffold, Pages | done | m0 | / and /app/ |
| M1 Landing | done | m1 | / |
| M2 Match, parse, resumes | pending | | |
| M3 Today, tracker, clipper | pending | | |
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

## Owner decisions (non-blocking)

- Logo: using A · Signpost.
- Custom domain, deployed sync credentials, and optional AI keys can be added later.
