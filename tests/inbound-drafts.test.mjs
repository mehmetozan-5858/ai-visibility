import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=(await fs.readFile(new URL('../lib/inbound-mail.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
let rows=new Map(),pending=[],captured=[];
const pool={connect:async()=>pool,release(){},async query(sql,a=[]){
 if(sql.includes('pg_try_advisory_lock'))return {rows:[{acquired:true}]};
 if(sql.includes('to_regclass'))return {rows:[{present:true}]};
 if(sql.includes('SELECT * FROM incoming_mail'))return {rows:pending};
 if(sql.includes('SELECT id FROM prospects'))return {rows:[{id:'business'}]};
 if(sql.includes('SELECT id FROM creator_hunt_leads'))return {rows:[]};
 if(sql.includes('SET reply_draft=$2')){assert.match(sql,/status='analyzed' AND matched_id IS NOT NULL AND draft_version=\$3/);const row=rows.get(a[0]);if(!row||row.status!=='analyzed'||!row.matchedId||row.draftVersion!==a[2])return {rows:[]};row.replyDraft=a[1];row.draftVersion++;return {rows:[{...row}]};}
 if(sql.includes('SET status=$2,sender=$3'))captured.push(a);
 return {rows:[]};
}};
const api=new Function('databasePool','getDatabaseUrl','initializeSchema','mailbox','inboundText','trustedInbound','getCommunicationProspect','saveProspectReplyAnalysis','analyzeSalesReply','analyzeAndSaveCreatorReply','budgetFetch',source+';return {saveInboundDraft,processInbound}')( ()=>pool,()=> 'db',async()=>{}, x=>x,x=>x.text,x=>x.trusted,async()=>({id:'business'}),async()=>{},async x=>({draftReply:'Reply to '+x.replyText,summary:x.replyText}),async()=>({analysis:{draftReply:'creator reply'}}),async url=>({ok:true,json:async()=>({from:'owner@example.com',subject:'Question',text:url.includes('/two?')?'second':'first',trusted:!url.includes('/bad?')})}));
test('edits are isolated by event and reject stale versions or unverified messages',async()=>{
 rows=new Map([['one',{status:'analyzed',matchedId:'business',draftVersion:1,replyDraft:'first'}],['two',{status:'analyzed',matchedId:'business',draftVersion:1,replyDraft:'second'}],['bad',{status:'review-required',matchedId:'business',draftVersion:1}]]);
 assert.equal((await api.saveInboundDraft('one','edited',1)).draftVersion,2);
 assert.equal(await api.saveInboundDraft('one','stale overwrite',1),null);
 assert.equal(rows.get('two').replyDraft,'second');assert.equal(await api.saveInboundDraft('bad','unverified',1),null);
 await assert.rejects(api.saveInboundDraft('one',' ',2),/invalid-draft/);
 await assert.rejects(api.saveInboundDraft('one','x'.repeat(10001),2),/invalid-draft/);
});
test('processing stores a separate draft for each authenticated email and no draft for untrusted sender',async()=>{
 process.env.RESEND_RECEIVING_API_KEY='test';process.env.INBOUND_EMAIL_ADDRESS='inbox@example.com';process.env.RESEND_WEBHOOK_SECRET='test';
 captured=[];pending=[{event_id:'one',email_id:'one'},{event_id:'two',email_id:'two'}];
 const result=await api.processInbound();assert.equal(result.automaticReplySending,false);assert.equal(captured[0][8],'Reply to first');assert.equal(captured[1][8],'Reply to second');
 captured=[];pending=[{event_id:'bad',email_id:'bad'}];await api.processInbound();assert.equal(captured[0][1],'review-required');assert.equal(captured[0][8],'');
});
