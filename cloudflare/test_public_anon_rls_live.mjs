/**
 * Bellaquitas Fest — autorización REAL de visitantes anónimos en Supabase.
 *
 * SOLO 5 solicitudes HTTP GET usando la clave ANON PÚBLICA del repositorio.
 * No inicia sesión como usuario, no lee ni imprime registros personales,
 * no escribe puntos/visitas ni envía la clave a otro host.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const cfg=readFileSync("config.js","utf8");
const expected="https://vlsipvngvxcgnwrhpjgg.supabase.co";
assert.match(cfg,/supabaseUrl:\s*['"]https:\/\/vlsipvngvxcgnwrhpjgg\.supabase\.co['"]/);
const matched=cfg.match(/supabaseAnonKey:\s*['"]([^'"]+)['"]/);
assert.ok(matched&&matched[1].length>20,"La clave ANON pública no está configurada");
const key=matched[1];
const paths=[
 "/rest/v1/profiles?select=id%2Crole%2Cpoints%2Cvisits&limit=1",
 "/rest/v1/admin_member_changes?select=id&limit=1",
 "/rest/v1/activity?select=id&limit=1",
 "/rest/v1/redemptions?select=id&limit=1",
 "/auth/v1/user"
];
for(const path of paths){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 let response;
 try{
  response=await fetch(expected+path,{method:"GET",headers:{
   "apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"
  },cache:"no-store",redirect:"error",signal:controller.signal});
 }finally{clearTimeout(timeout);}
 assert.ok([200,401,403].includes(response.status),
  path+" — HTTP inesperado "+response.status);
 // No imprimir ni almacenar la respuesta: solo verificar que no se
 // obtengan filas privadas desde una sesión anónima.
 if(response.ok){
  const raw=await response.text();
  assert.ok(raw.length<10000,"Respuesta inesperadamente extensa");
  const obj=JSON.parse(raw);
  if(path.startsWith("/rest/"))
   assert.deepEqual(obj,[],path+" EXPONE información privada al anónimo");
  else
   assert.fail("Supabase Auth devolvió una identidad sin token de usuario");
 }
 console.log("OK acceso anónimo DENEGADO: "+path.split("?")[0]);
}
console.log("OK: 5 rutas privadas sin acceso anónimo real, sin mutaciones ni datos descargados");
