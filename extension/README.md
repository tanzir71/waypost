# ATS Job Collector Extension

Manifest V3 browser extension for saving job descriptions locally and downloading selected collection dates as files for manual import into the ATS scoring app.

## Load locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select this `extension/` folder.

## Use

1. Open a job posting page.
2. Click the extension and press the plus button.
3. Repeat across jobs. Captures are stored in `chrome.storage.local`.
4. Select one or more collection dates.
5. Export `TXT` for paste/file import, or `JSON` for the scoring app's job file uploader.
6. Open the ATS scorer and manually import the downloaded file.

All captured data stays in the browser unless the user downloads an export file.
