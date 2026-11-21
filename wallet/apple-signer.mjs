#!/usr/bin/env node
/**
 * Optional OFFLINE Apple .pkpass signer. Not executable inside Cloudflare Workers
 * (native OpenSSL + ZIP required). Intended for an independently controlled
 * private signing service once Apple Developer credentials are available.
 * Never commit P12/PEM keys, never treat an unsigned ZIP as Apple Wallet pass.
 *
 * Input JSON path: --input=/private/customer.json
 * Required environment: APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_ORG_NAME,
 * APPLE_PASS_CERT_PATH, APPLE_PASS_KEY_PATH, APPLE_WWDR_CERT_PATH,
 * APPLE_ICON_PNG_PATH, APPLE_LOGO_PNG_PATH, WALLET_HMAC_KEY.
 * Output: --out=/private/customer.pkpass
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync,chmodSync} from "node:fs";
import {createHash,createHmac} from "node:crypto";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {execFileSync} from "node:child_process";
const option=k=>process.argv.find(x=>x.startsWith("--"+k+"="))?.slice(k.length+3);
export function passManifest(customer,program,env){
 const required=["APPLE_PASS_TYPE_ID","APPLE_TEAM_ID","APPLE_ORG_NAME","WALLET_HMAC_KEY"];
 for(const k of required)if(typeof env[k]!=="string"||!env[k])throw Error(k+" not configured");
 if(!/^pass\.[a-zA-Z0-9.-]+$/.test(env.APPLE_PASS_TYPE_ID))throw Error("Bad pass type");
 if(!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID))throw Error("Bad team");
 if(env.WALLET_HMAC_KEY.length<32)throw Error("Wallet HMAC key too short");
 if(!/^[0-9a-f-]{36}$/i.test(customer.id)||!/^bfw1\./.test(customer.scan_code||""))
  throw Error("Unverified customer/QR");
 const rgb=h=>{
  const v=(h&&/^#[a-f0-9]{6}$/i.test(h)?h:"#21121b").slice(1);
  return "rgb("+[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)).join(",")+")";
 };
 const auth=createHmac("sha256",env.WALLET_HMAC_KEY)
  .update("appleauth:"+customer.id).digest("base64url");
 return {
  formatVersion:1,
  passTypeIdentifier:env.APPLE_PASS_TYPE_ID,
  serialNumber:customer.id,
  teamIdentifier:env.APPLE_TEAM_ID,
  organizationName:env.APPLE_ORG_NAME,
  description:"Tarjeta de fidelidad Bellaquitas Fest",
  webServiceURL:"https://bellaquitas.fr/v1/apple-wallet",
  authenticationToken:auth,
  logoText:program.name,
  foregroundColor:rgb(program.accent_color||"#e9c477"),
  backgroundColor:rgb(program.color),
  barcode:{format:"PKBarcodeFormatQR",message:customer.scan_code,
   messageEncoding:"iso-8859-1"},
  barcodes:[{format:"PKBarcodeFormatQR",message:customer.scan_code,
   messageEncoding:"iso-8859-1"}],
  storeCard:{
   primaryFields:[{key:"stamps",label:"SELLOS / TAMPONS",
    value:customer.stamps+" / "+program.stamp_goal,
    changeMessage:"Sellos actualizados: %@"}],
   secondaryFields:[{key:"reward",label:"RECOMPENSA",
    value:program.reward_label}],
   auxiliaryFields:[{key:"customer",label:"SOCIO",value:customer.name}]
  }
 };
}
export function signPkpass({inputPath,outputPath,env=process.env}){
 for(const name of ["APPLE_PASS_CERT_PATH","APPLE_PASS_KEY_PATH",
  "APPLE_WWDR_CERT_PATH","APPLE_ICON_PNG_PATH","APPLE_LOGO_PNG_PATH"])
  if(!env[name])throw Error(name+" missing");
 if(!inputPath||!outputPath)throw Error("Input and output file paths are required");
 const data=JSON.parse(readFileSync(inputPath,"utf8"));
 const pass=passManifest(data.customer,data.program,env);
 const dir=mkdtempSync(join(tmpdir(),"bellaquitas-pass-"));
 const out=resolve(outputPath);
 try{
  chmodSync(dir,0o700);
  writeFileSync(join(dir,"pass.json"),JSON.stringify(pass),{mode:0o600});
  cpSync(env.APPLE_ICON_PNG_PATH,join(dir,"icon.png"));
  cpSync(env.APPLE_LOGO_PNG_PATH,join(dir,"logo.png"));
  const files=["pass.json","icon.png","logo.png"],manifest={};
  for(const file of files)manifest[file]=createHash("sha1")
    .update(readFileSync(join(dir,file))).digest("hex");
  writeFileSync(join(dir,"manifest.json"),JSON.stringify(manifest),{mode:0o600});
  execFileSync("openssl",["smime","-sign","-binary","-in","manifest.json",
   "-signer",env.APPLE_PASS_CERT_PATH,"-inkey",env.APPLE_PASS_KEY_PATH,
   "-certfile",env.APPLE_WWDR_CERT_PATH,"-outform","DER","-out","signature"],{
   cwd:dir,stdio:["ignore","pipe","pipe"],timeout:20000});
  // Detached CMS signature verified against the same manifest.
  execFileSync("openssl",["smime","-verify","-inform","DER","-in","signature",
   "-content","manifest.json","-noverify"],{cwd:dir,stdio:["ignore","pipe","pipe"],timeout:20000});
  execFileSync("zip",["-X","-q",out,...files,"manifest.json","signature"],{
   cwd:dir,stdio:["ignore","pipe","pipe"],timeout:10000});
  return {outputPath:out,signed:true};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replaceAll("\\","/"))){
 const result=signPkpass({inputPath:option("input"),outputPath:option("out")});
 // Do not log personal data, secrets or tokens.
 console.log("Signed .pkpass generated:",result.outputPath);
}
