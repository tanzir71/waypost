# Optional encrypted sync

The static app works without a server. Sync is off until **Set up sync** passes
actual server checks, shows recovery codes, verifies an encrypted round-trip,
and the user selects **Turn on sync**. The GitHub Pages demo never calls these
APIs. Host the app and API on the same HTTPS origin, including under `/waypost/`.
No CORS headers are emitted; foreign origins, cross-site requests and HTTP fail.
Do not put credentials in URLs. Service workers never cache `/server/` or `/api/`.

Download `downloads/waypost-self-host.zip` and extract its contents to the site's
document root or a subdirectory. `config.js` detects that base path. Keep the
existing data directory and deployment configuration when replacing static files.
The package contains only configuration **samples**, never a working private
configuration, real Worker secrets or a database. No npm dependencies are needed
by the app or PHP server. The ZIP is built with Node's standard library.

## Shared hosting: PHP 8.1+ and PDO SQLite

1. Enable HTTPS, PHP 8.1 or newer, PDO SQLite, Apache rewrite/headers support and
   the supplied `.htaccess` files. Preserve `Authorization` headers. For another
   server, reproduce the HTTPS redirect, no directory listings and private-file
   deny rules. Never allow PHP source to be served as text.
2. Create a private directory **outside the entire web root**, for example
   `waypost-data` next to `public_html`, writable by the PHP service account only.
   Copy `server/php/config.sample.php` there as `config.php`. Its `database`
   value defaults to `__DIR__ . '/vault.sqlite'`. The config and data directory
   must also be outside `server/php`; database symlinks are rejected.
3. The default lookup is `dirname(DOCUMENT_ROOT)/waypost-data/config.php`.
   If the host uses another location, set the trusted server environment variable
   `WAYPOST_CONFIG` to that private absolute path. Never place config.php inside
   the upload directory. SQLite, WAL/journal files and backups stay private.
4. Open `app/setup/`. Select Shared hosting and the same-origin HTTPS endpoint
   `<basePath>server/php/sync.php`. **Check server** reports the actual PHP
   version, PDO SQLite availability, private config location and directory
   writability. A failed check blocks vault creation in Setup.
5. Create a vault, save all eight codes and the connection file, test the
   encrypted round-trip, then turn sync on. On another device use the same
   endpoint, vault ID and passphrase. The vault name is device-local.

The server creates its SQLite schema on first API access. Transactions use
`BEGIN IMMEDIATE`, a five-second busy timeout and the same quota/cursor triggers
as the Worker. Authentication uses `password_hash` / `password_verify` on the
derived bearer token. No passphrase, raw master key or recovery code is sent.
Only trusted server configuration may mark HTTPS as active behind a proxy;
the app deliberately ignores client-supplied forwarding headers.

`max_vault_bytes` defaults to 200 MB; `rate_per_minute` defaults to 600 per IP.
Public identity/recovery operations have a stricter 30-per-minute IP limit.
The request limit is 5 MB and each encrypted record is at most 4 MB. Configure
the host's body limit to at least 5 MB and allow SQLite access. Back up the
private directory separately, with filesystem permissions retained. Replacing
the ZIP does not change this data. Passphrase replacement temporarily stages
another vault-sized set of ciphertext, so provision at least twice the quota
plus SQLite journal headroom. An interrupted rotation can be cancelled in Setup.

## Cloudflare: Worker, D1 and R2

Use the same origin for the static app and Worker route `/api/sync/*` (or a
subdirectory such as `/waypost/api/sync/*`). A separate workers.dev origin is
not accepted by the browser client. The handler strips the `/api/sync` prefix.

1. Copy `server/worker/wrangler.toml.sample` to the ignored `wrangler.toml` and
   configure the actual D1 database ID, R2 bucket and same-origin Worker route.
2. Create the D1 schema from `server/worker/schema.sql`. Bind D1 as `DB`, R2 as
   `BLOBS`; set `AUTH_PEPPER` with the platform's secret facility to a random
   secret of at least 32 characters. Never put it in tracked files. Deployment
   tooling is dev-only and is not part of the browser application.
3. Deploy the Worker with its relative core imports. D1 batches are atomic;
   encrypted envelopes above 64 KB use immutable R2 objects, with authenticated
   record metadata and a SQLite cursor/pointer. Smaller envelopes stay in D1.
4. Open Setup on this origin, select Cloudflare and use `/api/sync` as the
   endpoint. Checks verify the schema, bindings and authentication secret before
   vault setup. The same recovery and encrypted round-trip flow applies.

Worker authentication stores HMAC-SHA256(token, server pepper), verified with
WebCrypto. Losing/changing the pepper prevents authentication of existing
vaults; retain it in the deployment's secret store. The Worker accepts at most
ten records per write, staying within the free-plan subrequest budget. The
client splits larger batches, follows cursor pages, retries bounded rate-limit
responses and resumes after reconnecting. Default limits match PHP and can be
changed through `MAX_VAULT_BYTES` and `RATE_PER_MINUTE`.

After a failed storage/cleanup operation, an unreferenced R2 object may remain.
It is encrypted, is never returned without a database pointer, and does not
alter live records. Vault deletion removes all objects beneath that vault's
prefix. Interrupted rotation staging is removed by **Cancel unfinished key
rotation**; old active keys and records remain valid until an atomic commit.

## Wire protocol and recovery

All JSON responses are `no-store`; error bodies expose a code and usable message,
never configuration paths, SQL errors, keys or request bodies. Authenticated
requests carry `Authorization: Bearer <base64url(authKey)>`, `X-Waypost-Vault`
and `X-Waypost-Key-Version`. IDs are UUIDv7; timestamps are canonical UTC.

| Method and route | Purpose |
| --- | --- |
| GET `/checks` | Actual deployment checks; no authentication |
| POST `/vault` | `{vaultId,salt,authHash,wrappedKeys,keyVersion:1}`; bearer binds the auth hash |
| GET `/vault?vaultId=…` | Salt/key version for another device; vault ID is unguessable |
| GET `/changes?since=…` | Cursor page of encrypted envelopes, `cursor`, `hasMore`, `keyVersion` |
| POST `/changes` | `{changes}` with at most ten exact encrypted envelopes |
| POST `/recover` | `{vaultId,codeId}` returns a wrapped master key, never a plaintext code |
| DELETE `/vault` | Authenticated removal of the vault, ciphertext and recovery wrappers |
| GET/POST/DELETE `/vault/rotation` | Inspect, start or cancel replacement keys |
| POST `/vault/rotation/changes` | Stage records encrypted with replacement keys |
| POST `/vault/rotation/commit` | Atomically install the complete staged snapshot if its cursor still matches |

PHP routes use `sync.php?route=/changes` (PATH_INFO also works). Worker routes
append the path to `/api/sync`. An envelope contains only
`{id,type,updatedAt,deviceId,iv,ciphertext}`. AES-GCM authenticated data binds its
vault, key version, type, ID, timestamp and device. The plaintext record is also
validated after decryption. Tombstones sync; last-writer-wins uses timestamp,
then device ID. Raw uploaded files stay in local OPFS; extracted text syncs.
Only safe appearance/study preferences cross devices. AI and sync connections,
credentials, keys, internal journals and device settings are excluded.

PBKDF2-SHA256 runs 600,000 iterations with a random 16-byte salt. HKDF derives
separate AES-GCM-256 and authentication keys. Eight random 160-bit codes each
wrap the master key with HKDF/AES-GCM and their own salt/IV. A derived code ID
locates the encrypted wrapper; the full code stays in the browser. Codes are
shown once, must be saved explicitly, and are excluded from workspace backups.
They remain usable until passphrase replacement invalidates all prior codes.

Recovery unwraps the old master locally, derives **fresh** keys from the new
passphrase and a fresh salt, and reencrypts the entire remote snapshot. After
new codes are saved, the atomic commit replaces ciphertext, auth and wrappers.
A concurrent write rejects the commit and preserves the old vault. A lost
successful commit response is resolved by authenticating with the new keys.
No email reset, third-party account or server-side decryption exists. Without
the passphrase, a saved recovery code or an already unlocked device, the server
cannot restore plaintext. Keep a separate workspace backup.

## Verification

`npm run check` needs only Node 20+. PHP lint runs on every PHP file when PHP is
on PATH and otherwise logs a skip. Tests cover WebCrypto, recovery, tampering,
merge/cursor behavior, two workspace devices, endpoint limits and Worker HTTP
handling with in-memory D1/R2 fakes. Node versions with built-in SQLite execute
the actual D1 SQL too. If PHP SQLite is available, tests exercise the real PHP
API and atomic recovery against a temporary private database. No accounts,
network, headless browser or deployment credentials are needed for these checks.

Rebuild after runtime/documentation edits:

```sh
node scripts/build-docs.mjs
node scripts/build-precache.mjs
node scripts/make-zip.mjs
npm run check
```

GitHub Pages serves the static demo and downloadable package; it cannot execute
PHP or Workers. A production sync deployment is optional and requires its own
same-origin server configuration. Calendar publication is a separate plaintext
opt-in; the sync server never interprets encrypted deadlines.

## Calendar subscriptions (optional plaintext)

Deadlines combines saved entries, Tracker next steps, offer decision dates and
dated course finals. Downloading `.ics` works locally, including offline. No
calendar is published by default, and selecting **Include in feed** alone does
not create a public feed. With sync connected, **Subscribe (sync on)** previews
the selected titles/dates and requires acknowledgement before publication.

Publication is the explicit exception to encrypted storage. Only canonical
all-day events (title, date, stable UID and standard timestamps) are accepted;
descriptions, URLs, attendees and other calendar properties are rejected. The
limit is 1000 selected events / 256 KB. The server stores that plaintext ICS
and a hash of its URL token in SQLite/D1. Anyone with the URL can read it.
Public reads use HTTPS and `text/calendar`, with `no-store` and no CORS grants.
Both public and authenticated calendar requests are excluded from the PWA cache.

The token is HMAC-SHA256 with the derived vault authentication key over a fresh
random 32-byte nonce and vault/key-version context. Authenticated calendar
metadata shares the nonce, so any unlocked device can derive the same URL and
refresh selected entries after encrypted sync. The token and URL never enter
workspace exports, private input links, application logs or result JSON. The
hosting server may record feed paths/queries in its access logs. Only per-entry
inclusion flags are synced/exported with records. `config.js`'s optional
`icsUrl` overrides the same-origin feed script/base path; cross-origin overrides
are rejected. Defaults are `server/php/ics.php?token=…` and `/api/ics/TOKEN.ics`.

| Authenticated sync route | Effect |
| --- | --- |
| GET `/calendar` | Published flag, epoch version, nonce and content hash; no token |
| POST `/calendar` | `{nonce,token,ics,expectedVersion}` explicitly publishes/replaces a URL |
| PUT `/calendar` | `{token,ics,version}` updates an existing matching feed only |
| DELETE `/calendar` | `{expectedVersion}` revokes the URL and advances the epoch |

Creation/revocation use atomic version guards. Confirmation is tied to the
preview's version and content hash. Stale automatic updates or old confirmations
cannot recreate a revoked feed or overwrite a newer publishing decision. Key
recovery and vault deletion revoke feeds as part of the same database commit.
Disconnecting sync leaves an existing feed online; revoke it in Deadlines first
when access should end. Calendar apps can retain already downloaded copies.

For an existing M6 **D1** deployment, apply
`server/worker/migrations/002-calendar.sql` once before deploying this Worker.
Fresh deployments use the complete `schema.sql`. Setup reports an outdated D1
schema as needing attention. **PHP** adds the calendar columns/tables in place
under a database lock on first access, preserving existing encrypted rows.
Both upgrade paths have real SQLite preservation tests.

## Optional AI relay

AI is off by default and independent of encrypted sync. Chrome's built-in
English Prompt API needs no server; Settings checks support and prepares its
model only on request. The browser manages any model download. Writing text
stays on-device. BYOK currently supports OpenAI's Responses API and sends only
the selected letter text and rewrite instructions after an explicit request.
GitHub Pages cannot run the relay, so BYOK is disabled in demo mode.

For **PHP**, upload `ai.php` and `ai-library.php` with the other server files.
Keep the existing private config/database outside the web root. Optional BYOK
also needs PHP cURL with its HTTPS certificate store configured. In Settings,
use `https://YOUR_HOST/BASE/server/php/ai.php` as the relay endpoint. No vault
needs to be created; SQLite is used for the per-IP rate limit.

For **Cloudflare**, the supplied Worker handles `/api/ai` alongside the sync and
calendar routes. D1 and a private `AUTH_PEPPER` are required for rate limiting;
AI itself needs no vault or R2 object. The existing schema needs no further
migration. Use `https://YOUR_HOST/api/ai` in Settings. The Worker and PHP accept
same-origin HTTPS JSON POSTs only and never grant CORS access. Configure the
relay on the same host you trust with your key and selected text.

The relay receives `{model,input,instructions}` and a `X-Waypost-AI-Key` header.
It calls only the fixed OpenAI Responses HTTPS URL, never a caller-supplied
upstream, with `store:false`, no tools, a 4096-output-token cap, a 45-second
timeout and no redirects. Requests are capped at 64 KB, selected text at 12,000
characters (the PHP adapter also bounds UTF-8 bytes), responses at 256 KB and
requests at 30 per IP/minute. Provider failures/refusals/incomplete outputs are
redacted to generic errors. Browser requests and responses are never cached.
Application code never logs or persists keys/text on the server; configure host
request logging to exclude the key header and bodies. Provider charges and
retention policies still apply; `store:false` is not a zero-retention promise.

The key is saved only in this device's internal IndexedDB settings. It is never
synced, exported, added to result JSON or included in URLs. The UI rechecks that
the provider/model/relay match the reviewed request. Every result is checked by
`core/ai` and displayed as a complete accept/reject diff. Quantified English
sentences are locked verbatim; the user reviews other meaning/facts. Accepting
only changes the current editor, and stale editor snapshots cannot overwrite
new edits. Workspace import leaves AI off; Forget AI key removes its local key.

Provider APIs verified against the [Chrome Prompt API documentation](https://developer.chrome.com/docs/ai/prompt-api)
and [OpenAI Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create)
on 26 November 2026. No SDK, gateway, CDN, model ID default or new dependency is
required. Provider/model availability varies; tests use fakes and do not claim
that every browser/device or model is supported.
