import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createClientToken} from '../lib/admin-auth.js';
import {isNarrowSignedClaimReader,signTrialReportClaim,readSignedDbClaimReportReview} from '../lib/signed-db-claim-report-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const dbSecret='synthetic-db-claim-signing-key-only-for-unit-test';
const roleName='portal_gateway_reader_trial_20261114';
const proofRole={
 name:roleName,login:true,superuser:false,bypassRls:false,
 createDb:false,createRole:false,replication:false,
 schemaUsage:true,schemaCreate:false,rawSelect:false,
 credentialSelect:false,paymentSelect:false,settlementSelect:false,
 secretSchemaUsage:false,functionExecute:true
};
async function withSyntheticConfig(fn){
 const vars=['AUTH_SECRET','PORTAL_REPORT_CLAIM_SECRET','PORTAL_REPORT_READER_ROLE'];
 const old=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 process.env.AUTH_SECRET='synthetic-test-http-session-key-not-production';
 process.env.PORTAL_REPORT_CLAIM_SECRET=dbSecret;
 process.env.PORTAL_REPORT_READER_ROLE=roleName;
 try{return await fn()}finally{
  for(const k of vars)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
 }
}
const syntheticRow=(clientId,label)=>({clientId,query:label,results:[
 {provider:'gemini',status:'answer-received-unverified',answer:'synthetic example only'}
]});

test('signed claim is scoped to exact tenant, audience and 90s expiry',async()=>{
 const now=1794720000;
 const c=await signTrialReportClaim(A,dbSecret,now);
 assert.equal(c.tenant,A);
 assert.equal(c.expires,now+90);
 assert.equal(c.mac.length,64);
 const expected=createHmac('sha256',dbSecret).update(`portal-report-v1|${A}|${now+90}`).digest('hex');
 assert.equal(c.mac,expected);
 const other=createHmac('sha256',dbSecret).update(`portal-report-v1|${B}|${now+90}`).digest('hex');
 assert.notEqual(c.mac,other);
 await assert.rejects(signTrialReportClaim('not-uuid',dbSecret,now),/trial-claim-signing-unavailable/);
 await assert.rejects(signTrialReportClaim(A,'weak',now),/trial-claim-signing-unavailable/);
});

test('narrow SQL role cannot have raw SELECT, secret access or privileged flags',()=>{
 assert.equal(isNarrowSignedClaimReader(proofRole,roleName),true);
 for(const modification of [
  {rawSelect:true},{secretSchemaUsage:true},{bypassRls:true},
  {paymentSelect:true},{credentialSelect:true},{settlementSelect:true},
  {schemaCreate:true},{functionExecute:false},{name:'neondb_owner'},
  {login:false}
 ])assert.equal(isNarrowSignedClaimReader({...proofRole,...modification},roleName),false);
});

test('signed HTTP session A/B binds claims and DB function on same read-only connection',async()=>{
 await withSyntheticConfig(async()=>{
  const calls=[];let acquired=0,released=0;
  const pool={connect:async()=>{acquired++;return {
   query:async(sql,args)=>{
    calls.push({sql,args});
    if(sql==='BEGIN READ ONLY'||sql==='COMMIT')return {rows:[]};
    if(sql.includes('current_user AS "name"'))return {rows:[proofRole]};
    assert.match(sql,/portal_trial_verified_report\(\$1::uuid,\$2::bigint,\$3::text\)/);
    assert.ok(!/set_config|current_setting/i.test(sql));
    const [tenant,expires,mac]=args;
    const expected=createHmac('sha256',dbSecret)
      .update(`portal-report-v1|${tenant}|${expires}`).digest('hex');
    assert.equal(mac,expected);
    return {rows:[syntheticRow(tenant,tenant===A?'Synthetic A':'Synthetic B'),syntheticRow(tenant===A?B:A,'Foreign row')]};
   },release:()=>{released++}
  }}};
  const tokenA=await createClientToken(A),tokenB=await createClientToken(B);
  assert.deepEqual((await readSignedDbClaimReportReview(pool,tokenA,true)).map(r=>r.query),['Synthetic A']);
  assert.deepEqual((await readSignedDbClaimReportReview(pool,tokenB,true)).map(r=>r.query),['Synthetic B']);
  assert.equal(acquired,2);assert.equal(released,2);
  assert.equal(calls.filter(c=>c.sql==='BEGIN READ ONLY').length,2);
  assert.equal(calls.filter(c=>c.sql==='COMMIT').length,2);
 });
});

test('signature, entitlement and secret failures reject before database connection',async()=>{
 await withSyntheticConfig(async()=>{
  let calls=0;
  const pool={connect:async()=>{calls++;throw Error('must-not-connect')}};
  const token=await createClientToken(A);
  await assert.rejects(readSignedDbClaimReportReview(pool,'bad-token',true),/verified-customer-session-required/);
  await assert.rejects(readSignedDbClaimReportReview(pool,token.slice(0,-3)+'xxx',true),/verified-customer-session-required/);
  await assert.rejects(readSignedDbClaimReportReview(pool,token,false),/verified-customer-entitlement-required/);
  process.env.PORTAL_REPORT_CLAIM_SECRET=process.env.AUTH_SECRET;
  await assert.rejects(readSignedDbClaimReportReview(pool,token,true),/trial-report-signing-not-configured/);
  assert.equal(calls,0);
 });
});

test('unsafe SQL identity aborts, rolls back and releases without report SELECT',async()=>{
 await withSyntheticConfig(async()=>{
  const token=await createClientToken(A);
  const calls=[];let released=0;
  const pool={connect:async()=>({query:async sql=>{
   calls.push(sql);
   if(sql==='BEGIN READ ONLY'||sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('current_user AS "name"'))return {rows:[{...proofRole,rawSelect:true}]};
   throw Error('unsafe-report-read');
  },release:()=>{released++}})};
  await assert.rejects(readSignedDbClaimReportReview(pool,token,true),/trial-report-reader-role-unverified/);
  assert.equal(calls.length,3);
  assert.equal(calls[2],'ROLLBACK');
  assert.equal(released,1);
 });
});
