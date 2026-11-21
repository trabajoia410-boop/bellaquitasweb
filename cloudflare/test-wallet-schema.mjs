#!/usr/bin/env node
/** Isolated schema QA: no D1, people, domain or real points are touched. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const sql=readFileSync("cloudflare/migrations/0010-wallet-digital-loyalty.sql","utf8");
assert.doesNotMatch(sql,/(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:profiles|activity|rewards|redemptions)\b/i);
assert.doesNotMatch(sql,/\b(?:DROP|ALTER)\s+TABLE\b/i);
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
db.exec("CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT,role TEXT)");
const uid="11111111-1111-4111-8111-111111111111",
      employeeId="22222222-2222-4222-8222-222222222222",
      programId="33333333-3333-4333-8333-333333333333",
      clientId="44444444-4444-4444-8444-444444444444";
db.prepare("INSERT INTO profiles VALUES(?,?,?)").run(uid,"Admin","admin");
db.prepare("INSERT INTO profiles VALUES(?,?,?)").run(employeeId,"Door","puerta");
db.exec(sql);
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'wallet_%'").all();
assert.equal(tables.length,13);
db.prepare("INSERT INTO wallet_programs(id,slug,name,stamp_goal) VALUES(?,?,?,?)")
 .run(programId,"bellaquitas-fest","Bellaquitas Fest",3);
const customerStmt=db.prepare("INSERT INTO wallet_customers(id,program_id,name,email,contact_hash,scan_token_hash,consent_at) VALUES (?,?,?,?,?,?,unixepoch())");
customerStmt.run(clientId,programId,"Persona Ficticia","test@example.invalid","hash-one","scan-one");
assert.throws(()=>customerStmt.run("55555555-5555-4555-8555-555555555555",programId,"Duplicado","test@example.invalid","hash-one","scan-two"));
const stamp=db.prepare("INSERT INTO wallet_stamp_events(id,customer_id,actor_profile_id,employee_id,action,delta,request_id) VALUES (?,?,?,?,'stamp',1,?)");
const current=()=>db.prepare("SELECT stamps,unlocked_rewards,redeemed_rewards FROM wallet_customers WHERE id=?").get(clientId);
stamp.run("66666666-6666-4666-8666-666666666666",clientId,employeeId,null,"evt-one");
assert.equal(current().stamps,1);
assert.equal(db.prepare("SELECT count(*) AS n FROM wallet_sync_jobs WHERE customer_id=? AND status='pending'").get(clientId).n,2,
 "A stamped customer gets a durable job for both wallet providers");
assert.throws(()=>stamp.run("77777777-7777-4777-8777-777777777777",clientId,employeeId,null,"evt-two"),
 "SQL cooldown must reject duplicate stamps");
assert.equal(current().stamps,1);
db.prepare("UPDATE wallet_customers SET last_stamp_at=unixepoch()-900 WHERE id=?").run(clientId);
stamp.run("77777777-7777-4777-8777-777777777777",clientId,employeeId,null,"evt-two");
assert.equal(current().stamps,2);
db.prepare("UPDATE wallet_customers SET last_stamp_at=unixepoch()-900 WHERE id=?").run(clientId);
stamp.run("88888888-8888-4888-8888-888888888888",clientId,employeeId,null,"evt-three");
assert.deepEqual([current().stamps,current().unlocked_rewards],[0,1]);
assert.throws(()=>stamp.run("88888888-8888-4888-8888-888888888888",clientId,employeeId,null,"evt-three"),
 "Unique request ID is an idempotency key");
const claim=db.prepare("INSERT INTO wallet_reward_claims(id,customer_id,verified_by) VALUES(?,?,?)");
assert.throws(()=>claim.run("99999999-9999-4999-8999-999999999999",clientId,employeeId));
claim.run("99999999-9999-4999-8999-999999999999",clientId,uid);
assert.equal(current().redeemed_rewards,1);
assert.equal(db.prepare("SELECT count(*) AS n FROM wallet_sync_jobs WHERE customer_id=?").get(clientId).n,2,
 "Repeat stamps/claims coalesce outbox jobs");
assert.throws(()=>claim.run("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",clientId,uid),
 "Cannot redeem one completed card twice");
assert.throws(()=>db.prepare("INSERT INTO wallet_stamp_events(id,customer_id,actor_profile_id,action,delta,request_id,reason) VALUES(?, ?,?,'reversal',-1,?,?)")
 .run("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",clientId,employeeId,"evt-minus","Motivo de prueba"));
assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
assert.equal(db.prepare("SELECT count(*) AS n FROM wallet_stamp_events").get().n,3);
console.log("PASS: 13 tablas nuevas, outbox Apple/Google, 0 cambios en perfiles, hash único, cooldown, ciclo, canje, solo admin y 0 FK errors.");
