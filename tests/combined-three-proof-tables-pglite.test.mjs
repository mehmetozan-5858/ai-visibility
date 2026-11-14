import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';

const tenantA='11111111-1111-4111-8111-111111111111';
const tenantB='22222222-2222-4222-8222-222222222222';
const payment='33333333-3333-4333-8333-333333333333';
const domain='example.test';
const migrations=[
 'migrations/free-applicant-verified-proof-review.sql',
 'migrations/verified-customer-settlements-review.sql'
];
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('three reviewed proof tables coexist in isolated PostgreSQL and preserve distinct tenant-scoped grants',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE public.clients(id UUID PRIMARY KEY);
    CREATE TABLE public.payments(id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES public.clients(id),method TEXT NOT NULL,status TEXT NOT NULL);`);
  await db.query('INSERT INTO public.clients(id) VALUES($1),($2)',[tenantA,tenantB]);
  await db.query("INSERT INTO public.payments(id,client_id,method,status) VALUES($1,$2,'paddle','paid')",[payment,tenantA]);
  for(const migration of migrations)await db.exec(await read(migration));
  const tables=(await db.query(`SELECT to_regclass('public.free_applicant_verified_receipts') AS receipts,
   to_regclass('public.free_applicant_verified_observations') AS observations,
   to_regclass('public.verified_customer_settlements') AS settlements`)).rows[0];
  assert.ok(tables.receipts&&tables.observations&&tables.settlements);
  const receipt='synthetic-receipt-1',provider='Gemini',model='offline-fixture',response='synthetic-response-1',query='Neutral purchase options?';
  await db.query(`INSERT INTO public.free_applicant_verified_receipts
   (id,tenant_id,domain,provider,model,response_id,query_text,amount,currency,estimated,operation,verified_zero_price,response_complete,verified_model_identity)
   VALUES($1,$2,$3,$4,$5,$6,$7,0,'USD',false,'answer-evidence',true,true,true)`,
   [receipt,tenantA,domain,provider,model,response,query]);
  await assert.rejects(db.query(`INSERT INTO public.free_applicant_verified_observations
   (receipt_id,tenant_id,domain,provider,model,response_id,query_text,result_text,brand_mentioned,brand_prompted,truncated,mode,recorded_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetic reply',false,false,false,'api-no-search',NOW())`,
   [receipt,tenantB,domain,provider,model,response,query]),/foreign key|violates/i);
  await db.query(`INSERT INTO public.free_applicant_verified_observations
   (receipt_id,tenant_id,domain,provider,model,response_id,query_text,result_text,brand_mentioned,brand_prompted,truncated,mode,recorded_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetic reply',false,false,false,'api-no-search',NOW())`,
   [receipt,tenantA,domain,provider,model,response,query]);
  const pool={query:(...args)=>db.query(...args)};
  const own=await readVerifiedFreeApplicantAssessment(pool,{id:tenantA,domain});
  const other=await readVerifiedFreeApplicantAssessment(pool,{id:tenantB,domain});
  assert.equal(own.status,'insufficient');
  assert.equal(own.samples,1);
  assert.equal(own.score,null);
  assert.equal(other.status,'insufficient');
  assert.equal(other.score,null);
  assert.equal(other.samples,0);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.verified_customer_settlements')).rows[0].n,0);
  await assert.rejects(db.query(`INSERT INTO public.verified_customer_settlements
   (payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,'evt_synthetic1','txn_synthetic1')`,
   [payment,tenantB]),/foreign key|violates/i);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.verified_customer_settlements')).rows[0].n,0);
  // No settlement rows are auto-created from free assessment evidence or a legacy paid label.
  // A synthetic matching pair can test FK only: it is NOT signed Paddle verification.
  await db.query(`INSERT INTO public.verified_customer_settlements
   (payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,'evt_synthetic2','txn_synthetic2')`,
   [payment,tenantA]);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.verified_customer_settlements')).rows[0].n,1);
 }finally{await db.close()}
});

test('proof schema cannot silently accept nonzero applicant cost',async()=>{
 const migration=await read(migrations[0]);
 assert.match(migration,/amount NUMERIC NOT NULL CHECK \(amount = 0\)/);
 assert.match(migration,/brand_prompted BOOLEAN NOT NULL CHECK \(brand_prompted=FALSE\)/);
 assert.match(migration,/verified_zero_price BOOLEAN NOT NULL CHECK \(verified_zero_price = TRUE\)/);
});
