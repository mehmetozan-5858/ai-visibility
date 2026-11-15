import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_PILOT_SQL,SIGNED_SETTLEMENT_SQL,createReviewReportEntitlementAuthority,createOneTimeReportGatewayReview}
 from '../lib/one-time-report-authority-review.mjs';
import {createClientToken} from '../lib/admin-auth.js';
import {readOneTimeDbReportReview} from '../lib/one-time-db-report-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('active pilot is bound to trusted tenant query and never requires legacy paid label',async()=>{
 const queries=[];
 const authority=createReviewReportEntitlementAuthority({query:async(sql,args)=>{
  queries.push({sql,args});
  return {rows:[{activeClient:true,activePilot:true}]};
 }});
 const proof=await authority(A);
 assert.equal(proof.tenantId,A);
 assert.equal(proof.active,true);
 assert.equal(proof.source,'verified-pilot');
 assert.ok(Number.isSafeInteger(proof.checkedAt));
 assert.deepEqual(queries,[{sql:ACTIVE_PILOT_SQL,args:[A]}]);
 assert.match(ACTIVE_PILOT_SQL,/revoked_at IS NULL/);
 assert.match(ACTIVE_PILOT_SQL,/expires_at>clock_timestamp/);
 assert.match(ACTIVE_PILOT_SQL,/c\.status='active'/);
});

test('revoked, expired, suspended and missing pilot fail closed without settlement flag',async()=>{
 for(const result of [
  {activeClient:false,activePilot:true},
  {activeClient:true,activePilot:false},
  {activeClient:true,activePilot:null},
  {}
 ]){
  let calls=0;
  const auth=createReviewReportEntitlementAuthority({query:async()=>{calls++;return {rows:[result]}}});
  assert.equal(await auth(A),null);
  assert.equal(calls,1);
 }
 const unavailable=createReviewReportEntitlementAuthority({query:async()=>{throw Error('private error')}});
 assert.equal(await unavailable(A),null);
 assert.equal(await unavailable('forged-tenant'),null);
});

test('Paddle settlement requires explicit review opt-in AND launch gate, not legacy paid label',async()=>{
 const prior=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 let calls=[];
 const pool={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql===ACTIVE_PILOT_SQL)return {rows:[{activeClient:true,activePilot:false}]};
  assert.equal(sql,SIGNED_SETTLEMENT_SQL);
  return {rows:[{signedSettlement:true}]};
 }};
 try{
  process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED='false';
  assert.equal(await createReviewReportEntitlementAuthority(pool,{allowSignedSettlement:true})(A),null);
  process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED='true';
  assert.equal(await createReviewReportEntitlementAuthority(pool,{allowSignedSettlement:false})(A),null);
  assert.equal(calls.length,2,'paid query never fired under either disabled gate');
  const evidence=await createReviewReportEntitlementAuthority(pool,{allowSignedSettlement:true})(A);
  assert.equal(evidence.source,'signed-paddle-settlement');
  assert.equal(calls.length,4);
  assert.deepEqual(calls[3],{sql:SIGNED_SETTLEMENT_SQL,args:[A]});
  assert.match(SIGNED_SETTLEMENT_SQL,/s\.payment_id/);
  assert.match(SIGNED_SETTLEMENT_SQL,/p\.method='paddle'/);
  assert.match(SIGNED_SETTLEMENT_SQL,/p\.status='paid'/);
  assert.match(SIGNED_SETTLEMENT_SQL,/c\.status='active'/);
 }finally{
  if(prior===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=prior;
 }
});

test('missing verified settlement or an unavailable ledger denies paid access',async()=>{
 const old=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED='true';
 try{
  for(const row of [{signedSettlement:false},{}]){
   const pool={query:async sql=>({rows:sql===ACTIVE_PILOT_SQL
    ?[{activeClient:true,activePilot:false}]:[row]})};
   assert.equal(await createReviewReportEntitlementAuthority(pool,{allowSignedSettlement:true})(B),null);
  }
  const pool={query:async sql=>{
   if(sql===ACTIVE_PILOT_SQL)return {rows:[{activeClient:true,activePilot:false}]};
   throw Error('missing migration');
  }};
  assert.equal(await createReviewReportEntitlementAuthority(pool,{allowSignedSettlement:true})(B),null);
 }finally{
  if(old===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=old;
 }
});

test('revoked pilot cannot open SQL reader even with valid signed HTTP token',async()=>{
 const prev=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-authority-test-http-key';
 let opened=0;
 try{
  const token=await createClientToken(A);
  const reportPool={connect:async()=>{opened++;throw Error('no report SQL on revoked access')}};
  const authority=createReviewReportEntitlementAuthority({query:async()=>({
   rows:[{activeClient:true,activePilot:false}]
  })});
  await assert.rejects(readOneTimeDbReportReview(reportPool,token,authority),
   /verified-customer-entitlement-required/);
  assert.equal(opened,0);
 }finally{
  if(prev===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=prev;
 }
});

test('trusted gateway factory never accepts caller-supplied tenant or proof callback',async()=>{
 const old=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-http-token-for-private-bound-gateway';
 let authorityCalls=0,reportAcquires=0;
 try{
  const token=await createClientToken(A);
  const reportPool={connect:async()=>{reportAcquires++;throw Error('report SQL must stay closed')}};
  const authorityPool={query:async(sql,args)=>{
   authorityCalls++;
   assert.equal(sql,ACTIVE_PILOT_SQL);
   assert.deepEqual(args,[A],'only verified cookie tenant may reach DB authority');
   return {rows:[{activeClient:true,activePilot:false}]};
  }};
  const gateway=createOneTimeReportGatewayReview({reportPool,authorityPool});
  await assert.rejects(gateway(token,B,async()=>({tenantId:B,active:true})),
   /verified-customer-entitlement-required/);
  assert.equal(authorityCalls,1);
  assert.equal(reportAcquires,0);
  await assert.rejects(gateway('invalid-cookie'),/verified-customer-session-required/);
  assert.equal(authorityCalls,1,'invalid signed session never queries authority');
  assert.equal(reportAcquires,0);
 }finally{
  if(old===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=old;
 }
});
