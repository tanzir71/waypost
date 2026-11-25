-- Apply once when upgrading an existing M6 D1 database. Fresh installs use schema.sql.
ALTER TABLE vaults ADD COLUMN calendar_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vaults ADD COLUMN calendar_mutation TEXT;
CREATE TABLE IF NOT EXISTS calendar_feeds (
 vault_id TEXT PRIMARY KEY REFERENCES vaults(vault_id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, nonce TEXT NOT NULL, version INTEGER NOT NULL,
 ics TEXT NOT NULL, content_hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
