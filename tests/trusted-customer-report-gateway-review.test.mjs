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
  const pool={query:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.includes('current_user AS "name"'))return {rows:[{
    name:'portal_gateway_reader_synthetic',login:true,superuser:false,
    bypassRls:false,createDb:false,createRole:false,replication:false,
    schemaUsage:true,schemaCreate:false,comparisonSelect:true,
    comparisonInsert:false,comparisonUpdate:false,comparisonDelete:false,
    credentialSelect:false,paymentSelect:false,settlementSelect:false
   }]};
   return {rows:[resultFor(A),resultFor(B)]};
  }};
  const result=await readTrustedCustomerReportReview(pool,token,true);
  assert.equal(calls.length,2,'exactly one metadata role probe and one fixed report query');
  assert.match(calls[1].sql,/WHERE client_id=\$1 ORDER BY created_at DESC LIMIT 20/);
  assert.ok(!/\bset_config\b|\bcurrent_setting\b|\bCREATE\b|\bUPDATE\b/i.test(calls[1].sql));
  assert.deepEqual(calls[1].args,[A]);
  assert.equal(result.length,1);
  assert.equal(result[0].clientId,A);
 });
});

test('invalid signature, invalid tenant and missing entitlement cause zero SQL',async()=>{
 await withSyntheticSecret(async()=>{
  let called=0;
  const pool={query:async()=>{called++;throw Error('query-must-not-run')}};
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
  await assert.rejects(readTrustedCustomerReportReview({query:async()=>({})},valid,true),/report-query-unavailable/);
  await assert.rejects(readTrustedCustomerReportReview(null,valid,true),/report-reader-unavailable/);
 });
});
