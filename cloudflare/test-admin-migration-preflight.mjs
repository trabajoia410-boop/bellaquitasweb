#!/usr/bin/env node
/* Bellaquitas Fest — ensayo idempotente migraciones 0007 y 0008 en SQLite RAM.
 * NUNCA usa D1 real, Supabase, correos ni cuentas reales.
 */
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:');
db.exec("PRAGMA foreign_keys=ON;");
db.exec("CREATE TABLE profiles (id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,member_code TEXT NOT NULL UNIQUE,points INTEGER NOT NULL,lifetime_points INTEGER NOT NULL,visits INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now'))); CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY,profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT (unixepoch()));");
const id="11111111-1111-4111-8111-111111111111";
db.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES(?,?,?,?,?,?,?)")
 .run(id,'Admin QA ficticio','admin','MBR-QA-TEST1',330,340,2);
db.prepare("INSERT INTO auth_sessions(token_hash,profile_id,expires_at) VALUES(?,?,unixepoch()+3600)")
 .run('session-qa',id);
const original={
 profile:{...db.prepare('SELECT * FROM profiles LIMIT 1').get()},
 session:{...db.prepare('SELECT * FROM auth_sessions LIMIT 1').get()}
};
for(const migration of ['0007-admin-step-up.sql','0008-admin-email-link.sql']){
 const sql=readFileSync('cloudflare/migrations/'+migration,'utf8');
 assert.ok(!/(?:^|;)\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER)\b/im.test(sql.replace(/^--.*$/gm,'')),
 'Migración administrativa no debe cambiar cuentas o puntos');
 db.exec(sql);
 db.exec(sql); // reejecución sin duplicar ni destruir
}
const list=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_admin_%' ORDER BY name").all().map(x=>x.name);
assert.deepEqual(list,['auth_admin_email_links','auth_admin_sessions']);
const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_admin_%' ORDER BY name").all().map(x=>x.name);
assert.ok(indexes.includes('idx_admin_sessions_profile_expiry'));
assert.ok(indexes.includes('idx_admin_sessions_regular'));
assert.ok(indexes.includes('idx_admin_email_links_profile'));
assert.ok(indexes.includes('idx_admin_email_links_expiry'));
assert.deepEqual({...db.prepare('SELECT * FROM profiles LIMIT 1').get()},original.profile);
assert.deepEqual({...db.prepare('SELECT * FROM auth_sessions LIMIT 1').get()},original.session);
assert.equal(db.prepare('SELECT count(*) AS n FROM auth_admin_sessions').get().n,0);
assert.equal(db.prepare('SELECT count(*) AS n FROM auth_admin_email_links').get().n,0);
db.prepare("INSERT INTO auth_admin_sessions(token_hash,profile_id,regular_session_hash,expires_at) VALUES(?,?,?,unixepoch()+1800)")
 .run('admin-step-up',id,'session-qa');
assert.equal(db.prepare('SELECT count(*) AS n FROM auth_admin_sessions').get().n,1);
db.prepare("INSERT INTO auth_admin_email_links(token_hash,profile_id,email,password_hash,password_salt,password_iterations,expires_at) VALUES(?,?,?,?,?,?,unixepoch()+900)")
 .run('link-token',id,'qa@example.test','hash-QA','salt-QA',600000);
assert.equal(db.prepare('SELECT count(*) AS n FROM auth_admin_email_links').get().n,1);
assert.throws(()=>db.prepare("INSERT INTO auth_admin_email_links(token_hash,profile_id,email,password_hash,password_salt,password_iterations,expires_at) VALUES(?,?,?,?,?,?,unixepoch()+900)")
 .run('link-duplicate',id,'qa-2@example.test','hash-QA','salt-QA',600000),/UNIQUE|constraint/i);
assert.throws(()=>db.prepare("INSERT INTO auth_admin_email_links(token_hash,profile_id,email,password_hash,password_salt,password_iterations,expires_at) VALUES(?,?,?,?,?,?,unixepoch()+900)")
 .run('link-weak','00000000-0000-4000-8000-000000000000','qa-2@example.test','hash-QA','salt-QA',20),/CHECK|constraint/i);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
assert.deepEqual({...db.prepare('SELECT * FROM profiles LIMIT 1').get()},original.profile,'Rol y puntos intactos');
db.close();
console.log('OK: migraciones reales 0007 y 0008 aplicadas dos veces en RAM; admin step-up, integridad, sin editar roles, puntos ni sesiones.');
