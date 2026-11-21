/**
 * Durable Wallet sync outbox consumer, never active in staging or mock.
 * Run via a future, explicitly approved Cloudflare scheduled Worker (or a
 * protected internal call). Keep batches small on Workers Free: CPU budget 10ms.
 */
import {walletMode,updatePass} from "./index.js";
import {walletIssuerReadiness} from "./issuer-readiness.js";
import {scanCode} from "./core.js";
export async function syncQueuedWalletPasses(env,{limit=2}={}){
 if(env?.SITE_MODE!=="production"||env.WALLET_ENABLED!=="yes"||
    env.WALLET_SYNC_ENABLED!=="yes"||env.WALLET_REAL_APPROVED!=="yes"||
    walletMode(env)!=="real"||typeof env.DB?.prepare!=="function"||
    !Number.isInteger(limit)||limit<1||limit>3)
  return {enabled:false,processed:0,failed:0};
 // Paused issuers must not consume retries or starve an approved provider.
 const available=walletIssuerReadiness(env);
 const providers=Object.entries(available).filter(([,active])=>active).map(([name])=>name);
 if(!providers.length)return {enabled:false,processed:0,failed:0};
 const placeholders=providers.map(()=>"?").join(",");
 const jobs=await env.DB.prepare(
  "SELECT customer_id,provider,attempts FROM wallet_sync_jobs "+
  "WHERE provider IN ("+placeholders+") AND status IN('pending','failed') "+
  "AND attempts<10 AND next_attempt_at<=unixepoch() "+
  "ORDER BY next_attempt_at,requested_at LIMIT ?").bind(...providers,limit).all();
 let processed=0,failed=0;
 for(const job of jobs.results||[]){
  const acquired=await env.DB.prepare(
   "UPDATE wallet_sync_jobs SET status='running' "+
   "WHERE customer_id=? AND provider=? AND status IN('pending','failed') AND next_attempt_at<=unixepoch() "+
   "RETURNING customer_id").bind(job.customer_id,job.provider).first();
  if(!acquired)continue;
  const row=await env.DB.prepare(
   "SELECT c.*,p.slug,p.name AS business_name,p.stamp_goal,p.reward_label,p.color,p.accent_color,p.logo_url "+
   "FROM wallet_customers c JOIN wallet_programs p ON p.id=c.program_id "+
   "WHERE c.id=? AND c.deleted_at IS NULL AND p.active=1 LIMIT 1")
   .bind(job.customer_id).first();
  if(!row){
   await env.DB.prepare("DELETE FROM wallet_sync_jobs WHERE customer_id=? AND provider=?")
    .bind(job.customer_id,job.provider).run();continue;
  }
  const customer={...row,scan_code:await scanCode(row,env.WALLET_HMAC_KEY)};
  const program={id:row.program_id,slug:row.slug,name:row.business_name,
   stamp_goal:row.stamp_goal,reward_label:row.reward_label,
   color:row.color,accent_color:row.accent_color,logo_url:row.logo_url};
  try{
   await updatePass(customer,program,env,job.provider);
   // Do not overwrite a newer pending update if a stamp arrived while
   // the external API was being contacted.
   await env.DB.prepare(
    "UPDATE wallet_sync_jobs SET status='done',processed_at=unixepoch() "+
    "WHERE customer_id=? AND provider=? AND status='running'")
    .bind(job.customer_id,job.provider).run();
   processed++;
  }catch{
   // Retry with increasing delay; do not expose user/secret in logs.
   await env.DB.prepare(
    "UPDATE wallet_sync_jobs SET attempts=MIN(10,attempts+1),status='failed', "+
    "next_attempt_at=unixepoch()+MIN(21600,60*(attempts+1)*(attempts+1)) "+
    "WHERE customer_id=? AND provider=? AND status='running'")
    .bind(job.customer_id,job.provider).run();
   failed++;
  }
 }
 return {enabled:true,processed,failed};
}
