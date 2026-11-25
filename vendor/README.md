PDF.js 6.5.438 (Apache-2.0) and Mammoth 1.13.0 (BSD-2-Clause) are pinned here.
See VERSIONS.json for sources. License files for the code, CMaps, fonts and WASM
components are included. Only the browser parsers and their supporting assets
are bundled; no npm runtime dependencies or remote scripts are needed.

ui/read-file.js lazy-loads them on a matching file upload. PDF.js's worker,
CMaps, standard fonts, WASM and ICC assets all resolve under vendor/pdfjs/.
Mammoth extracts raw text only; document HTML is never inserted into the UI.
