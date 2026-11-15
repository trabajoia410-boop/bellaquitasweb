// Bellaquitas Fest — servidor de medios QA, separado de la web y del API.
// NUNCA usar este Worker en bellaquitas.fr ni concederle acceso a D1/R2.
const MEDIA={
 "Bellaquitas Fest para móvil.mp4":"video/mp4",
 "bellaquitas fiesta portada movil.mp4":"video/mp4",
 "bellaquitas fiesta portada.mp4":"video/mp4",
 "bellaquitas-fiesta-fondo 1.mp4":"video/mp4",
 "bellaquitas-fiesta-fondo.mp4":"video/mp4",
 "LICENSE-QR-LIBRARIES.txt":"text/plain",
 "auth-startup.js":"application/javascript",
 "favicon.svg":"image/svg+xml",
 "google-g.svg":"image/svg+xml",
 "icon-180.png":"image/png",
 "icon-192.png":"image/png",
 "icon-512.png":"image/png",
 "icon-maskable-512.png":"image/png",
 "logo-bellaquitas.webp":"image/webp",
 "logo-navbar.png":"image/png",
 "tarjeta-conejita-frente.webp":"image/webp",
 "tarjeta-qr-dorso.webp":"image/webp",
 "705cc152-5de2-407a-a880-1e78ca4b30ea.png":"image/png",
 "af5b256c-877b-4c9c-8d36-d00854885c4b.jpg":"image/jpeg",
 "f4978ae8-1058-43a7-b5cd-ef9b17c11843.png":"image/png"
};
const headers={
 "X-Content-Type-Options":"nosniff",
 "X-Robots-Tag":"noindex, nofollow",
 "Cross-Origin-Resource-Policy":"same-origin",
 "Referrer-Policy":"no-referrer"
};
function respond(message,status=404){
 return new Response(JSON.stringify({error:message}),{status,headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}});
}
export default {
 async fetch(request,env){
  const u=new URL(request.url);
  if(request.method!=="GET"&&request.method!=="HEAD")return respond("Método no permitido",405);
  if(u.pathname==="/health"){
   return new Response(JSON.stringify({service:"bellaquitas-media-qa",assetsReady:!!env.ASSETS,production:false}),{
    headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}});
  }
  if(!u.pathname.startsWith("/assets/"))return respond("No encontrado");
  let name;
  try{name=decodeURIComponent(u.pathname.slice("/assets/".length));}
  catch{return respond("Ruta inválida");}
  if(!name||name.includes("\\")||name.includes("\0")||name==="."||name===".."||name.startsWith(".")||name.includes("/../"))
    return respond("Ruta inválida");
  const match=/^migrated-logos\/(.+)$/.exec(name);
  const safe=match?match[1]:name;
  const expected=MEDIA[safe];
  if(!expected||(!match&&safe.includes("/"))||(match&&!/^[-a-f0-9]{36}\.(?:png|jpg)$/.test(safe)))
   return respond("Recurso no autorizado");
  if(!env.ASSETS)return respond("Medios originales pendientes de publicación",503);
  const response=await env.ASSETS.fetch(request);
  if(response.status!==200&&response.status!==206&&response.status!==304&&response.status!==416)
   return respond("Medio original no disponible",503);
  const outgoing=new Headers(response.headers);
  for(const [k,v] of Object.entries(headers))outgoing.set(k,v);
  outgoing.set("Content-Type",expected);
  outgoing.set("Accept-Ranges","bytes");
  outgoing.set("Cache-Control","public,max-age=3600");
  return new Response(request.method==="HEAD"?null:response.body,{status:response.status,headers:outgoing});
 }
};
