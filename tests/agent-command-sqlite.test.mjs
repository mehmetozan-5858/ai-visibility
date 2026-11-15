import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {openDurableCommandControl} from '../lib/agent-command-sqlite.js';

const principal={authenticated:true,actorId:'operator',tenantId:'internal',projects:['ai-visibility'],actions:['acceptance.review']};
const task={id:'durable-1',tenantId:'internal',project:'ai-visibility',action:'acceptance.review'};
async function temp(fn){const dir=await mkdtemp(join(tmpdir(),'agent-ledger-'));try{await fn(join(dir,'control.sqlite'));}finally{await rm(dir,{recursive:true,force:true});}}

test('restart retains tasks, distinct event times, results and duplicate protection',()=>temp(async path=>{
 let time='2026-11-08T20:00:00Z';
 let q=openDurableCommandControl(path,{clock:()=>time});q.enqueue(task,principal);q.close();
 time='2026-11-08T21:00:00Z';q=openDurableCommandControl(path,{clock:()=>time});
 assert.throws(()=>q.enqueue(task,principal),/duplicate-task/);
 q.review(task.id,[{id:'payment',status:'pending'}],principal);
 const before=q.snapshot(principal);q.close();
 q=openDurableCommandControl(path);const after=q.snapshot(principal);
 assert.deepEqual(after,before);assert.equal(after.durable,true);
 assert.deepEqual(after.audit.map(e=>e.at),['2026-11-08T20:00:00Z','2026-11-08T21:00:00Z']);
 assert.equal(after.tasks[0].result.releaseAuthorized,false);
 assert.throws(()=>q.review(task.id,[{id:'payment',status:'verified'}],principal),/invalid-transition/);
 q.close();assert.equal((await stat(path)).mode&0o777,0o600);
}));
test('authorization and invalid input failures leave persistent ledger unchanged',()=>temp(async path=>{
 const q=openDurableCommandControl(path);q.enqueue(task,principal);
 for(const p of [{...principal,tenantId:'other'},{...principal,actions:[]}])
  assert.throws(()=>q.review(task.id,[{id:'gate',status:'verified'}],p));
 assert.throws(()=>q.review(task.id,[],principal),/invalid-gates/);
 const snap=q.snapshot(principal);assert.equal(snap.ledgerEntries,1);assert.equal(snap.tasks[0].state,'queued');
 assert.equal(q.snapshot({...principal,tenantId:'other'}).tasks.length,0);
 assert.equal(q.snapshot({...principal,tenantId:'other'}).ledgerEntries,0);
 q.close();
 const invalidClock=openDurableCommandControl(path,{clock:()=> 'invalid'});
 assert.throws(()=>invalidClock.review(task.id,[{id:'gate',status:'verified'}],principal),/invalid-clock/);
 assert.equal(invalidClock.snapshot(principal).ledgerEntries,1);invalidClock.close();
}));
test('storage write failure rolls back task transition and permits recovery',()=>temp(async path=>{
 let q=openDurableCommandControl(path);q.enqueue(task,principal);
 const db=new DatabaseSync(path);
 db.exec("CREATE TRIGGER simulate_disk_failure BEFORE INSERT ON command_ledger BEGIN SELECT RAISE(ABORT, 'simulated-write-failure'); END;");
 assert.throws(()=>q.review(task.id,[{id:'gate',status:'verified'}],principal),/simulated-write-failure/);
 assert.equal(q.snapshot(principal).tasks[0].state,'queued');q.close();
 db.exec('DROP TRIGGER simulate_disk_failure');db.close();
 q=openDurableCommandControl(path);q.review(task.id,[{id:'gate',status:'verified'}],principal);
 assert.equal(q.snapshot(principal).ledgerEntries,2);q.close();
}));
test('corrupted ledger refuses startup instead of silently resetting history',()=>temp(async path=>{
 const q=openDurableCommandControl(path);q.enqueue(task,principal);q.close();
 const db=new DatabaseSync(path);db.exec("UPDATE command_ledger SET operation='{}' WHERE sequence=1");db.close();
 assert.throws(()=>openDurableCommandControl(path),/ledger-integrity-failed/);
}));
test('two processes cannot both commit the same task ID',()=>temp(async path=>{
 const q=openDurableCommandControl(path);q.close();
 const moduleUrl=new URL('../lib/agent-command-sqlite.js',import.meta.url).href;
 const code=`import {openDurableCommandControl} from ${JSON.stringify(moduleUrl)};
 const q=openDurableCommandControl(process.argv[1]);
 try {q.enqueue(${JSON.stringify(task)},${JSON.stringify(principal)});process.stdout.write('accepted');}
 catch(e){if(e.message==='duplicate-task')process.stdout.write('duplicate');else throw e;}finally{q.close();}`;
 const run=()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',code,path]);let out='',err='';
  child.stdout.on('data',x=>{out+=x;});child.stderr.on('data',x=>{err+=x;});child.on('error',reject);
  child.on('close',status=>status===0?resolve(out):reject(Error(err)));
 });
 assert.deepEqual((await Promise.all([run(),run()])).sort(),['accepted','duplicate']);
 const reopened=openDurableCommandControl(path);assert.equal(reopened.snapshot(principal).ledgerEntries,1);reopened.close();
}));
