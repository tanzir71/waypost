# Waypost

An honest, local-first toolkit for students and jobseekers. Evidence-based resume
matching, GPA planning, application tracking, and offer comparison, from one
private workspace. MIT licensed. Made by [tanziro.com](https://tanziro.com).

[Live demo](https://tanzir71.github.io/waypost/) ·
[Milestone progress](PROGRESS.md) · [Implementation spec](HANDOVER.md) ·
[Agent documentation](llms.txt)

## Current release

M0 supplies the static foundation, generated tool routes, design tokens, and
self-hosted fonts. Tools are explicitly marked Coming soon until implemented.
The original matching and extension data helpers remain covered by unit tests.

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
copied unchanged from handover/tokens.css to ui/tokens.css.
