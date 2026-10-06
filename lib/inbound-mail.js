import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {mailbox,inboundText,trustedInbound} from './inbound-validation';
import {getCommunicationProspect,saveProspectReplyAnalysis} from './prospects';
import {analyzeSalesReply} from './providers';
import {analyzeAndSaveCreatorReply} from './creator-hunt';
import {budgetFetch} from './request-budget';
async function inboxPool(){
 const url=getDatabaseUrl();if(!url)throw new Error('database-not-configured');const pool=databasePool(url);
 await initializeSchema(pool,'inbound-mail',async tx=>tx.query(`CREATE TABLE IF NOT EXISTS incoming_mail(
  event_id TEXT PRIMARY KEY,email_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'queued',
  sender TEXT NOT NULL DEFAULT '',subject TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',
  matched_type TEXT NOT NULL DEFAULT '',matched_id UUID,review_reason TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),processed_at TIMESTAMPTZ
 )`));return pool;
}
export async function enqueueInbound(eventId,event){
 const id=event.data?.email_id;if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,120}$/.test(id))throw new Error('invalid-email-id');
 const pool=await inboxPool();const row=(await pool.query(`INSERT INTO incoming_mail(event_id,email_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,[eventId,id])).rows[0];return Boolean(row);
}
export async function listInbound(){
 const pool=await inboxPool();return (await pool.query(`SELECT event_id AS "eventId",status,sender,subject,body,matched_type AS "matchedType",matched_id AS "matchedId",review_reason AS "reviewReason",received_at AS "receivedAt" FROM incoming_mail ORDER BY received_at DESC LIMIT 60`)).rows;
}
export async function processInbound(){
 if(!process.env.RESEND_API_KEY||!process.env.INBOUND_EMAIL_ADDRESS||!process.env.RESEND_WEBHOOK_SECRET)return {ok:true,skipped:'inbox-not-configured'};
 const pool=await inboxPool(),lock=await pool.connect();let acquired=false;const results=[];
 try{
  acquired=Boolean((await lock.query('SELECT pg_try_advisory_lock(741852965) AS acquired')).rows[0]?.acquired);
  if(!acquired)return {ok:true,skipped:'already-running'};
  const pending=(await pool.query(`SELECT * FROM incoming_mail WHERE status='queued' AND attempts<5 ORDER BY received_at LIMIT 2`)).rows;
  for(const item of pending){
   try{
    await pool.query('UPDATE incoming_mail SET attempts=attempts+1 WHERE event_id=$1',[item.event_id]);
    const res=await budgetFetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(item.email_id)}?html_format=cid`,{headers:{authorization:'Bearer '+process.env.RESEND_API_KEY}});
    if(!res.ok)throw new Error('receive-api-'+res.status);
    const email=await res.json(),sender=mailbox(email.from),text=inboundText(email);
    let reason=trustedInbound(email,process.env.INBOUND_EMAIL_ADDRESS)?'':'sender-authentication-or-recipient-unverified';
    const matches=[];
    if(sender&&!reason){
     if((await pool.query("SELECT to_regclass('public.prospects') AS present")).rows[0]?.present){
      const rows=(await pool.query(`SELECT id FROM prospects WHERE lower(contact_email)=$1 AND contact_status='verified' AND communication_status='sent' LIMIT 2`,[sender])).rows;
      matches.push(...rows.map(x=>({type:'business',id:x.id})));
     }
     if((await pool.query("SELECT to_regclass('public.creator_hunt_leads') AS present")).rows[0]?.present){
      const rows=(await pool.query(`SELECT id FROM creator_hunt_leads WHERE lower(public_contact)=$1 AND crm_stage IN ('contacted','reply','warm','proposal') LIMIT 2`,[sender])).rows;
      matches.push(...rows.map(x=>({type:'creator',id:x.id})));
     }
     if(matches.length!==1)reason=matches.length?'ambiguous-sender':'no-contacted-record';
    }
    if(!text)reason='empty-message';
    let match=matches.length===1?matches[0]:null;
    if(!reason){
     if(match.type==='business'){const prospect=await getCommunicationProspect(match.id);const analysis=await analyzeSalesReply({...prospect,replyText:text});await saveProspectReplyAnalysis(match.id,{...analysis,needsHuman:true})}
     else await analyzeAndSaveCreatorReply(match.id,text);
    }
    await pool.query(`UPDATE incoming_mail SET status=$2,sender=$3,subject=$4,body=$5,matched_type=$6,matched_id=$7,review_reason=$8,processed_at=NOW() WHERE event_id=$1`,[item.event_id,reason?'review-required':'analyzed',sender,String(email.subject||'').slice(0,300),text,match?.type||'',match?.id||null,reason]);
    results.push({eventId:item.event_id,status:reason?'review-required':'analyzed'});
   }catch(e){await pool.query('UPDATE incoming_mail SET review_reason=$2,status=CASE WHEN attempts>=5 THEN \'review-required\' ELSE status END WHERE event_id=$1',[item.event_id,String(e.message||'processing-failed').slice(0,100)]);results.push({eventId:item.event_id,status:'retry'})}
  }
  return {ok:true,results,automaticReplySending:false};
 }finally{if(acquired)await lock.query('SELECT pg_advisory_unlock(741852965)').catch(()=>{});lock.release()}
}
