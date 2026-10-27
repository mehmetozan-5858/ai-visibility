import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {prepareCustomerComparisonStorage,storeCustomerComparisonWithPool,storeClaimedCustomerComparison} from '../lib/customer-comparison-storage.mjs';
import {readCustomerComparisons} from '../lib/customer-comparison-reader.mjs';
const customer='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',missing='33333333-3333-4333-8333-333333333333';
let db,dir,pool;
const comparison=(clientId=customer)=>({clientId,query:'Fixture customer visibility query',results:[{provider:'gemini',status:'answer-received-unverified',verified:false,answer:'Synthetic answer; no source verification.'}]});
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'comparison-writes-'));db=new PGlite(dir);
 pool={query:(sql,p)=>db.query(sql,p),connect:async()=>({query:(sql,p)=>db.query(sql,p),release(){}})};
 await db.exec('CREATE TABLE clients(id UUID PRIMARY KEY);CREATE TABLE zera_ai_task_attempts(client_id UUID,task_id TEXT,status TEXT,comparison_id UUID,PRIMARY KEY(client_id,task_id));');
 await db.query('INSERT INTO clients VALUES($1),($2)',[customer,other]);
});
after(async()=>{await db.close();await rm(dir,{recursive:true,force:true})});

test('preflight rejects a missing customer before provisioning comparison storage',async()=>{
 await assert.rejects(prepareCustomerComparisonStorage({pool,clientId:missing}),e=>e.code==='23503');
 assert.equal((await db.query("SELECT to_regclass('public.ai_provider_comparisons') AS name")).rows[0].name,null);
 assert.equal((await prepareCustomerComparisonStorage({pool,clientId:customer})).ready,true);
});
test('actual legacy column mismatch fails the storage readiness check',async()=>{
 await db.exec('ALTER TABLE ai_provider_comparisons RENAME COLUMN results TO legacy_results');
 try{await assert.rejects(prepareCustomerComparisonStorage({pool,clientId:customer}),e=>e.code==='42703')}
 finally{await db.exec('ALTER TABLE ai_provider_comparisons RENAME COLUMN legacy_results TO results')}
});
test('comparison identity mismatch and unowned claims cannot create records',async()=>{
 await assert.rejects(storeCustomerComparisonWithPool({pool,clientId:customer,comparison:comparison(other)}),/identity mismatch/);
 await db.query("INSERT INTO zera_ai_task_attempts VALUES($1,'owned','started',NULL)",[customer]);
 await assert.rejects(storeClaimedCustomerComparison({pool,clientId:other,taskId:'owned',comparison:comparison(other)}),/Owned started/);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
});
test('task update failure rolls back the answer insert instead of leaving an orphan',async()=>{
 await db.query("INSERT INTO zera_ai_task_attempts VALUES($1,'rollback','started',NULL)",[customer]);
 const failingPool={connect:async()=>({query:async(sql,args)=>{
  if(sql.startsWith('UPDATE zera_ai_task_attempts')){const error=Error('fixture timeout');error.code='57014';throw error}
  return db.query(sql,args);
 },release(){}})};
 await assert.rejects(storeClaimedCustomerComparison({pool:failingPool,clientId:customer,taskId:'rollback',comparison:comparison()}),e=>e.code==='57014');
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
 assert.equal((await db.query("SELECT status FROM zera_ai_task_attempts WHERE task_id='rollback'")).rows[0].status,'started');
});
test('PostgreSQL-rejected answer payload never marks the task stored',async()=>{
 const data=comparison();data.results[0].answer='invalid\u0000payload';
 await db.query("INSERT INTO zera_ai_task_attempts VALUES($1,'invalid','started',NULL)",[customer]);
 await assert.rejects(storeClaimedCustomerComparison({pool,clientId:customer,taskId:'invalid',comparison:data}));
 assert.equal((await db.query("SELECT status FROM zera_ai_task_attempts WHERE task_id='invalid'")).rows[0].status,'started');
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
});
test('answer and claim persist together; replay after restart returns the same ID and reader stays scoped',async()=>{
 await db.query("INSERT INTO zera_ai_task_attempts VALUES($1,'success','started',NULL)",[customer]);
 const saved=await storeClaimedCustomerComparison({pool,clientId:customer,taskId:'success',comparison:comparison()});
 assert.equal(saved.visibilityScore,null);
 const row=(await db.query("SELECT status,comparison_id FROM zera_ai_task_attempts WHERE task_id='success'")).rows[0];
 assert.equal(row.status,'stored');assert.equal(row.comparison_id,saved.id);
 assert.equal((await readCustomerComparisons({pool,clientId:customer})).comparisons.length,1);
 assert.equal((await readCustomerComparisons({pool,clientId:other})).comparisons.length,0);
 await db.close();db=new PGlite(dir);
 const replay=await storeClaimedCustomerComparison({pool,clientId:customer,taskId:'success',comparison:comparison()});
 assert.equal(replay.id,saved.id);assert.equal(replay.duplicate,true);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,1);
});
