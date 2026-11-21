/** Pure identity/QR/HTML helpers. No DB, points or payments. */
const encoder=new TextEncoder();
export const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const normalizeEmail=value=>{
 const mail=String(value||"").normalize("NFKC").trim().toLowerCase();
 if(mail.length<5||mail.length>254||!/^[a-z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(mail))throw Error("Invalid email");
 return mail;
};
export const normalizePhone=value=>{
 const phone=String(value||"").replace(/[\s().-]/g,"");
 if(phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone))throw Error("Invalid international phone");
 return phone;
};
export const validSlug=x=>typeof x==="string"&&/^[a-z0-9][a-z0-9-]{2,69}$/.test(x);
export const validUuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export const validColor=x=>typeof x==="string"&&/^#[0-9a-f]{6}$/i.test(x);
export const safeAsset=x=>typeof x==="string"&&x.length<300&&
 (/^\/assets\/[a-zA-Z0-9/_-]+\.(?:png|webp|jpe?g)$/.test(x)||x==="");
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64decode=x=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
export async function hmac(value,secret){
 if(typeof secret!=="string"||secret.length<32)throw Error("WALLET_HMAC_KEY missing");
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value))));
}
export async function sha256(value){return b64(new Uint8Array(
 await crypto.subtle.digest("SHA-256",encoder.encode(value))));}
export function randomToken(n=32){const b=new Uint8Array(n);crypto.getRandomValues(b);return b64(b);}
export function otp6(){
 const ceiling=Math.floor(4294967296/1000000)*1000000;
 let v;do{v=crypto.getRandomValues(new Uint32Array(1))[0]}while(v>=ceiling);
 return String(v%1000000).padStart(6,"0");
}
export async function scanCode(customer,secret){
 if(!validUuid(customer.id)||!validUuid(customer.scan_nonce))throw Error("Invalid card nonce");
 const payload=customer.id+"."+customer.scan_nonce;
 return "bfw1."+payload+"."+(await hmac("scan:"+payload,secret));
}
export async function verifyScan(code,secret){
 const m=String(code||"").match(/^bfw1\.([a-f0-9-]{36})\.([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/i);
 if(!m||!validUuid(m[1])||!validUuid(m[2]))return null;
 const data="scan:"+m[1]+"."+m[2];
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["verify"]);
 try{const ok=await crypto.subtle.verify("HMAC",key,b64decode(m[3]),encoder.encode(data));
  return ok?{id:m[1],nonce:m[2]}:null;
 }catch{return null;}
}
export function publicCard(customer,program){
 return {id:customer.id,name:customer.name,stamps:customer.stamps,
  goal:program.stamp_goal,reward:program.reward_label,
  available:customer.unlocked_rewards-customer.redeemed_rewards,
  business:program.name,color:program.color,accent:program.accent_color,
  logo:program.logo_url,banner:program.banner_url};
}
