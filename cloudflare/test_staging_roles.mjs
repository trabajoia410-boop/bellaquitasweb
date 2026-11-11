/**
 * Pruebas de control de acceso de los módulos reales recuperados del Worker.
 * Simula identidades y base D1. Nunca hace una solicitud de red ni escribe datos reales.
 *
 * node cloudflare/staging-source-2026-11-11/extract-modules.mjs
 * node --experimental-default-type=module --test cloudflare/test_staging_roles.mjs
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const folder=path.join(here,"staging-source-2026-11-11","recovered-src");
const {protectedRoute}=await import(pathToFileURL(path.join(folder,"protected-routes.js")).href);
const {mirrorDataRoute}=await import(pathToFileURL(path.join(folder,"mirror-data-routes.js")).href);
const {mirrorWriteRoute}=await import(pathToFileURL(path.join(folder,"mirror-write-routes.js")).href);
const {authRoute}=await import(pathToFileURL(path.join(folder,"auth-routes.js")).href);

const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const TOKEN="A".repeat(43); // Cookie imposible de utilizar en el servicio real.
const ID="00000000-0000-4000-8000-000000000001";

function mock(role,{authenticated=true,mutations="disabled"}={}){
  const actor=authenticated?{
    id:ID, name:"Socio de prueba",role,
    member_code:"MBR-FICTICIO00001",points:0,lifetime_points:0,visits:0,
    created_at:"2026-11-11T00:00:00Z"
  }:null;
  const reads=[];
  const env={
    PUBLIC_ORIGIN:BASE,
    STAGING_MUTATIONS:mutations,
    DB:{
      prepare(sql){
        assert.match(sql,/^\s*SELECT\b/i,"Solo se permiten SELECT en estas pruebas");
        return {
          args:[],
          bind(...args){this.args=args;return this;},
          async first(){
            reads.push({sql,args:this.args});
            return sql.includes("FROM auth_sessions")?actor:null;
          },
          async all(){reads.push({sql,args:this.args});return {results:[]};}
        };
      },
      batch(){throw new Error("El test nunca debe escribir ni ejecutar lotes");}
    }
  };
  return {env,reads};
}
function req(route,{method="GET",session=true,origin=BASE,body}={}){
  const headers={"Origin":origin,"Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"};
  if(session)headers.Cookie="__Host-bf_session="+TOKEN;
  if(body!==undefined)headers["Content-Type"]="application/json";
  return new Request(BASE+route,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body)
  });
}
async function expectStatus(handler,ctx,route,status,options={}){
  const res=await handler(req(route,options),ctx.env);
  assert.equal(res?.status,status,route+" devolvió "+res?.status+"; esperado "+status);
  return res;
}

test("sin sesión se deniegan las rutas de socio, puerta y administración",async()=>{
  const ctx=mock("socio",{authenticated:false});
  for(const route of ["/v1/me/activity","/v1/admin/members","/v1/door/members"]){
    await expectStatus(protectedRoute,ctx,route,401,{session:false});
  }
  for(const route of ["/v1/mirror/admin/site-drafts","/v1/mirror/door/redemptions"]){
    await expectStatus(mirrorDataRoute,ctx,route,401,{session:false});
  }
  await expectStatus(mirrorWriteRoute,ctx,"/v1/mirror/admin/write",401,
    {method:"POST",session:false,body:{}});
});

test("socio autenticado no accede a funciones administrativas",async()=>{
  const ctx=mock("socio");
  await expectStatus(protectedRoute,ctx,"/v1/admin/members",403);
  await expectStatus(protectedRoute,ctx,"/v1/door/members",403);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/admin/catalog/events",403);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/admin/site-drafts",403);
  await expectStatus(mirrorWriteRoute,ctx,"/v1/mirror/admin/write",403,{
    method:"POST",body:{kind:"site_content",action:"publish"}
  });
});

test("personal de puerta puede consultar puerta, no editar ni ver administración",async()=>{
  const ctx=mock("puerta");
  await expectStatus(protectedRoute,ctx,"/v1/door/members",200);
  await expectStatus(protectedRoute,ctx,"/v1/admin/members",403);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/door/redemptions",200);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/admin/catalog/events",403);
  await expectStatus(mirrorWriteRoute,ctx,"/v1/mirror/admin/write",403,{
    method:"POST",body:{kind:"site_content"}
  });
});

test("administrador puede consultar catálogo, borradores y socios",async()=>{
  const ctx=mock("admin");
  await expectStatus(protectedRoute,ctx,"/v1/admin/members",200);
  await expectStatus(protectedRoute,ctx,"/v1/door/members",200);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/admin/site-drafts",200);
  await expectStatus(mirrorDataRoute,ctx,"/v1/mirror/admin/catalog/events",200);
});

test("la configuración actual bloquea todas las modificaciones de pruebas",async()=>{
  const ctx=mock("admin");
  await expectStatus(mirrorWriteRoute,ctx,"/v1/mirror/admin/write",423,{
    method:"POST",body:{kind:"site_content",action:"publish"}
  });
  await expectStatus(protectedRoute,ctx,"/v1/door/checkin",423,{
    method:"POST",body:{code:"MBR-FICTICIO00001"}
  });
  await expectStatus(protectedRoute,ctx,"/v1/admin/member",423,{
    method:"POST",body:{member_id:ID}
  });
});

test("rechazo de origen externo incluso cuando se simula edición habilitada",async()=>{
  const ctx=mock("admin",{mutations:"enabled"});
  const external="https://externo.example";
  await expectStatus(mirrorWriteRoute,ctx,"/v1/mirror/admin/write",403,{
    method:"POST",body:{kind:"site_content",action:"publish"},origin:external
  });
  await expectStatus(protectedRoute,ctx,"/v1/door/checkin",403,{
    method:"POST",body:{code:"MBR-FICTICIO00001"},origin:external
  });
});

test("socio no puede validar QR aunque se simule activación",async()=>{
  const ctx=mock("socio",{mutations:"enabled"});
  await expectStatus(protectedRoute,ctx,"/v1/door/checkin",403,{
    method:"POST",body:{code:"MBR-FICTICIO00001"}
  });
});

test("actividad de socio siempre se filtra por su identidad",async()=>{
  const ctx=mock("socio");
  await expectStatus(protectedRoute,ctx,"/v1/me/activity",200);
  assert.ok(ctx.reads.some(x=>x.sql.includes("FROM activity WHERE user_id=?")&&x.args[0]===ID));
});

test("cierre de sesión desde origen externo se rechaza",async()=>{
  const ctx=mock("admin");
  await expectStatus(authRoute,ctx,"/v1/auth/logout",403,{
    method:"POST",origin:"https://externo.example"
  });
});

test("las identidades empleadas son exclusivamente ficticias",()=>{
  assert.match(ID,/^00000000-0000-4000-8000-/);
  assert.equal(TOKEN.length,43);
});
