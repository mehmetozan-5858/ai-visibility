import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCommandControl,commandControlStatus} from '../lib/agent-command-control.js';

const principal={authenticated:true,actorId:'reviewer',tenantId:'internal',
 projects:['ai-visibility','global-broker-ai','future-signal-studio'],actions:['acceptance.review']};
const task={id:'review-1',tenantId:'internal',project:'ai-visibility',action:'acceptance.review'};
test('three projects can run offline reviews without authorizing a release',()=>{
 const q=createCommandControl();
 for(const project of principal.projects){
  q.enqueue({...task,id:project,project},principal);
  const r=q.review(project,[{id:'mobile',status:'pending'}],principal);
  assert.equal(r.state,'reviewed');assert.equal(r.result.releaseAuthorized,false);
  assert.deepEqual(r.result.openGateIds,['mobile']);
 }
 assert.equal(q.snapshot(principal).tasks.length,3);
});
test('rejects absent identity, wrong tenant, project and action scopes',()=>{
 for(const p of [null,{...principal,authenticated:false},{...principal,tenantId:'other'},
  {...principal,projects:[]},{...principal,actions:[]}]) {
  const q=createCommandControl();assert.throws(()=>q.enqueue(task,p),/forbidden/);
  assert.equal(q.snapshot(principal).audit.length,0);
 }
});
test('rejects external execution, secret payloads, replay and repeated review',()=>{
 const q=createCommandControl();
 for(const input of [{...task,action:'model.execute'},{...task,token:'secret'},
  {...task,project:'unknown'},{...task,cost:0}]) assert.throws(()=>q.enqueue(input,principal),/invalid-task/);
 q.enqueue(task,principal);
 assert.throws(()=>q.enqueue(task,principal),/duplicate-task/);
 q.review(task.id,[{id:'gate',status:'verified'}],principal);
 assert.throws(()=>q.review(task.id,[{id:'gate',status:'verified'}],principal),/invalid-transition/);
 assert.equal(q.snapshot(principal).tasks[0].result.independentlyVerified,false);
});
test('invalid gate data cannot consume a queued task or add audit entries',()=>{
 const q=createCommandControl();q.enqueue(task,principal);
 for(const gates of [[],null,[{id:'gate',status:'success'}],
  [{id:'gate',status:'verified',token:'secret'}],
  [{id:'gate',status:'verified'},{id:'gate',status:'pending'}]]) {
  assert.throws(()=>q.review(task.id,gates,principal),/invalid-gates/);
 }
 assert.equal(q.snapshot(principal).tasks[0].state,'queued');
 assert.equal(q.snapshot(principal).audit.length,1);
});
test('audit hashes and snapshots are immutable to callers; cross-tenant reads are empty',()=>{
 const q=createCommandControl({clock:()=> '2026-11-08T20:00:00Z'});
 q.enqueue(task,principal);q.review(task.id,[{id:'gate',status:'blocked'}],principal);
 const snap=q.snapshot(principal);
 for(const [i,event] of snap.audit.entries()){
  const {hash,...body}=event;
  assert.equal(hash,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  assert.equal(event.previousHash,i?snap.audit[i-1].hash:null);
 }
 snap.tasks[0].state='released';snap.audit.length=0;
 assert.equal(q.snapshot(principal).tasks[0].state,'reviewed');
 assert.equal(q.snapshot({...principal,tenantId:'other'}).audit.length,0);
 assert.equal(q.snapshot({...principal,projects:[]}).tasks.length,0);
});
test('revoked permissions prevent a queued task from being reviewed',()=>{
 const q=createCommandControl();q.enqueue(task,principal);
 assert.throws(()=>q.review(task.id,[{id:'g',status:'verified'}],{...principal,actions:[]}),/forbidden/);
 assert.equal(q.snapshot(principal).tasks[0].state,'queued');
});
test('status honestly reports missing inference and durable persistence',()=>{
 const s=commandControlStatus();assert.equal(s.providerExecution,false);
 assert.equal(s.storage,'process-memory');assert.equal(s.releaseReady,false);
 s.projects.length=0;assert.equal(commandControlStatus().projects.length,3);
});
