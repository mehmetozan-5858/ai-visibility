import test from 'node:test';
import assert from 'node:assert/strict';
import {replyFingerprint,validateInboxReviews,assertReviewMatches} from '../lib/inbox-review-rules.js';
import fs from 'node:fs/promises';
const body='Please send details about your analysis. We have questions about scope.';
const review={eventId:'mail-one',version:0,bodyHash:replyFingerprint(body),classification:'question',excerpt:'Please send details',summary:'The recipient requests the analysis details.',nextAction:'Prepare a factual scope explanation without committing to terms.',draft:'Thank you. We can explain the scope.'};
const row={body,status:'awaiting-review',matched_id:'prospect',matched_type:'business',review_reason:'',draft_version:0};
test('review binds to exact reply text, version and trusted CRM match',()=>{
 assertReviewMatches(row,validateInboxReviews({reviews:[review]})[0]);
 for(const patch of [{body:body+' changed'},{draft_version:1}])assert.throws(()=>assertReviewMatches({...row,...patch},review),/stale-message/);
 for(const patch of [{status:'review-required'},{matched_id:null},{review_reason:'ambiguous-sender'},{matched_type:'unknown'}])assert.throws(()=>assertReviewMatches({...row,...patch},review),/unverified-message/);
 assert.throws(()=>assertReviewMatches(row,{...review,excerpt:'Invented customer request'}),/excerpt-not-found/);
});
test('batch rejects duplicate IDs, invalid classification and oversize input; opt-out has no reply draft',()=>{
 assert.throws(()=>validateInboxReviews({reviews:[review,review]}),/invalid-reviews/);
 assert.throws(()=>validateInboxReviews({reviews:Array(11).fill(review)}),/invalid-reviews/);
 assert.throws(()=>validateInboxReviews({reviews:[{...review,classification:'won'}]}),/invalid-reviews/);
 assert.throws(()=>validateInboxReviews({reviews:[{...review,classification:'opt-out'}]}),/stop-contact-draft/);
 assert.equal(validateInboxReviews({reviews:[{...review,classification:'opt-out',draft:''}]})[0].draft,'');
});
const source=(await fs.readFile(new URL('../lib/inbound-mail.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function harness({patch={},crmPatch={},newer=false,failSave=false}={}){
 const calls=[],mail={...row,event_id:review.eventId,sender:'owner@example.com',received_at:'2026-10-08T08:00:00Z',...patch};
 const pool={connect:async()=>pool,release(){},async query(sql,args=[]){
  calls.push({sql,args});
  if(sql.includes('SELECT * FROM incoming_mail'))return {rows:[mail]};
  if(sql.includes('SELECT * FROM prospects'))return {rows:[{contact_email:mail.sender,contact_status:'verified',communication_status:'sent',crm_stage:'contacted',...crmPatch}]};
  if(sql.includes('SELECT event_id FROM incoming_mail'))return {rows:newer?[{event_id:'newer'}]:[]};
  if(failSave&&sql.includes("status='analyzed'"))throw Error('database failure');
  return {rows:[]};
 }};
 const api=new Function('databasePool','getDatabaseUrl','initializeSchema','mailbox','replyFingerprint','validateInboxReviews','assertReviewMatches',source+';return {importInboxReviews}')( ()=>pool,()=> 'db',async()=>{},x=>x.toLowerCase(),replyFingerprint,validateInboxReviews,assertReviewMatches);
 return {api,calls};
}
test('inbox handoff commits CRM and per-message assessment together; stale and failed saves roll back',async()=>{
 for(const options of [{},{patch:{draft_version:2}},{crmPatch:{contact_email:'changed@example.com'}},{failSave:true}]){
  const {api,calls}=harness(options),result=await api.importInboxReviews({reviews:[review]});
  const success=!Object.keys(options).length;
  assert.equal(result.results[0].status,success?'saved':'not-saved');
  assert.equal(result.paidAiCalls,0);assert.equal(result.sent,false);
  assert.equal(calls.some(x=>x.sql==='COMMIT'),success);
  assert.equal(calls.some(x=>x.sql==='ROLLBACK'),!success);
 }
});
test('old emails cannot replace newer CRM guidance; opt-outs stop contact and preserve won stage',async()=>{
 const old=harness({newer:true});assert.equal((await old.api.importInboxReviews({reviews:[review]})).results[0].crmUpdated,false);
 assert.equal(old.calls.some(x=>x.sql.startsWith('UPDATE prospects')),false);
 const stop=harness();await stop.api.importInboxReviews({reviews:[{...review,classification:'opt-out',draft:''}]});
 const update=stop.calls.find(x=>x.sql.startsWith('UPDATE prospects'));assert.equal(update.args[1],'lost');assert.equal(update.args[2],'lost');assert.match(update.sql,/crm_stage='won'/);assert.equal(update.args[5],'');
});
