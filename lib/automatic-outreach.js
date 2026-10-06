import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {listOutreachEvaluationCandidates,listFollowUpQueue,getCommunicationProspect,markProspectCommunicationSent,markProspectFollowUpSent} from './prospects';
import {evaluateOutreachPool} from './outreach-selection';
import {sendBrandedOutreach} from './outreach-email';
import {addSharedAgentEvent} from './agent-coordination';
import {verifyContactPage} from './contact-page-verification';

export function outreachPolicy(env=process.env){
 return {enabled:env.OUTREACH_SEND_ENABLED==='true',dailyLimit:Math.max(1,Math.min(Math.floor(Number(env.OUTREACH_DAILY_LIMIT)||50),50)),perCycle:Math.max(1,Math.min(Math.floor(Number(env.OUTREACH_CYCLE_LIMIT)||5),5)),selectionLimit:50,selectionMode:'comparative-pool-review',followUpDays:[4,5],maxFollowUps:2};
}
function host(raw){try{return new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}
export function automaticRecipientIssue(x){
 const email=String(x.contactEmail||'').toLowerCase(),domain=host(x.domain||''),source=host(x.contactSourceUrl||'');
 if(x.contactStatus!=='verified'||!domain||!source||!/^https:\/\//i.test(x.contactSourceUrl||''))return 'official-source-required';
 if(!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))return 'verified-email-required';
 if(source!==domain&&!source.endsWith('.'+domain))return 'source-business-mismatch';
 const emailHost=email.split('@')[1];if(emailHost!==domain&&!emailHost.endsWith('.'+domain))return 'email-business-mismatch';
 if(/(?:^|\.)(local|test|invalid|example)$/.test(domain)||/^(example\.(com|org|net)|localhost)$/.test(domain))return 'test-recipient';
 if(x.replyStatus||['lost','won'].includes(x.crmStage)||x.clientId)return 'reply-or-customer';
 // These contacts were explicitly held during the October 6 verification.
 if(/berlin.?klinik|audi\s*dental|do\s*&\s*co.*restaurant/i.test(x.name||''))return 'identity-review-required';
 return '';
}
export function permissionMessage(x,follow=false){
 const tr=/^(Türkiye|Turkey|TR)$/i.test(String(x.country||'')),name=String(x.name||'').slice(0,180);
 return tr?(follow?`Merhaba ${name} ekibi,\n\nAI Visibility Works olarak AI görünürlüğü hakkında gönderdiğimiz mesajı bir kez hatırlatmak istedik. İşletmenize yönelik kısa bir değerlendirme paylaşmamızı ister misiniz?\n\nİlgilenmiyorsanız bu e-postaya yazmanız yeterli; tekrar iletişim kurmayacağız.\n\nAI Visibility Works`:`Merhaba ${name} ekibi,\n\nAI Visibility Works olarak işletmelerin yapay zekâ aramalarındaki görünürlüğünü değerlendiren analiz ve iyileştirme hizmetleri sunuyoruz. İşletmeniz için kısa bir değerlendirme paylaşmamızı ister misiniz?\n\nBu mesaj tamamlanmış bir analiz veya sonuç garantisi içermez. İlgilenmiyorsanız yanıtlayarak belirtmeniz yeterli; tekrar iletişim kurmayacağız.\n\nAI Visibility Works`):(follow?`Hello ${name} team,\n\nA brief follow-up to our AI Visibility Works enquiry: would you like us to share a short assessment of your business's discoverability in AI search?\n\nIf this is not relevant, reply to let us know and we will stop contacting you.\n\nAI Visibility Works`:`Hello ${name} team,\n\nAI Visibility Works offers analysis and improvement services for how businesses appear in AI search. Would you be interested in receiving a short assessment for your business?\n\nThis enquiry does not claim a completed audit or guaranteed results. If this is not relevant, reply to let us know and we will stop contacting you.\n\nAI Visibility Works`);
}
async function outreachPool(){
 const pool=databasePool(getDatabaseUrl());
 await initializeSchema(pool,'automatic-outreach-v1',async tx=>{
  await tx.query(`CREATE TABLE IF NOT EXISTS outreach_cycle_reports(id BIGSERIAL PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),report JSONB NOT NULL)`);
  await tx.query(`CREATE TABLE IF NOT EXISTS email_deliveries(delivery_key TEXT PRIMARY KEY,payload JSONB NOT NULL,provider_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'sending',first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ)`);
 });return pool;
}
async function blockedRecipient(pool,email,{follow,id}={}){
 // Replies and opt-outs block every duplicate prospect using that address.
 const r=await pool.query(`SELECT EXISTS(SELECT 1 FROM prospects WHERE lower(contact_email)=$1 AND (COALESCE(reply_status,'')<>'' OR crm_stage IN ('lost','won') OR client_id IS NOT NULL)) AS blocked`,[email]);
 if(r.rows[0]?.blocked)return 'reply-or-customer';
 if((await pool.query("SELECT to_regclass('public.incoming_mail') AS present")).rows[0]?.present){
  if((await pool.query('SELECT 1 FROM incoming_mail WHERE lower(sender)=$1 LIMIT 1',[email])).rows.length)return 'inbound-reply';
  // Unknown queued senders must be processed before further outreach.
  if((await pool.query("SELECT 1 FROM incoming_mail WHERE status='queued' LIMIT 1")).rows.length)return 'inbound-processing-pending';
 }
 if(!follow){const prior=await pool.query(`SELECT 1 FROM email_deliveries WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'to') AS recipient WHERE lower(recipient)=$1) AND delivery_key LIKE 'prospect-%' AND delivery_key<>$2 LIMIT 1`,[email,`prospect-first/${id}`]);if(prior.rows.length)return 'already-contacted';}
 return '';
}
async function followDeliveryIssue(pool,id){
 const key=process.env.RESEND_RECEIVING_API_KEY||process.env.RESEND_API_KEY;
 const row=(await pool.query("SELECT provider_id FROM email_deliveries WHERE delivery_key=$1",[`prospect-first/${id}`])).rows[0];
 if(!row?.provider_id||!key)return 'delivery-not-verified';
 const r=await fetch('https://api.resend.com/emails/'+encodeURIComponent(row.provider_id),{headers:{authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return 'delivery-not-verified';const d=await r.json();
 return d.id===row.provider_id&&['delivered','opened','clicked'].includes(d.last_event)?'':'delivery-not-verified';
}
export async function automaticOutreachStatus(){
 const pool=await outreachPool(),policy=outreachPolicy();
 const recent=(await pool.query('SELECT created_at AS "createdAt",report FROM outreach_cycle_reports ORDER BY id DESC LIMIT 5')).rows;
 return {policy,recent};
}
export async function runAutomaticOutreach({dryRun=false,mode='all',deps={}}={}){
 const policy=outreachPolicy(deps.env||process.env),report={ok:true,sendEnabled:policy.enabled,dryRun,policy,startedAt:new Date().toISOString(),eligible:0,sent:0,firstSent:0,followSent:0,skipped:[],errors:[]};
 if(!policy.enabled&&!dryRun)return {...report,skippedReason:'sending-disabled'};
 const pool=deps.pool||await outreachPool(),lock=await pool.connect();let acquired=false,transaction=false;
 try{
  // A transaction pins pooled database connections to one backend. Session
  // locks can survive a request when a transaction pool routes unlock elsewhere.
  await lock.query('BEGIN');transaction=true;
  acquired=Boolean((await lock.query('SELECT pg_try_advisory_xact_lock(741852977) AS acquired')).rows[0]?.acquired);
  if(!acquired)return {...report,skippedReason:'already-running'};
  const sender=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL;
  if(!deps.send&&(!sender||/@resend\.dev\b/i.test(sender)||!process.env.INBOUND_EMAIL_ADDRESS||!process.env.RESEND_RECEIVING_API_KEY))throw Error('verified-sender-and-inbox-required');
  const today=Number((await pool.query(`SELECT count(*)::integer AS total FROM email_deliveries WHERE delivery_key LIKE 'prospect-%' AND first_attempt_at>=((NOW() AT TIME ZONE 'Europe/Istanbul')::date::timestamp AT TIME ZONE 'Europe/Istanbul')`)).rows[0]?.total||0);
  report.todayAttempts=today;let remaining=Math.max(0,policy.dailyLimit-today);
  // Follow-up and first-contact jobs share the same hourly ceiling, including
  // uncertain provider attempts and reruns. Istanbul defines the calendar day.
  const hourly=Number((await pool.query(`SELECT count(*)::integer AS total FROM email_deliveries WHERE delivery_key LIKE 'prospect-%' AND first_attempt_at>=date_trunc('hour',NOW())`)).rows[0]?.total||0);
  report.hourAttempts=hourly;let cycleRemaining=Math.max(0,policy.perCycle-hourly);
  const candidates=mode==='follow'?[]:await (deps.listFirst||listOutreachEvaluationCandidates)();
  const assessment=evaluateOutreachPool(candidates.map(x=>({...x,selectionBlocked:automaticRecipientIssue(x)})),{limit:remaining});
  const first=assessment.selected,follows=mode==='first'?[]:await (deps.listFollow||listFollowUpQueue)(50);
  report.selection={evaluated:assessment.evaluated,qualified:assessment.qualified,awaitingAnalysis:assessment.awaitingAnalysis,selected:first.map(x=>({id:x.id,name:x.name,priority:x.selectionPriority,reasons:x.selectionReasons}))};
  const seen=new Set();
  for(const [candidate,follow] of [...first.map(x=>[x,false]),...follows.map(x=>[x,true])]){
   if(Date.now()-new Date(report.startedAt).getTime()>65000){report.deferred='runtime-budget';break}
   const x=await (deps.getProspect||getCommunicationProspect)(candidate.id);if(!x)continue;
   const email=String(x.contactEmail||'').toLowerCase();let issue=automaticRecipientIssue(x);
   if(!issue&&!follow&&x.communicationStatus!=='ready-for-review')issue='not-ready';
   if(!issue&&follow&&(x.replyStatus||candidate.followUpCount>=2||!candidate.followUpAt||new Date(candidate.followUpAt)>new Date()))issue='follow-not-due';
   if(!issue&&seen.has(email))issue='duplicate-recipient';
   if(!issue)issue=await (deps.blocked||blockedRecipient)(pool,email,{follow,id:x.id});
   if(issue){report.skipped.push({id:x.id,reason:issue});continue}
   seen.add(email);
   try{
    if(!await (deps.verify||verifyContactPage)(x.contactSourceUrl,email,x.domain))throw Error('address-not-on-official-page');
    if(follow){const failure=await (deps.followDelivery||followDeliveryIssue)(pool,x.id);if(failure)throw Error(failure)}
    report.eligible++;
    if(dryRun)continue;
    if(remaining<=0){report.deferred='daily-limit';break}
    if(cycleRemaining<=0){report.deferred='cycle-limit';break}
    // Recheck replies just before the provider call, after page verification.
    const blocked=await (deps.blocked||blockedRecipient)(pool,email,{follow,id:x.id});if(blocked){report.skipped.push({id:x.id,reason:blocked});continue}
    remaining--;cycleRemaining--; // Count uncertain attempts conservatively within this run.
    const key=follow?`prospect-follow/${x.id}/${candidate.followUpCount}`:`prospect-first/${x.id}`;
    const finalize=follow?()=>markProspectFollowUpSent(x.id,candidate.followUpCount):providerId=>markProspectCommunicationSent(x.id,providerId);
    const result=await (deps.send||sendBrandedOutreach)({...x,firstContact:true,outreachDraft:permissionMessage(x,follow)},{key,finalize});
    if(!result.duplicate){report.sent++;if(follow)report.followSent++;else report.firstSent++;}
    await (deps.pause||(()=>new Promise(resolve=>setTimeout(resolve,700))))();
   }catch(e){report.errors.push({id:x.id,error:String(e?.message||e).slice(0,140)})}
  }
  report.finishedAt=new Date().toISOString();
  await pool.query('INSERT INTO outreach_cycle_reports(report) VALUES($1)',[JSON.stringify(report)]);
  if(!deps.noEvents)await addSharedAgentEvent({agent:'Communication Agent',eventType:'outreach-cycle',title:`Otomatik iletişim: ${report.sent} gönderim`,detail:`İlk temas ${report.firstSent}, takip ${report.followSent}; doğrulama hatası ${report.errors.length}.`,payload:report,status:report.errors.length?'needs-attention':'completed'});
  return report;
 }catch(e){report.ok=false;report.errors.push({error:String(e?.message||e).slice(0,140)});await pool.query('INSERT INTO outreach_cycle_reports(report) VALUES($1)',[JSON.stringify(report)]).catch(()=>{});return report}
 finally{let destroy=false;if(transaction){try{await lock.query('ROLLBACK')}catch{destroy=true}}lock.release(destroy)}
}
