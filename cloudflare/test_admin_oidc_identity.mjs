/**
 * Bellaquitas Fest: verifica identidad OIDC EXCLUSIVAMENTE con JWTs firmados
 * y claves RSA fabricadas al vuelo. No hay red, Clerk/Auth0, contraseñas,
 * usuarios, R2 ni bases Cloudflare/Supabase reales.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyAdminOidcIdToken,existingAdminFromExternalIdToken} from "./qa-candidates/admin-oidc-verifier.js";

const here=path.dirname(fileURLToPath(import.meta.url));
const ISSUER="https://fake-provider.example.test/";
const ISSUER_OTHER="https://other-provider.example.test/";
const AUDIENCE="bellaquitas-admin-client";
const NONCE="validNonce_"+("Y".repeat(32));
const NOW=1800000000; // Fecha artificial de prueba
const ADMIN="00000000-0000-4000-8000-000000000011";
const MEMBER="00000000-0000-4000-8000-000000000012";
const adminSubject="user_fictitious_admin_1";
const memberSubject="user_fictitious_member_2";
const baseClaims={
 iss:ISSUER,aud:AUDIENCE,nonce:NONCE,sub:adminSubject,iat:NOW-30,nbf:NOW-30,exp:NOW+300
};
const keys=await crypto.subtle.generateKey(
 {name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},
 true,["sign","verify"]
);
const publicJwk={...(await crypto.subtle.exportKey("jwk",keys.publicKey)),
 kid:"unit-test-key-1",alg:"RS256",use:"sig"};
const conf=(over={})=>({
 provider:"clerk",issuer:ISSUER,audience:AUDIENCE,nonce:NONCE,
 jwks:{keys:[publicJwk]},now:NOW,...over
});
const b64=data=>Buffer.from(typeof data==="string"?data:JSON.stringify(data)).toString("base64url");
async function signed(claims={},header={}){
 const encodedHeader=b64({typ:"JWT",alg:"RS256",kid:publicJwk.kid,...header});
 const encodedClaims=b64({...baseClaims,...claims});
 const body=encodedHeader+"."+encodedClaims;
 const signature=new Uint8Array(await crypto.subtle.sign(
   "RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body)));
 return body+"."+Buffer.from(signature).toString("base64url");
}
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
db.exec("CREATE TABLE profiles(id TEXT PRIMARY KEY, role TEXT NOT NULL)");
db.exec(fs.readFileSync(path.join(here,"migrations/0006-admin-external-identity-candidate.sql"),"utf8"));
db.prepare("INSERT INTO profiles(id,role) VALUES (?,?)").run(ADMIN,"admin");
db.prepare("INSERT INTO profiles(id,role) VALUES (?,?)").run(MEMBER,"socio");
db.prepare("INSERT INTO admin_external_identities(provider,issuer,subject,profile_id) VALUES (?,?,?,?)")
 .run("clerk",ISSUER,adminSubject,ADMIN);
db.prepare("INSERT INTO admin_external_identities(provider,issuer,subject,profile_id) VALUES (?,?,?,?)")
 .run("clerk",ISSUER,memberSubject,MEMBER);
const D1={prepare(sql){
 const stmt=db.prepare(sql);
 return {bind(...args){return {async first(){return stmt.get(...args)||null;}};}};
}};
const deny=async(token,options=conf())=>{
 await assert.rejects(verifyAdminOidcIdToken(token,options),/Identidad externa no verificada/);
};
test("JWT RSA válido produce SOLO identidad firmada, no correo ni rol",async()=>{
 const result=await verifyAdminOidcIdToken(await signed({email:"inventado@example.test",role:"admin"}),conf());
 assert.deepEqual(result,{provider:"clerk",issuer:ISSUER,subject:adminSubject});
 assert.equal(Object.isFrozen(result),true);
});
test("Solo un perfil admin previamente vinculado en D1 entra, sin crear usuarios",async()=>{
 const first=db.prepare("SELECT COUNT(*) AS n FROM profiles").get().n;
 const matched=await existingAdminFromExternalIdToken(await signed(),conf(),D1);
 assert.deepEqual(matched,{profile_id:ADMIN});
 const ignored=await existingAdminFromExternalIdToken(
   await signed({sub:memberSubject,email:"admin@example.test",role:"admin",user_metadata:{is_admin:true}}),
   conf(),D1);
 assert.equal(ignored,null);
 const unknown=await existingAdminFromExternalIdToken(
   await signed({sub:"user_unlinked",email:"admin@example.test",role:"admin"}),
   conf(),D1);
 assert.equal(unknown,null);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM profiles").get().n,first);
});
test("Revocar vinculación impide acceso sin cambiar rol ni puntos",async()=>{
 const fixture=db.prepare("INSERT INTO profiles(id,role) VALUES (?,?)");
 const transient="00000000-0000-4000-8000-000000000013";
 fixture.run(transient,"admin");
 db.prepare("INSERT INTO admin_external_identities(provider,issuer,subject,profile_id) VALUES (?,?,?,?)")
   .run("clerk",ISSUER,"user_transient",transient);
 assert.deepEqual(await existingAdminFromExternalIdToken(await signed({sub:"user_transient"}),conf(),D1),{profile_id:transient});
 db.prepare("DELETE FROM admin_external_identities WHERE subject=?").run("user_transient");
 assert.equal(await existingAdminFromExternalIdToken(await signed({sub:"user_transient"}),conf(),D1),null);
});
test("Una clave o firma alterada se rechaza",async()=>{
 const valid=await signed();
 await deny(valid.slice(0,-2)+(valid.slice(-2)==="aa"?"bb":"aa"));
 await deny(await signed({}, {kid:"unknown-kid"}));
 await deny(await signed({}, {alg:"none"}));
 await deny(await signed({}, {jku:"https://attacker.invalid/jwks.json"}));
 await deny(await signed({}, {crit:["exp"]}));
});
test("No confundir emisores ni clientes y no confiar en emails iguales",async()=>{
 await deny(await signed({iss:ISSUER_OTHER}));
 await deny(await signed({aud:"other-client"}));
 await deny(await signed(),conf({issuer:ISSUER_OTHER}));
 await deny(await signed(),conf({audience:"other-client"}));
 await deny(await signed({nonce:"other-nonce-"+("A".repeat(30))}));
});
test("Rechaza expiración, emisión futura, iat antigua y nbf futuro",async()=>{
 await deny(await signed({exp:NOW}));
 await deny(await signed({iat:NOW+61}));
 await deny(await signed({iat:NOW-601}));
 await deny(await signed({nbf:NOW+61}));
 await deny(await signed({exp:"1970"}));
});
test("Audiencias múltiples requieren azp correcto",async()=>{
 await deny(await signed({aud:[AUDIENCE,"another"]}));
 await deny(await signed({aud:[AUDIENCE,"another"],azp:"another"}));
 const accepted=await verifyAdminOidcIdToken(
   await signed({aud:[AUDIENCE,"another"],azp:AUDIENCE}),conf());
 assert.equal(accepted.subject,adminSubject);
});
test("El único kid confiable proviene de un JWKS fijo sin duplicados",async()=>{
 const token=await signed();
 await deny(token,conf({jwks:{keys:[]}}));
 await deny(token,conf({jwks:{keys:[publicJwk,publicJwk]}}));
 await deny(token,conf({jwks:{keys:[{...publicJwk,use:"enc"}]}}));
});
test("Identidades de distintos proveedores no se mezclan",async()=>{
 const token=await signed();
 const noLink=await existingAdminFromExternalIdToken(token,conf({provider:"auth0"}),D1);
 assert.equal(noLink,null);
 assert.throws(()=>db.prepare("INSERT INTO admin_external_identities(provider,issuer,subject,profile_id) VALUES (?,?,?,?)")
   .run("clerk",ISSUER,adminSubject,MEMBER),/UNIQUE/);
 assert.throws(()=>db.prepare("INSERT INTO admin_external_identities(provider,issuer,subject,profile_id) VALUES (?,?,?,?)")
   .run("otro",ISSUER,"unknown",ADMIN),/CHECK/);
});
test("No acepta datos sin firma, JWKS ausentes ni nonce trivial",async()=>{
 await deny("header.payload.signature");
 await deny(await signed(),conf({jwks:{keys:[]}}));
 await deny(await signed(),conf({nonce:"123"}));
});
console.log("Ensayo OIDC: RSA firmado ficticio, SQLite :memory:, CERO proveedor conectado.");
