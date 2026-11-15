import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {inspectLoginReadinessReview} from '../lib/client-login-db-readiness-review.mjs';

test('login SQL preflight does not create schema or read passwords, and checks minimum role',async()=>{
 const db=new PGlite();
 try{
  assert.deepEqual(await inspectLoginReadinessReview(db),
   {ready:false,reason:'credential-table-missing'});
  await db.exec(`CREATE TABLE public.client_credentials(
   client_id UUID PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT NOT NULL);
   CREATE ROLE synthetic_login_reader LOGIN;
   REVOKE ALL ON TABLE public.client_credentials FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO synthetic_login_reader;
   GRANT SELECT ON public.client_credentials TO synthetic_login_reader;`);
  await db.exec('SET ROLE synthetic_login_reader');
  const status=await inspectLoginReadinessReview(db);
  assert.deepEqual(status,{ready:true,reason:'credential-select-only-ready'});
  assert.equal(JSON.stringify(status).includes('password_hash'),false);
  await assert.rejects(db.query("INSERT INTO public.client_credentials(client_id,email,password_hash) VALUES('11111111-1111-4111-8111-111111111111','private@example.test','secret')"),/permission denied/i);
  await db.exec('RESET ROLE');
  await db.exec('REVOKE SELECT ON public.client_credentials FROM synthetic_login_reader');
  await db.exec('SET ROLE synthetic_login_reader');
  assert.deepEqual(await inspectLoginReadinessReview(db),
   {ready:false,reason:'credential-select-unavailable'});
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});
test('database failures and ambiguous role output fail closed without sensitive output',async()=>{
 const unavailable=await inspectLoginReadinessReview({query:async()=>{throw Error('password/sensitive')}}); 
 assert.deepEqual(unavailable,{ready:false,reason:'login-reader-inspection-unavailable'});
 assert.ok(!JSON.stringify(unavailable).includes('sensitive'));
 const ambiguous=await inspectLoginReadinessReview({query:async()=>({rows:[]})});
 assert.equal(ambiguous.ready,false);
});
