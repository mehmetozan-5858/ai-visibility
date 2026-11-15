import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {recordFreeEvidenceCostTx} from '../lib/answer-evidence-zero-cost-tx.mjs';
const receipt={costType:'ai-provider',provider:'OpenRouter',operation:'answer-evidence',marketKey:'business:ai',amount:0,currency:'USD',estimated:false,metadata:{pricingSource:'provider-reported-zero',model:'fixture/model:free',responseId:'provider-fixture-001'}};
test('real PostgreSQL rollback removes both cost receipt and answer evidence',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE cost_ledger (id UUID PRIMARY KEY,cost_type TEXT NOT NULL,provider TEXT NOT NULL,operation TEXT NOT NULL,market_key TEXT NOT NULL,prospect_id UUID,amount NUMERIC NOT NULL,currency TEXT NOT NULL,estimated BOOLEAN NOT NULL,metadata JSONB NOT NULL);
  CREATE TABLE answer_evidence_runs(id UUID PRIMARY KEY,result JSONB NOT NULL);`);
  await db.exec('BEGIN');
  const cost=await recordFreeEvidenceCostTx(db,receipt);
  assert.ok(cost.id);
  await db.query('INSERT INTO answer_evidence_runs(id,result) VALUES($1,$2::jsonb)',[crypto.randomUUID(),JSON.stringify({observations:[{costRecordId:cost.id,responseId:receipt.metadata.responseId}]})]);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM cost_ledger')).rows[0].count,0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM answer_evidence_runs')).rows[0].count,0);
  await db.exec('BEGIN');
  const committed=await recordFreeEvidenceCostTx(db,receipt);
  await db.query('INSERT INTO answer_evidence_runs(id,result) VALUES($1,$2::jsonb)',[crypto.randomUUID(),JSON.stringify({observations:[{costRecordId:committed.id,responseId:receipt.metadata.responseId}]})]);
  await db.exec('COMMIT');
  const row=(await db.query(`SELECT a.result->'observations'->0->>'costRecordId' AS linked,c.id::text AS receipt_id,c.amount::text AS amount,c.metadata->>'responseId' AS provider_response
    FROM answer_evidence_runs a JOIN cost_ledger c ON c.id::text=a.result->'observations'->0->>'costRecordId'`)).rows[0];
  assert.equal(row.linked,committed.id);assert.equal(row.amount,'0');assert.equal(row.provider_response,receipt.metadata.responseId);
  for(const bad of [{...receipt,amount:0.01},{...receipt,estimated:true},{...receipt,metadata:{...receipt.metadata,responseId:''}},{...receipt,metadata:{...receipt.metadata,model:'paid/model'}}]){
   await assert.rejects(()=>recordFreeEvidenceCostTx(db,bad),/invalid-free-evidence-cost/);
  }
 }finally{await db.close()}
});

test('failed final evidence INSERT cannot commit an orphaned zero-cost receipt',async()=>{
 const db=new PGlite();
 const fixed='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec(`CREATE TABLE cost_ledger (id UUID PRIMARY KEY,cost_type TEXT NOT NULL,provider TEXT NOT NULL,operation TEXT NOT NULL,market_key TEXT NOT NULL,prospect_id UUID,amount NUMERIC NOT NULL,currency TEXT NOT NULL,estimated BOOLEAN NOT NULL,metadata JSONB NOT NULL);
  CREATE TABLE answer_evidence_runs(id UUID PRIMARY KEY,result JSONB NOT NULL);`);
  // An existing measurement row forces the subsequent INSERT to fail.
  await db.query("INSERT INTO answer_evidence_runs(id,result) VALUES($1,'{}'::jsonb)",[fixed]);
  await db.exec('BEGIN');
  const cost=await recordFreeEvidenceCostTx(db,receipt);
  await assert.rejects(()=>db.query("INSERT INTO answer_evidence_runs(id,result) VALUES($1,'{}'::jsonb)",[fixed]),/duplicate key|unique constraint/i);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM cost_ledger')).rows[0].n,0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM answer_evidence_runs')).rows[0].n,1);
  assert.ok(cost.id);
 }finally{await db.close()}
});
