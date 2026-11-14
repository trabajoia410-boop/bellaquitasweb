// Adaptador Cloudflare para el renderer ORIGINAL de Bellaquitas Fest.
// La API de edición ya está preparada pero el Worker la bloquea con
// STAGING_MUTATIONS=disabled. Sin cambios a puntos, visitas o contenido real.
const READONLY_ERROR="Vista de pruebas: editar, registrar visitas y cambiar puntos está desactivado.";
function readOnly(){return Promise.resolve({data:null,error:{message:READONLY_ERROR}});}
function requestJson(path,options={}){
  return fetch(path,{
    ...options,
    credentials:"same-origin",
    cache:"no-store",
    headers:{"Accept":"application/json",...(options.headers||{})}
  }).then(async r=>{
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.error||"No se pudieron cargar los datos de Cloudflare.");
    return data;
  });
}
const uploadedImages=new Map();
const uploadedMoments=new Map();
const deletedMoments=new Set();
function asError(error){return {data:null,error:{message:String(error?.message||error||"Error")}};}
async function postJson(path,body){
 return requestJson(path,{method:"POST",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function resultForAction(data){return {data:data||null,error:null};}
async function remoteMutation(table,method,item,filters){
 try{
  const id=filters.find(x=>x[0]==="id")?.[1];
  let path="/v1/mirror/admin/write",body;
  if(["events","rewards","promos"].includes(table)){
   const toggle=method==="update"&&Object.keys(item||{}).length===1&&
    typeof item?.active==="boolean";
   body={kind:"catalog",table,action:method==="upsert"?"insert":toggle?"toggle":method,
    id,item,...(toggle?{active:item.active}:{})};
  }else if(table==="site_drafts"&&method==="upsert"){
   body={kind:table,action:"save",settings:item.settings};
  }else if(table==="site_content"&&method==="upsert"){
   body=item.page_settings
    ?{kind:table,action:"publish",settings:item.page_settings}
    :{kind:table,action:"save_text",hero_text:item.hero_text,announcement:item.announcement};
  }else if(table==="community_suggestions"&&method==="update"){
   body={kind:table,action:"status",id,status:item.status};
  }else if(table==="moments_albums"){
   if(method==="insert"){
    path="/v1/admin/moments/create";
    body={title:item.title,event_date:item.event_date};
   }else if(method==="update"){
    path="/v1/admin/moments/publish";
    body={album_id:id,published:item.published};
   }else if(method==="delete"){
    body={kind:table,action:"delete",id};
   }
  }else if(table==="moments_photos"){
   if(method==="insert"){
    const key=String(item?.storage_path||"");
    if(!uploadedMoments.has(key)||uploadedMoments.get(key)!==item.album_id)
     throw Error("Primero hay que subir la foto.");
    uploadedMoments.delete(key);
    return resultForAction({ok:true});
   }else if(method==="delete"){
    body={kind:table,action:"delete",id};
   }
  }
  if(!body)throw Error(READONLY_ERROR);
  const result=await postJson(path,body);
  if(table==="moments_photos"&&method==="delete"&&id)deletedMoments.add(String(id));
  return resultForAction(result);
 }catch(error){return asError(error);}
}
async function invokeRpc(name,args={}){
 try{
  const commands={
   register_visit:["/v1/door/checkin",{code:args.p_member_code}],
   request_redemption:["/v1/rewards/request",{reward_id:args.p_reward_id}],
   validate_redemption:["/v1/door/redemptions/validate",{code:args.p_code}],
   update_display_name:["/v1/account/name",{name:args.p_name}],
   admin_update_member:["/v1/admin/member",{
    member_id:args.p_member_id,name:args.p_name,role:args.p_role,
    points:args.p_points,lifetime_points:args.p_lifetime_points,
    visits:args.p_visits,reason:args.p_reason
   }]
  };
  const entry=commands[name];
  if(!entry)throw Error(READONLY_ERROR);
  return resultForAction(await postJson(entry[0],entry[1]));
 }catch(error){return asError(error);}
}
async function uploadToR2(path,file){
 try{
  const filename=String(path||"");
  if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Formato de foto no permitido");
  if(file.size<=0||file.size>8*1024*1024)throw Error("Foto demasiado grande");
  let endpoint,result;
  const moment=filename.match(/^moments\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(?:jpg|png|webp)$/i);
  if(moment){
   endpoint="/v1/admin/moments/"+moment[1]+"/photo";
   result=await requestJson(endpoint,{method:"POST",
    headers:{"Content-Type":file.type},body:file});
   uploadedMoments.set(filename,moment[1]);
  }else{
   const category=filename.split("/")[0];
   if(!["events","rewards","promos","logos"].includes(category)||file.size>5*1024*1024)
    throw Error("Ruta o tamaño no autorizado");
   endpoint="/v1/mirror/admin/media/upload?category="+category;
   result=await requestJson(endpoint,{method:"PUT",
    headers:{"Content-Type":file.type},body:file});
   uploadedImages.set(filename,result.url);
  }
  return {data:{path:filename,photo_id:result?.id||null},error:null};
 }catch(error){return asError(error);}
}
async function removeFromR2(paths){
 try{
  if(!Array.isArray(paths))throw Error("Archivos inválidos");
  const files=paths.filter(x=>typeof x==="string");
  const mediaKeys=files.filter(x=>/^media\/(?:events|rewards|promos|logos)\//.test(x));
  if(mediaKeys.length)await postJson("/v1/mirror/admin/write",
   {kind:"media",action:"remove",keys:mediaKeys});
  // Las fotos moments ya se eliminan del R2 de forma atómica con su registro
  // mediante la operación de administración del servidor.
  if(files.some(x=>!x.startsWith("moments/")&&!/^(?:public-photo|admin-photo):[0-9a-f-]{36}$/i.test(x)&&!mediaKeys.includes(x)))
   throw Error("Ruta no autorizada");
  return {data:null,error:null};
 }catch(error){return asError(error);}
}
const cachedAuth={state:null};
async function getAuth(){
  const response=await requestJson("/v1/auth/me");
  const p=response.authenticated?response.profile:null;
  cachedAuth.state=p;
  return p;
}
function queryBuilder(table){
  const spec={filters:[],orderBy:null,ascending:true,maximum:1000,one:false,mutation:null};
  const q={
    select(){return this;},
    eq(field,value){spec.filters.push([field,value]);return this;},
    order(field,options={}){spec.orderBy=field;spec.ascending=options.ascending!==false;return this;},
    limit(num){if(Number.isInteger(num))spec.maximum=Math.max(0,Math.min(num,1000));return this;},
    maybeSingle(){spec.one=true;return this;},
    single(){spec.one=true;return this;},
    insert(item){spec.mutation={method:"insert",item};return this;},
    update(item){spec.mutation={method:"update",item};return this;},
    upsert(item){spec.mutation={method:"upsert",item};return this;},
    delete(){spec.mutation={method:"delete",item:null};return this;},
    then(resolve,reject){return execute().then(resolve,reject);}
  };
  async function execute(){
    if(spec.mutation)return remoteMutation(table,spec.mutation.method,spec.mutation.item,spec.filters);
    try{
      let rows=[];
      const profile=await getAuth().catch(()=>null);
      const isAdmin=profile?.role==="admin";
      const isStaff=isAdmin||profile?.role==="puerta";
      const identity=spec.filters.find(x=>x[0]==="id")?.[1];
      if(table==="profiles"){
        if(!profile)rows=[];
        else if(identity)rows=profile.id===identity?[profile]:[];
        else if(isAdmin)rows=(await requestJson("/v1/admin/members")).items||[];
        else if(isStaff)rows=(await requestJson("/v1/door/members")).items||[];
        else rows=[profile];
      }else if(["events","rewards","promos"].includes(table)){
        if(isAdmin){
          rows=(await requestJson("/v1/mirror/admin/catalog/"+table)).items||[];
        }else{
          rows=(await requestJson("/v1/"+table)).items||[];
          rows=rows.map(x=>({...x,active:true}));
        }
      }else if(table==="moments_albums"){
        if(isAdmin){
          rows=(await requestJson("/v1/mirror/admin/community")).albums||[];
        }else{
          rows=(await requestJson("/v1/moments")).items||[];
          rows=rows.map(x=>({...x,published:true}));
        }
      }else if(table==="moments_photos"){
        if(isAdmin)rows=(await requestJson("/v1/mirror/admin/community")).photos||[];
        else rows=(await requestJson("/v1/mirror/public/photos")).items||[];
      }else if(table==="community_suggestions"){
        if(isAdmin)rows=(await requestJson("/v1/mirror/admin/community")).suggestions||[];
      }else if(table==="site_content"){
        const result=await requestJson("/v1/site");
        rows=[{key:"homepage",...result.site}];
      }else if(table==="site_drafts"){
        if(isAdmin)rows=(await requestJson("/v1/mirror/admin/site-drafts")).items||[];
      }else if(table==="admin_member_changes"){
        if(isAdmin)rows=(await requestJson("/v1/mirror/admin/changes")).items||[];
      }else if(table==="redemptions"){
        if(profile){
          const path=isStaff?"/v1/mirror/door/redemptions":"/v1/mirror/me/redemptions";
          rows=(await requestJson(path)).items||[];
        }
      }else if(table==="activity"){
        if(isAdmin)rows=(await requestJson("/v1/mirror/admin/activity")).items||[];
        else if(profile)rows=(await requestJson("/v1/me/activity")).items||[];
      }
      for(const [field,value] of spec.filters){
        rows=rows.filter(x=>x[field]===value||x[field]===Number(value));
      }
      if(spec.orderBy){
        const f=spec.orderBy,mult=spec.ascending?1:-1;
        rows.sort((a,b)=>String(a[f]??"").localeCompare(String(b[f]??""))*mult);
      }
      rows=rows.slice(0,spec.maximum);
      return {data:spec.one?(rows[0]||null):rows,error:null};
    }catch(err){return{data:null,error:{message:String(err?.message||"Error en Cloudflare")}};}
  }
  return q;
}
export function createClient(){
  const auth={
    async getSession(){
      try{
        const p=await getAuth();
        return{data:{session:p?{user:{id:p.id,email:p.email||null}}:null},error:null};
      }catch(error){return{data:null,error:{message:String(error.message||error)}};}
    },
    onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},
    async signInWithOAuth(){
      location.assign("/v1/auth/google/start?return=mirror");
      return {data:null,error:null};
    },
    async signInWithPassword({email,password}={}){
      try{
        await requestJson("/v1/auth/email/login",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email,password})
        });
        cachedAuth.state=null;
        return{data:{user:null},error:null};
      }catch(error){return{data:null,error:{message:String(error.message||error)}};}
    },
    async signOut(){
      try{
        await requestJson("/v1/auth/logout",{
          method:"POST",headers:{"Content-Type":"application/json"},body:"{}"
        });
        cachedAuth.state=null;
        return{error:null};
      }catch(error){return{error:{message:String(error.message||error)}};}
    },
    signUp:readOnly,
    resetPasswordForEmail:readOnly,
    updateUser:readOnly
  };
  return {
    auth,
    from:queryBuilder,
    rpc:invokeRpc,
    storage:{from(){return{
      upload:uploadToR2,remove:removeFromR2,
      getPublicUrl(key){
        const source=String(key||"");
        const match=source.match(/^(public-photo|admin-photo):([0-9a-f-]{36})$/i);
        const href=match
          ?(match[1]==="admin-photo"?"/v1/mirror/admin/media/":"/v1/moments/photos/")+match[2]
          :(uploadedImages.get(source)||"");
        return {data:{publicUrl:href}};
      }
    };}}
  };
}
