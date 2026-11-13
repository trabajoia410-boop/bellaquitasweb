/**
 * Bellaquitas Fest — candidato de identidad externa, NO integrado.
 *
 * Verifica un ID token OIDC RS256, emitido tras autenticación de correo +
 * contraseña en un proveedor EXTERNO explícitamente elegido por el dueño.
 * Las contraseñas NO pasan por este módulo ni se guardan en D1.
 * JWT/JWKS de entrada: los JWKS solo pueden obtenerse de un origen FIJO,
 * configurado por el servidor. NO usar enlaces jku/x5u del propio JWT.
 *
 * La vinculación privada D1 se hace por (proveedor, emisor, subject) y NUNCA
 * por email, nombre, claims de rol o perfil que aporte el navegador.
 * Falta: crear cuenta/proveedor con autorización, OIDC code+PKCE+nonce,
 * cookies propias, rechazo de replay y pruebas del runtime Workers Free.
 *
 * No despliega, no crea usuarios, no cambia roles ni créditos.
 */
const FAILURE="Identidad externa no verificada";
const reject=()=>{throw new Error(FAILURE);};
const PROVIDERS=new Set(["clerk","auth0"]);
function bytes(segment){
  if(typeof segment!=="string"||segment.length<1||segment.length>12000||
     !/^[A-Za-z0-9_-]+$/.test(segment))reject();
  try {
    const padded=segment.replace(/-/g,"+").replace(/_/g,"/")+
      "=".repeat((4-segment.length%4)%4);
    return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
  }catch {reject();}
}
function json(segment){
  try {
    const object=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes(segment)));
    if(!object||typeof object!=="object"||Array.isArray(object))reject();
    return object;
  }catch {reject();}
}
function params(config){
  if(!config||typeof config!=="object"||!PROVIDERS.has(config.provider))reject();
  const issuer=config.issuer,audience=config.audience,nonce=config.nonce;
  if(typeof issuer!=="string"||typeof audience!=="string"||
     audience.length<5||audience.length>256||
     typeof nonce!=="string"||!(/^[A-Za-z0-9_-]{20,128}$/).test(nonce))reject();
  try {
    const url=new URL(issuer);
    if(url.protocol!=="https:"||url.username||url.password||url.hash||url.search)reject();
  }catch {reject();}
  if(!config.jwks||!Array.isArray(config.jwks.keys)||
     config.jwks.keys.length>30)reject();
  const now=config.now===undefined?Math.floor(Date.now()/1000):config.now;
  if(!Number.isSafeInteger(now)||now<1)reject();
  return {issuer,audience,nonce,now};
}
export async function verifyAdminOidcIdToken(jwt,config){
  const {issuer,audience,nonce,now}=params(config);
  if(typeof jwt!=="string"||jwt.length>16000)reject();
  const parts=jwt.split(".");
  if(parts.length!==3)reject();
  const header=json(parts[0]),claims=json(parts[1]);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||
     !/^[\w.-]{1,128}$/.test(header.kid)||
     (header.typ!==undefined&&header.typ!=="JWT")||
     ["jwk","jku","x5u","crit"].some(k=>Object.hasOwn(header,k)))reject();
  if(claims.iss!==issuer ||
     !(claims.aud===audience||(Array.isArray(claims.aud)&&claims.aud.includes(audience)))||
     (Array.isArray(claims.aud)&&claims.aud.length>1&&claims.azp!==audience)||
     (claims.azp!==undefined&&claims.azp!==audience)||
     claims.nonce!==nonce||
     typeof claims.sub!=="string"||!/^[A-Za-z0-9._:@|-]{1,256}$/.test(claims.sub)||
     !Number.isSafeInteger(claims.exp)||claims.exp<=now||
     !Number.isSafeInteger(claims.iat)||claims.iat>now+60||
     claims.iat<now-600 ||
     (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+60))
    )reject();
  const keys=config.jwks.keys.filter(k=>k&&k.kid===header.kid&&k.kty==="RSA"&&
    (!k.use||k.use==="sig")&&(!k.alg||k.alg==="RS256")&&
    typeof k.n==="string"&&typeof k.e==="string");
  if(keys.length!==1)reject();
  try {
    const imported=await crypto.subtle.importKey("jwk",keys[0],
      {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",imported,
      bytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    if(!valid)reject();
  }catch {reject();}
  // No devolver claims editables, email ni tokens sin necesidad.
  return Object.freeze({provider:config.provider,issuer,subject:claims.sub});
}

/**
 * Única entrada para vincular ID token VERIFICADO con un administrador previo.
 * Sin inserciones, sin nuevos perfiles, sin promoción de roles.
 */
export async function existingAdminFromExternalIdToken(jwt,config,db){
  const verified=await verifyAdminOidcIdToken(jwt,config);
  if(!db||typeof db.prepare!=="function")reject();
  const row=await db.prepare(
    "SELECT p.id FROM admin_external_identities e "+
    "JOIN profiles p ON p.id=e.profile_id "+
    "WHERE e.provider=? AND e.issuer=? AND e.subject=? "+
    "AND p.role='admin' LIMIT 1"
  ).bind(verified.provider,verified.issuer,verified.subject).first();
  return row?.id?{profile_id:row.id}:null;
}
