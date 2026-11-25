PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS vaults (
 vault_id TEXT PRIMARY KEY, salt TEXT NOT NULL, auth_hash TEXT NOT NULL,
 wrapped_keys TEXT NOT NULL, key_version INTEGER NOT NULL DEFAULT 1,
 cursor INTEGER NOT NULL DEFAULT 0, size_bytes INTEGER NOT NULL DEFAULT 0,
 max_bytes INTEGER NOT NULL DEFAULT 209715200, created_at TEXT NOT NULL,
 applied_rotation TEXT, calendar_version INTEGER NOT NULL DEFAULT 0, calendar_mutation TEXT,
 CHECK(size_bytes >= 0 AND size_bytes <= max_bytes)
);
CREATE TABLE IF NOT EXISTS changes (
 vault_id TEXT NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
 type TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL, device_id TEXT NOT NULL,
 key_version INTEGER NOT NULL, iv TEXT NOT NULL, ciphertext TEXT, r2_key TEXT,
 bytes INTEGER NOT NULL, seq INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(vault_id,type,id), CHECK((ciphertext IS NULL) != (r2_key IS NULL))
);
CREATE INDEX IF NOT EXISTS changes_cursor ON changes(vault_id,seq);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS calendar_feeds (
 vault_id TEXT PRIMARY KEY REFERENCES vaults(vault_id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, nonce TEXT NOT NULL, version INTEGER NOT NULL,
 ics TEXT NOT NULL, content_hash TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rotations (
 vault_id TEXT PRIMARY KEY REFERENCES vaults(vault_id) ON DELETE CASCADE,
 rotation_id TEXT NOT NULL UNIQUE, base_cursor INTEGER NOT NULL, key_version INTEGER NOT NULL,
 salt TEXT NOT NULL, auth_hash TEXT NOT NULL, wrapped_keys TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staged_changes (
 vault_id TEXT NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
 rotation_id TEXT NOT NULL, type TEXT NOT NULL, id TEXT NOT NULL,
 updated_at TEXT NOT NULL, device_id TEXT NOT NULL, key_version INTEGER NOT NULL,
 iv TEXT NOT NULL, ciphertext TEXT, r2_key TEXT, bytes INTEGER NOT NULL,
 PRIMARY KEY(vault_id,rotation_id,type,id), CHECK((ciphertext IS NULL) != (r2_key IS NULL))
);
CREATE TRIGGER IF NOT EXISTS changes_version_insert BEFORE INSERT ON changes
WHEN NEW.key_version != (SELECT key_version FROM vaults WHERE vault_id=NEW.vault_id)
BEGIN SELECT RAISE(ABORT,'key_version_changed'); END;
CREATE TRIGGER IF NOT EXISTS changes_version_update BEFORE UPDATE OF key_version ON changes
WHEN NEW.key_version != (SELECT key_version FROM vaults WHERE vault_id=NEW.vault_id)
BEGIN SELECT RAISE(ABORT,'key_version_changed'); END;
CREATE TRIGGER IF NOT EXISTS changes_insert AFTER INSERT ON changes BEGIN
 UPDATE vaults SET size_bytes=size_bytes+NEW.bytes,cursor=cursor+1 WHERE vault_id=NEW.vault_id;
 UPDATE changes SET seq=(SELECT cursor FROM vaults WHERE vault_id=NEW.vault_id) WHERE vault_id=NEW.vault_id AND type=NEW.type AND id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS changes_update AFTER UPDATE OF updated_at,device_id,iv,ciphertext,r2_key,bytes ON changes BEGIN
 UPDATE vaults SET size_bytes=size_bytes-OLD.bytes+NEW.bytes,cursor=cursor+1 WHERE vault_id=NEW.vault_id;
 UPDATE changes SET seq=(SELECT cursor FROM vaults WHERE vault_id=NEW.vault_id) WHERE vault_id=NEW.vault_id AND type=NEW.type AND id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS changes_delete AFTER DELETE ON changes BEGIN
 UPDATE vaults SET size_bytes=size_bytes-OLD.bytes WHERE vault_id=OLD.vault_id;
END;
CREATE TRIGGER IF NOT EXISTS staged_limit_insert AFTER INSERT ON staged_changes
WHEN (SELECT COALESCE(SUM(bytes),0) FROM staged_changes WHERE vault_id=NEW.vault_id) > (SELECT max_bytes FROM vaults WHERE vault_id=NEW.vault_id)
BEGIN SELECT RAISE(ABORT,'rotation_quota'); END;
CREATE TRIGGER IF NOT EXISTS staged_limit_update AFTER UPDATE OF bytes ON staged_changes
WHEN (SELECT COALESCE(SUM(bytes),0) FROM staged_changes WHERE vault_id=NEW.vault_id) > (SELECT max_bytes FROM vaults WHERE vault_id=NEW.vault_id)
BEGIN SELECT RAISE(ABORT,'rotation_quota'); END;
