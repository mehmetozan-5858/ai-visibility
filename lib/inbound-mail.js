import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {mailbox,inboundText,trustedInbound} from './inbound-validation';
import {replyFingerprint,validateInboxReviews,assertReviewMatches} from './inbox-review-rules';
import {budgetFetch} from './request-budget';
async function inboxPool(){
 const url=getDatabaseUrl();if(!url)throw new Error('database-not-configured');const pool=databasePool(url);
 await initializeSchema(pool,'inbound-mail',async tx=>tx.query(`CREATE TABLE IF NOT EXISTS incoming_mail(
  event_id TEXT PRIMARY KEY,email_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'queued',
  sender TEXT NOT NULL DEFAULT '',subject TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',
  matched_type TEXT NOT NULL DEFAULT '',matched_id UUID,review_reason TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),processed_at TIMESTAMPTZ
 )`));
 await initializeSchema(pool,'inbound-reply-drafts-v1',async tx=>tx.query(`ALTER TABLE incoming_mail
 ADD COLUMN IF NOT EXISTS reply_draft TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS reply_summary TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS draft_version INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ`));
 await initializeSchema(pool,'inbound-manual-review-v1',async tx=>tx.query(`ALTER TABLE incoming_mail ADD COLUMN IF NOT EXISTS review_assessment JSONB NOT NULL DEFAULT '{}'::jsonb`));return pool;
}
export async function enqueueInbound(eventId,event){
 const id=event.data?.email_id;if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,120}$/.test(id))throw new Error('invalid-email-id');
 const pool=await inboxPool();const row=(await pool.query(`INSERT INTO incoming_mail(event_id,email_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,[eventId,id])).rows[0];return Boolean(row);
}
export async function listInbound(){
 const pool=await inboxPool();return (await pool.query(`SELECT event_id AS "eventId",status,sender,subject,body,matched_type AS "matchedType",matched_id AS "matchedId",review_reason AS "reviewReason",reply_draft AS "replyDraft",reply_summary AS "replySummary",draft_version AS "draftVersion",draft_updated_at AS "draftUpdatedAt",received_at AS "receivedAt",review_assessment AS "reviewAssessment" FROM incoming_mail ORDER BY received_at DESC LIMIT 60`)).rows;
}
export async function processInbound(){
 const receivingKey=process.env.RESEND_RECEIVING_API_KEY||process.env.RESEND_API_KEY;
 if(!receivingKey||!process.env.INBOUND_EMAIL_ADDRESS||!process.env.RESEND_WEBHOOK_SECRET)return {ok:true,skipped:'inbox-not-configured'};
 const pool=await inboxPool(),lock=await pool.connect();let acquired=false;const results=[];
 try{
  acquired=Boolean((await lock.query('SELECT pg_try_advisory_lock(741852965) AS acquired')).rows[0]?.acquired);
  if(!acquired)return {ok:true,skipped:'already-running'};
  const pending=(await pool.query(`SELECT * FROM incoming_mail WHERE status='queued' AND attempts<5 ORDER BY received_at LIMIT 2`)).rows;
  for(const item of pending){
   try{
    await pool.query('UPDATE incoming_mail SET attempts=attempts+1 WHERE event_id=$1',[item.event_id]);
    const res=await budgetFetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(item.email_id)}?html_format=cid`,{headers:{authorization:'Bearer '+receivingKey}});
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
    let match=matches.length===1?matches[0]:null,replyDraft='',replySummary='';
    if(!reason){
     if(match.type==='business')await pool.query(`UPDATE prospects SET reply_status=CASE WHEN reply_status='' THEN 'replied' ELSE reply_status END,crm_stage=CASE WHEN crm_stage IN ('new','contacted') THEN 'replied' ELSE crm_stage END,follow_up_at=NULL,reply_needs_human=TRUE,reply_received_at=NOW() WHERE id=$1`,[match.id]);
     else await pool.query(`UPDATE creator_hunt_leads SET reply_classification='pending-review',crm_stage=CASE WHEN crm_stage IN ('contacted','reply') THEN 'reply' ELSE crm_stage END,stop_contact=TRUE,next_follow_up=NULL,follow_up_due_at=NULL,updated_at=NOW() WHERE id=$1`,[match.id]);
    }
    await pool.query(`UPDATE incoming_mail SET status=$2,sender=$3,subject=$4,body=$5,matched_type=$6,matched_id=$7,review_reason=$8,reply_draft=$9,reply_summary=$10,draft_version=0,draft_updated_at=NULL,processed_at=NOW() WHERE event_id=$1`,[item.event_id,reason?'review-required':'awaiting-review',sender,String(email.subject||'').slice(0,300),text,match?.type||'',match?.id||null,reason,replyDraft,replySummary]);
    results.push({eventId:item.event_id,status:reason?'review-required':'awaiting-review'});
   }catch(e){await pool.query('UPDATE incoming_mail SET review_reason=$2,status=CASE WHEN attempts>=5 THEN \'review-required\' ELSE status END WHERE event_id=$1',[item.event_id,String(e.message||'processing-failed').slice(0,100)]);results.push({eventId:item.event_id,status:'retry'})}
  }
  return {ok:true,results,automaticReplySending:false};
 }finally{if(acquired)await lock.query('SELECT pg_advisory_unlock(741852965)').catch(()=>{});lock.release()}
}

export async function retryInboundReview(eventId){
 const p=await inboxPool();return (await p.query("UPDATE incoming_mail SET status='queued',attempts=0,review_reason='' WHERE event_id=$1 AND status='review-required' RETURNING event_id",[eventId])).rows[0]||null;
}

export async function saveInboundDraft(eventId,draft,version){
 if(typeof eventId!=='string'||!eventId||eventId.length>200||typeof draft!=='string'||!draft.trim()||draft.length>10000||!Number.isInteger(version)||version<1)throw new Error('invalid-draft');
 const p=await inboxPool();return (await p.query(`UPDATE incoming_mail SET reply_draft=$2,draft_version=draft_version+1,draft_updated_at=NOW()
 WHERE event_id=$1 AND status='analyzed' AND matched_id IS NOT NULL AND draft_version=$3
 RETURNING event_id AS "eventId",reply_draft AS "replyDraft",draft_version AS "draftVersion"`,[eventId,draft.trim(),version])).rows[0]||null;
}

export async function exportInboxReviews(){
 const p=await inboxPool();
 const rows=(await p.query(`SELECT event_id AS "eventId",sender,subject,body,matched_type AS "matchedType",matched_id AS "matchedId",draft_version AS version,received_at AS "receivedAt" FROM incoming_mail WHERE status='awaiting-review' AND matched_id IS NOT NULL AND review_reason='' ORDER BY received_at,event_id LIMIT 10`)).rows;
 const counts=(await p.query(`SELECT count(*) FILTER (WHERE status='awaiting-review')::int AS pending,count(*) FILTER (WHERE status='review-required')::int AS "verificationRequired" FROM incoming_mail`)).rows[0];
 return {...counts,messages:rows.map(x=>({...x,bodyHash:replyFingerprint(x.body)})),paidAiCalls:0};
}

export async function importInboxReviews(input){
 const reviews=validateInboxReviews(input),p=await inboxPool(),results=[];
 for(const review of reviews){
  const tx=await p.connect();
  try{
   await tx.query('BEGIN');
   const row=(await tx.query('SELECT * FROM incoming_mail WHERE event_id=$1 FOR UPDATE',[review.eventId])).rows[0];
   assertReviewMatches(row,review);
   const business=row.matched_type==='business',table=business?'prospects':'creator_hunt_leads';
   const crm=(await tx.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[row.matched_id])).rows[0];
   if(!crm||mailbox(business?crm.contact_email:crm.public_contact)!==row.sender||(business&&(crm.contact_status!=='verified'||crm.communication_status!=='sent')))throw Error('crm-match-changed');
   const stopped=['not-interested','opt-out'].includes(review.classification);
   const newer=(await tx.query(`SELECT event_id FROM incoming_mail WHERE matched_type=$1 AND matched_id=$2 AND review_reason='' AND (received_at,event_id)>($3,$4) LIMIT 1`,[row.matched_type,row.matched_id,row.received_at,row.event_id])).rows.length;
   // Older messages remain auditable but cannot overwrite the latest conversation guidance.
   if(!newer){
    if(business)await tx.query(`UPDATE prospects SET reply_status=CASE WHEN crm_stage='won' THEN reply_status ELSE $2 END,crm_stage=CASE WHEN crm_stage='won' THEN crm_stage ELSE $3 END,follow_up_at=NULL,reply_classification=$4,reply_summary=$5,reply_draft=$6,reply_needs_human=TRUE WHERE id=$1`,[row.matched_id,stopped?'lost':'replied',stopped?'lost':(['warm','meeting','proposal'].includes(crm.crm_stage)?crm.crm_stage:'replied'),review.classification,review.summary,review.draft]);
    else await tx.query(`UPDATE creator_hunt_leads SET reply_classification=$2,reply_summary=$3,reply_draft=$4,stop_contact=TRUE,next_follow_up=NULL,follow_up_due_at=NULL,crm_stage=CASE WHEN crm_stage='won' THEN crm_stage ELSE $5 END,updated_at=NOW() WHERE id=$1`,[row.matched_id,review.classification,review.summary,review.draft,stopped?'lost':(['warm','proposal'].includes(crm.crm_stage)?crm.crm_stage:'reply')]);
   }
   const assessment={method:'manual-inbox-review-v1',classification:review.classification,excerpt:review.excerpt,nextAction:review.nextAction,bodyHash:review.bodyHash,reviewedAt:new Date().toISOString(),crmUpdated:!newer};
   await tx.query(`UPDATE incoming_mail SET status='analyzed',reply_draft=$2,reply_summary=$3,draft_version=draft_version+1,draft_updated_at=NOW(),review_assessment=$4::jsonb WHERE event_id=$1`,[review.eventId,review.draft,review.summary,JSON.stringify(assessment)]);
   await tx.query('COMMIT');results.push({eventId:review.eventId,status:'saved',crmUpdated:!newer});
  }catch(e){await tx.query('ROLLBACK').catch(()=>{});results.push({eventId:review.eventId,status:'not-saved',reason:['unverified-message','stale-message','excerpt-not-found','crm-match-changed'].includes(e.message)?e.message:'save-failed'})}
  finally{tx.release()}
 }
 return {results,paidAiCalls:0,sent:false};
}
