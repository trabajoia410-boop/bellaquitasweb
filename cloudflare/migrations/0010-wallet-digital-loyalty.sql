-- Bellaquitas Fest / Digital Wallet — nueva fidelidad, fase 2.
-- SOLO crea tablas nuevas. NO migra ni toca profiles.points, visits, activity,
-- rewards, redemptions, roles, usuarios o sesiones actuales.
-- Ejecución en D1 real: PROHIBIDA hasta aprobación y copia restaurable.
CREATE TABLE IF NOT EXISTS wallet_programs (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 3 AND 70),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 logo_url TEXT NOT NULL DEFAULT '',
 banner_url TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '#21121b' CHECK(length(color)=7),
 accent_color TEXT NOT NULL DEFAULT '#e9c477' CHECK(length(accent_color)=7),
 stamp_goal INTEGER NOT NULL DEFAULT 7 CHECK(stamp_goal BETWEEN 2 AND 30),
 reward_label TEXT NOT NULL DEFAULT 'Consumición gratis' CHECK(length(reward_label) BETWEEN 2 AND 160),
 card_message TEXT NOT NULL DEFAULT 'Vive el momento' CHECK(length(card_message) BETWEEN 0 AND 200),
 cooldown_seconds INTEGER NOT NULL DEFAULT 600 CHECK(cooldown_seconds BETWEEN 60 AND 86400),
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS wallet_customers (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 program_id TEXT NOT NULL REFERENCES wallet_programs(id) ON DELETE RESTRICT,
 profile_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 5 AND 254),
 phone TEXT NOT NULL DEFAULT '' CHECK(length(phone)<=24),
 contact_hash TEXT NOT NULL,
 scan_token_hash TEXT NOT NULL UNIQUE,
 scan_nonce TEXT NOT NULL DEFAULT '' CHECK(length(scan_nonce)<=64),
 consent_at INTEGER NOT NULL CHECK(consent_at>0),
 marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(marketing_opt_in IN(0,1)),
 stamps INTEGER NOT NULL DEFAULT 0 CHECK(stamps>=0),
 unlocked_rewards INTEGER NOT NULL DEFAULT 0 CHECK(unlocked_rewards>=0),
 redeemed_rewards INTEGER NOT NULL DEFAULT 0 CHECK(redeemed_rewards>=0),
 last_stamp_at INTEGER,
 deleted_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(program_id,contact_hash),
 CHECK(redeemed_rewards<=unlocked_rewards)
);
CREATE INDEX IF NOT EXISTS idx_wallet_customers_program ON wallet_customers(program_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_customers_last_visit ON wallet_customers(program_id,last_stamp_at);
CREATE TABLE IF NOT EXISTS wallet_email_challenges (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 program_id TEXT NOT NULL REFERENCES wallet_programs(id) ON DELETE CASCADE,
 contact_hash TEXT NOT NULL,
 email TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 consent INTEGER NOT NULL CHECK(consent=1),
 marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(marketing_opt_in IN(0,1)),
 code_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(program_id,contact_hash)
);
CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expiry ON wallet_email_challenges(expires_at);
CREATE TABLE IF NOT EXISTS wallet_customer_sessions (
 token_hash TEXT PRIMARY KEY,
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_customer ON wallet_customer_sessions(customer_id,expires_at);
CREATE TABLE IF NOT EXISTS wallet_employees (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 program_id TEXT NOT NULL REFERENCES wallet_programs(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 pin_hash TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
 created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(program_id,pin_hash)
);
CREATE TABLE IF NOT EXISTS wallet_pin_limits (
 key_hash TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 10),
 blocked_until INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wallet_employee_sessions (
 token_hash TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL REFERENCES wallet_employees(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Outbox durable para actualizaciones Wallet: sin peticiones externas en la
-- transacción que sella o canjea. El procesador se activa solo con credenciales.
CREATE TABLE IF NOT EXISTS wallet_sync_jobs (
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider IN('apple','google')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','done','failed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
 requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
 next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
 processed_at INTEGER,
 PRIMARY KEY(customer_id,provider)
);
CREATE INDEX IF NOT EXISTS idx_wallet_sync_pending ON wallet_sync_jobs(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS wallet_stamp_events (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE RESTRICT,
 actor_profile_id TEXT REFERENCES profiles(id) ON DELETE RESTRICT,
 employee_id TEXT REFERENCES wallet_employees(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN('stamp','reversal')),
 delta INTEGER NOT NULL CHECK(delta IN(1,-1)),
 request_id TEXT NOT NULL UNIQUE,
 reason TEXT NOT NULL DEFAULT '' CHECK(length(reason)<=200),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 CHECK((actor_profile_id IS NULL)!=(employee_id IS NULL)),
 CHECK(action='stamp' AND delta=1 OR action='reversal' AND delta=-1),
 CHECK(action!='reversal' OR (employee_id IS NULL AND length(reason)>=5))
);
CREATE INDEX IF NOT EXISTS idx_wallet_stamps_customer ON wallet_stamp_events(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_stamps_day ON wallet_stamp_events(created_at);
-- DB triggers protect business invariants, even if a route is accidentally bypassed.
CREATE TRIGGER IF NOT EXISTS wallet_stamp_guard BEFORE INSERT ON wallet_stamp_events
BEGIN
 SELECT RAISE(ABORT,'Cliente inactivo') WHERE NOT EXISTS(
   SELECT 1 FROM wallet_customers WHERE id=NEW.customer_id AND deleted_at IS NULL);
 SELECT RAISE(ABORT,'Personal no autorizado') WHERE
   NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.actor_profile_id AND role IN('puerta','admin'))
   AND NOT EXISTS(SELECT 1 FROM wallet_employees WHERE id=NEW.employee_id AND enabled=1);
 SELECT RAISE(ABORT,'Solo administrador puede quitar sellos') WHERE
   NEW.action='reversal' AND NOT EXISTS(
    SELECT 1 FROM profiles WHERE id=NEW.actor_profile_id AND role='admin');
 SELECT RAISE(ABORT,'Espera antes de sellar de nuevo') WHERE NEW.action='stamp' AND EXISTS(
   SELECT 1 FROM wallet_customers c JOIN wallet_programs p ON p.id=c.program_id
   WHERE c.id=NEW.customer_id AND c.last_stamp_at>unixepoch()-p.cooldown_seconds);
 SELECT RAISE(ABORT,'No quedan sellos por quitar') WHERE NEW.action='reversal' AND EXISTS(
   SELECT 1 FROM wallet_customers WHERE id=NEW.customer_id AND stamps=0);
END;
CREATE TRIGGER IF NOT EXISTS wallet_stamp_apply AFTER INSERT ON wallet_stamp_events
BEGIN
 UPDATE wallet_customers SET
   stamps=CASE WHEN NEW.delta=1
     THEN (stamps+1) % (SELECT stamp_goal FROM wallet_programs WHERE id=program_id)
     ELSE stamps-1 END,
   unlocked_rewards=unlocked_rewards+CASE WHEN NEW.delta=1 AND
     stamps+1 >= (SELECT stamp_goal FROM wallet_programs WHERE id=program_id) THEN 1 ELSE 0 END,
   last_stamp_at=CASE WHEN NEW.delta=1 THEN unixepoch() ELSE last_stamp_at END,
   updated_at=unixepoch()
 WHERE id=NEW.customer_id;
 INSERT INTO wallet_sync_jobs(customer_id,provider) VALUES(NEW.customer_id,'google')
 ON CONFLICT(customer_id,provider) DO UPDATE SET status='pending',
  requested_at=unixepoch(),next_attempt_at=unixepoch(),attempts=0;
 INSERT INTO wallet_sync_jobs(customer_id,provider) VALUES(NEW.customer_id,'apple')
 ON CONFLICT(customer_id,provider) DO UPDATE SET status='pending',
  requested_at=unixepoch(),next_attempt_at=unixepoch(),attempts=0;
END;
CREATE TABLE IF NOT EXISTS wallet_reward_claims (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE RESTRICT,
 verified_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER IF NOT EXISTS wallet_reward_guard BEFORE INSERT ON wallet_reward_claims
BEGIN
 SELECT RAISE(ABORT,'Canje sin recompensa disponible') WHERE NOT EXISTS(
  SELECT 1 FROM wallet_customers WHERE id=NEW.customer_id AND deleted_at IS NULL
    AND unlocked_rewards>redeemed_rewards);
 SELECT RAISE(ABORT,'Canje requiere administrador') WHERE NOT EXISTS(
  SELECT 1 FROM profiles WHERE id=NEW.verified_by AND role='admin');
END;
CREATE TRIGGER IF NOT EXISTS wallet_reward_apply AFTER INSERT ON wallet_reward_claims
BEGIN
 UPDATE wallet_customers SET redeemed_rewards=redeemed_rewards+1,updated_at=unixepoch()
 WHERE id=NEW.customer_id;
 INSERT INTO wallet_sync_jobs(customer_id,provider) VALUES(NEW.customer_id,'google')
 ON CONFLICT(customer_id,provider) DO UPDATE SET status='pending',
  requested_at=unixepoch(),next_attempt_at=unixepoch(),attempts=0;
 INSERT INTO wallet_sync_jobs(customer_id,provider) VALUES(NEW.customer_id,'apple')
 ON CONFLICT(customer_id,provider) DO UPDATE SET status='pending',
  requested_at=unixepoch(),next_attempt_at=unixepoch(),attempts=0;
END;
CREATE TABLE IF NOT EXISTS wallet_campaigns (
 id TEXT PRIMARY KEY CHECK(length(id)=36),
 program_id TEXT NOT NULL REFERENCES wallet_programs(id) ON DELETE RESTRICT,
 created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
 audience TEXT NOT NULL CHECK(audience IN('all','inactive')),
 inactive_days INTEGER NOT NULL DEFAULT 0 CHECK(inactive_days BETWEEN 0 AND 365),
 message_es TEXT NOT NULL CHECK(length(message_es) BETWEEN 2 AND 160),
 message_fr TEXT NOT NULL CHECK(length(message_fr) BETWEEN 2 AND 160),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','queued','sent','failed')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 sent_at INTEGER
);
CREATE TABLE IF NOT EXISTS wallet_message_deliveries (
 campaign_id TEXT NOT NULL REFERENCES wallet_campaigns(id) ON DELETE CASCADE,
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider IN('mock','apple','google')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sent','failed','skipped')),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(campaign_id,customer_id,provider)
);
CREATE TABLE IF NOT EXISTS wallet_apple_registrations (
 device_id_hash TEXT NOT NULL,
 customer_id TEXT NOT NULL REFERENCES wallet_customers(id) ON DELETE CASCADE,
 push_token TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(device_id_hash,customer_id)
);
