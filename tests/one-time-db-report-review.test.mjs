import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createClientToken} from '../lib/admin-auth.js';
import {isOneTimeReportReader,signOneTimeReportClaim,readOneTimeDbReportReview} from '../lib/one-time-db-report-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const CLAIM='33333333-3333-4333-8333-333333333333';
const SECRET='synthetic-one-time-db-hmac-do-not-use-in-production';
const ROLE='portal_gateway_reader_trial_20261114';
const verified=tenantId=>async id=>({tenantId,active:true,source:'verified-pilot',checkedAt:Date.now()});
const safeRole={name:ROLE,login:true,superuser:false,bypassRls:false,
 createDb:false,createRole:false,replication:false,schemaUsage:true,schemaCreate:false,
 rawSelect:false,credentialSelect:false,paymentSelect:false,settlementSelect:false,
 privateSchemaUsage:false,legacyReplayExecute:false,oneTimeExecute:true,
 claimLedgerInsert:false,claimLedgerSelect:false};
const withSyntheticEnv=async fn=>{
 const keys=['AUTH_SECRET','PORTAL_REPORT_CLAIM_SECRET','PORTAL_REPORT_READER_ROLE'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.AUTH_SECRET='synthetic-one-time-http-session-secret';
 process.env.PORTAL_REPORT_CLAIM_SECRET=SECRET;
 process.env.PORTAL_REPORT_READER_ROLE=ROLE;
 try{return await fn()}finally{
  for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}
 }
};

test('nonce-bound trial HMAC includes tenant, expiry, audience and claim ID',async()=>{
 const at=1794730000;
 const claim=await signOneTimeReportClaim(A,SECRET,at,CLAIM);
 assert.equal(claim.tenant,A);
 assert.equal(claim.claimId,CLAIM);
 assert.equal(claim.expires,at+90);
 assert.equal(claim.mac,createHmac('sha256',SECRET)
  .update(`portal-one-time-report-v1|${A}|${at+90}|${CLAIM}`).digest('hex'));
 const other=await signOneTimeReportClaim(B,SECRET,at,CLAIM);
 assert.notEqual(other.mac,claim.mac,'cross-tenant reuse invalidates signature');
 const fresh=await signOneTimeReportClaim(A,SECRET,at);
 assert.notEqual(fresh.claimId,CLAIM,'nonce must be generated per call');
 assert.notEqual(fresh.mac,claim.mac);
 await assert.rejects(signOneTimeReportClaim('not-uuid',SECRET,at,CLAIM),/one-time-claim-unavailable/);
 await assert.rejects(signOneTimeReportClaim(A,'short',at,CLAIM),/one-time-claim-unavailable/);
});

test('SQL role denies old replayable RPC, raw report SELECT and private token ledger',()=>{
 assert.equal(isOneTimeReportReader(safeRole,ROLE),true);
 for(const change of [
  {legacyReplayExecute:true},{rawSelect:true},{privateSchemaUsage:true},
  {claimLedgerInsert:true},{claimLedgerSelect:true},{credentialSelect:true},
  {paymentSelect:true},{settlementSelect:true},{oneTimeExecute:false},
  {bypassRls:true},{name:'neondb_owner'},{login:false}
 ])assert.equal(isOneTimeReportReader({...safeRole,...change},ROLE),false,
  'unsafe identity must fail: '+JSON.stringify(change));
});

test('verified customer A and B produce separate claims on one SQL connection each',async()=>{
 await withSyntheticEnv(async()=>{
  const calls=[];let acquired=0,released=0;
  const reader={connect:async()=>{acquired++;return {
   query:async(sql,args)=>{
    calls.push({sql,args});
    if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'||sql==='COMMIT'||
       sql==="SET LOCAL lock_timeout = '2500ms'"||
       sql==="SET LOCAL statement_timeout = '10000ms'")return {rows:[]};
    if(sql.includes('current_user AS "name"'))return {rows:[safeRole]};
    assert.match(sql,/portal_trial_one_time_report\(\$1::uuid,\$2::bigint,\$3::uuid,\$4::text\)/);
    const [tenant,expires,claimId,mac]=args;
    assert.equal(mac,createHmac('sha256',SECRET)
     .update(`portal-one-time-report-v1|${tenant}|${expires}|${claimId}`).digest('hex'));
    return {rows:[{clientId:tenant,query:tenant===A?'Synthetic A':'Synthetic B',
     results:[{provider:'gemini',status:'answer-received-unverified',answer:'synthetic'}]},
     {clientId:tenant===A?B:A,query:'Foreign synthetic result',
      results:[{provider:'gemini',status:'answer-received-unverified',answer:'synthetic'}]}]};
   },release:()=>{released++}
  }}};
  const a=await createClientToken(A),b=await createClientToken(B);
  assert.deepEqual((await readOneTimeDbReportReview(reader,a,verified(A))).map(x=>x.query),['Synthetic A']);
  assert.deepEqual((await readOneTimeDbReportReview(reader,b,verified(B))).map(x=>x.query),['Synthetic B']);
  assert.equal(acquired,2);assert.equal(released,2);
  assert.equal(calls.filter(x=>x.sql==='BEGIN ISOLATION LEVEL READ COMMITTED').length,2);
  assert.equal(calls.filter(x=>x.sql==="SET LOCAL lock_timeout = '2500ms'").length,2);
  assert.equal(calls.filter(x=>x.sql==="SET LOCAL statement_timeout = '10000ms'").length,2);
  assert.equal(calls.filter(x=>x.sql==='COMMIT').length,2);
  assert.equal(calls.filter(x=>x.sql.startsWith('SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_one_time_report(')).length,2,'count real RPC SELECTs, not privilege-probe SQL');
 });
});

test('invalid session, missing entitlement, missing distinct secret never open SQL',async()=>{
 await withSyntheticEnv(async()=>{
  let acquisitions=0;
  const reader={connect:async()=>{acquisitions++;throw Error('must-not-connect')}};
  const valid=await createClientToken(A);
  await assert.rejects(readOneTimeDbReportReview(reader,'invalid',verified(A)),
   /verified-customer-session-required/);
  await assert.rejects(readOneTimeDbReportReview(reader,valid.slice(0,-2)+'xx',verified(A)),
   /verified-customer-session-required/);
  await assert.rejects(readOneTimeDbReportReview(reader,valid,false),
   /verified-customer-entitlement-required/);
  process.env.PORTAL_REPORT_CLAIM_SECRET=process.env.AUTH_SECRET;
  await assert.rejects(readOneTimeDbReportReview(reader,valid,verified(A)),
   /one-time-signing-not-configured/);
  assert.equal(acquisitions,0);
 });
});

test('revoked, expired, stale, cross-tenant or missing authority proof blocks before SQL',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  let dbCalls=0;
  const pool={connect:async()=>{dbCalls++;throw Error('SQL must not be reached')}};
  const deny=[
   async()=>null,
   async()=>({tenantId:A,active:false,source:'verified-pilot',checkedAt:Date.now()}),
   async()=>({tenantId:B,active:true,source:'verified-pilot',checkedAt:Date.now()}),
   async()=>({tenantId:A,active:true,source:'verified-pilot',checkedAt:Date.now()-10000}),
   async()=>({tenantId:A,active:true,source:'verified-pilot',checkedAt:Date.now()+10000}),
   async()=>({tenantId:A,active:true,source:'legacy-paid-label',checkedAt:Date.now()}),
   async()=>({tenantId:A,active:true,source:'signed-paddle-settlement',checkedAt:Date.now()}),
   async()=>{throw Error('private authority unavailable')}
  ];
  for(const verifier of deny)
   await assert.rejects(readOneTimeDbReportReview(pool,token,verifier),
    /verified-customer-entitlement-required/);
  assert.equal(dbCalls,0);
 });
});

test('unsafe SQL role rolls back without RPC and always releases connection',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  const calls=[];let released=0;
  const pool={connect:async()=>({query:async sql=>{
   calls.push(sql);
   if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'||sql==='ROLLBACK'||
      sql==="SET LOCAL lock_timeout = '2500ms'"||
      sql==="SET LOCAL statement_timeout = '10000ms'")return {rows:[]};
   if(sql.includes('current_user AS "name"'))return {rows:[{...safeRole,legacyReplayExecute:true}]};
   throw Error('unexpected-report-call');
  },release:()=>{released++}})};
  await assert.rejects(readOneTimeDbReportReview(pool,token,verified(A)),/one-time-reader-role-unverified/);
  assert.deepEqual(calls.slice(0,3),[
   'BEGIN ISOLATION LEVEL READ COMMITTED',
   "SET LOCAL lock_timeout = '2500ms'",
   "SET LOCAL statement_timeout = '10000ms'"
  ]);
  assert.equal(calls.length,5);assert.equal(calls[4],'ROLLBACK');assert.equal(released,1);
 });
});

test('lock timeout in the RPC rolls back and never returns verified report',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  let releases=0;
  const calls=[];
  const pool={connect:async()=>({
   query:async sql=>{
    calls.push(sql);
    if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'||
       sql==="SET LOCAL lock_timeout = '2500ms'"||
       sql==="SET LOCAL statement_timeout = '10000ms'"||
       sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('current_user AS "name"'))return {rows:[safeRole]};
    if(sql.startsWith('SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_one_time_report('))
     throw Object.assign(Error('synthetic lock timeout'),{code:'55P03'});
    throw Error('unexpected SQL');
   },
   release:()=>{releases++}
  })};
  await assert.rejects(readOneTimeDbReportReview(pool,token,verified(A)),
   /synthetic lock timeout/);
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.equal(calls.filter(x=>x==='COMMIT').length,0);
  assert.equal(releases,1);
 });
});

test('ambiguous zero-row RPC rejects, rolls back, and never certifies report access',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  const calls=[];let releases=0;
  const pool={connect:async()=>({
   query:async(sql)=>{
    calls.push(sql);
    if(sql.includes('current_user AS "name"'))return {rows:[safeRole]};
    if(sql.startsWith('SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_one_time_report('))
     return {rows:[]};
    return {rows:[]};
   },release:()=>{releases++}
  })};
  await assert.rejects(readOneTimeDbReportReview(pool,token,verified(A)),
   /one-time-report-authorization-unproven/);
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.equal(calls.includes('COMMIT'),false);
  assert.equal(releases,1);
 });
});
