import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientToken} from '../lib/admin-auth.js';
import {createEnvelopeGatewayReview} from '../lib/portal-envelope-gateway-review.mjs';

// REVIEW-ONLY: no external DB, customer account, payment or production call.
const TENANT='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';

test('stale, future, ambiguous, or misattributed entitlement cannot open report SQL',async()=>{
 const previous=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-preflight-session-secret-never-live';
 try{
  const session=await createClientToken(TENANT);
  const now=Date.now();
  const variants=[
   null,
   {active:false,source:'verified-pilot',tenantId:TENANT,checkedAt:now},
   {active:true,source:'historical-paid',tenantId:TENANT,checkedAt:now},
   {active:true,source:'signed-paddle-settlement',tenantId:TENANT,checkedAt:now},
   {active:true,source:'verified-pilot',tenantId:OTHER,checkedAt:now},
   {active:true,source:'verified-pilot',tenantId:TENANT,checkedAt:now-60_000},
   {active:true,source:'verified-pilot',tenantId:TENANT,checkedAt:now+60_000},
   {active:true,source:'verified-pilot',tenantId:TENANT,checkedAt:NaN},
   {active:true,source:'verified-pilot',tenantId:TENANT,checkedAt:'unknown'}
  ];
  for(const proof of variants){
   let connections=0;
   const pool={connect:async()=>{connections++;throw Error('SQL connection must not open')}};
   const gateway=createEnvelopeGatewayReview({
    reportPool:pool,
    entitlementAuthority:async()=>proof
   });
   await assert.rejects(gateway(session),/review-envelope-entitlement-denied/);
   assert.equal(connections,0,'denied preflight reached report SQL');
  }
 }finally{
  if(previous===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=previous;
 }
});
