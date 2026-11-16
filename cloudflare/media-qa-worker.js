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
// Tamaños exactos de los 20 binarios verificados en GitHub; no se sirven códigos ajenos.
const MEDIA_LENGTHS={
  "Bellaquitas Fest para móvil.mp4": 9072277,
  "LICENSE-QR-LIBRARIES.txt": 12300,
  "auth-startup.js": 56,
  "bellaquitas fiesta portada movil.mp4": 2028873,
  "bellaquitas fiesta portada.mp4": 25437525,
  "bellaquitas-fiesta-fondo 1.mp4": 2071218,
  "bellaquitas-fiesta-fondo.mp4": 15545064,
  "favicon.svg": 379,
  "google-g.svg": 711,
  "icon-180.png": 11489,
  "icon-192.png": 13529,
  "icon-512.png": 42968,
  "icon-maskable-512.png": 28411,
  "logo-bellaquitas.webp": 317366,
  "logo-navbar.png": 29101,
  "tarjeta-conejita-frente.webp": 149924,
  "tarjeta-qr-dorso.webp": 85126,
  "705cc152-5de2-407a-a880-1e78ca4b30ea.png": 904603,
  "af5b256c-877b-4c9c-8d36-d00854885c4b.jpg": 130096,
  "f4978ae8-1058-43a7-b5cd-ef9b17c11843.png": 904603
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

// Safari e iOS solicitan fragmentos HTTP 206 para poder reproducir MP4.
// Cloudflare Static Assets puede responder 200 a env.ASSETS.fetch(Range).
// Cuando ocurre, entregamos SOLO los bytes solicitados mediante streaming,
// sin cargar los vídeos enteros en memoria y sin utilizar R2.
export function parseByteRange(header,length){
 if(!header)return null;
 const m=/^bytes=(\d*)-(\d*)$/.exec(header.trim());
 if(!m||(!m[1]&&!m[2]))return {invalid:true};
 let start,end;
 if(!m[1]){
  const suffix=Number(m[2]);
  if(!Number.isSafeInteger(suffix)||suffix===0)return {invalid:true};
  start=Math.max(0,length-suffix);end=length-1;
 }else{
  start=Number(m[1]);end=m[2]?Number(m[2]):length-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=length||start>end)return {invalid:true};
  end=Math.min(length-1,end);
 }
 return {start,end,length:end-start+1};
}
function streamByteRange(body,start,end){
 const reader=body.getReader();
 let consumed=0,finished=false;
 return new ReadableStream({
  async pull(controller){
   if(finished){controller.close();return;}
   try{
    while(true){
     const {value,done}=await reader.read();
     if(done){finished=true;controller.close();return;}
     const chunkStart=consumed;
     consumed+=value.byteLength;
     if(consumed<=start)continue;
     const from=Math.max(0,start-chunkStart);
     const to=Math.min(value.byteLength,end-chunkStart+1);
     if(to>from)controller.enqueue(value.subarray(from,to));
     if(consumed>end){
      finished=true;controller.close();
      reader.cancel().catch(()=>{});
      return;
     }
     if(to>from)return;
    }
   }catch(e){finished=true;controller.error(e);reader.cancel().catch(()=>{});}
  },
  cancel(reason){finished=true;return reader.cancel(reason);}
 });
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
  const total=MEDIA_LENGTHS[safe];
  const range=parseByteRange(request.headers.get("Range"),total);
  if(range?.invalid)return new Response(null,{status:416,headers:{
   ...headers,"Content-Range":"bytes */"+total,"Accept-Ranges":"bytes","Cache-Control":"no-store"
  }});
  if(request.method==="HEAD"&&range){
   return new Response(null,{status:206,headers:{...headers,
    "Content-Type":expected,"Content-Range":"bytes "+range.start+"-"+range.end+"/"+total,
    "Content-Length":String(range.length),"Accept-Ranges":"bytes","Cross-Origin-Resource-Policy":"cross-origin","Cache-Control":"public,max-age=3600"
   }});
  }
  const response=await env.ASSETS.fetch(request);
  if(response.status!==200&&response.status!==206&&response.status!==304&&response.status!==416)
   return respond("Medio original no disponible",503);
  const outgoing=new Headers(response.headers);
  for(const [k,v] of Object.entries(headers))outgoing.set(k,v);
  outgoing.set("Content-Type",expected);
  // Archivos multimedia públicos: utilizados por la web/QA desde otro Worker.
  // CORP same-origin bloquea <video> en Safari/Chrome aunque Range 206 funcione.
  // Esto NO abre D1, R2, cookies, ni endpoints privados.
  outgoing.set("Cross-Origin-Resource-Policy","cross-origin");
  outgoing.set("Accept-Ranges","bytes");
  outgoing.set("Cache-Control","public,max-age=3600");
  if(range&&response.status===200){
   if(!response.body)return respond("Medio original vacío",503);
   outgoing.delete("Content-Encoding");
   outgoing.set("Content-Range","bytes "+range.start+"-"+range.end+"/"+total);
   outgoing.set("Content-Length",String(range.length));
   return new Response(streamByteRange(response.body,range.start,range.end),{
    status:206,headers:outgoing
   });
  }
  return new Response(request.method==="HEAD"?null:response.body,{status:response.status,headers:outgoing});
 }
};
