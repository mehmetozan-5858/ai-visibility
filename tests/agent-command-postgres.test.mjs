import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresCommandControl} from '../lib/agent-command-postgres.js';
import {createAgentIdentityResolver} from '../lib/agent-command-identity.js';
import {createAgentCommandHandler} from '../lib/agent-command-http.js';

const principal={authenticated:true,actorId:'operator',tenantId:'internal',projects:['ai-visibility'],actions:['acceptance.review']};
const task={id:'pg-task',tenantId:'internal',project:'ai-visibility',action:'acceptance.review'};
async function fixture(fn){
 const db=new PGlite();let releases=0;
 const pool={async connect(){return {query:(sql,args)=>db.query(sql,args),release(){releases++;}};}};
 try{
  await db.exec(await readFile(new URL('../migrations/agent-command-ledger.sql',import.meta.url),'utf8'));
  await fn({db,pool,releases:()=>releases});
 }finally{await db.close();}
}
test('PostgreSQL engine persists and replays scoped tasks with exact event times',()=>fixture(async({pool})=>{
 let at='2026-11-08T20:00:00Z';
 const a=createPostgresCommandControl(pool,{clock:()=>at});await a.enqueue(task,principal);
 at='2026-11-08T21:00:00Z';await a.review(task.id,[{id:'payment',status:'pending'}],principal);
 const b=createPostgresCommandControl(pool);const snap=await b.snapshot(principal);
 assert.equal(snap.storage,'postgresql');assert.equal(snap.tasks[0].state,'reviewed');
 assert.deepEqual(snap.audit.map(e=>e.at),['2026-11-08T20:00:00Z','2026-11-08T21:00:00Z']);
 assert.equal(snap.tasks[0].result.releaseAuthorized,false);
 await assert.rejects(b.enqueue(task,principal),/duplicate-task/);
 assert.equal((await b.snapshot({...principal,tenantId:'other'})).ledgerEntries,0);
}));
test('PostgreSQL rejects unauthorized and invalid transitions without ledger changes',()=>fixture(async({pool,releases})=>{
 const q=createPostgresCommandControl(pool);await q.enqueue(task,principal);
 await assert.rejects(q.review(task.id,[],principal),/invalid-gates/);
 await assert.rejects(q.review(task.id,[{id:'gate',status:'verified'}],{...principal,actions:[]}),/unknown-or-forbidden-task/);
 const s=await q.snapshot(principal);assert.equal(s.ledgerEntries,1);assert.equal(s.tasks[0].state,'queued');
 assert.equal(releases(),4);
}));
test('PostgreSQL write rejection rolls back the task state and can recover',()=>fixture(async({db,pool})=>{
 const q=createPostgresCommandControl(pool);await q.enqueue(task,principal);
 await db.exec(`ALTER TABLE public.agent_command_ledger ADD CONSTRAINT reject_review CHECK (operation NOT LIKE '%"kind":"review"%')`);
 await assert.rejects(q.review(task.id,[{id:'gate',status:'verified'}],principal));
 assert.equal((await q.snapshot(principal)).tasks[0].state,'queued');
 await db.exec('ALTER TABLE public.agent_command_ledger DROP CONSTRAINT reject_review');
 await q.review(task.id,[{id:'gate',status:'verified'}],principal);
 assert.equal((await q.snapshot(principal)).ledgerEntries,2);
}));
test('PostgreSQL rejects corrupted stored operations',()=>fixture(async({db,pool})=>{
 const q=createPostgresCommandControl(pool);await q.enqueue(task,principal);
 await db.exec("UPDATE public.agent_command_ledger SET operation='{}' WHERE sequence=1");
 await assert.rejects(q.snapshot(principal),/ledger-integrity-failed/);
}));

test('signed HTTP commands persist in PostgreSQL across handler instances and honor revocation',()=>fixture(async({pool})=>{
 const agents={worker:{enabled:true,tenantId:'internal',projects:['ai-visibility'],actions:['acceptance.review']}};
 const resolver=createAgentIdentityResolver({keys:{test:'x'.repeat(32)},getAgent:id=>agents[id]});
 const token=resolver.issue({actorId:'worker',keyId:'test'});
 const handler=()=>createAgentCommandHandler({enabled:()=>true,resolvePrincipal:t=>resolver.resolve(t),
  getControl:()=>createPostgresCommandControl(pool)});
 const req=input=>new Request('https://example.org/api/command-control',{method:'POST',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await handler()(req({operation:'enqueue',task}))).status,200);
 assert.equal((await handler()(req({operation:'review',taskId:task.id,gates:[{id:'live',status:'pending'}]}))).status,200);
 const q=createPostgresCommandControl(pool);assert.equal((await q.snapshot(principal)).ledgerEntries,2);
 agents.worker.enabled=false;
 assert.equal((await handler()(req({operation:'enqueue',task:{...task,id:'revoked'}}))).status,401);
 assert.equal((await q.snapshot(principal)).ledgerEntries,2);
}));

test('SELECT-only group can read snapshots but cannot append, update or read unrelated tables',()=>fixture(async({db,pool})=>{
 const q=createPostgresCommandControl(pool);await q.enqueue(task,principal);
 await db.exec(await readFile(new URL('../migrations/agent-command-access.sql',import.meta.url),'utf8'));
 await db.exec('CREATE TABLE unrelated_private_record(id integer); SET ROLE agent_command_reader');
 try{
  const snapshot=await q.snapshot(principal);assert.equal(snapshot.tasks.length,1);
  await assert.rejects(q.enqueue({...task,id:'reader-write'},principal),/permission denied/);
  await assert.rejects(db.query("UPDATE public.agent_command_ledger SET operation='{}'"),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM unrelated_private_record'),/permission denied/);
 }finally{await db.exec('RESET ROLE');}
 assert.equal((await q.snapshot(principal)).ledgerEntries,1);
}));

test('append-only writer can enqueue/review but cannot mutate history, delete or read customer tables',()=>fixture(async({db,pool})=>{
 await db.exec(await readFile(new URL('../migrations/agent-command-access.sql',import.meta.url),'utf8'));
 await db.exec('CREATE TABLE unrelated_private_record(id integer); SET ROLE agent_command_writer');
 const q=createPostgresCommandControl(pool);
 try{
  await q.enqueue(task,principal);await q.review(task.id,[{id:'mobile',status:'pending'}],principal);
  assert.equal((await q.snapshot(principal)).ledgerEntries,2);
  await assert.rejects(db.query("UPDATE public.agent_command_ledger SET operation='{}'"),/permission denied/);
  await assert.rejects(db.query('DELETE FROM public.agent_command_ledger'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM unrelated_private_record'),/permission denied/);
 }finally{await db.exec('RESET ROLE');}
}));
