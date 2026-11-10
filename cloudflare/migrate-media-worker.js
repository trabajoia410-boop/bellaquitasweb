/* One-time migration of three existing PUBLIC logo assets into PRIVATE R2.
 * Exposes no HTTP write endpoint. The cron schedule is removed after verification.
 */
const sourceBase="https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/";
const files=[{"key":"logos/705cc152-5de2-407a-a880-1e78ca4b30ea.png","size":904603,"type":"image/png"},{"key":"logos/af5b256c-877b-4c9c-8d36-d00854885c4b.jpg","size":130096,"type":"image/jpeg"},{"key":"logos/f4978ae8-1058-43a7-b5cd-ef9b17c11843.png","size":904603,"type":"image/png"}];
async function sha256(b){
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",b));
 return Array.from(digest,x=>x.toString(16).padStart(2,"0")).join("");
}
export default {
 async fetch(){return new Response("Not found",{status:404});},
 async scheduled(_event,env,ctx){
  ctx.waitUntil((async()=>{
   for(const file of files){
    const dest=await env.MEDIA.head(file.key);
    if(dest && dest.size===file.size){
      await env.DB.prepare("INSERT OR REPLACE INTO media_migration_log(storage_key,status,bytes,sha256,detail,updated_at) VALUES (?,'copied',?,COALESCE((SELECT sha256 FROM media_migration_log WHERE storage_key=?),''),'Already present',datetime('now'))").bind(file.key,dest.size,file.key).run();
      continue;
    }
    try {
      const resp=await fetch(sourceBase+encodeURI(file.key),{
       method:"GET",headers:{"Accept":file.type}
      });
      if(!resp.ok)throw new Error("Source HTTP "+resp.status);
      const data=await resp.arrayBuffer();
      if(data.byteLength!==file.size)throw new Error("Unexpected file length");
      const contentType=resp.headers.get("content-type")||"";
      if(!contentType.startsWith(file.type))throw new Error("Unexpected file type");
      const hash=await sha256(data);
      await env.MEDIA.put(file.key,data,{httpMetadata:{contentType:file.type},
        customMetadata:{sha256:hash,source:"bellaquitas-public-assets"}});
      const verify=await env.MEDIA.head(file.key);
      if(!verify || verify.size!==file.size)throw new Error("Storage verification failed");
      await env.DB.prepare("INSERT OR REPLACE INTO media_migration_log(storage_key,status,bytes,sha256,detail,updated_at) VALUES (?,'copied',?,?,'Size verified in R2',datetime('now'))").bind(file.key,file.size,hash).run();
    }catch(e){
      console.warn("Media migration:",file.key,String(e?.message||e));
      await env.DB.prepare("INSERT OR REPLACE INTO media_migration_log(storage_key,status,bytes,sha256,detail,updated_at) VALUES (?,'error',0,'',?,datetime('now'))").bind(file.key,String(e?.message||"error").slice(0,160)).run();
    }
   }
  })());
 }
};
