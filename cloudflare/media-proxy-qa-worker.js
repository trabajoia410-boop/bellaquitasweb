/**
 * Bellaquitas Fest — alternativa TEMPORAL de pruebas (NUNCA producción).
 * Entrega los archivos originales del commit Git fijo, con byte ranges reales.
 * Fuente remota GitHub: NO son Workers Static Assets propios. No marcar release gates.
 * Este Worker no tiene D1, cuentas, secretos, R2 ni acceso al dominio bellaquitas.fr.
 */
const SOURCE_SHA="733244ec58fa2d0af053bf969d25525a8f878aa2";
const ORIGIN="https://raw.githubusercontent.com/trabajoia410-boop/bellaquitasweb/"+SOURCE_SHA+"/assets/";
const MEDIA=Object.freeze({
  "Bellaquitas Fest para móvil.mp4": {
    "bytes": 9072277,
    "type": "video/mp4"
  },
  "LICENSE-QR-LIBRARIES.txt": {
    "bytes": 12300,
    "type": "text/plain"
  },
  "auth-startup.js": {
    "bytes": 56,
    "type": "application/javascript"
  },
  "bellaquitas fiesta portada movil.mp4": {
    "bytes": 2028873,
    "type": "video/mp4"
  },
  "bellaquitas fiesta portada.mp4": {
    "bytes": 25437525,
    "type": "video/mp4"
  },
  "bellaquitas-fiesta-fondo 1.mp4": {
    "bytes": 2071218,
    "type": "video/mp4"
  },
  "bellaquitas-fiesta-fondo.mp4": {
    "bytes": 15545064,
    "type": "video/mp4"
  },
  "favicon.svg": {
    "bytes": 379,
    "type": "image/svg+xml"
  },
  "google-g.svg": {
    "bytes": 711,
    "type": "image/svg+xml"
  },
  "icon-180.png": {
    "bytes": 11489,
    "type": "image/png"
  },
  "icon-192.png": {
    "bytes": 13529,
    "type": "image/png"
  },
  "icon-512.png": {
    "bytes": 42968,
    "type": "image/png"
  },
  "icon-maskable-512.png": {
    "bytes": 28411,
    "type": "image/png"
  },
  "logo-bellaquitas.webp": {
    "bytes": 317366,
    "type": "image/webp"
  },
  "logo-navbar.png": {
    "bytes": 29101,
    "type": "image/png"
  },
  "tarjeta-conejita-frente.webp": {
    "bytes": 149924,
    "type": "image/webp"
  },
  "tarjeta-qr-dorso.webp": {
    "bytes": 85126,
    "type": "image/webp"
  },
  "migrated-logos/705cc152-5de2-407a-a880-1e78ca4b30ea.png": {
    "bytes": 904603,
    "type": "image/png"
  },
  "migrated-logos/af5b256c-877b-4c9c-8d36-d00854885c4b.jpg": {
    "bytes": 130096,
    "type": "image/jpeg"
  },
  "migrated-logos/f4978ae8-1058-43a7-b5cd-ef9b17c11843.png": {
    "bytes": 904603,
    "type": "image/png"
  }
});
const HEADERS={
 "X-Robots-Tag":"noindex, nofollow",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "Cross-Origin-Resource-Policy":"cross-origin",
 "Access-Control-Allow-Origin":"*",
 "Cache-Control":"no-store"
};
function response(status,message){
 return new Response(JSON.stringify({error:message}),{status,headers:{...HEADERS,"Content-Type":"application/json"}});
}
export default {
 async fetch(request){
  const u=new URL(request.url);
  if(request.method!=="GET"&&request.method!=="HEAD")return response(405,"Método no permitido");
  if(u.pathname==="/health")return new Response(JSON.stringify({
   service:"bellaquitas-media-proxy-qa",production:false,
   mode:"temporary-github-proxy",uploadedStaticAssets:false,
   sourceCommit:SOURCE_SHA,allowlistedAssets:Object.keys(MEDIA).length
  }),{headers:{...HEADERS,"Content-Type":"application/json"}});
  if(!u.pathname.startsWith("/assets/"))return response(404,"No encontrado");
  let name;
  try{name=decodeURIComponent(u.pathname.slice(8));}
  catch{return response(400,"Codificación de ruta incorrecta");}
  if(!Object.hasOwn(MEDIA,name))return response(404,"Recurso no autorizado");
  const item=MEDIA[name];
  const range=request.headers.get("Range");
  if(range&&(!/^bytes=(?:[0-9]+-[0-9]*|-[0-9]+)$/.test(range)||range.length>80))
   return response(416,"Range no admitido");
  const segments=name.split("/").map(encodeURIComponent);
  const target=ORIGIN+segments.join("/");
  const headers=new Headers();
  if(range)headers.set("Range",range);
  let upstream;
  try{
   upstream=await fetch(target,{method:request.method,headers,redirect:"error"});
  }catch(err){return response(503,"Recurso temporal no disponible ("+String(err?.message||"error").slice(0,90)+")");}
  if(![200,206,304,416].includes(upstream.status))
   return response(503,"El origen original no está disponible");
  if(range&&upstream.status===200)
   return response(502,"El origen no respetó la solicitud Range");
  if(upstream.status===206){
   const contentRange=upstream.headers.get("Content-Range")||"";
   const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
   if(!match||Number(match[3])!==item.bytes||Number(match[2])>=item.bytes||Number(match[1])>Number(match[2]))
    return response(502,"Contenido Range distinto del original");
  }
  if(upstream.status===200){
   const length=upstream.headers.get("Content-Length");
   if(length!==null&&Number(length)!==item.bytes)
    return response(502,"Tamaño original no coincide");
  }
  const outgoing=new Headers();
  for(const [key,value] of Object.entries(HEADERS))outgoing.set(key,value);
  outgoing.set("Content-Type",item.type);
  outgoing.set("Accept-Ranges","bytes");
  const cLen=upstream.headers.get("Content-Length");
  if(cLen)outgoing.set("Content-Length",cLen);
  else if(upstream.status===200)outgoing.set("Content-Length",String(item.bytes));
  const cRange=upstream.headers.get("Content-Range");
  if(cRange)outgoing.set("Content-Range",cRange);
  return new Response(request.method==="HEAD"?null:upstream.body,{status:upstream.status,headers:outgoing});
 }
};
