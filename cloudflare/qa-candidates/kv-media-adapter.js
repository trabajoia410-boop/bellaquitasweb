/**
 * Candidato aislado: almacenamiento de imágenes Bellaquitas en Workers KV Free.
 *
 * NO desplegado, NO conectado a KV real ni a R2. No sustituye el control
 * de autorización de la API. El acceso público a fotos sigue requiriendo
 * autorización y consulta D1 en la ruta que llame este adaptador.
 *
 * KV Free falla cerrado al alcanzar su cuota, pero la replicación puede
 * tardar >60 s. No utilizar para sesiones, QR, saldos ni permisos.
 */
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_PATTERN=new RegExp(
  "^(?:moments/"+UUID+"/"+UUID+"\\.(?:jpg|png|webp)"+
  "|media/(?:events|rewards|promos|logos)/"+UUID+"\\.(?:jpg|png|webp)"+
  "|logos/"+UUID+"\\.(?:jpg|png))$","i"
);
const MIME_EXT={
  "image/jpeg":"jpg",
  "image/png":"png",
  "image/webp":"webp"
};
export const MAX_IMAGE_BYTES=8*1024*1024;
const validKey=key=>typeof key==="string"&&key.length<=512&&KEY_PATTERN.test(key);
const toBytes=input=>{
  if(input instanceof ArrayBuffer)return new Uint8Array(input);
  if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  throw new TypeError("La imagen debe ser binaria");
};
function validImage(key,bytes,mime){
  if(!validKey(key))throw new Error("Ruta de imagen no permitida");
  if(!Object.hasOwn(MIME_EXT,mime)||!key.toLowerCase().endsWith("."+MIME_EXT[mime]))
    throw new Error("Extensión o MIME no válido");
  if(bytes.byteLength===0||bytes.byteLength>MAX_IMAGE_BYTES)
    throw new Error("Archivo fuera del límite permitido");
  // El Content-Type y la extensión son datos del usuario: exigir cabecera binaria.
  const jpeg=mime==="image/jpeg"&&bytes.length>=3&&
    bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=mime==="image/png"&&bytes.length>=8&&
    bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&
    bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
  const webp=mime==="image/webp"&&bytes.length>=12&&
    bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&
    bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
  if(!jpeg&&!png&&!webp)throw new Error("Firma de imagen incorrecta");
}
/**
 * Interfaz compatible con el subconjunto R2 usado por el candidato:
 * get() -> {body,httpMetadata,size}|null; put(); delete().
 * allowWrites debe aprobarse expresamente por el llamador, nunca implícito.
 */
export function createKvMediaAdapter(kv,{allowWrites=false}={}){
  if(!kv||typeof kv.getWithMetadata!=="function"||
     typeof kv.put!=="function"||typeof kv.delete!=="function")
    throw new TypeError("Se requiere un binding KV válido");
  const demandWrite=()=>{
    if(allowWrites!==true)throw new Error("Almacenamiento KV en modo solo lectura");
  };
  return Object.freeze({
    async get(key){
      if(!validKey(key))return null;
      const result=await kv.getWithMetadata(key,{type:"arrayBuffer",cacheTtl:30});
      if(!result||result.value==null)return null;
      const contentType=result.metadata?.contentType;
      if(!Object.hasOwn(MIME_EXT,contentType)||!key.toLowerCase().endsWith("."+MIME_EXT[contentType]))
        return null;
      // Revalidar cada lectura: nunca servir HTML u otros bytes disfrazados
      // de foto, aunque metadata o contenido KV se haya alterado.
      try {
        const bytes=toBytes(result.value);
        validImage(key,bytes,contentType);
        return {body:bytes,httpMetadata:{contentType},size:bytes.byteLength};
      } catch (_) {
        return null;
      }
    },
    async put(key,body,options={}){
      demandWrite();
      const bytes=toBytes(body),contentType=options?.httpMetadata?.contentType;
      validImage(key,bytes,contentType);
      // KV no garantiza unicidad/compare-and-swap: los UUID deben crearse en
      // el servidor y una referencia privada de D1 decide la publicación.
      await kv.put(key,bytes.slice(),{metadata:{contentType}});
    },
    async delete(key){
      demandWrite();
      if(!validKey(key))throw new Error("Ruta de imagen no permitida");
      await kv.delete(key);
    }
  });
}
