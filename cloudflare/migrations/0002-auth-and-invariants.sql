-- Identities and future verified user sessions in Cloudflare D1.
CREATE TABLE IF NOT EXISTS auth_identity_links (
 id TEXT NOT NULL,
 provider TEXT NOT NULL,
 provider_subject TEXT NOT NULL,
 profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 PRIMARY KEY (provider,provider_subject),
 UNIQUE (provider,profile_id),
 CHECK (provider IN ('google','email'))
);
CREATE INDEX IF NOT EXISTS idx_identity_links_profile ON auth_identity_links(profile_id);
CREATE TABLE IF NOT EXISTS migration_audit (
 id TEXT PRIMARY KEY,
 source TEXT NOT NULL,
 entity TEXT NOT NULL,
 row_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Bellaquitas Fest staging: SQL invariants for points, visits and redemptions.
-- Do not import pre-existing redemptions using INSERT after these triggers are enabled,
-- because new redemption inserts consume points by design.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_one_visit_per_day
ON activity(user_id, substr(created_at,1,10))
WHERE type='visita';

CREATE TRIGGER IF NOT EXISTS trg_redemption_request
BEFORE INSERT ON redemptions
WHEN NEW.status = 'pendiente'
BEGIN
  SELECT RAISE(ABORT,'Recompensa no disponible')
  WHERE NOT EXISTS (
    SELECT 1 FROM rewards
    WHERE id=NEW.reward_id AND active=1 AND cost=NEW.cost
  );
  SELECT RAISE(ABORT,'Puntos insuficientes')
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles WHERE id=NEW.user_id AND points>=NEW.cost
  );
  UPDATE profiles SET points=points-NEW.cost
  WHERE id=NEW.user_id AND points>=NEW.cost;
  SELECT RAISE(ABORT,'Puntos insuficientes') WHERE changes()<>1;
  INSERT INTO activity(id,user_id,type,delta,detail,created_at)
  VALUES (lower(hex(randomblob(16))),NEW.user_id,'canje_solicitado',
          -NEW.cost,(SELECT name FROM rewards WHERE id=NEW.reward_id),datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS trg_redemption_staff_check
BEFORE UPDATE OF status ON redemptions
WHEN NEW.status='validado' AND OLD.status='pendiente'
BEGIN
  SELECT RAISE(ABORT,'Personal no autorizado')
  WHERE NEW.validated_by IS NULL OR NOT EXISTS(
    SELECT 1 FROM profiles WHERE id=NEW.validated_by AND role IN ('puerta','admin')
  );
  SELECT RAISE(ABORT,'No puedes validar tu propio canje')
  WHERE NEW.validated_by=NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_redemption_validation_log
AFTER UPDATE OF status ON redemptions
WHEN NEW.status='validado' AND OLD.status='pendiente'
BEGIN
  INSERT INTO activity(id,user_id,type,delta,detail,staff_id,created_at)
  VALUES (lower(hex(randomblob(16))),NEW.user_id,'canje_validado',0,
          'Canje '||NEW.code||' validado',NEW.validated_by,datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS trg_redemption_status_flow
BEFORE UPDATE OF status ON redemptions
WHEN OLD.status<>'pendiente' AND NEW.status<>OLD.status
BEGIN
  SELECT RAISE(ABORT,'Este canje ya está cerrado');
END;

-- A single INSERT into the audit log performs a validated member update
-- atomically; no privileged SQL mutation routes are offered to public callers.
CREATE TRIGGER IF NOT EXISTS trg_admin_member_change
BEFORE INSERT ON admin_member_changes
BEGIN
 SELECT RAISE(ABORT,'Solo un administrador puede modificar socios')
 WHERE NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.admin_id AND role='admin');

 SELECT RAISE(ABORT,'La cuenta ya no existe')
 WHERE NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.member_id);

 SELECT RAISE(ABORT,'El motivo es obligatorio')
 WHERE length(trim(NEW.reason)) NOT BETWEEN 5 AND 250;

 SELECT RAISE(ABORT,'Datos inválidos')
 WHERE json_valid(NEW.before_data)=0 OR json_valid(NEW.after_data)=0;

 SELECT RAISE(ABORT,'El cambio está desactualizado')
 WHERE NOT EXISTS (
   SELECT 1 FROM profiles p WHERE p.id=NEW.member_id
     AND p.name=json_extract(NEW.before_data,'$.name')
     AND p.role=json_extract(NEW.before_data,'$.role')
     AND p.points=json_extract(NEW.before_data,'$.points')
     AND p.lifetime_points=json_extract(NEW.before_data,'$.lifetime_points')
     AND p.visits=json_extract(NEW.before_data,'$.visits')
 );

 SELECT RAISE(ABORT,'No puedes quitarte tu rol de administrador')
 WHERE NEW.admin_id=NEW.member_id AND json_extract(NEW.after_data,'$.role')<>'admin';

 SELECT RAISE(ABORT,'Debe permanecer al menos un administrador')
 WHERE EXISTS(SELECT 1 FROM profiles WHERE id=NEW.member_id AND role='admin')
   AND json_extract(NEW.after_data,'$.role')<>'admin'
   AND (SELECT count(*) FROM profiles WHERE role='admin')<2;

 SELECT RAISE(ABORT,'Nombre inválido')
 WHERE length(trim(coalesce(json_extract(NEW.after_data,'$.name'),''))) NOT BETWEEN 2 AND 80;

 SELECT RAISE(ABORT,'Rol inválido')
 WHERE json_extract(NEW.after_data,'$.role') NOT IN ('socio','puerta','admin')
    OR json_extract(NEW.after_data,'$.role') IS NULL;

 SELECT RAISE(ABORT,'Saldo inválido')
 WHERE json_type(NEW.after_data,'$.points')<>'integer'
    OR json_type(NEW.after_data,'$.lifetime_points')<>'integer'
    OR json_type(NEW.after_data,'$.visits')<>'integer'
    OR json_extract(NEW.after_data,'$.points') NOT BETWEEN 0 AND 100000000
    OR json_extract(NEW.after_data,'$.lifetime_points') NOT BETWEEN 0 AND 100000000
    OR json_extract(NEW.after_data,'$.visits') NOT BETWEEN 0 AND 1000000
    OR json_extract(NEW.after_data,'$.lifetime_points') <
       json_extract(NEW.after_data,'$.points');

 SELECT RAISE(ABORT,'No hay cambios que guardar')
 WHERE json_extract(NEW.before_data,'$.name')=json_extract(NEW.after_data,'$.name')
   AND json_extract(NEW.before_data,'$.role')=json_extract(NEW.after_data,'$.role')
   AND json_extract(NEW.before_data,'$.points')=json_extract(NEW.after_data,'$.points')
   AND json_extract(NEW.before_data,'$.lifetime_points')=json_extract(NEW.after_data,'$.lifetime_points')
   AND json_extract(NEW.before_data,'$.visits')=json_extract(NEW.after_data,'$.visits');

 UPDATE profiles
 SET name=json_extract(NEW.after_data,'$.name'),
     role=json_extract(NEW.after_data,'$.role'),
     points=json_extract(NEW.after_data,'$.points'),
     lifetime_points=json_extract(NEW.after_data,'$.lifetime_points'),
     visits=json_extract(NEW.after_data,'$.visits')
 WHERE id=NEW.member_id;

 INSERT INTO activity(id,user_id,type,delta,detail,created_at,staff_id)
 SELECT lower(hex(randomblob(16))),NEW.member_id,'ajuste_admin',
        json_extract(NEW.after_data,'$.points') -
        json_extract(NEW.before_data,'$.points'),
        substr('Ajuste de administración: '||NEW.reason,1,400),
        datetime('now'),NEW.admin_id
 WHERE json_extract(NEW.after_data,'$.points')<>json_extract(NEW.before_data,'$.points')
    OR json_extract(NEW.after_data,'$.lifetime_points')<>
       json_extract(NEW.before_data,'$.lifetime_points');
END;
