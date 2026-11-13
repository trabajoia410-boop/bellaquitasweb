/**
 * Fase 5 — servir medios originales SIN R2 ni ejecutar fetch externo desde
 * Cloudflare: redirección temporal a los blobs públicos ya existentes de
 * GitHub Pages. Evita operaciones facturables y mantiene MP4 sin recodificar.
 * Solo acepta nombres exactos del manifiesto y solo imágenes y vídeos.
 * El JavaScript y las bibliotecas QR se siguen sirviendo localmente desde
 * la instantánea para respetar Content Security Policy.
 */
import {SITE_MEDIA} from "./site-media-manifest.js";
const ORIGINAL="https://trabajoia410-boop.github.io/bellaquitasweb/assets/";
const PREFIX="/espejo/assets/";
export function staticMediaFallback(request){
 const url=new URL(request.url);
 if(!url.pathname.startsWith(PREFIX))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return null;
 let name;
 try {name=decodeURIComponent(url.pathname.slice(PREFIX.length));}
 catch {return null;}
 if(!name||name.includes("/")||name.includes("\\")||name.length>200)return null;
 const file=SITE_MEDIA.find(x=>x.path===name&&
   (x.type.startsWith("image/")||x.type.startsWith("video/")));
 if(!file)return null;
 const location=ORIGINAL+encodeURIComponent(file.path);
 // Sin redirecciones controladas por usuario: allowlist exacta de assets.
 return new Response(null,{status:307,headers:{
   "Location":location,
   "Cache-Control":"public, max-age=300",
   "X-Content-Type-Options":"nosniff",
   "X-Robots-Tag":"noindex, nofollow",
   "Referrer-Policy":"no-referrer",
   "Vary":"Accept"
 }});
}
