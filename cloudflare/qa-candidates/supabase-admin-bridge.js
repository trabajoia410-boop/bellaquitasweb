/**
 * Bellaquitas — puente temporal de sesión Supabase -> panel Cloudflare.
 *
 * EN AUDITORÍA. No utiliza claves service_role ni lee información privada
 * sin la autorización RLS del propio usuario. La verificación de identidad
 * se hace en Supabase Auth /user y el rol se comprueba DE NUEVO usando RLS.
 * El ID validado debe coincidir exactamente con el ID y rol admin en D1.
 *
 * Cada acceso al panel exige el access_token actual de la sesión pública:
 * cerrar sesión en Supabase quita ese token del navegador, incluso si quedan
 * cookies D1 antiguas. El frontend nunca guarda copias del token.
 */
const SUPABASE_HOST="https://vlsipvngvxcgnwrhpjgg.supabase.co";
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const MAX_TOKEN_LENGTH=8192;
function settings(env){
  if(env?.ADMIN_SUPABASE_BRIDGE!=="yes"||
     env?.ADMIN_SSO_ENABLED!=="yes"||
     env?.SUPABASE_URL!==SUPABASE_HOST)return null;
  const key=env?.SUPABASE_ANON_KEY||env?.SUPABASE_PUBLISHABLE_KEY;
  if(typeof key!=="string"||key.length<20||key.length>2000)return null;
  return {key};
}
function rawToken(request){
  const authorization=request.headers.get("Authorization")||"";
  const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
  if(!match||match[1].length<80||match[1].length>MAX_TOKEN_LENGTH)return null;
  // No aceptar tokens opacos, API keys ni credenciales OAuth diferentes.
  if(match[1].split(".").length!==3)return null;
  return match[1];
}
async function getJSON(url,token,key){
  let response;
  try {
    response=await fetch(url,{
      method:"GET",
      headers:{apikey:key,Authorization:"Bearer "+token,Accept:"application/json"},
      cache:"no-store",
      redirect:"error",
      signal:AbortSignal.timeout(5000)
    });
  } catch {return null;}
  if(!response.ok)return null;
  try {
    const data=await response.json();
    return JSON.stringify(data).length<=12000?data:null;
  } catch {return null;}
}
function jwtExpiration(token){
  // Solo usar exp para acortar la sesión, JAMÁS para autenticar.
  try {
    const part=token.split(".")[1];
    const decoded=atob(part.replace(/-/g,"+").replace(/_/g,"/"));
    const claims=JSON.parse(decoded);
    return Number.isSafeInteger(claims.exp)?claims.exp:0;
  }catch{return 0;}
}
export async function verifiedSupabaseAdmin(request,env,expectedProfileId=null){
  const cfg=settings(env),accessToken=rawToken(request);
  if(!cfg||!accessToken)return null;
  const now=Math.floor(Date.now()/1000),expiresAt=jwtExpiration(accessToken);
  if(expiresAt<=now+15||expiresAt>now+7200)return null;
  const user=await getJSON(SUPABASE_HOST+"/auth/v1/user",accessToken,cfg.key);
  if(!user||typeof user!=="object"||!UUID.test(user.id||"")||
     (expectedProfileId!==null&&user.id!==expectedProfileId))return null;
  // Solo identidades emitidas por el proveedor oficial, no por un campo
  // editable de usuario ni por el email recibido en un formulario.
  const provider=user.app_metadata?.provider;
  if(!["google","email"].includes(provider))return null;
  // Supabase Auth verifica firma, caducidad y revocación según sus reglas.
  // Comprobar también el rol ACTUAL mediante RLS, no metadata cliente.
  const found=await getJSON(
    SUPABASE_HOST+"/rest/v1/profiles?select=id%2Crole&id=eq."+encodeURIComponent(user.id)+"&limit=1",
    accessToken,cfg.key
  );
  if(!Array.isArray(found)||found.length!==1||
     found[0].id!==user.id||found[0].role!=="admin")return null;
  return {id:user.id,method:provider,expiresAt};
}
export function bridgeEnabled(env){return !!settings(env);}
export function bridgeTokenSupplied(request){return !!rawToken(request);}
