import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {claimMerchantEventOnceReview} from '../lib/portal-merchant-event-claim-review.mjs';

// NEVER runs against Neon. Local disposable PostgreSQL accepts only fixture
// username+database and loopback hostname.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
test('durable payment event claim rejects replay, while rollback frees claim for safe retry',{
 skip:!source?'requires disposable local PostgreSQL':false,timeout:20000
},async()=>{
 const dbname='ci_merchant_replay_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:10000});
 const u=new URL(source);u.pathname='/'+dbname;
 let db,created=false;
 const eventId='evt_'+randomUUID(),paymentId=randomUUID(),tenantId=randomUUID();
 const args={provider:'review',eventId,paymentId,tenantId};
 try{
  await admin.query('CREATE DATABASE '+dbname);created=true;
  db=new Pool({connectionString:u.toString(),max:3,connectionTimeoutMillis:3000,query_timeout:10000});
  const migration=await readFile(new URL('../migrations/portal-merchant-event-idempotency-review.sql',import.meta.url),'utf8');
  await db.query(migration);
  const a=await db.connect();
  try{
   await a.query('BEGIN');
   await claimMerchantEventOnceReview(a,args);
   await a.query('ROLLBACK');
  }finally{a.release()}
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.portal_merchant_event_claims_review')).rows[0].count,0,
   'a failed payment transaction may not consume an event forever');
  const b=await db.connect();
  try{
   await b.query('BEGIN');
   await claimMerchantEventOnceReview(b,args);
   await b.query('COMMIT');
  }finally{b.release()}
  const replay=await db.connect();
  try{
   await replay.query('BEGIN');
   await assert.rejects(claimMerchantEventOnceReview(replay,args),/merchant-event-already-claimed/);
   await replay.query('ROLLBACK');
  }finally{replay.release()}
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.portal_merchant_event_claims_review')).rows[0].count,1);
  // Different provider events are different, but not proof of a new charge.
  const distinct=await db.connect();
  try{
   await distinct.query('BEGIN');
   await claimMerchantEventOnceReview(distinct,{...args,eventId:'evt_'+randomUUID()});
   await distinct.query('COMMIT');
  }finally{distinct.release()}
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.portal_merchant_event_claims_review')).rows[0].count,2);
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbname).catch(()=>{});
  await admin.end();
 }
});
test('invalid provider, event and tenant claim never touches SQL',async()=>{
 let calls=0;
 const tx={query:async()=>{calls++;return {rows:[]}}};
 const valid={provider:'review',eventId:'evt_12345678',paymentId:randomUUID(),tenantId:randomUUID()};
 for(const invalid of [{...valid,provider:'BAD'}, {...valid,eventId:'short'},
  {...valid,tenantId:'not-uuid'},{...valid,paymentId:''}]){
  await assert.rejects(claimMerchantEventOnceReview(tx,invalid),/merchant-event-claim-invalid/);
 }
 assert.equal(calls,0);
});
