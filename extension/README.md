# Waypost Clipper

An MV3 extension for reading job pages on click, saving captures by date, matching
against a locally chosen resume, and sending a private import to Waypost.

## Install and use

1. Load this extension/ directory with Load unpacked in Chromium's Extensions
   developer mode. The generated bundle is already committed; no install or build
   step is needed to load it.
2. Open a job page, click the extension, then Read this page. Scripts are injected
   only for that action. Protected browser pages and LinkedIn scraping are excluded.
3. Save for later keeps the job in extension-local storage. Select capture dates
   to export compatible TXT or JSON files, or send the selected jobs to Waypost.
4. Send to Waypost opens app/import/#job=BASE64URL at the configured deployment.
   The app validates schemas/job-export.json and waits for in-page confirmation.
   Text is in the fragment, not a server query. Large payloads use file export and
   import instead; they are never silently truncated into an incomplete link.

## Options and site chips

Options sets the deployment root (default: the GitHub Pages demo) and a default
resume label/text for the popup's quick match. Import a plain text resume there,
or paste one. This local extension copy is separate from app IndexedDB storage.
All tiers and evidence come from the same generated core/match engine as the app.

Site chips are off by default. After reading a page, enable its chip to request
permission for that origin only. The service worker checks both the saved opt-in
and granted permission before injecting on later visits. Disable it in the popup
or revoke that site's access in Options. Reload a page to remove an existing chip
after revoking access from Options. No always-on all-URL content script is shipped.

Required permissions: activeTab, storage, downloads, scripting. Optional host
access is requested only for enabled origins. There are no remote scripts,
analytics, credentials, or third-party font requests.

## Development

Business logic lives in the repository's canonical core/. Run
`node scripts/build-extension.mjs` after changing bundled sources. JSON imports
are translated to local JS data modules because extension service workers do
not support import assertions. `npm run check` verifies bundle parity, matcher
parity, capture API calls, permissions and the chip's opt-in behavior with fakes.

Made by [tanziro.com](https://tanziro.com).
