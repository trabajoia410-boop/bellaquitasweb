/**
 * QA ClerkJS sobre staging, sin cambiar la portada real ni panel admin.
 * La ruta no existe hasta habilitar tres flags expresas en staging.
 */
const QA_HOST="bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const HEAD={"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow",
 "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export function clerkQaPreview(request,env){
 const url=new URL(request.url);
 if(url.pathname!=="/__qa/clerk/")return null;
 if(env?.SITE_MODE!=="staging"||env.CLERK_QA_PREVIEW!=="yes"||
    env.CLERK_JWT_ENABLED!=="yes"||url.hostname!==QA_HOST)
   return new Response("Clerk QA no disponible",{status:404,headers:HEAD});
 const pub=env.CLERK_PUBLISHABLE_KEY;
 if(typeof pub!=="string"||!/^pk_test_[A-Za-z0-9_-]{25,300}$/.test(pub))
   return new Response("Clerk QA sin configurar",{status:503,headers:HEAD});
 let domain;
 try{domain=atob(pub.split("_")[2]).slice(0,-1);}
 catch{return new Response("Clave pública inválida",{status:503,headers:HEAD});}
 if(!/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(domain)||
    env.CLERK_ISSUER!=="https://"+domain)
   return new Response("Emisor Clerk no autorizado",{status:503,headers:HEAD});
 if(request.method!=="GET")return new Response("Método no permitido",{status:405,headers:HEAD});
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 const nonce=btoa(String.fromCharCode(...bytes));
 const inline=[
 'window.addEventListener("load",async function(){',
 ' const box=document.getElementById("clerk"),status=document.getElementById("status");',
 ' try {',
 '  if(!window.Clerk||!window.__internal_ClerkUICtor)throw Error("SDK unavailable");',
 '  await window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});',
 '  if(!window.Clerk.isSignedIn){status.textContent="Prueba de desarrollo: no accede a miembros reales.";window.Clerk.mountSignIn(box);return;}',
 '  window.Clerk.mountUserButton(box);',
 '  const token=await window.Clerk.session?.getToken();',
 '  if(!token){status.textContent="Falta token verificado.";return;}',
 '  const r=await fetch("/v1/auth/clerk/me",{method:"GET",cache:"no-store",credentials:"omit",headers:{Authorization:"Bearer "+token}});',
 '  if(r.status===403){status.textContent="Cuenta Clerk válida, sin vínculo autorizado con Bellaquitas.";return;}',
 '  if(!r.ok){status.textContent="Vinculación no disponible. HTTP "+r.status;return;}',
 '  const data=await r.json();',
 '  status.textContent=data.authenticated?"Perfil verificado. Esta página NO abre administración ni modifica puntos.":"No autenticado.";',
 ' }catch{status.textContent="No se pudo iniciar la prueba Clerk.";}',
 '});'
 ].join("\n");
 const html=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1">',
 '<title>Bellaquitas · Clerk QA</title>',
 '<style>body{font:16px system-ui;background:#141018;color:#fff;margin:0;padding:22px}main{max-width:720px;margin:40px auto}h1{color:#eac77c}section{background:#231c2b;border:1px solid #5a4568;border-radius:15px;padding:22px}p{line-height:1.5}</style>',
 '</head><body><main><h1>Clerk · Bellaquitas Fest</h1>',
 '<p>Entorno de desarrollo aislado: no es la página pública.</p>',
 '<section><div id="clerk"></div><p id="status" role="status">Comprobando identidad…</p></section></main>',
 '<script defer crossorigin="anonymous" src="https://'+domain+'/npm/@clerk/ui@1/dist/ui.browser.js"></script>',
 '<script defer crossorigin="anonymous" data-clerk-publishable-key="'+pub+'" src="https://'+domain+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>',
 '<script nonce="'+nonce+'">'+inline+'</script></body></html>'
 ].join("\n");
 const headers=new Headers(HEAD);headers.set("Content-Type","text/html; charset=utf-8");
 headers.set("Content-Security-Policy",
  "default-src 'none'; base-uri 'none'; form-action 'self' https://"+domain+
  "; script-src 'nonce-"+nonce+"' https://"+domain+
  "; connect-src 'self' https://"+domain+
  "; frame-src https://"+domain+
  "; img-src 'self' data: https://"+domain+
  "; style-src 'unsafe-inline' https://"+domain);
 return new Response(html,{status:200,headers});
}
