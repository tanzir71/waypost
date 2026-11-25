# AGENTS.md — instructions for Codex and other coding agents

Project: **Waypost** (repo `tanzir71/waypost`, formerly `ats-scoring`).
Spec: read `HANDOVER.md` first. Design: Figma file "ATS-Scoring" (node IDs are listed in HANDOVER.md §2).

## How to work here
- Build milestone by milestone (HANDOVER.md §12). One PR per milestone. Each one must deploy and work on GitHub Pages in `mode: "demo"`.
- Match the Figma frames. Use the tokens in `handover/tokens.css` (copy them to `/ui/tokens.css`). Don't invent colours, radii or type sizes.
- Business logic goes in `/core` as pure ES modules with no DOM access and has unit tests. UI code imports from `/core`, as do WebMCP tools and tests. Never duplicate logic.
- No frameworks and no runtime npm dependencies. Dev-only tools (Playwright) are fine. Vendor pdf.js and mammoth into `/vendor/` and lazy-load them.
- No third-party CDNs, fonts or analytics. In demo/pwa mode the app must make zero cross-origin requests.
- Keep generated route pages (`/app/*/index.html`) committed. Run `node scripts/build-routes.mjs` after editing `_shell.html`.

## Hard rules from the owner
- No italics anywhere in the UI (style `<em>` as Medium weight instead).
- No gradients, no glow effects, no borders on containers. Separate areas by surface tone and spacing.
- Never show a bare "ATS score". Show tiers (Strong/Good/Partial/Limited) with evidence; keyword coverage % is secondary and labelled.
- AI features are optional and off by default. They never invent metrics, and every suggestion is an accept/reject diff.
- Account recovery uses recovery codes. Don't add email resets or third-party auth.
- Footer credit: "Made by tanziro.com".

## Accessibility and agent readability (every PR)
- Use native elements and labels. Accessible names state the action. Each view has one `h1`.
- Add a `data-testid` to actionable elements and result rows (see the map in HANDOVER.md §10 and llms.txt). Every compute updates `#result-data`.
- Write e2e tests with `getByRole` / `getByLabel` only.

## Commands
```bash
npm test                      # node --test tests/*.test.mjs (core + static checks)
python -m http.server 4173    # serve locally → http://localhost:4173
npx playwright test           # e2e (dev only)
node scripts/check-routes.mjs # route pages in sync with _shell.html
```

## Definition of done (per milestone)
- Matches the Figma frames listed for that milestone in Light and Dark.
- Tests are green. The fixtures from HANDOVER.md §7 pass (3.78 / 3.81 / 61.8 / 72.4% / Northwind report).
- Works offline once the PWA ships (M5+). Works under a `/waypost/` base path.
- README, llms.txt and CHANGELOG are updated.
