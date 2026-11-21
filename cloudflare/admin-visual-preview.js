/* Bellaquitas Fest — vista VISUAL aislada. No permite acceder a cuentas. */
import {adminConsoleRoute} from "./admin-console.js";
const api=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}
});
export default {
 async fetch(request){
  const pathname=new URL(request.url).pathname;
  if(pathname==="/")return Response.redirect(new URL("/administracion/",request.url).toString(),302);
  const page=adminConsoleRoute(request);
  if(page){
   if(request.method==="HEAD")return page;
   // El preview carece de backend real: no se permiten introducir credenciales.
   // Reutilizar el HTML auténtico solo para inspección, nunca para acceso.
   let html=await page.text();
   html=html.replace("<main>",'<main><div class="warning" role="alert" style="margin:0 auto 20px;max-width:880px;font-weight:700">MODO DEMOSTRACIÓN · NO introduzcas correos ni contraseñas. El acceso está desactivado y no se guardan datos.</div>');
   html=html.replace('href="/v1/auth/google/start?return=admin" class="action"','href="/v1/auth/google/start?return=admin" class="action secondary" aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.45"');
   html=html.replace('<form id="loginForm">','<form id="loginForm"><fieldset disabled style="border:0;margin:0;padding:0;opacity:.55">');
   html=html.replace('</button></form></section>','</button></fieldset></form></section>');
   // Añadir un bloqueo visual de los enlaces de acceso.
   const headers=new Headers(page.headers);
   headers.set("Cache-Control","no-store, private");
   return new Response(html,{status:page.status,headers});
  }
  if(pathname==="/v1/auth/email/status"&&request.method==="GET")return api({login:false,registration:false});
  if(pathname==="/v1/auth/me"&&request.method==="GET")return api({authenticated:false,profile:null});
  if(pathname==="/v1/admin/session")return api({authorized:false},401);
  if(pathname.startsWith("/v1/auth/"))return api({error:"Vista visual aislada: acceso real desactivado por seguridad"},503);
  return api({error:"No encontrado"},404);
 }
};
