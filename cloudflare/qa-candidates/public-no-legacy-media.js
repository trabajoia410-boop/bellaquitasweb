/**
 * Bellaquitas Fest — migración Cloudflare D1 sin proveedores retirados.
 *
 * ALCANCE: solo normaliza la RESPUESTA PÚBLICA, nunca modifica D1.
 * Evita que logos, fotos o vídeos apunten al antiguo servicio.
 * Por seguridad no reconstruye dominios ni conserva URLs retiradas.
 * El logo original es un asset estático existente en GitHub Pages.
 *
 * No usar para HTML sin escape: estas rutas se convierten a texto en UI.
 */
const ORIGINALS=Object.freeze({
  logo_url:"/assets/logo-bellaquitas.webp",
  header_logo_url:"/assets/logo-navbar.png",
  hero_video_url:"",
  experience_video_url:"",
  image_url:"",
  storage_path:"",
});
function isRetiredStorage(value){
 if(typeof value!=="string")return false;
 try{
  const parsed=new URL(value.trim());
  return parsed.protocol==="https:" && (
    parsed.hostname==="supabase.co" ||
    parsed.hostname.endsWith(".supabase.co") ||
    parsed.pathname.startsWith("/storage/v1/object/")
      && parsed.hostname.endsWith("supabase.in")
  );
 }catch{return false;}
}
export function stripRetiredStorage(value,key="",depth=0){
 if(depth>12)return null;
 if(typeof value==="string"){
  if(!isRetiredStorage(value))return value;
  return ORIGINALS[key]??"";
 }
 if(Array.isArray(value))return value.slice(0,200).map(v=>stripRetiredStorage(v,"",depth+1));
 if(value&&typeof value==="object"){
  const out={};
  for(const [k,v] of Object.entries(value).slice(0,150))
    out[k]=stripRetiredStorage(v,k,depth+1);
  return out;
 }
 return value;
}
