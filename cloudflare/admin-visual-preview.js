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
  if(page)return page;
  if(pathname==="/v1/auth/email/status"&&request.method==="GET")return api({login:false,registration:false});
  if(pathname==="/v1/auth/me"&&request.method==="GET")return api({authenticated:false,profile:null});
  if(pathname==="/v1/admin/session")return api({authorized:false},401);
  if(pathname.startsWith("/v1/auth/"))return api({error:"Vista visual aislada: acceso real desactivado por seguridad"},503);
  return api({error:"No encontrado"},404);
 }
};
