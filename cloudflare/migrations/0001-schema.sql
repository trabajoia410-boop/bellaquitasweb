-- Bellaquitas Fest Cloudflare D1 staging schema
-- Generated from deployed D1 structure; NO data or secrets.
PRAGMA foreign_keys=ON;

CREATE TABLE activity (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES profiles(id),
 type TEXT NOT NULL,
 delta INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 staff_id TEXT REFERENCES profiles(id)
);

CREATE TABLE admin_member_changes (
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES profiles(id),
 admin_id TEXT NOT NULL REFERENCES profiles(id),
 before_data TEXT NOT NULL CHECK(json_valid(before_data)),
 after_data TEXT NOT NULL CHECK(json_valid(after_data)),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 250),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE community_suggestions (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL DEFAULT '' CHECK(length(name)<=80),
 message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 5 AND 2000),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 status TEXT NOT NULL DEFAULT 'nuevo' CHECK(status IN ('nuevo','revisado','archivado'))
);

CREATE TABLE events (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 date_label TEXT NOT NULL,
 location TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 start_time TEXT,
 image_url TEXT NOT NULL DEFAULT '',
 localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content))
);

CREATE TABLE moments_albums (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 120),
 event_date TEXT NOT NULL,
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE moments_photos (
 id TEXT PRIMARY KEY,
 album_id TEXT NOT NULL REFERENCES moments_albums(id) ON DELETE CASCADE,
 storage_path TEXT NOT NULL UNIQUE,
 caption TEXT NOT NULL DEFAULT '' CHECK(length(caption)<=200),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE profiles (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 role TEXT NOT NULL DEFAULT 'socio' CHECK(role IN ('socio','puerta','admin')),
 member_code TEXT NOT NULL UNIQUE,
 points INTEGER NOT NULL DEFAULT 0 CHECK(points >= 0),
 lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_points >= 0),
 visits INTEGER NOT NULL DEFAULT 0 CHECK(visits >= 0),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE promos (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 bonus INTEGER NOT NULL CHECK(bonus>0),
 description TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content))
);

CREATE TABLE redemptions (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES profiles(id),
 reward_id TEXT NOT NULL REFERENCES rewards(id),
 cost INTEGER NOT NULL CHECK(cost>0),
 status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','validado','cancelado')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 validated_at TEXT,
 validated_by TEXT REFERENCES profiles(id)
);

CREATE TABLE rewards (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'Premios',
 cost INTEGER NOT NULL CHECK(cost>0),
 symbol TEXT NOT NULL DEFAULT '✦',
 description TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 image_url TEXT NOT NULL DEFAULT '',
 localized_content TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(localized_content))
);

CREATE TABLE site_content (
 key TEXT PRIMARY KEY CHECK(key='homepage'),
 hero_text TEXT NOT NULL,
 announcement TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 page_settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(page_settings))
);

CREATE TABLE site_drafts (
 key TEXT PRIMARY KEY CHECK(key='homepage'),
 settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings)),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_activity_user ON activity(user_id, created_at DESC);

CREATE INDEX idx_admin_changes_member ON admin_member_changes(member_id, created_at DESC);

CREATE INDEX idx_moments_photos_album ON moments_photos(album_id);

CREATE INDEX idx_redemptions_user ON redemptions(user_id, created_at DESC);
