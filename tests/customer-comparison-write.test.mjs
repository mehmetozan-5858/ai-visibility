import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {writeCustomerComparison} from '../lib/customer-comparison-write.mjs';
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE TABLE ai_provider_comparisons(id UUID PRIMARY KEY,client_id UUID,query TEXT,results JSONB);
 CREATE TABLE zera_ai_task_attempts(client_id UUID,task_id TEXT,status TEXT,comparison_id UUID,failure_reason TEXT,PRIMARY KEY(client_id,task_id));
 INSERT INTO zera_ai_task_attempts VALUES('${own}','brand-ai-de','started',NULL,NULL),('${other}','brand-ai-tr','started',NULL,NULL)`);
 const releases=[];
 return {db,releases,pool:{connect:async()=>({query:(sql,args)=>db.query(sql,args),release:discard=>releases.push(discard)})}};
}
const input=(taskId='brand-ai-de')=>({clientId:own,comparison:{clientId:own,query:'fixture',results:[{provider:'gemini',answer:'fixture',verified:false}]},attemptTaskId:taskId});
test('answer and own attempt commit together; another tenant remains untouched',async()=>{
 const f=await fixture();try{
  const saved=await writeCustomerComparison(f.pool,input());
  const row=(await f.db.query('SELECT status,comparison_id FROM zera_ai_task_attempts WHERE client_id=$1',[own])).rows[0];
  assert.equal(row.status,'stored');assert.equal(row.comparison_id,saved.id);
  assert.equal((await f.db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,1);
  assert.equal((await f.db.query('SELECT status FROM zera_ai_task_attempts WHERE client_id=$1',[other])).rows[0].status,'started');
  assert.deepEqual(f.releases,[false]);
 }finally{await f.db.close()}
});
test('missing or foreign claim rolls the answer back; existing completed claim cannot be overwritten',async()=>{
 const f=await fixture();try{
  await assert.rejects(writeCustomerComparison(f.pool,input('brand-ai-tr')),/exclusively claimed/);
  assert.equal((await f.db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
  const saved=await writeCustomerComparison(f.pool,input());
  await assert.rejects(writeCustomerComparison(f.pool,input()),/exclusively claimed/);
  assert.equal((await f.db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,1);
  assert.equal((await f.db.query('SELECT comparison_id FROM zera_ai_task_attempts WHERE client_id=$1',[own])).rows[0].comparison_id,saved.id);
 }finally{await f.db.close()}
});
test('failed attempt status write leaves no orphan answer and preserves durable started claim',async()=>{
 const f=await fixture();try{
  await f.db.exec("ALTER TABLE zera_ai_task_attempts ADD CONSTRAINT simulated_write_failure CHECK(status<>'stored')");
  await assert.rejects(writeCustomerComparison(f.pool,input()));
  assert.equal((await f.db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
  assert.equal((await f.db.query('SELECT status FROM zera_ai_task_attempts WHERE client_id=$1',[own])).rows[0].status,'started');
 }finally{await f.db.close()}
});
test('failed rollback discards connection and preserves the original error',async()=>{
 const failure=Error('fixture insert failure');let released;
 const pool={connect:async()=>({query:async sql=>{if(sql==='BEGIN')return;if(sql==='ROLLBACK')throw Error('rollback failed');throw failure},release:value=>released=value})};
 await assert.rejects(writeCustomerComparison(pool,input()),error=>error===failure);
 assert.equal(released,true);
});
test('identity mismatch is rejected before acquiring a connection',async()=>{
 let connected=false;
 await assert.rejects(writeCustomerComparison({connect:()=>{connected=true}}, {...input(),clientId:other}),/identity mismatch/);
 assert.equal(connected,false);
});
