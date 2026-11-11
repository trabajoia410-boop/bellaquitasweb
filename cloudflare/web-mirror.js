import {createClient as createCloudflareClient} from "./web-mirror-bridge.js";
const SOURCE="https://bellaquitas.fr";
const MIRROR_BASE="/espejo/";
const PROTECTED={
 "Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff",
 "X-Frame-Options":"DENY",
 "X-Robots-Tag":"noindex, nofollow",
 "Referrer-Policy":"no-referrer",
 "Cross-Origin-Resource-Policy":"same-origin"
};
function js(code){return new Response(code,{headers:{...PROTECTED,"Content-Type":"application/javascript; charset=utf-8"}});}
function fail(status,message){return new Response(message,{status,headers:{...PROTECTED,"Content-Type":"text/plain; charset=utf-8"}});}
async function original(file){
  // Ruta fija a los ficheros del sitio actual. No se admite URL de origen del usuario.
  const response=await fetch(SOURCE+"/"+file,{redirect:"follow",headers:{"Accept":"text/html, text/css, application/javascript, */*"}});
  if(!response.ok)throw Error("Public source responded "+response.status);
  return response.text();
}
const config=String.raw`// Espejo de solo lectura. No existen claves Supabase en este origen.
window.BELLAQUITAS_CONFIG={supabaseUrl:"",supabaseAnonKey:"",siteUrl:"https://bellaquitas.fr/"};
`;
function sameDesignHTML(html){
 if(!html.includes('id="app"')||!html.includes('src="config.js"')||
   !/src="app\.js\?v=/.test(html)||!html.includes('styles.css?'))
   throw Error("The website template changed: inspect before mirroring");
 // Conserva la estructura, imágenes, estilos y CSS originales.
 // Aísla el navegador de Supabase; la única API posible es Cloudflare de staging.
 let out=html.replace('content="index,follow"','content="noindex,nofollow"');
 out=out.replaceAll("https://vlsipvngvxcgnwrhpjgg.supabase.co","");
 out=out.replaceAll("wss://vlsipvngvxcgnwrhpjgg.supabase.co","");
 out=out.replaceAll("https://esm.sh","");
 out=out.replace("</body>",`<div role="status" aria-label="Copia de pruebas Cloudflare" style="position:fixed;bottom:12px;right:12px;z-index:99999;padding:8px 13px;border:1px solid #d5a749;border-radius:999px;color:#f8d98d;background:#100c12ee;box-shadow:0 4px 18px #0009;font:600 11px/1.4 system-ui,sans-serif">PRUEBAS · SOLO LECTURA</div></body>`);
 return out;
}
function sameDesignJS(source){
 const needle="await import('https://esm.sh/@supabase/supabase-js@2.118.0')";
 const live="const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);";
 if(!source.includes(needle)||!source.includes(live))
   throw Error("Renderer changed; do not serve an unsafe Supabase-connected preview");
 // Solo se sustituye la conexión de datos. El renderer y el diseño siguen idénticos.
 return source.replace(needle,"await import('/espejo/bridge.js')")
   .replace(live,"const live = true; // Catálogos y sesiones de Cloudflare, sin Supabase.");
}
export async function mirrorRoute(request){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/espejo")return Response.redirect(url.origin+MIRROR_BASE,302);
 if(!path.startsWith(MIRROR_BASE))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return fail(405,"Método no permitido");
 if(path==="/espejo/sw.js"||path==="/espejo/manifest.webmanifest")return fail(404,"PWA desactivada en pruebas");
 if(path==="/espejo/config.js")return js(config);
 if(path==="/espejo/bridge.js")return js(BRIDGE);
 if(path.startsWith("/espejo/assets/")){
   const filename=path.slice("/espejo/assets/".length);
   if(!filename||filename.includes("..")||filename.includes("%2e")||
      !/^[a-zA-Z0-9%_.+\-]+$/i.test(filename)||
      !/\.(?:mp4|webm|webp|png|jpg|jpeg|svg|js)$/i.test(filename))return fail(404,"Recurso no permitido");
   // Las librerías JS deben proceder del MISMO origen para respetar CSP.
   if(filename==="qr-local.js"||filename==="jsqr-local.js"){
     try{return js(await original("assets/"+filename));}
     catch(_){return fail(503,"No se pudo cargar el generador/lector QR");}
   }
   // Vídeos e imágenes se sirven sin recomprimir desde la web original.
   return new Response(null,{status:302,headers:{...PROTECTED,Location:SOURCE+"/assets/"+filename}});
 }
 try{
  if(path==="/espejo/"||path==="/espejo/index.html"){
   const html=sameDesignHTML(await original("index.html"));
   return new Response(request.method==="HEAD"?null:html,{headers:{...PROTECTED,
    "Content-Type":"text/html; charset=utf-8",
    "Content-Security-Policy":"default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-src 'self' blob: about:; media-src 'self' blob: https:; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"}}); 
  }
  if(path==="/espejo/app.js"){
   const originalCode=await original("app.js");
   return js(sameDesignJS(originalCode));
  }
  if(path==="/espejo/locale-fr.js"){
   return js(await original("locale-fr.js"));
  }
  if(path==="/espejo/styles.css"){
   const css=await original("styles.css");
   return new Response(request.method==="HEAD"?null:css,{headers:{...PROTECTED,"Content-Type":"text/css; charset=utf-8"}});
  }
 }catch(error){
  console.warn("Espejo de prueba:",String(error?.message||"unavailable").slice(0,140));
  return fail(503,"No se ha podido cargar la copia segura. La web pública sigue disponible.");
 }
 return fail(404,"Ruta no encontrada");
}
const BRIDGE="// Adaptador SOLO LECTURA de Bellaquitas Fest, diseñado para el espejo visual.\n// Todas las escrituras de fidelidad, panel, editor y contenido se rechazan.\n// El diseño, estilos, medios y el renderer son los originales de la web actual.\nconst READONLY_ERROR=\"Vista de pruebas: editar, registrar visitas y cambiar puntos está desactivado.\";\nfunction readOnly(){return Promise.resolve({data:null,error:{message:READONLY_ERROR}});}\nfunction requestJson(path,options={}){\n  return fetch(path,{\n    ...options,\n    credentials:\"same-origin\",\n    cache:\"no-store\",\n    headers:{\"Accept\":\"application/json\",...(options.headers||{})}\n  }).then(async r=>{\n    const data=await r.json().catch(()=>({}));\n    if(!r.ok)throw Error(data.error||\"No se pudieron cargar los datos de Cloudflare.\");\n    return data;\n  });\n}\nconst cachedAuth={state:null};\nasync function getAuth(){\n  const response=await requestJson(\"/v1/auth/me\");\n  const p=response.authenticated?response.profile:null;\n  cachedAuth.state=p;\n  return p;\n}\nfunction queryBuilder(table){\n  const spec={filters:[],orderBy:null,ascending:true,maximum:1000,one:false};\n  const q={\n    select(){return this;},\n    eq(field,value){spec.filters.push([field,value]);return this;},\n    order(field,options={}){spec.orderBy=field;spec.ascending=options.ascending!==false;return this;},\n    limit(num){if(Number.isInteger(num))spec.maximum=Math.max(0,Math.min(num,1000));return this;},\n    maybeSingle(){spec.one=true;return this;},\n    single(){spec.one=true;return this;},\n    insert:readOnly,update:readOnly,upsert:readOnly,delete:readOnly,\n    then(resolve,reject){return execute().then(resolve,reject);}\n  };\n  async function execute(){\n    try{\n      let rows=[];\n      const profile=await getAuth().catch(()=>null);\n      const isAdmin=profile?.role===\"admin\";\n      const isStaff=isAdmin||profile?.role===\"puerta\";\n      const identity=spec.filters.find(x=>x[0]===\"id\")?.[1];\n      if(table===\"profiles\"){\n        if(!profile)rows=[];\n        else if(identity)rows=profile.id===identity?[profile]:[];\n        else if(isAdmin)rows=(await requestJson(\"/v1/admin/members\")).items||[];\n        else if(isStaff)rows=(await requestJson(\"/v1/door/members\")).items||[];\n        else rows=[profile];\n      }else if([\"events\",\"rewards\",\"promos\"].includes(table)){\n        if(isAdmin){\n          rows=(await requestJson(\"/v1/mirror/admin/catalog/\"+table)).items||[];\n        }else{\n          rows=(await requestJson(\"/v1/\"+table)).items||[];\n          rows=rows.map(x=>({...x,active:true}));\n        }\n      }else if(table===\"moments_albums\"){\n        if(isAdmin){\n          rows=(await requestJson(\"/v1/mirror/admin/community\")).albums||[];\n        }else{\n          rows=(await requestJson(\"/v1/moments\")).items||[];\n          rows=rows.map(x=>({...x,published:true}));\n        }\n      }else if(table===\"moments_photos\"){\n        if(isAdmin)rows=(await requestJson(\"/v1/mirror/admin/community\")).photos||[];\n        else rows=(await requestJson(\"/v1/mirror/public/photos\")).items||[];\n      }else if(table===\"community_suggestions\"){\n        if(isAdmin)rows=(await requestJson(\"/v1/mirror/admin/community\")).suggestions||[];\n      }else if(table===\"site_content\"){\n        const result=await requestJson(\"/v1/site\");\n        rows=[{key:\"homepage\",...result.site}];\n      }else if(table===\"site_drafts\"){\n        if(isAdmin)rows=(await requestJson(\"/v1/mirror/admin/site-drafts\")).items||[];\n      }else if(table===\"admin_member_changes\"){\n        if(isAdmin)rows=(await requestJson(\"/v1/mirror/admin/changes\")).items||[];\n      }else if(table===\"redemptions\"){\n        if(profile){\n          const path=isStaff?\"/v1/mirror/door/redemptions\":\"/v1/mirror/me/redemptions\";\n          rows=(await requestJson(path)).items||[];\n        }\n      }else if(table===\"activity\"){\n        if(isAdmin)rows=(await requestJson(\"/v1/mirror/admin/activity\")).items||[];\n        else if(profile)rows=(await requestJson(\"/v1/me/activity\")).items||[];\n      }\n      for(const [field,value] of spec.filters){\n        rows=rows.filter(x=>x[field]===value||x[field]===Number(value));\n      }\n      if(spec.orderBy){\n        const f=spec.orderBy,mult=spec.ascending?1:-1;\n        rows.sort((a,b)=>String(a[f]??\"\").localeCompare(String(b[f]??\"\"))*mult);\n      }\n      rows=rows.slice(0,spec.maximum);\n      return {data:spec.one?(rows[0]||null):rows,error:null};\n    }catch(err){return{data:null,error:{message:String(err?.message||\"Error en Cloudflare\")}};}\n  }\n  return q;\n}\nexport function createClient(){\n  const auth={\n    async getSession(){\n      try{\n        const p=await getAuth();\n        return{data:{session:p?{user:{id:p.id,email:p.email||null}}:null},error:null};\n      }catch(error){return{data:null,error:{message:String(error.message||error)}};}\n    },\n    onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},\n    async signInWithOAuth(){\n      location.assign(\"/v1/auth/google/start\");\n      return {data:null,error:null};\n    },\n    async signInWithPassword({email,password}={}){\n      try{\n        await requestJson(\"/v1/auth/email/login\",{\n          method:\"POST\",headers:{\"Content-Type\":\"application/json\"},\n          body:JSON.stringify({email,password})\n        });\n        cachedAuth.state=null;\n        return{data:{user:null},error:null};\n      }catch(error){return{data:null,error:{message:String(error.message||error)}};}\n    },\n    async signOut(){\n      try{\n        await requestJson(\"/v1/auth/logout\",{\n          method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:\"{}\"\n        });\n        cachedAuth.state=null;\n        return{error:null};\n      }catch(error){return{error:{message:String(error.message||error)}};}\n    },\n    signUp:readOnly,\n    resetPasswordForEmail:readOnly,\n    updateUser:readOnly\n  };\n  return {\n    auth,\n    from:queryBuilder,\n    rpc:readOnly,\n    storage:{from(){return{\n      upload:readOnly,remove:readOnly,\n      getPublicUrl(key){\n        const source=String(key||\"\");\n        const match=source.match(/^(public-photo|admin-photo):([0-9a-f-]{36})$/i);\n        const href=match\n          ?(match[1]===\"admin-photo\"?\"/v1/mirror/admin/media/\":\"/v1/moments/photos/\")+match[2]\n          :\"\";\n        return {data:{publicUrl:href}};\n      }\n    };}}\n  };\n}\n";
