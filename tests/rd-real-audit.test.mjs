import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {REAL_AUDIT_SQL,normalizeRealAudit,readRealAudit} from '../lib/rd-real-audit.mjs';

test('real aggregate query is bounded and returns no event text or customer identifiers',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE agent_shared_board(status TEXT,created_at TIMESTAMPTZ,title TEXT,detail TEXT,payload JSONB);
   CREATE TABLE cost_ledger(amount NUMERIC,currency TEXT,estimated BOOLEAN,metadata JSONB,created_at TIMESTAMPTZ);
   INSERT INTO agent_shared_board SELECT CASE WHEN i%2=0 THEN 'completed' ELSE 'error' END,NOW()-i*INTERVAL '1 second','private-name','private-email', '{}'::jsonb FROM generate_series(1,205) i;
   INSERT INTO agent_shared_board VALUES('completed',NOW()+INTERVAL '1 day','future','','{}');
   INSERT INTO cost_ledger VALUES(1,'USD',TRUE,'{}',NOW()),(0,'USD',FALSE,'{"pricingSource":"unconfigured-zero"}',NOW()),(2,'EUR',FALSE,'{}',NOW());`);
  const result=await readRealAudit({connect:async()=>({query:(...args)=>db.query(...args),release(){}})});
  assert.equal(result.events.count,200);assert.equal(result.events.limited,true);
  assert.equal(result.events.completed+result.events.attention,200);
  assert.equal(result.costs.count,3);assert.equal(result.costs.estimated,1);assert.equal(result.costs.unknown,1);
  assert.equal(result.costs.actualTotal,null);assert.equal(result.dedicatedReaderRole,false);
  assert.doesNotMatch(JSON.stringify(result),/private-name|private-email|USD|EUR|payload/);
 }finally{await db.close()}
});
test('reader confirms read-only transaction before data query and sanitizes rollback errors',async()=>{
 const calls=[];let released;
 const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'off'}]};return {rows:[]}},release:x=>{released=x}};
 await assert.rejects(readRealAudit({connect:async()=>tx}),e=>e.message==='real-audit-unavailable');
 assert.equal(calls[0],'BEGIN READ ONLY');assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.includes(REAL_AUDIT_SQL));assert.equal(released,false);
});
test('invalid aggregate cannot claim success or escape a secret-bearing driver error',async()=>{
 const calls=[];let released;
 const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'on'}]};if(sql===REAL_AUDIT_SQL)throw Error('private-driver-connection-string');if(sql==='ROLLBACK')throw Error('private-rollback');return {rows:[]}},release:x=>{released=x}};
 await assert.rejects(readRealAudit({connect:async()=>tx}),e=>e.message==='real-audit-unavailable');
 assert.equal(released,true);assert.ok(!calls.includes('COMMIT'));
 assert.throws(()=>normalizeRealAudit({eventCount:999}),/invalid-audit-aggregate/);
});
