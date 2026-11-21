#!/usr/bin/env node
/** Apple signed ZIP structure with a SYNTHETIC, untrusted certificate.
 * NOT a real Apple Wallet pass or Apple Developer approval.
 */
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {passManifest,signPkpass} from "../wallet/apple-signer.mjs";
const root=mkdtempSync(join(tmpdir(),"bq-wallet-test-"));
const cert=join(root,"signer-cert.pem"),key=join(root,"signer-key.pem");
const sample=join(root,"synthetic-customer.json"),target=join(root,"synthetic.pkpass");
const png=join(root,"logo.png");
const input={customer:{id:"11111111-1111-4111-8111-111111111111",
 name:"Persona de prueba",stamps:4,
 scan_code:"bfw1."+("1".repeat(36))+"."+("2".repeat(36))+"."+"A".repeat(43)},
 program:{name:"Bellaquitas Fest",stamp_goal:7,reward_label:"Premio de prueba",
  color:"#21121b",accent_color:"#e9c477"}};
const vars={APPLE_PASS_TYPE_ID:"pass.fr.bellaquitas.test",
 APPLE_TEAM_ID:"A1B2C3D4E5",APPLE_ORG_NAME:"Bellaquitas Test",
 WALLET_HMAC_KEY:"synthetic-testing-only-not-for-real-keys-123",
 APPLE_PASS_CERT_PATH:cert,APPLE_PASS_KEY_PATH:key,
 APPLE_WWDR_CERT_PATH:cert,APPLE_ICON_PNG_PATH:png,APPLE_LOGO_PNG_PATH:png};
try{
 const document=passManifest(input.customer,input.program,vars);
 assert.equal(document.serialNumber,input.customer.id);
 assert.equal(document.storeCard.primaryFields[0].value,"4 / 7");
 assert.ok(document.webServiceURL.startsWith("https://bellaquitas.fr/"));
 assert.throws(()=>passManifest(input.customer,input.program,{}));
 writeFileSync(sample,JSON.stringify(input));
 writeFileSync(png,Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==","base64"));
 execFileSync("openssl",["req","-newkey","rsa:2048","-nodes","-x509",
 "-days","1","-subj","/CN=Wallet Synthetic Test",
 "-keyout",key,"-out",cert],{stdio:"ignore",timeout:20000});
 const result=signPkpass({inputPath:sample,outputPath:target,env:vars});
 assert.equal(result.signed,true);assert.equal(existsSync(target),true);
 const zip=readFileSync(target);
 assert.equal(zip[0],80);assert.equal(zip[1],75);
 const listing=execFileSync("unzip",["-Z","-1",target],{encoding:"utf8"})
  .trim().split("\n");
 assert.deepEqual(listing.sort(),["icon.png","logo.png","manifest.json","pass.json","signature"].sort());
 const manifest=JSON.parse(execFileSync("unzip",["-p",target,"manifest.json"],{encoding:"utf8"}));
 assert.equal(Object.keys(manifest).length,3);
 assert.match(manifest["pass.json"],/^[0-9a-f]{40}$/);
 const signedPass=JSON.parse(execFileSync("unzip",["-p",target,"pass.json"],{encoding:"utf8"}));
 assert.equal(signedPass.storeCard.secondaryFields[0].value,"Premio de prueba");
 console.log("PASS: CMS detached + manifest + signed .pkpass ZIP with synthetic certificate (NOT an Apple issued pass).");
}finally{rmSync(root,{recursive:true,force:true});}
