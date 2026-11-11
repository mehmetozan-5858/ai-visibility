import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {REAL_AUDIT_SQL,REAL_AUDIT_VIEW_SQL,normalizeRealAudit,readRealAudit} from '../lib/rd-real-audit.mjs';

test('real aggregate query is bounded and returns no event text or customer identifiers',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE agent_shared_board(status TEXT,created_at TIMESTAMPTZ,title TEXT,detail TEXT,payload JSONB);
   CREATE TABLE cost_ledger(amount NUMERIC,currency TEXT,estimated BOOLEAN,metadata JSONB,created_at TIMESTAMPTZ);
   INSERT INTO agent_shared_board SELECT CASE WHEN i%2=0 THEN 'completed' ELSE 'error' END,NOW()-i*INTERVAL '1 second','private-name','private-email', '{}'::jsonb FROM generate_series(1,205) i;
   INSERT INTO agent_shared_board VALUES('completed',NOW()+INTERVAL '1 day','future','','{}');
   INSERT INTO cost_ledger VALUES(1,'USD',TRUE,'{}',NOW()),(0,'USD',FALSE,'{"pricingSource":"unconfigured-zero"}',NOW()),(2,'EUR',FALSE,'{}',NOW());`);
  await db.exec(await readFile(new URL('../migrations/rd-audit-reader.sql',import.meta.url),'utf8'));
  const result=await readRealAudit({connect:async()=>({query:(...args)=>db.query(...args),release(){}})});
  assert.equal(result.events.count,200);assert.equal(result.events.limited,true);
  assert.equal(result.events.completed+result.events.attention,200);
  assert.equal(result.costs.count,3);assert.equal(result.costs.estimated,1);assert.equal(result.costs.unknown,1);
  assert.equal(result.costs.actualTotal,null);assert.equal(result.dedicatedReaderRole,true);
  assert.equal(result.connectionRoleIsDedicated,false);
  assert.doesNotMatch(JSON.stringify(result),/private-name|private-email|USD|EUR|payload/);
  assert.notEqual((await db.query('SELECT current_user AS role')).rows[0].role,'rd_audit_reader');
  await db.exec('BEGIN READ ONLY; SET LOCAL ROLE rd_audit_reader');
  await assert.rejects(db.query('SELECT detail FROM public.agent_shared_board'),e=>e.code==='42501');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN READ ONLY; SET LOCAL ROLE rd_audit_reader');
  await assert.rejects(db.query('SELECT * FROM public.cost_ledger'),e=>e.code==='42501');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN; SET LOCAL ROLE rd_audit_reader');
  await assert.rejects(db.query("INSERT INTO public.agent_shared_board(status) VALUES('forbidden')"),e=>e.code==='42501');
  await db.exec('ROLLBACK');
 }finally{await db.close()}
});
test('reader confirms read-only transaction before data query and sanitizes rollback errors',async()=>{
 const calls=[];let released;
 const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'off'}]};return {rows:[]}},release:x=>{released=x}};
 await assert.rejects(readRealAudit({connect:async()=>tx}),e=>e.message==='real-audit-unavailable');
 assert.equal(calls[0],'BEGIN READ ONLY');assert.ok(calls.includes('ROLLBACK'));
 assert.ok(!calls.includes(REAL_AUDIT_SQL));assert.ok(!calls.includes(REAL_AUDIT_VIEW_SQL));assert.equal(released,false);
});
test('invalid aggregate cannot claim success or escape a secret-bearing driver error',async()=>{
 const calls=[];let released;
 const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'on',role:'rd_audit_reader'}]};if(sql===REAL_AUDIT_VIEW_SQL)throw Error('private-driver-connection-string');if(sql==='ROLLBACK')throw Error('private-rollback');return {rows:[]}},release:x=>{released=x}};
 await assert.rejects(readRealAudit({connect:async()=>tx}),e=>e.message==='real-audit-unavailable');
 assert.equal(released,true);assert.ok(!calls.includes('COMMIT'));
 assert.throws(()=>normalizeRealAudit({eventCount:999}),/invalid-audit-aggregate/);
});
test('wrong effective role never falls back to owner-level raw-table queries',async()=>{
 const calls=[];
 const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'on',role:'database-owner'}]};return {rows:[]}},release(){}};
 await assert.rejects(readRealAudit({connect:async()=>tx}),/real-audit-unavailable/);
 assert.ok(calls.includes('SET LOCAL ROLE rd_audit_reader'));
 assert.ok(!calls.includes(REAL_AUDIT_SQL)&&!calls.includes(REAL_AUDIT_VIEW_SQL));
 assert.ok(calls.includes('ROLLBACK')&&!calls.includes('COMMIT'));
});
