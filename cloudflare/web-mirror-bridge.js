// Adaptador SOLO LECTURA de Bellaquitas Fest, diseñado para el espejo visual.
// Todas las escrituras de fidelidad, panel, editor y contenido se rechazan.
// El diseño, estilos, medios y el renderer son los originales de la web actual.
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
const cachedAuth={state:null};
async function getAuth(){
  const response=await requestJson("/v1/auth/me");
  const p=response.authenticated?response.profile:null;
  cachedAuth.state=p;
  return p;
}
function queryBuilder(table){
  const spec={filters:[],orderBy:null,ascending:true,maximum:1000,one:false};
  const q={
    select(){return this;},
    eq(field,value){spec.filters.push([field,value]);return this;},
    order(field,options={}){spec.orderBy=field;spec.ascending=options.ascending!==false;return this;},
    limit(num){if(Number.isInteger(num))spec.maximum=Math.max(0,Math.min(num,1000));return this;},
    maybeSingle(){spec.one=true;return this;},
    single(){spec.one=true;return this;},
    insert:readOnly,update:readOnly,upsert:readOnly,delete:readOnly,
    then(resolve,reject){return execute().then(resolve,reject);}
  };
  async function execute(){
    try{
      let rows=[];
      const profile=await getAuth().catch(()=>null);
      const identity=spec.filters.find(x=>x[0]==="id")?.[1];
      if(table==="profiles"){
        if(!profile)rows=[];
        else if(identity)rows=profile.id===identity?[profile]:[];
        else if(profile.role==="admin")rows=(await requestJson("/v1/admin/members")).items||[];
        else if(profile.role==="puerta")rows=(await requestJson("/v1/door/members")).items||[];
        else rows=[profile];
      }else if(["events","rewards","promos","moments_albums"].includes(table)){
        const endpoint={events:"events",rewards:"rewards",promos:"promos",moments_albums:"moments"}[table];
        rows=(await requestJson("/v1/"+endpoint)).items||[];
        if(table==="moments_albums")rows=rows.map(x=>({...x,published:true}));
      }else if(table==="site_content"){
        const result=await requestJson("/v1/site");
        rows=[{key:"homepage",...result.site}];
      }else if(table==="activity"){
        if(profile)rows=(await requestJson("/v1/me/activity")).items||[];
      }else if(["site_drafts","admin_member_changes","moments_photos",
        "community_suggestions","redemptions"].includes(table)){
        rows=[]; // Estas pantallas aún no están migradas: no consultar producción.
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
      location.assign("/v1/auth/google/start");
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
    rpc:readOnly,
    storage:{from(){return{
      upload:readOnly,remove:readOnly,
      getPublicUrl(){return{data:{publicUrl:""}};}
    };}}
  };
}
