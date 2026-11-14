/**
 * Bellaquitas Fest — candidato de streaming MP4 206 desde Workers Static Assets.
 * NO DESPLEGAR: la viabilidad de CPU <10ms Free, rutas y fotos dinámicas
 * necesitan ensayos reales sin cargos y aprobación del propietario.
 *
 * No descarga a memoria los vídeos: descarta los bytes anteriores al rango
 * mediante stream y cancela la lectura después del último byte pedido.
 * Trabaja solo con los cinco MP4 originales verificados por SHA Git.
 */
import {SITE_MEDIA} from "./site-media-manifest.js";
const PREFIX="/espejo/assets/";
const MOVIES=new Map(SITE_MEDIA.filter(x=>x.type==="video/mp4").map(x=>[x.path,x]));
const secureHeaders={
 "Accept-Ranges":"bytes",
 "Cache-Control":"public, max-age=86400",
 "X-Content-Type-Options":"nosniff",
 "Content-Disposition":"inline",
 "Cross-Origin-Resource-Policy":"same-origin"
};
function rangeHeader(value,size){
 if(value===null)return {status:200,start:0,end:size-1};
 if(!/^bytes=/i.test(value))return null;
 const m=/^bytes=(\d*)-(\d*)$/i.exec(value.trim());
 if(!m || (!m[1]&&!m[2]))return null;
 // Solo rangos simples: no aceptar múltiples rangos ni números imprecisos.
 if(m[1].length>16 || m[2].length>16)return null;
 let start,end;
 if(!m[1]){
   const count=Number(m[2]);
   if(!Number.isSafeInteger(count)||count<=0)return null;
   start=Math.max(0,size-count);end=size-1;
 }else{
   start=Number(m[1]);end=m[2]?Number(m[2]):size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return null;
   if(start>=size || end<start)return null;
   end=Math.min(end,size-1);
 }
 return {status:206,start,end};
}
function bytesFromStream(body,start,length){
 const reader=body.getReader();
 let skip=start,left=length,finished=false;
 return new ReadableStream({
   async pull(controller){
     if(finished)return;
     try{
       while(left>0){
         const {done,value}=await reader.read();
         if(done){finished=true;controller.error(new Error("Archivo MP4 incompleto"));return;}
         const chunk=value instanceof Uint8Array?value:new Uint8Array(value);
         if(skip>=chunk.byteLength){skip-=chunk.byteLength;continue;}
         const begin=skip;skip=0;
         const bytes=Math.min(left,chunk.byteLength-begin);
         if(bytes>0){controller.enqueue(chunk.subarray(begin,begin+bytes));left-=bytes;}
         if(left===0){
           finished=true;controller.close();
           void reader.cancel().catch(()=>{});
         }
         return;
       }
       finished=true;controller.close();void reader.cancel().catch(()=>{});
     }catch(error){finished=true;controller.error(error);}
   },
   async cancel(reason){finished=true;await reader.cancel(reason);}
 });
}
export async function staticMp4RangeRoute(request,env){
 const u=new URL(request.url);
 if(!u.pathname.startsWith(PREFIX))return null;
 let name;
 try{name=decodeURIComponent(u.pathname.slice(PREFIX.length));}
 catch{return null;}
 if(!name||name.includes("/")||name.includes("\\")||
    /[\x00-\x1f]/.test(name)||name.length>200)return null;
 const video=MOVIES.get(name);
 if(!video)return null;
 if(!env?.ASSETS || env.STATIC_MP4_RANGE_ENABLED!=="yes")
   return null; // No cambiar rutas existentes mientras no se valide.
 const headers=new Headers(secureHeaders);
 headers.set("Content-Type",video.type);
 headers.set("ETag",'"'+video.gitSha1+'"');
 if(!["HEAD","GET"].includes(request.method)){
   headers.set("Allow","GET, HEAD");
   return new Response(null,{status:405,headers});
 }
 const wanted=rangeHeader(request.headers.get("Range"),video.bytes);
 if(!wanted){
   headers.set("Content-Range","bytes */"+video.bytes);
   headers.set("Content-Length","0");
   return new Response(null,{status:416,headers});
 }
 const len=wanted.end-wanted.start+1;
 headers.set("Content-Length",String(len));
 if(wanted.status===206)headers.set("Content-Range","bytes "+wanted.start+"-"+wanted.end+"/"+video.bytes);
 if(request.method==="HEAD")return new Response(null,{status:wanted.status,headers});
 // Sin Range al binding: Cloudflare Static Assets entrega 200 íntegro.
 // El script crea una respuesta 206 a partir de su stream, sin arrayBuffer().
 const h=new Headers({"Accept":"video/mp4","Accept-Encoding":"identity"});
 const origin=await env.ASSETS.fetch(new Request(u.href,{method:"GET",headers:h}));
 if(!origin.ok || origin.status!==200 || !origin.body){
   return new Response("Vídeo no disponible",{status:503,
     headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }
 if(origin.headers.get("Content-Encoding")&&origin.headers.get("Content-Encoding")!=="identity"){
   await origin.body.cancel();
   return new Response("Respuesta de vídeo codificada",{status:503});
 }
 const reported=origin.headers.get("Content-Length");
 if(reported && Number(reported)!==video.bytes){
   await origin.body.cancel();
   return new Response("Longitud del vídeo distinta al original",{status:503});
 }
 // Para los GET sin Range no se necesita descartar ni modificar los bytes.
 if(wanted.status===200)return new Response(origin.body,{status:200,headers});
 return new Response(bytesFromStream(origin.body,wanted.start,len),{status:206,headers});
}
