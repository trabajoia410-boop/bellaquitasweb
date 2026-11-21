/**
 * Isolated Bellaquitas Wallet interface — default MOCK.
 * Never claim that a preview web card is signed/accepted by Apple/Google.
 */
import {googleCreatePass,googleUpdatePass,googleSendNotification} from "./google.js";
export const walletMode=env=>
 env?.WALLET_MODE==="real"&&env?.WALLET_REAL_APPROVED==="yes"?"real":"mock";
export async function createPass(customer,program,env={},provider="mock"){
 if(walletMode(env)!=="real"||provider==="mock")
  return {mode:"mock",type:"web-preview",signed:false,
   previewUrl:"/tarjeta/"+encodeURIComponent(program.slug),walletUrl:null};
 if(provider==="google")return googleCreatePass(customer,program,env);
 if(provider==="apple"){
  // The optional private signing service must generate an actual CMS-signed
  // .pkpass with all required images. Never return a fake file as pkpass.
  if(typeof env.APPLE_PASS_SIGNER?.fetch!=="function")
   throw Error("Apple Wallet signer unavailable");
  const response=await env.APPLE_PASS_SIGNER.fetch("https://internal.wallet.invalid/v1/passes",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({customer,program})
  });
  if(!response.ok||response.headers.get("Content-Type")!=="application/vnd.apple.pkpass")
   throw Error("Apple Wallet signer rejected pass");
  return {mode:"apple",type:"signed-pkpass",signed:true,body:response.body};
 }
 throw Error("Unknown wallet provider");
}
export async function updatePass(customer,program,env={},provider="mock"){
 if(walletMode(env)!=="real"||provider==="mock")
  return {mode:"mock",updated:true,requiresPush:false};
 if(provider==="google")return googleUpdatePass(customer,program,env);
 if(provider==="apple"){
  if(typeof env.APPLE_PUSH_BRIDGE?.fetch!=="function")
   throw Error("Apple Wallet APNs bridge not configured");
  const response=await env.APPLE_PUSH_BRIDGE.fetch("https://internal.wallet.invalid/v1/update",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({customerId:customer.id,programId:program.id})
  });
  if(!response.ok)throw Error("Apple Wallet APNs update failed");
  return {mode:"apple",updated:true};
 }
 throw Error("Unknown wallet provider");
}
export async function sendNotification(customers,message,env={},provider="mock"){
 if(!Array.isArray(customers)||customers.length>200)
  throw Error("Batch must be <=200 customers");
 if(typeof message!=="string"||message.trim().length<2||message.length>160)
  throw Error("Invalid notification message");
 if(walletMode(env)!=="real"||provider==="mock")
  return {mode:"mock",sent:0,previewOnly:true,customerCount:customers.length};
 if(provider==="google")return googleSendNotification(customers,message,env);
 if(provider==="apple"){
  if(typeof env.APPLE_PUSH_BRIDGE?.fetch!=="function")throw Error("Apple APNs bridge unavailable");
  const results=[];
  for(const customer of customers){
   const r=await env.APPLE_PUSH_BRIDGE.fetch("https://internal.wallet.invalid/v1/message",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({customerId:customer.id,message})
   });
   results.push({id:customer.id,status:r.ok?"submitted":"failed"});
  }
  return {mode:"apple",results,guaranteedPush:false};
 }
 throw Error("Unknown wallet provider");
}
