import {createHmac,randomInt,timingSafeEqual} from "node:crypto";
import {databasePool} from "./database-runtime.js";
import {getDatabaseUrl} from "./db.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const TTL_MINUTES=10;
const COOLDOWN_SECONDS=60;
const MAX_ATTEMPTS=6;
export const leadEmailVerificationEnabled=()=>process.env.LEAD_EMAIL_VERIFICATION_ENABLED==="true";
export function normalizeLeadEmail(value){
 if(typeof value!=="string"||value.length>254)return null;
 const normalized=value.trim().toLowerCase();
 return EMAIL.test(normalized)?normalized:null;
}
function secret(){
 const s=process.env.LEAD_EMAIL_CHALLENGE_SECRET;
 if(typeof s!=="string"||s.length<32)throw Error("lead-email-secret-not-configured");
 return s;
}
export function leadCodeDigest(leadId,email,code,key){
 if(!UUID.test(leadId)||!normalizeLeadEmail(email)||!/^\d{6}$/.test(String(code)))throw Error("invalid-lead-email-challenge");
 return createHmac("sha256",key).update("lead-email-v1\0"+leadId+"\0"+normalizeLeadEmail(email)+"\0"+String(code)).digest("hex");
}
function pool(){
 const databaseUrl=getDatabaseUrl();
 if(!databaseUrl)throw Error("database-unavailable");
 return databasePool(databaseUrl);
}
export async function issueLeadEmailChallenge({leadId,email,send}={}){
 const normalized=normalizeLeadEmail(email);
 if(!UUID.test(leadId)||!normalized)throw Error("invalid-request");
 if(!leadEmailVerificationEnabled())throw Error("lead-email-disabled");
 const key=secret();
 if(typeof send!=="function")throw Error("email-sender-unavailable");
 const client=await pool().connect();
 const code=String(randomInt(100000,1000000));
 const digest=leadCodeDigest(leadId,normalized,code,key);
 try{
  await client.query("BEGIN");
  const row=(await client.query("SELECT id,email FROM public.customer_leads WHERE id=$1 FOR UPDATE",[leadId])).rows[0];
  if(!row||normalizeLeadEmail(row.email)!==normalized)throw Error("lead-email-not-eligible");
  const existing=(await client.query("SELECT verified_at,last_sent_at FROM public.lead_email_challenges WHERE lead_id=$1 FOR UPDATE",[leadId])).rows[0];
  if(existing?.verified_at)throw Error("lead-already-verified");
  if(existing && (Date.now()-new Date(existing.last_sent_at).getTime())<COOLDOWN_SECONDS*1000)throw Error("lead-verification-cooldown");
  await client.query(`INSERT INTO public.lead_email_challenges(lead_id,email,code_digest,expires_at,attempts,verified_at,consumed_at,last_sent_at)
    VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes',0,NULL,NULL,NOW())
    ON CONFLICT(lead_id) DO UPDATE SET email=EXCLUDED.email,code_digest=EXCLUDED.code_digest,
       expires_at=EXCLUDED.expires_at,attempts=0,verified_at=NULL,consumed_at=NULL,last_sent_at=NOW()`,[leadId,normalized,digest]);
  // Do not send while locked transaction is pending. The secret is not logged.
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}finally{client.release()}
 await send(normalized,code);
 return {accepted:true};
}
export async function verifyLeadEmailChallenge({leadId,email,code}={}){
 const normalized=normalizeLeadEmail(email);
 if(!UUID.test(leadId)||!normalized||!/^\d{6}$/.test(String(code||"")))return false;
 if(!leadEmailVerificationEnabled())return false;
 const digest=leadCodeDigest(leadId,normalized,code,secret());
 const client=await pool().connect();
 try{
  await client.query("BEGIN");
  const row=(await client.query(`SELECT c.code_digest,c.attempts,c.expires_at,c.verified_at,c.consumed_at
   FROM public.lead_email_challenges c
   JOIN public.customer_leads l ON l.id=c.lead_id AND lower(l.email)=c.email
   WHERE c.lead_id=$1 AND c.email=$2 FOR UPDATE`,[leadId,normalized])).rows[0];
  if(!row||row.verified_at||row.consumed_at||new Date(row.expires_at).getTime()<=Date.now()||row.attempts>=MAX_ATTEMPTS){
   await client.query("COMMIT");return false;
  }
  const a=Buffer.from(String(row.code_digest||""),"hex"),b=Buffer.from(digest,"hex");
  const valid=a.length===b.length&&timingSafeEqual(a,b);
  if(valid){
   await client.query("UPDATE public.lead_email_challenges SET attempts=attempts+1,verified_at=NOW(),consumed_at=NOW() WHERE lead_id=$1",[leadId]);
  }else{
   await client.query("UPDATE public.lead_email_challenges SET attempts=attempts+1 WHERE lead_id=$1",[leadId]);
  }
  await client.query("COMMIT");return valid;
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}finally{client.release()}
}
