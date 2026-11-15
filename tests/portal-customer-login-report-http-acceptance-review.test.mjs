import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyHash} from '../lib/client-password-verifier.mjs';
import {createClientToken} from '../lib/admin-auth.js';
import {issueExistingPasswordSessionReview} from '../lib/portal-existing-password-session-review.mjs';
import {createEnvelopeGatewayReview} from '../lib/portal-envelope-gateway-review.mjs';
import {createPortalReportHttpReview} from '../lib/portal-report-http-review.mjs';

// REVIEW ONLY. A fully synthetic session-to-report HTTP acceptance seam.
// No real password, Neon, Paddle, customer record or production route.
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ROLE='portal_gateway_reader_synthetic';
const role={name:ROLE,login:true,superuser:false,bypassRls:false,
 createDb:false,createRole:false,replication:false,schemaUsage:true,
 schemaCreate:false,envelopeExecute:true,rawSelect:false,
 credentialSelect:false,paymentSelect:false,settlementSelect:false,
 privateSchemaUsage:false};
async function withSyntheticEnv(fn){
 const keys=['AUTH_SECRET','PORTAL_REPORT_CLAIM_SECRET','PORTAL_REPORT_READER_ROLE'];
 const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.AUTH_SECRET='synthetic-existing-login-secret-2026';
 process.env.PORTAL_REPORT_CLAIM_SECRET='synthetic-separated-claim-secret-at-least-32-characters';
 process.env.PORTAL_REPORT_READER_ROLE=ROLE;
 try{return await fn()}finally{
  for(const key of keys){
   if(old[key]===undefined)delete process.env[key];
   else process.env[key]=old[key];
  }
 }
}
function fixture({entitled=true,reports=[],roleRow=role,preflight={}}={}){
 const calls=[];
 let connections=0,releases=0;
 const reportPool={async connect(){
  connections++;
  return {
   async query(sql,args){
    calls.push(sql);
    if(sql.includes('current_user AS "name"'))return {rows:[roleRow]};
    if(sql.includes('FROM public.portal_verified_one_time_envelope_review(')){
     assert.equal(args[0],A,'signed claim may only target session tenant');
     return {rows:[{authorized:true,tenantId:A,reports}]};
    }
    return {rows:[]};
   },
   release(){releases++}
  };
 }};
 const entitlementAuthority=async tenant=>({
  tenantId:tenant,active:entitled,source:'verified-pilot',checkedAt:Date.now(),...preflight
 });
 return {http:createPortalReportHttpReview(createEnvelopeGatewayReview({
  reportPool,entitlementAuthority
 })),calls,get connections(){return connections},get releases(){return releases}};
}
test('unchanged existing password yields a private authorized tenant report',async()=>{
 await withSyntheticEnv(async()=>{
  const password='synthetic-existing-passphrase-do-not-reset';
  const stored=hashPassword(password);
  assert.equal(verifyHash(password,stored),true);
  assert.equal(verifyHash(password+'wrong',stored),false);
  assert.equal(verifyHash(password,stored),true);
  // The real review gateway must not be reached by a failed credential.
  // No reset, credential insert, or replacement is called.
  let verifierCalls=0;
  const verifyExisting=async(email,input)=>{
   verifierCalls++;
   return email==='owner@example.com'&&verifyHash(input,stored)
    ?{clientId:A,email:'owner@example.com'}:null;
  };
  const f=fixture({reports:[{clientId:A,query:'synthetic query',results:[{provider:'gemini',status:'answer-received-unverified',answer:'Synthetic answer',verified:false}],createdAt:'2026-11-15T00:00:00Z'}]});
  for(const input of ['incorrect-password',password+'-changed']){
   const invalid=await issueExistingPasswordSessionReview({
    email:'OWNER@example.com',password:input,verifyExisting
   });
   assert.equal(invalid,null);
   assert.equal((await f.http(invalid||'')).status,401);
  }
  assert.equal(f.connections,0,'wrong password never opens the reader connection');
  const token=await issueExistingPasswordSessionReview({
   email:'OWNER@example.com',password,verifyExisting
  });
  assert.equal(verifierCalls,3);
  const response=await f.http(token);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  const reports=(await response.json()).reports;
  assert.deepEqual(reports.map(x=>x.clientId),[A]);
  assert.equal(reports[0].results[0].verified,false,
   'synthetic answer must never be presented as verified provider evidence');
  assert.equal(reports[0].results[0].status,'answer-received-unverified');
  assert.equal(f.calls.at(-1),'COMMIT');
  assert.equal(f.connections,1);
  assert.equal(f.releases,1);
 });
});
test('unauthenticated or unentitled customer cannot open report SQL',async()=>{
 await withSyntheticEnv(async()=>{
  const f=fixture({entitled:false});
  assert.equal((await f.http('')).status,401);
  assert.equal((await f.http('invalid-cookie')).status,401);
  assert.equal((await f.http(await createClientToken(A))).status,403);
  assert.equal(f.connections,0);
 });
});
test('different-tenant response is rejected, rolled back and never cached',async()=>{
 await withSyntheticEnv(async()=>{
  const f=fixture({reports:[{clientId:B,query:'foreign',results:{}}]});
  const response=await f.http(await createClientToken(A));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'verified-report-unavailable'});
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.equal(f.calls.at(-1),'ROLLBACK');
  assert.equal(f.releases,1);
 });
});
test('unsafe SQL reader role never reaches report RPC',async()=>{
 await withSyntheticEnv(async()=>{
  const f=fixture({roleRow:{...role,rawSelect:true}});
  const response=await f.http(await createClientToken(A));
  assert.equal(response.status,503);
  assert.equal(f.calls.some(x=>x.includes('FROM public.portal_verified_one_time_envelope_review(')),false);
  assert.equal(f.calls.at(-1),'ROLLBACK');
  assert.equal(f.releases,1);
 });
});

test('tampered signed cookie never reaches any report database connection',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  const f=fixture({reports:[{clientId:A}]});
  // Change an encoded HMAC byte without touching any customer password.
  const bad=token.slice(0,-1)+(token.at(-1)==='A'?'B':'A');
  const response=await f.http(bad);
  assert.equal(response.status,401);
  assert.equal(f.connections,0);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
 });
});
test('stale/future/mismatched pilot evidence fails before report database connection',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  const cases=[
   {tenantId:B},
   {source:'historical'},
   {source:'paid'},
   {checkedAt:Date.now()-60000},
   {checkedAt:Date.now()+60000},
   {active:false}
  ];
  for(const preflight of cases){
   const f=fixture({preflight});
   const response=await f.http(token);
   assert.equal(response.status,403);
   assert.equal(f.connections,0);
   assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  }
 });
});
test('missing or reused report signing secret fails closed without SQL connection',async()=>{
 await withSyntheticEnv(async()=>{
  const token=await createClientToken(A);
  const original=process.env.PORTAL_REPORT_CLAIM_SECRET;
  try{
   for(const secret of ['',process.env.AUTH_SECRET]){
    process.env.PORTAL_REPORT_CLAIM_SECRET=secret;
    const f=fixture();
    const response=await f.http(token);
    assert.equal(response.status,503);
    assert.equal(f.connections,0);
   }
  }finally{process.env.PORTAL_REPORT_CLAIM_SECRET=original}
 });
});

test('unsafe claimed provider evidence is downgraded at signed HTTP boundary',async()=>{
 await withSyntheticEnv(async()=>{
  const f=fixture({reports:[{clientId:A,query:'synthetic evidence',createdAt:'2026-11-15T00:00:00Z',
   results:[{provider:'gemini',status:'source-supported-answer',verified:true,
    answer:'A synthetic answer with an alleged source',
    evidence:{sourceUrl:'javascript:alert(1)',observation:'alleged source'}}]}]});
  const response=await f.http(await createClientToken(A));
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.authorized,true);
  assert.equal(payload.reports.length,1);
  const result=payload.reports[0].results[0];
  assert.equal(result.provider,'gemini');
  assert.equal(result.verified,false);
  assert.equal(result.supported,false);
  assert.equal(result.status,'answer-received-unverified');
  assert.equal(result.sourceUrl,null);
  assert.equal(result.evidence,null);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.equal(f.calls.at(-1),'COMMIT');
 });
});

test('malformed nonempty SQL report fails closed and rolls back one-time claim',async()=>{
 await withSyntheticEnv(async()=>{
  // A DB envelope may be cryptographically authorized yet contain a row
  // with no displayable provider answer. Never commit and label this an
  // authorized empty customer report; keep the nonce transaction rollback.
  const f=fixture({reports:[{clientId:A,query:'empty provider response',
   results:[{provider:'gemini',status:'error',answer:''}],
   createdAt:'2026-11-15T00:00:00Z'}]});
  const response=await f.http(await createClientToken(A));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'verified-report-unavailable'});
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.equal(f.calls.at(-1),'ROLLBACK','invalid provider rows must roll back claim');
  assert.equal(f.releases,1);
 });
});
