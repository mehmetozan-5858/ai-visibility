import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createClientToken} from '../lib/admin-auth.js';
import {createEnvelopeGatewayReview,isEnvelopeReaderRoleReview}
 from '../lib/portal-envelope-gateway-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ROLE='portal_gateway_reader_synthetic';
const SECRET='synthetic-customer-report-claim-secret-not-production';
const role={name:ROLE,login:true,superuser:false,bypassRls:false,
 createDb:false,createRole:false,replication:false,schemaUsage:true,
 schemaCreate:false,envelopeExecute:true,rawSelect:false,credentialSelect:false,paymentSelect:false,settlementSelect:false,privateSchemaUsage:false};
const proof=tenant=>async id=>({active:true,source:'verified-pilot',
 tenantId:tenant,checkedAt:Date.now()});
async function env(fn){
 const keys=['AUTH_SECRET','PORTAL_REPORT_CLAIM_SECRET','PORTAL_REPORT_READER_ROLE'];
 const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.AUTH_SECRET='synthetic-customer-session-auth-secret';
 process.env.PORTAL_REPORT_CLAIM_SECRET=SECRET;
 process.env.PORTAL_REPORT_READER_ROLE=ROLE;
 try{return await fn()}finally{
  for(const k of keys){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}
 }
}
function mock({response=[],roleOverride=role,rpcError=null}={}){
 const queries=[];let connected=0,released=0;
 const pool={connect:async()=>{
  connected++;return {query:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('current_user AS "name"'))return {rows:[roleOverride]};
   if(sql.includes('FROM public.portal_verified_one_time_envelope_review(')){
    if(rpcError)throw rpcError;
    const [tenant,expiry,nonce,mac]=args;
    assert.equal(mac,createHmac('sha256',SECRET)
     .update('portal-one-time-report-v1|'+tenant+'|'+expiry+'|'+nonce).digest('hex'));
    return {rows:response};
   }
   return {rows:[]};
  },release(){released++}};
 }};
 return {pool,queries,get connected(){return connected},get released(){return released}};
}
test('valid signed session returns authorized empty envelope with one committed transaction',async()=>{
 await env(async()=>{
  const m=mock({response:[{authorized:true,tenantId:A,reports:[]}]});
  const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(A)});
  assert.deepEqual(await gateway(await createClientToken(A)),[]);
  assert.deepEqual(m.queries.slice(0,3).map(x=>x.sql),[
   'BEGIN ISOLATION LEVEL READ COMMITTED',
   "SET LOCAL lock_timeout = '2500ms'",
   "SET LOCAL statement_timeout = '10000ms'"
  ]);
  assert.equal(m.queries.at(-1).sql,'COMMIT');
  assert.equal(m.queries.filter(x=>x.sql.includes('FROM public.portal_verified_one_time_envelope_review(')).length,1);
  assert.equal(m.connected,1);assert.equal(m.released,1);
 });
});
test('cross-tenant or ambiguous deny never commits a report',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  for(const rows of [[],[{authorized:false,tenantId:A,reports:[]}],
   [{authorized:true,tenantId:A,reports:[{clientId:B}]}]]){
   const m=mock({response:rows});
   const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(A)});
   await assert.rejects(gateway(token),/report-envelope-(authorization-unproven|cross-tenant-denied)/);
   assert.equal(m.queries.at(-1).sql,'ROLLBACK');
   assert.equal(m.released,1);
  }
 });
});
test('invalid or cross-tenant sessions and unverified pilot never acquire SQL connection',async()=>{
 await env(async()=>{
  const m=mock();
  const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(B)});
  await assert.rejects(gateway(await createClientToken(A)),/review-envelope-entitlement-denied/);
  await assert.rejects(gateway('invalid-cookie'),/review-envelope-customer-session-required/);
  assert.equal(m.connected,0);
 });
});
test('unsafe reader role and lock timeout both fail closed and release connection',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  for(const opts of [{roleOverride:{...role,rawSelect:true}},
   {rpcError:Object.assign(Error('synthetic-lock-timeout'),{code:'55P03'})}]){
   const m=mock(opts);
   const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(A)});
   await assert.rejects(gateway(token));
   assert.equal(m.queries.at(-1).sql,'ROLLBACK');
   assert.equal(m.released,1);
  }
 });
});
test('reader can only execute envelope RPC and cannot be owner or raw-table reader',()=>{
 assert.equal(isEnvelopeReaderRoleReview(role,ROLE),true);
 for(const patch of [{envelopeExecute:false},{rawSelect:true},
  {credentialSelect:true},{paymentSelect:true},{settlementSelect:true},{privateSchemaUsage:true},
  {bypassRls:true},{name:'neondb_owner'}])
  assert.equal(isEnvelopeReaderRoleReview({...role,...patch},ROLE),false);
});

test('stale authority result and missing independent signing secret block before SQL acquisition',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  const m=mock();
  const stale=async tenant=>({tenantId:tenant,active:true,
   source:'verified-pilot',checkedAt:Date.now()-10000});
  const gateway=createEnvelopeGatewayReview({
   reportPool:m.pool,entitlementAuthority:stale
  });
  await assert.rejects(gateway(token),/review-envelope-entitlement-denied/);
  const valid=createEnvelopeGatewayReview({
   reportPool:m.pool,entitlementAuthority:proof(A)
  });
  process.env.PORTAL_REPORT_CLAIM_SECRET=process.env.AUTH_SECRET;
  await assert.rejects(valid(token),/review-envelope-signing-unavailable/);
  delete process.env.PORTAL_REPORT_CLAIM_SECRET;
  await assert.rejects(valid(token),/review-envelope-signing-unavailable/);
  assert.equal(m.connected,0,'unsafe preflight or secret cannot open report pool');
 });
});

test('reader with forged role identity, overbroad credentials or missing RPC permission must roll back',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  for(const roleOverride of [
   {...role,name:'neondb_owner'},
   {...role,bypassRls:true},
   {...role,credentialSelect:true},
   {...role,paymentSelect:true},
   {...role,settlementSelect:true},
   {...role,envelopeExecute:false}
  ]){
   const m=mock({roleOverride});
   const gateway=createEnvelopeGatewayReview({
    reportPool:m.pool,entitlementAuthority:proof(A)
   });
   await assert.rejects(gateway(token),/review-envelope-role-unverified/);
   assert.equal(m.queries.at(-1).sql,'ROLLBACK');
   assert.equal(m.queries.some(c=>c.sql.includes('FROM public.portal_verified_one_time_envelope_review(')),false);
   assert.equal(m.released,1);
  }
 });
});

test('signed envelope never leaks arbitrary SQL JSON or unaudited provider fields',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  const m=mock({response:[{authorized:true,tenantId:A,reports:[{
   clientId:A,query:'Synthetic query',createdAt:'2026-11-15T00:00:00Z',
   sensitiveInternal:'do-not-expose',
   results:[{provider:'gemini',status:'answer-received-unverified',
    answer:'Synthetic answer',verified:false,
    secret:'do-not-expose',usage:{cost:55}},
   {provider:'unlisted-provider',status:'source-supported-answer',
    answer:'untrusted output',verified:true}]
  }]}]});
  const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(A)});
  const safe=await gateway(token);
  assert.equal(safe.length,1);
  assert.equal(safe[0].results.length,1);
  assert.equal(safe[0].results[0].provider,'gemini');
  assert.equal(safe[0].results[0].verified,false);
  assert.equal(JSON.stringify(safe).includes('do-not-expose'),false);
  assert.equal(JSON.stringify(safe).includes('unlisted-provider'),false);
  assert.equal(JSON.stringify(safe).includes('cost'),false);
  assert.equal(m.queries.at(-1).sql,'COMMIT');
 });
});

test('nonempty signed envelope with no safe provider evidence rolls back claim',async()=>{
 await env(async()=>{
  const token=await createClientToken(A);
  const m=mock({response:[{authorized:true,tenantId:A,reports:[{
   clientId:A,query:'Synthetic query',createdAt:'2026-11-15T00:00:00Z',
   results:{} // malformed, not an authorized empty-report envelope
  }]}]});
  const gateway=createEnvelopeGatewayReview({reportPool:m.pool,entitlementAuthority:proof(A)});
  await assert.rejects(gateway(token),/review-envelope-report-evidence-unverified/);
  assert.equal(m.queries.at(-1).sql,'ROLLBACK');
  assert.equal(m.released,1);
 });
});
