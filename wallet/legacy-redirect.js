/** Reversible cutover of ONLY the old card hash. Do not remove accounts or points. */
export function walletLegacyRedirectRoute(request,env){
 const url=new URL(request.url);
 if(url.pathname!=="/wallet/legacy-redirect.js")return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 if(env?.SITE_MODE!=="production"||env.WALLET_ENABLED!=="yes"||
    env.WALLET_REPLACE_LEGACY!=="yes")
  return new Response("Not found",{status:404});
 const script="(()=>{'use strict';function cut(){const route=location.hash.split('?')[0];if(route==='#/tarjeta'||route==='#/premios')location.replace('/tarjeta/bellaquitas-fest');}window.addEventListener('hashchange',cut);cut();})();";
 return new Response(request.method==="HEAD"?null:script,{status:200,headers:{
  "Content-Type":"application/javascript; charset=utf-8",
  "X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
}
