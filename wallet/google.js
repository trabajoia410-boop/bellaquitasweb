import {buildBellaquitasGoogleLoyaltyClass} from "./google-provisional-class.js";
import {googleWalletCredentials} from "./google-credentials.js";
/**
 * Google Wallet API LoyaltyObject adapter (explicit credential-gated).
 * No API call unless issuer + service account keys exist AND WALLET_MODE=real.
 * Always bind the object ID to our opaque UUID, never email or phone.
 */
const SCOPE="https://www.googleapis.com/auth/wallet_object.issuer";
const ROOT="https://walletobjects.googleapis.com/walletobjects/v1";
const enc=o=>btoa(JSON.stringify(o)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64=x=>btoa(String.fromCharCode(...x)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const tokenCache=new Map();
const classCache=new Map();
const cfg=env=>{
 if(env?.WALLET_MODE!=="real")throw Error("Google Wallet issuer not configured");
 const credentials=googleWalletCredentials(env);
 if(!credentials)throw Error("Google Wallet issuer not configured");
 return credentials;
};

async function signer(pem){
 const raw=pem.replace(new RegExp("-----BEGIN "+"PRIVATE KEY-----|-----END "+"PRIVATE KEY-----|\\s","g"),"");
 const der=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
 return crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
}
async function jwt(payload,key){
 const head=enc({alg:"RS256",typ:"JWT"});
 const body=enc(payload);const raw=head+"."+body;
 const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(raw));
 return raw+"."+b64(new Uint8Array(signature));
}
async function accessToken(env){
 const {client,pem}=cfg(env);
 const old=tokenCache.get(client);
 if(old&&old.until>Date.now()+60000)return old.token;
 const now=Math.floor(Date.now()/1000),key=await signer(pem);
 const assertion=await jwt({iss:client,scope:SCOPE,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600},key);
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
  signal:AbortSignal.timeout(7000)
 });
 if(!response.ok)throw Error("Google Wallet OAuth unavailable");
 const data=await response.json();
 if(!/^ya29\.|^[A-Za-z0-9._-]{25,}$/.test(data.access_token||""))throw Error("Google Wallet token unavailable");
 tokenCache.set(client,{token:data.access_token,until:Date.now()+Math.min(3000,Number(data.expires_in)||3000)*1000});
 return data.access_token;
}
async function api(env,method,path,body){
 const token=await accessToken(env);
 const response=await fetch(ROOT+path,{method,
  headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
 if(response.status===409)return {existing:true};
 if(!response.ok)throw Error("Google Wallet API rejected "+response.status);
 return response.status===204?{}:response.json();
}
const classId=cfg=>cfg.issuer+".bellaquitas_fest";
async function ensureLoyaltyClass(program,env){
 const c=cfg(env),key=classId(c);
 if((classCache.get(key)||0)>Date.now())return;
 const item=buildBellaquitasGoogleLoyaltyClass(c.issuer,program);
 await api(env,"POST","/loyaltyClass",item);
 classCache.set(key,Date.now()+5*60*1000);
}

const objectId=(cfg,customer)=>cfg.issuer+".bf_"+customer.id.replace(/-/g,"");
function loyaltyObject(customer,program,settings){
 return {id:objectId(settings,customer),classId:classId(settings),
  state:"ACTIVE",accountId:customer.id,accountName:customer.name,
  loyaltyPoints:{label:"Sellos / Tampons",balance:{int:Number(customer.stamps)}},
  barcode:{type:"QR_CODE",value:customer.scan_code,alternateText:"Bellaquitas Fest"}};
}
export async function googleCreatePass(customer,program,env){
 const c=cfg(env);
 await ensureLoyaltyClass(program,env);
 await api(env,"POST","/loyaltyObject",loyaltyObject(customer,program,c));
 const key=await signer(c.pem),now=Math.floor(Date.now()/1000);
 // Google-signed issuer JWT; no user PII in URL besides opaque object ID.
 const token=await jwt({iss:c.client,aud:"google",typ:"savetowallet",iat:now,
  origins:["https://bellaquitas.fr"],payload:{loyaltyObjects:[
   {id:objectId(c,customer),classId:classId(c)}]}},key);
 return {mode:"google",url:"https://pay.google.com/gp/v/save/"+token};
}
export async function googleUpdatePass(customer,program,env){
 const c=cfg(env),id=objectId(c,customer);
 return api(env,"PATCH","/loyaltyObject/"+encodeURIComponent(id),{
  accountName:customer.name,
  barcode:{type:"QR_CODE",value:customer.scan_code,alternateText:"Bellaquitas Fest"},
  loyaltyPoints:{label:"Sellos / Tampons",balance:{int:Number(customer.stamps)}}});
}
export async function googleSendNotification(customers,message,env){
 const c=cfg(env);
 if(typeof message!=="string"||message.length>160)throw Error("Invalid message");
 const results=[];
 for(const customer of customers){
  try{
   await api(env,"POST","/loyaltyObject/"+encodeURIComponent(objectId(c,customer))+"/addMessage",
    {message:{header:"Bellaquitas Fest",body:message,messageType:"TEXT_AND_NOTIFY"}});
   results.push({id:customer.id,status:"submitted"});
  }catch{results.push({id:customer.id,status:"failed"});}
 }
 // Google decides whether and when an actual push is displayed.
 return {mode:"google",results,guaranteedPush:false};
}
