import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

// INDEPENDENT SYNTHETIC fixture only. These are NOT production migrations.
// All IDs and answers below are invented. This does not contact a provider.
const SCHEMA = `
 CREATE TABLE fixture_receipts (
   id text PRIMARY KEY, tenant_id text NOT NULL, provider text NOT NULL,
   response_id text NOT NULL, amount numeric NOT NULL CHECK (amount=0),
   currency text NOT NULL CHECK (currency='USD'), estimated boolean NOT NULL CHECK (NOT estimated),
   UNIQUE (tenant_id, provider, response_id)
 );
 CREATE TABLE fixture_observations (
   id text PRIMARY KEY, tenant_id text NOT NULL, provider text NOT NULL,
   response_id text NOT NULL, receipt_id text NOT NULL UNIQUE REFERENCES fixture_receipts(id),
   query text NOT NULL, result_text text NOT NULL,
   UNIQUE (tenant_id, provider, response_id)
 );`;
const base={receiptId:'receipt-a',observationId:'observation-a',tenant:'tenant-a',
 provider:'Gemini',responseId:'synthetic-response-a',query:'Which clothing stores are nearby?',
 text:'Synthetic output only.',amount:0};
async function recordPair(db, input, {simulateFailure=false}={}) {
 await db.query('BEGIN');
 try {
  await db.query(`INSERT INTO fixture_receipts(id,tenant_id,provider,response_id,amount,currency,estimated)
    VALUES ($1,$2,$3,$4,$5,'USD',false)`,
   [input.receiptId,input.tenant,input.provider,input.responseId,input.amount]);
  if(simulateFailure)throw Error('fixture-observation-insert-failed');
  await db.query(`INSERT INTO fixture_observations(id,tenant_id,provider,response_id,receipt_id,query,result_text)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
   [input.observationId,input.tenant,input.provider,input.responseId,input.receiptId,input.query,input.text]);
  await db.query('COMMIT');
 } catch (error) {
  await db.query('ROLLBACK');
  throw error;
 }
}
test('synthetic receipt and observation commit together, with foreign key linkage',async()=>{
 const db=new PGlite();
 try {
  await db.exec(SCHEMA);
  await recordPair(db,base);
  const receipts=await db.query('SELECT id,tenant_id,response_id FROM fixture_receipts');
  const observations=await db.query('SELECT receipt_id,tenant_id,response_id FROM fixture_observations');
  assert.equal(receipts.rows.length,1);
  assert.equal(observations.rows.length,1);
  assert.equal(observations.rows[0].receipt_id,receipts.rows[0].id);
  assert.equal(observations.rows[0].response_id,receipts.rows[0].response_id);
 } finally {await db.close();}
});
test('observation failure rolls back the zero-cost receipt',async()=>{
 const db=new PGlite();
 try{
  await db.exec(SCHEMA);
  await assert.rejects(recordPair(db,base,{simulateFailure:true}),/fixture-observation-insert-failed/);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM fixture_receipts')).rows[0].n,0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM fixture_observations')).rows[0].n,0);
 }finally{await db.close();}
});
test('duplicate or paid response cannot create a second eligible pair',async()=>{
 const db=new PGlite();
 try{
  await db.exec(SCHEMA);
  await recordPair(db,base);
  await assert.rejects(recordPair(db,{...base,receiptId:'receipt-b',observationId:'observation-b'}));
  await assert.rejects(recordPair(db,{...base,receiptId:'receipt-c',observationId:'observation-c',responseId:'response-c',amount:0.01}));
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM fixture_receipts')).rows[0].n,1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM fixture_observations')).rows[0].n,1);
 }finally{await db.close();}
});
test('cross-tenant access must join by tenant as well as receipt identity',async()=>{
 const db=new PGlite();
 try{
  await db.exec(SCHEMA);
  await recordPair(db,base);
  const rows=await db.query(`SELECT o.id FROM fixture_observations o
   JOIN fixture_receipts r ON r.id=o.receipt_id AND r.tenant_id=o.tenant_id
   AND r.provider=o.provider AND r.response_id=o.response_id
   WHERE o.tenant_id=$1 AND r.tenant_id=$1`,['different-tenant']);
  assert.equal(rows.rows.length,0);
 }finally{await db.close();}
});
