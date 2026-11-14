import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createClientToken} from '../lib/admin-auth.js';
import {readTrustedCustomerReportReview} from '../lib/trusted-customer-report-gateway-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const fixture=[{provider:'gemini',status:'answer-received-unverified',answer:'Synthetic only'}];

test('review-only fixed SQL honors verified tenant A/B with real PostgreSQL query execution',async()=>{
 const original=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='isolated-synthetic-test-hmac-not-production';
 const oldRole=process.env.PORTAL_REPORT_READER_ROLE;
 process.env.PORTAL_REPORT_READER_ROLE='portal_gateway_reader_synthetic';
 const db=new PGlite();
 let acquired=0,released=0;
 const pool={connect:async()=>{acquired++;return {query:(sql,args)=>db.query(sql,args),release:()=>{released++}}}};
 try{
  await db.exec(`CREATE TABLE public.ai_provider_comparisons(
   id UUID PRIMARY KEY, client_id UUID NOT NULL, query TEXT NOT NULL,
   results JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
   CREATE TABLE public.client_credentials(id UUID PRIMARY KEY);
   CREATE TABLE public.payments(id UUID PRIMARY KEY);
   CREATE TABLE public.verified_customer_settlements(id UUID PRIMARY KEY);
   CREATE ROLE portal_gateway_reader_synthetic LOGIN;
   GRANT USAGE ON SCHEMA public TO portal_gateway_reader_synthetic;
   GRANT SELECT ON public.ai_provider_comparisons TO portal_gateway_reader_synthetic;`);
  // Test records are isolated in-memory and never copied from Neon customers.
  await db.query('INSERT INTO public.ai_provider_comparisons(id,client_id,query,results) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',[
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A,'Synthetic A',JSON.stringify(fixture),
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',B,'Synthetic B',JSON.stringify(fixture)
  ]);
  await db.exec('SET ROLE portal_gateway_reader_synthetic');
  const tokenA=await createClientToken(A);
  const tokenB=await createClientToken(B);
  assert.deepEqual((await readTrustedCustomerReportReview(pool,tokenA,true)).map(x=>x.query),['Synthetic A']);
  assert.deepEqual((await readTrustedCustomerReportReview(pool,tokenB,true)).map(x=>x.query),['Synthetic B']);
  assert.equal(acquired,2);assert.equal(released,2,'each SQL session returned to pool');
  const stolen=tokenA.slice(0,-3)+'zzz';
  await assert.rejects(readTrustedCustomerReportReview(pool,stolen,true),/verified-customer-session-required/);
  await assert.rejects(readTrustedCustomerReportReview(pool,tokenA,false),/verified-customer-entitlement-required/);
  // The gateway is a trust boundary at the server, not a DB credential
  // compromise defense; the reader SQL role still has unrestricted SELECT.
 }finally{
  if(original===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=original;
  if(oldRole===undefined)delete process.env.PORTAL_REPORT_READER_ROLE;
  else process.env.PORTAL_REPORT_READER_ROLE=oldRole;
  await db.close();
 }
});
