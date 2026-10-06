import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';

// Persist the exact payload before the provider call. Unknown sends may only be
// retried inside the provider's deduplication window; older ones require review.
export async function deliverOnce(key,payload,finalize,{pool,send,now=()=>Date.now()}={}){
 if(!key||key.length>200)throw Error('invalid-delivery-key');
 pool ||= databasePool(getDatabaseUrl());
 await initializeSchema(pool,'email-deliveries',tx=>tx.query(`CREATE TABLE IF NOT EXISTS email_deliveries(delivery_key TEXT PRIMARY KEY,payload JSONB NOT NULL,provider_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'sending',first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ)`));
 const tx=await pool.connect();let locked=false;
 try{
  locked=Boolean((await tx.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[key])).rows[0]?.acquired);
  if(!locked)throw Error('delivery-in-progress');
  await tx.query('INSERT INTO email_deliveries(delivery_key,payload) VALUES($1,$2) ON CONFLICT DO NOTHING',[key,JSON.stringify(payload)]);
  const row=(await tx.query('SELECT * FROM email_deliveries WHERE delivery_key=$1',[key])).rows[0];
  if(row.status==='completed')return {id:row.provider_id,duplicate:true};
  let id=row.provider_id;
  if(!id){
   if(now()-new Date(row.first_attempt_at).getTime()>=23*3600000)throw Error('delivery-needs-review');
   const result=await (send||sendResend)(key,row.payload);id=result.id;
   if(!id)throw Error('delivery-provider-id-missing');
   await tx.query("UPDATE email_deliveries SET provider_id=$2,status='accepted' WHERE delivery_key=$1",[key,id]);
  }
  await finalize(id);
  await tx.query("UPDATE email_deliveries SET status='completed',completed_at=NOW() WHERE delivery_key=$1",[key]);
  return {id,duplicate:false};
 }finally{if(locked)await tx.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[key]).catch(()=>{});tx.release()}
}
async function sendResend(key,payload){
 if(!process.env.RESEND_API_KEY)throw Error('email-provider-not-configured');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('email-send-failed:'+r.status);return data;
}
