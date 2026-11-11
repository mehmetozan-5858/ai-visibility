import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {normalizePaymentEvidence,readPaymentEvidence,PAYMENT_EVIDENCE_VIEW_SQL} from '../lib/rd-payment-evidence.mjs';
const migration=await readFile(new URL('../migrations/rd-payment-evidence-reader.sql',import.meta.url),'utf8');
test('private payment view limits records, denies raw access and never verifies revenue',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE rd_audit_reader NOLOGIN;CREATE SCHEMA rd_audit;
  CREATE TABLE payments(id INT,status TEXT,method TEXT,created_at TIMESTAMPTZ,customer_email TEXT);
  INSERT INTO payments SELECT i,'paid','bank-transfer',NOW()-i*INTERVAL '1 second','private@example.test' FROM generate_series(1,205) i;
  INSERT INTO payments VALUES(999,'paid','bank-transfer',NOW()+INTERVAL '1 day','future');
  GRANT USAGE ON SCHEMA rd_audit TO rd_audit_reader;`);
  await db.exec(migration);
  const pool={connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
  const summary=await readPaymentEvidence(pool);
  assert.equal(summary.records.count,200);assert.equal(summary.records.bankPaidLabel,200);assert.equal(summary.limited,true);
  assert.deepEqual(summary.sourceTables,{settlements:false,providerEvents:false,providerEntities:false});
  assert.equal(summary.verifiedRevenue,null);assert.equal(summary.acceptance,'not-verified');
  assert.doesNotMatch(JSON.stringify(summary),/example|customer_email|999/);
  await db.exec('CREATE TABLE verified_customer_settlements(id INT);CREATE TABLE paddle_live_events(id INT);CREATE TABLE paddle_live_entities(id INT);');
  const present=await readPaymentEvidence(pool);assert.equal(present.sourceTables.settlements,true);
  assert.equal(present.acceptance,'not-verified');assert.equal(present.signatureDeliveryVerified,false);
  await db.exec('BEGIN READ ONLY;SET LOCAL ROLE rd_audit_reader');
  await assert.rejects(db.query('SELECT * FROM public.payments'),e=>e.code==='42501');await db.exec('ROLLBACK');
  await db.exec('BEGIN;SET LOCAL ROLE rd_audit_reader');
  await assert.rejects(db.query("UPDATE public.payments SET status='paid'"),e=>e.code==='42501');await db.exec('ROLLBACK');
 }finally{await db.close()}
});
test('invalid or missing counts remain unknown, never zero',()=>{
 assert.throws(()=>normalizePaymentEvidence(null));
 assert.throws(()=>normalizePaymentEvidence({recordCount:0}));
});
test('wrong role cannot query payment view; driver errors are sanitized',async()=>{
 for(const mode of [{mode:'on',role:'owner'},{mode:'off',role:'rd_audit_reader'}]){
  const calls=[];const tx={query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT current_setting'))return {rows:[mode]};return {rows:[]}},release(){}};
  await assert.rejects(readPaymentEvidence({connect:async()=>tx}),/^Error: payment-evidence-unavailable$/);
  assert.ok(!calls.includes(PAYMENT_EVIDENCE_VIEW_SQL));assert.ok(calls.includes('ROLLBACK'));
 }
 let discarded=false;const tx={query:async sql=>{if(sql.startsWith('SELECT current_setting'))return {rows:[{mode:'on',role:'rd_audit_reader'}]};if(sql===PAYMENT_EVIDENCE_VIEW_SQL||sql==='ROLLBACK')throw Error('secret-driver-data');return {rows:[]}},release:x=>{discarded=x}};
 await assert.rejects(readPaymentEvidence({connect:async()=>tx}),/^Error: payment-evidence-unavailable$/);assert.equal(discarded,true);
});
