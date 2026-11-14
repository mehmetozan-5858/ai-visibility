import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createClientToken} from '../lib/admin-auth.js';
import {withVerifiedClientTenantRead} from '../lib/verified-tenant-transaction-review.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const sql='SELECT client_id,query FROM public.ai_provider_comparisons ORDER BY query';

test('signed client session binds tenant per read-only transaction and is cleaned on failure',async()=>{
 const original=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-unit-test-secret-not-for-production';
 const db=new PGlite();
 let released=0,acquired=0;
 const pool={connect:async()=>{acquired++;return {
  query:(...args)=>db.query(...args),release:()=>{released++}
 }}};
 try{
  await db.exec(`CREATE TABLE public.ai_provider_comparisons
   (client_id UUID NOT NULL,query TEXT NOT NULL);
   INSERT INTO public.ai_provider_comparisons VALUES
   ('${A}','Synthetic report A'),('${B}','Synthetic report B');
   CREATE ROLE synthetic_session_reader LOGIN;
   GRANT USAGE ON SCHEMA public TO synthetic_session_reader;
   GRANT SELECT ON public.ai_provider_comparisons TO synthetic_session_reader;
   ALTER TABLE public.ai_provider_comparisons ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.ai_provider_comparisons FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_bound_report ON public.ai_provider_comparisons
    FOR SELECT TO synthetic_session_reader
    USING (client_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
   SET ROLE synthetic_session_reader;`);
  const signedA=await createClientToken(A);
  const signedB=await createClientToken(B);
  assert.deepEqual((await withVerifiedClientTenantRead(pool,signedA,
   (tx,clientId)=>{assert.equal(clientId,A);return tx.query(sql)})).rows.map(x=>x.query),
   ['Synthetic report A']);
  assert.equal((await db.query(sql)).rows.length,0,'tenant context leaked after successful commit');
  assert.deepEqual((await withVerifiedClientTenantRead(pool,signedB,
   tx=>tx.query(sql))).rows.map(x=>x.query),['Synthetic report B']);
  assert.equal((await db.query(sql)).rows.length,0,'B context leaked after successful commit');
  const before=acquired;
  await assert.rejects(withVerifiedClientTenantRead(pool,signedA.slice(0,-2)+'xx',
   tx=>tx.query(sql)),/tenant-session-invalid/);
  assert.equal(acquired,before,'invalid signature must not open a database connection');
  await assert.rejects(withVerifiedClientTenantRead(pool,signedA,
   async tx=>{await tx.query(sql);throw Error('synthetic-read-failure')}),/synthetic-read-failure/);
  assert.equal((await db.query(sql)).rows.length,0,'tenant context leaked after rollback');
  await assert.rejects(withVerifiedClientTenantRead(pool,signedA,
   tx=>tx.query("UPDATE public.ai_provider_comparisons SET query='unauthorized'")),
   /read.only transaction|permission denied|cannot execute UPDATE/i);
  assert.equal((await db.query(sql)).rows.length,0);
  assert.equal(acquired,released,'each acquired connection must be released');
  await db.exec('RESET ROLE');
 }finally{
  if(original===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=original;
  await db.close();
 }
});

test('missing session and malformed session scope fail closed before SQL',async()=>{
 let calls=0;
 const pool={connect:async()=>{calls++;throw Error('should-not-connect')}};
 for(const session of [null,{clientId:'other'},{clientId:''},{clientId:123}]){
  await assert.rejects(withVerifiedClientTenantRead(pool,'fixture',async()=>{},async()=>session),/tenant-session-invalid/);
 }
 assert.equal(calls,0);
});
