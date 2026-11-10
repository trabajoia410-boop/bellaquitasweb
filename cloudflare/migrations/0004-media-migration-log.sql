-- One-time migration audit for three public logo assets, copied to PRIVATE R2.
CREATE TABLE IF NOT EXISTS media_migration_log (
 storage_key TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('copied','error')),
 bytes INTEGER NOT NULL DEFAULT 0,
 sha256 TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
