import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientToken} from '../lib/admin-auth.js';
import {readTrustedCustomerReportReview} from '../lib/trusted-customer-report-gateway-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const withSyntheticSecret=async fn=>{
 const previous=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-test-only-gateway-hmac-not-production';
 const previousRole=process.env.PORTAL_REPORT_READER_ROLE;
 process.env.PORTAL_REPORT_READER_ROLE='portal_gateway_reader_synthetic';
 try{return await fn()}finally{
  if(previous===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=previous;
  if(previousRole===undefined)delete process.env.PORTAL_REPORT_READER_ROLE;
  else process.env.PORTAL_REPORT_READER_ROLE=previousRole;
 }
};
const resultFor=clientId=>({clientId,query:'synthetic query',results:[{
 provider:'gemini',status:'answer-received-unverified',
 answer:'Synthetic evidence, not a real provider response'
}]});

test('fixed server report query scopes to signed identity and filters unexpected foreign rows',async()=>{
 await withSyntheticSecret(async()=>{
  const token=await createClientToken(A);
  const calls=[];
  let acquired=0,released=0;
  const pool={connect:async()=>{acquired++;return {query:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.includes('current_user AS "name"'))return {rows:[{
    name:'portal_gateway_reader_synthetic',login:true,superuser:false,
    bypassRls:false,createDb:false,createRole:false,replication:false,
    schemaUsage:true,schemaCreate:false,comparisonSelect:true,
    comparisonInsert:false,comparisonUpdate:false,comparisonDelete:false,
    credentialSelect:false,paymentSelect:false,settlementSelect:false
   }]};
   return {rows:[resultFor(A),resultFor(B)]};
  },release:()=>{released++}}}};
  const result=await readTrustedCustomerReportReview(pool,token,true);
  assert.deepEqual(calls.map(x=>x.sql==='BEGIN READ ONLY'?'begin':x.sql.includes('current_user AS "name"')?'probe':x.sql==='COMMIT'?'commit':'report'),['begin','probe','report','commit']);
  assert.equal(acquired,1);assert.equal(released,1);
  assert.match(calls[2].sql,/WHERE client_id=\$1 ORDER BY created_at DESC LIMIT 20/);
  assert.ok(!/\bset_config\b|\bcurrent_setting\b|\bCREATE\b|\bUPDATE\b/i.test(calls[2].sql));
  assert.deepEqual(calls[2].args,[A]);
  assert.equal(result.length,1);
  assert.equal(result[0].clientId,A);
 });
});

test('invalid signature, invalid tenant and missing entitlement cause zero SQL',async()=>{
 await withSyntheticSecret(async()=>{
  let called=0;
  const pool={connect:async()=>{called++;throw Error('connect-must-not-run')}};
  const valid=await createClientToken(A);
  const malformedScope=await createClientToken('not-a-uuid');
  await assert.rejects(readTrustedCustomerReportReview(pool,'bad-token',true),/verified-customer-session-required/);
  await assert.rejects(readTrustedCustomerReportReview(pool,valid.slice(0,-2)+'xx',true),/verified-customer-session-required/);
  await assert.rejects(readTrustedCustomerReportReview(pool,malformedScope,true),/verified-customer-session-required/);
  await assert.rejects(readTrustedCustomerReportReview(pool,valid,false),/verified-customer-entitlement-required/);
  await assert.rejects(readTrustedCustomerReportReview(pool,valid,undefined),/verified-customer-entitlement-required/);
  assert.equal(called,0);
 });
});

test('a broken database reader cannot be interpreted as an empty verified report',async()=>{
 await withSyntheticSecret(async()=>{
  const valid=await createClientToken(A);
  await assert.rejects(readTrustedCustomerReportReview({connect:async()=>({query:async()=>({}),release:()=>{}})},valid,true),/trusted-report-reader-role-unverified/);
  await assert.rejects(readTrustedCustomerReportReview(null,valid,true),/report-reader-unavailable/);
 });
});

test('owner or overprivileged reader cannot run a customer report',async()=>{
 await withSyntheticSecret(async()=>{
  const token=await createClientToken(A);
  let calls=0;
  let released=0;
  const pool={connect:async()=>({query:async sql=>{
   calls++;
   if(sql==='BEGIN READ ONLY'||sql==='ROLLBACK')return {rows:[]};
   if(!sql.includes('current_user AS "name"'))throw Error('report-query-was-attempted');
   return {rows:[{
    name:'neondb_owner',login:true,superuser:false,bypassRls:true,
    createDb:true,createRole:true,replication:false,schemaUsage:true,
    schemaCreate:true,comparisonSelect:true,comparisonInsert:true,
    comparisonUpdate:true,comparisonDelete:true,credentialSelect:true,
    paymentSelect:true,settlementSelect:true
   }]};
  },release:()=>{released++}})};
  await assert.rejects(readTrustedCustomerReportReview(pool,token,true),
   /trusted-report-reader-role-unverified/);
  assert.equal(calls,3,'BEGIN, identity attestation and ROLLBACK only');
  assert.equal(released,1,'failed identity attestation releases connection');
 });
});
