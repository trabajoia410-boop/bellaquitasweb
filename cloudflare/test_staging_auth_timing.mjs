/**
 * Demuestra, sin conexión externa, que un correo existente y uno inexistente
 * realizan las mismas seis fases de PBKDF2 cuando la contraseña es incorrecta.
 * Requiere copiar la versión candidata a recovered-src antes de ejecutar.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const folder=path.join(here,"staging-source-2026-11-11","recovered-src");
const {emailAuthRoute}=await import(pathToFileURL(path.join(folder,"email-auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const HASH_SCHEME="pbkdf2-chain6-sha256-v1$";
const SALT="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const EXISTING="existente@example.test";
const UNKNOWN="inexistente@example.test";
const PASSWORD="ContraseñaFicticia#2026";

function db(){
  let writes=0;
  return {
    get writes(){return writes;},
    prepare(sql){
      return {
        args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          if(sql.includes("INSERT INTO auth_email_rate_limits")){
            writes++;
            return {attempts:1,retry_seconds:900};
          }
          if(sql.includes("SELECT email,profile_id,password_hash,password_salt,password_iterations FROM auth_email_credentials")){
            if(this.args[0]===EXISTING)return {
              email:EXISTING,
              profile_id:"00000000-0000-4000-8000-000000000001",
              password_salt:SALT,
              password_hash:HASH_SCHEME+SALT,
              password_iterations:600000
            };
            return null;
          }
          throw Error("SQL no simulada: "+sql);
        },
        async run(){throw Error("No debe crear ninguna sesión");}
      };
    }
  };
}
function env(DB){
  return {DB,PUBLIC_ORIGIN:BASE,EMAIL_AUTH_ENABLED:"yes",
    EMAIL_RATE_KEY:"TEST-KEY-LONGER-THAN-32-BYTES-000000000000"};
}
async function login(email,DB){
  const req=new Request(BASE+"/v1/auth/email/login",{
    method:"POST",
    headers:{"Origin":BASE,"Sec-Fetch-Site":"same-origin","Content-Type":"application/json"},
    body:JSON.stringify({email,password:PASSWORD})
  });
  const r=await emailAuthRoute(req,env(DB));
  return {status:r.status,payload:await r.json(),cookie:r.headers.get("set-cookie")};
}

test("correo existente e inexistente ejecutan exactamente seis derivaciones PBKDF2",async()=>{
  const subtle=crypto.subtle;
  const realDerive=subtle.deriveBits.bind(subtle);
  let calls=0;
  Object.defineProperty(subtle,"deriveBits",{configurable:true,value:async (...args)=>{
    assert.equal(args[0].iterations,100000);
    calls++;
    return realDerive(...args);
  }});
  try{
    const knownDb=db();
    const known=await login(EXISTING,knownDb),knownCalls=calls;
    calls=0;
    const absentDb=db();
    const absent=await login(UNKNOWN,absentDb),absentCalls=calls;
    assert.equal(known.status,401);
    assert.equal(absent.status,401);
    assert.equal(known.payload.error,absent.payload.error);
    assert.equal(known.cookie,null);
    assert.equal(absent.cookie,null);
    assert.equal(knownCalls,6,"Cuenta existente: trabajo PBKDF2 esperado");
    assert.equal(absentCalls,6,"Cuenta inexistente: mismo trabajo PBKDF2 esperado");
    assert.equal(knownDb.writes,2,"Solo límites de intento, sin crear sesión");
    assert.equal(absentDb.writes,2,"Solo límites de intento, sin crear sesión");
  }finally{
    delete subtle.deriveBits;
  }
});
