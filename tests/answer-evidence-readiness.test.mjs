import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {implementationReadiness,summarizeImplementationReadiness} from '../lib/answer-evidence-readiness-rules.js';
const now='2026-10-07T13:00:00Z',providers=['Gemini'];
const baseline={id:'before',entityType:'client',entityId:'client',entityName:'Acme Precision',domain:'acme.com',createdAt:'2026-10-01T10:00:00Z',result:{queries:['Suggest manufacturers in Berlin.'],observations:[{query:'Suggest manufacturers in Berlin.',provider:'Gemini',model:'fixture',mode:'api-no-search',brandPrompted:false,truncated:false,checkedAt:'2026-10-01T10:00:01Z'}],errors:[]}};
const row={id:'client',name:'Acme Precision',domain:'acme.com',status:'active',paid:true,workId:'work',title:'Metadata updated',workStatus:'completed',completionEvidence:'Administrator inspected the published changes.',evidenceRecordedAt:'2026-10-02T10:00:00Z',baseline};
test('ready work and precise 24-hour waits use actual stored timestamps',()=>{
 assert.equal(implementationReadiness(row,providers,now).state,'ready');
 const recent={...row,evidenceRecordedAt:'2026-10-06T13:00:01Z',lastAttemptAt:'2026-10-06T14:00:00Z'},wait=implementationReadiness(recent,providers,now);assert.equal(wait.state,'waiting');assert.deepEqual(wait.reasons,['delay','cooldown']);assert.equal(wait.nextEligibleAt,'2026-10-07T14:00:00.000Z');assert.equal(implementationReadiness(recent,providers,wait.nextEligibleAt).state,'ready');
});
test('shows independent payment, activity, access and domain blockers without authorizing a call',()=>{
 const r=implementationReadiness({...row,paid:false,status:'paused',domain:'demo.local',workStatus:'access-required',baseline:null},providers,now);assert.equal(r.state,'blocked');for(const reason of ['unpaid','inactive','domain','access','prepare-baseline'])assert.ok(r.reasons.includes(reason));assert.ok(implementationReadiness({...row,workStatus:'approval-required'},providers,now).reasons.includes('approval'));
});
test('missing or post-work baseline never suggests manufacturing a past measurement',()=>{
 for(const change of [{baseline:null},{baseline:{...baseline,createdAt:'2026-10-03T10:00:00Z'}},{baseline:{...baseline,result:{...baseline.result,observations:[{...baseline.result.observations[0],checkedAt:'2026-10-03T10:00:00Z'}]}}}]){const r=implementationReadiness({...row,...change},providers,now);assert.equal(r.state,'blocked');assert.ok(r.reasons.includes('baseline'));assert.ok(!r.reasons.includes('prepare-baseline'))}
 const changed=implementationReadiness({...row,name:'Renamed company'},providers,now);assert.ok(changed.reasons.includes('identity'));assert.ok(implementationReadiness(row,[],now).reasons.includes('provider'));
});
test('failed/incomplete baselines and unknown dates cannot be counted as ready',()=>{
 for(const obs of [{...baseline.result.observations[0],brandPrompted:true},{...baseline.result.observations[0],truncated:true},{...baseline.result.observations[0],checkedAt:'bad'}])assert.equal(implementationReadiness({...row,baseline:{...baseline,result:{...baseline.result,observations:[obs]}}},providers,now).state,'blocked');
 assert.ok(implementationReadiness({...row,evidenceRecordedAt:null},providers,now).reasons.includes('evidence'));assert.ok(implementationReadiness(row,providers,'unknown').reasons.includes('unknown'));
});
test('persisted followup is distinct from comparable success and bounded counts disclose their scope',()=>{
 assert.equal(implementationReadiness({...row,followupId:'saved',followupComplete:true},providers,now).state,'recorded');assert.equal(implementationReadiness({...row,followupId:'saved',followupComplete:false},providers,now).state,'review');
 const s=summarizeImplementationReadiness(Array.from({length:101},(_,i)=>({...row,workId:String(i)})),providers,now);assert.equal(s.reviewed,100);assert.equal(s.entries.length,20);assert.equal(s.limited,true);assert.equal(s.counts.ready,100);
});
const source=(await readFile(new URL('../lib/answer-evidence-readiness.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {listImplementationReadiness}=new Function('ensureWorkEvidence','summarizeImplementationReadiness',source+';return {listImplementationReadiness};')(async()=>{},summarizeImplementationReadiness);
test('read-only status includes unpaid and blocked work, excludes raw answer text and binds selected customer',async()=>{
 const pool={query:async(sql,p)=>{assert.match(sql,/LIMIT 101/);assert.match(sql,/test-flow-%/);assert.match(sql,/w.status<>'completed' OR a.created_at<w.evidence_recorded_at/);assert.ok(!sql.includes("'text',a.result"));assert.ok(!sql.includes("WHERE c.status='active'"));assert.deepEqual(p,['client']);return {rows:[{...row,baselineId:baseline.id,baselineName:baseline.entityName,baselineDomain:baseline.domain,baselineAt:baseline.createdAt,baselineResult:baseline.result}]}}};const r=await listImplementationReadiness(pool,providers,'client',now);assert.equal(r.counts.ready,1);assert.equal(r.entries[0].baselineRunId,'before');
});
