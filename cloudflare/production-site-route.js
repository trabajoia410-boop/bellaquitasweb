/**
 * Bellaquitas Fest — entrada pública definitiva SIN rediseño.
 * El espejo usa la fotografía exacta del sitio original, sin Supabase o R2.
 * Esta capa usa rutas /, /styles.css, /app.js y /assets/*
 * y preserva /administracion/ en el backend.
 * Solo entra en vigor con SITE_MODE=production.
 */
import {mirrorRoute} from "./web-mirror.js";
import {stampsReplacePoints} from "../wallet/cutover-policy.js";
import {stampsOnlyMarketingCopy} from "../wallet/retire-legacy-copy.js";
import {stampsOnlyMemberUI} from "../wallet/retire-legacy-member-ui.js";

const ASSET_SOURCE = /^\/(?:styles\.css|app\.js|config\.js|locale-fr\.js)$/;
const SINGLE_ASSET = /^\/assets\/[^/]+$/;
const MIRROR_PAGE = /^\/espejo(?:\/|\/index\.html)?$/;
const SITE_ROOT = new Set(["/","/index.html"]);
const BLOCKED_SERVICE_WORKER = "self.addEventListener('install',()=>self.skipWaiting());"+
  "self.addEventListener('activate',event=>{event.waitUntil((async()=>{"+
  "try{await self.registration.unregister()}catch(_){}"+
  "})())});";

const response = (body,status,contentType) => new Response(body,{status,headers:{
  "Content-Type":contentType,
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
  "Cache-Control":"no-store"
}});

const BADGE=/<div role="status" aria-label="Copia de pruebas Cloudflare"[^>]*>PRUEBAS · SOLO LECTURA<\/div>/;
// Solo HTML público inmutable: sin cookies, tokens, nombres ni contenido de D1.
// La protección global de producción se ejecuta ANTES en el router principal.
let cachedPublicHtml=null;
let cachedPublicHeaders=null;
let cachedPublicMode=null;
let cachedStampAppJS=null;
let cachedStampLocaleFR=null;

export async function productionSiteRoute(request,env) {
  if(env?.SITE_MODE!=="production")return null;
  const u=new URL(request.url);
  const path=u.pathname;
  // No abrir públicamente el preview ni el espejo como segunda portada.
  if(path==="/preview"||path.startsWith("/preview/"))
    return response("No encontrado",404,"text/plain; charset=utf-8");
  if(MIRROR_PAGE.test(path))
    return Response.redirect(u.origin+"/"+u.search+u.hash,308);

  if(request.method!=="GET"&&request.method!=="HEAD"){
    if(SITE_ROOT.has(path)||ASSET_SOURCE.test(path)||SINGLE_ASSET.test(path))
      return response("Método no permitido",405,"text/plain; charset=utf-8");
    return null;
  }

  if(path==="/sw.js")return response(
    request.method==="HEAD"?null:BLOCKED_SERVICE_WORKER,
    200,"application/javascript; charset=utf-8"
  );

  // Preservar robots.txt + sitemap.xml que Google Search Console ya conoce.
  // En pruebas SITE_MODE no sirve esta ruta; los archivos son los originales.
  if(path==="/robots.txt"||path==="/sitemap.xml"){
    if(!env.ASSETS?.fetch)
      return response("SEO original no preparado",503,"text/plain; charset=utf-8");
    const target=new URL(path,u.origin);
    const result=await env.ASSETS.fetch(new Request(target,{method:request.method}));
    if(result.status!==200)
      return response("SEO original no preparado",503,"text/plain; charset=utf-8");
    return new Response(request.method==="HEAD"?null:result.body,{status:200,headers:{
      "Content-Type":path==="/robots.txt"?"text/plain; charset=utf-8":"application/xml; charset=utf-8",
      "Cache-Control":"public,max-age=3600",
      "X-Content-Type-Options":"nosniff"
    }});
  }
  if(path==="/manifest.webmanifest"){
    if(!env.ASSETS?.fetch)
      return response("Recursos no preparados",503,"text/plain; charset=utf-8");
    const fileUrl=new URL("/manifest.webmanifest",u.origin);
    const served=await env.ASSETS.fetch(new Request(fileUrl,{method:request.method}));
    if(served.status!==200)return response("Recurso no disponible",503,"text/plain; charset=utf-8");
    return new Response(request.method==="HEAD"?null:served.body,{
      status:200,headers:{
       "Content-Type":"application/manifest+json",
       "Cache-Control":"public,max-age=3600",
       "X-Content-Type-Options":"nosniff"
      }
    });
  }

  const page=SITE_ROOT.has(path);
  if(!page&&!ASSET_SOURCE.test(path)&&!SINGLE_ASSET.test(path))return null;
  if(page&&cachedPublicHtml!==null&&cachedPublicMode===stampsReplacePoints(env)){
    return new Response(request.method==="HEAD"?null:cachedPublicHtml,{
      status:200,headers:new Headers(cachedPublicHeaders)
    });
  }
  // No redireccionar: Safari y el renderer conservan la URL normal.
  const mirrorUrl=new URL(u);
  mirrorUrl.pathname=page?"/espejo/":"/espejo"+path;
  const mirrorRequest=new Request(mirrorUrl,request);
  const served=await mirrorRoute(mirrorRequest,env);
  if(!served)return response("Recurso no disponible",503,"text/plain; charset=utf-8");
  // Do not change the original static files. Copy-only marketing replacements
  // are applied to the served JS once per isolate when stamp loyalty is live.
  if(path==="/app.js"&&stampsReplacePoints(env)&&served.status===200){
    if(request.method==="HEAD")
      return response(null,200,"application/javascript; charset=utf-8");
    if(cachedStampAppJS===null)
      cachedStampAppJS=stampsOnlyMemberUI(stampsOnlyMarketingCopy(await served.text()));
    return response(request.method==="HEAD"?null:cachedStampAppJS,200,
      "application/javascript; charset=utf-8");
  }
  if(path==="/locale-fr.js"&&stampsReplacePoints(env)&&served.status===200){
    if(request.method==="HEAD")return response(null,200,"application/javascript; charset=utf-8");
    if(cachedStampLocaleFR===null)
      cachedStampLocaleFR=stampsOnlyMarketingCopy(await served.text());
    return response(cachedStampLocaleFR,200,"application/javascript; charset=utf-8");
  }
  if(!page)return served;
  if(served.status!==200)return served;
  if(request.method==="HEAD"){
    const headers=new Headers(served.headers);
    headers.set("X-Robots-Tag","index, follow");
    return new Response(null,{status:200,headers});
  }
  const original=await served.text();
  if(!BADGE.test(original))return response("Página no verificada",503,"text/plain; charset=utf-8");
  let html=original
    .replace(BADGE,"")
    .replace(/content="noindex,nofollow"/g,'content="index,follow"');
  // Only after explicit cutover: replace old loyalty-card hash route, not
  // users, points, design, QR door controls or any other navigation.
  if(stampsReplacePoints(env)){
    html=stampsOnlyMarketingCopy(html);
    // The original website remains visually intact; only loyalty entry links
    // and the short copy are updated. Old card and reward hashes redirect.
    html=html.replaceAll('href="#/registro">Únete al club','href="/tarjeta/bellaquitas-fest">Únete al club');
    html=html.replaceAll('href="#/acceso" class="btn btn-primary">Acceder a mi tarjeta',
      'href="/tarjeta/bellaquitas-fest" class="btn btn-primary">Acceder a mi tarjeta');
    html=html.replace("</body>",'<script src="/wallet/legacy-redirect.js" defer></script></body>');
  }
  if(!html.includes('id="app"')||html.includes('PRUEBAS · SOLO LECTURA')||
    html.includes("vlsipvngvxcgnwrhpjgg.supabase.co"))
    return response("Página no verificada",503,"text/plain; charset=utf-8");
  const headers=new Headers(served.headers);
  headers.set("X-Robots-Tag","index, follow");
  headers.set("Cache-Control","public,max-age=120");
  headers.delete("Content-Length");
  cachedPublicHtml=html;
  cachedPublicHeaders=[...headers.entries()];
  cachedPublicMode=stampsReplacePoints(env);
  return new Response(html,{status:200,headers});
}
