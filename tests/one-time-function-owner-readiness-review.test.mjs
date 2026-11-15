import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOneTimeOwnerReadiness,inspectOneTimeOwnerReadiness,ownerReadinessSql} from '../lib/one-time-function-owner-readiness-review.mjs';

const expected={owner:'portal_report_fn_owner_trial_20261115',reader:'portal_gateway_reader_trial_20261114'};
const role={
 ownerName:expected.owner,ownerLogin:false,ownerSuper:false,
 ownerBypassRls:false,ownerCreateRole:false,ownerCreateDb:false,
 ownerInherit:false,ownerSchemaCreate:false,
 ownerClientSelect:true,ownerReportSelect:true,ownerSigningKeySelect:true,
 ownerNonceInsert:true,ownerNonceIdSelect:true,
 ownerPaymentSelect:false,ownerCredentialSelect:false,
 securityDefiner:true,safeSearchPath:true,ownerPolicyCount:1,publicExecute:false,functionCount:1,
 readerOwnerMember:false,readerOwnerUsage:false,readerOwnerSet:false,
 readerAdminMember:false,readerAdminSet:false,
 readerExecute:true,readerRawSelect:false,readerPrivateSchema:false,
 readerSigningKeySelect:false,readerNonceSelect:false,readerNonceInsert:false
};

test('trial function owner cannot log in, bypass RLS, read payments or expose keys',()=>{
 assert.deepEqual(evaluateOneTimeOwnerReadiness(role,expected),{
  ready:true,reason:'isolated-test-function-owner-role-verified'
 });
 for(const [key,value] of [
  ['ownerLogin',true],['ownerBypassRls',true],['ownerSuper',true],
  ['ownerInherit',true],['ownerSchemaCreate',true],['ownerNonceIdSelect',false],
  ['ownerPaymentSelect',true],['ownerCredentialSelect',true],
  ['safeSearchPath',false],['ownerPolicyCount',0],['publicExecute',true],
  ['readerOwnerMember',true],['readerOwnerUsage',true],['readerOwnerSet',true],
  ['readerAdminMember',true],['readerAdminSet',true],
  ['readerRawSelect',true],['readerPrivateSchema',true],
  ['readerSigningKeySelect',true],['readerNonceInsert',true],
  ['readerExecute',false]
 ]){
  const result=evaluateOneTimeOwnerReadiness({...role,[key]:value},expected);
  assert.equal(result.ready,false,`unsafe ${key} must be refused`);
 }
 assert.equal(evaluateOneTimeOwnerReadiness({...role,ownerName:'neondb_owner'},expected).ready,false);
});

test('readiness probe binds reader name and fails closed for missing catalog output',async()=>{
 let queried=0;
 const pool={query:async(sql,args)=>{
  queried++;
  assert.equal(sql,ownerReadinessSql);
  assert.deepEqual(args,[expected.reader]);
  return {rows:[role]};
 }};
 assert.equal((await inspectOneTimeOwnerReadiness(pool,expected)).ready,true);
 assert.equal(queried,1);
 assert.equal((await inspectOneTimeOwnerReadiness(pool,{...expected,reader:'neondb_owner'})).ready,false);
 assert.equal(queried,1,'invalid role cannot trigger SQL');
 assert.equal((await inspectOneTimeOwnerReadiness({query:async()=>({rows:[]})},expected)).ready,false);
 assert.equal((await inspectOneTimeOwnerReadiness({query:async()=>{throw Error('secret')}},expected)).ready,false);
 assert.equal((await inspectOneTimeOwnerReadiness(null,expected)).ready,false);
});

test('metadata SQL performs no database writes, secret retrieval or customer data SELECT',()=>{
 assert.match(ownerReadinessSql,/pg_proc/);
 assert.match(ownerReadinessSql,/pg_roles/);
 assert.match(ownerReadinessSql,/has_column_privilege/);
 assert.match(ownerReadinessSql,/pg_has_role\(\$1::name,o\.oid,'SET'\)/);
 assert.match(ownerReadinessSql,/pg_has_role\(\$1::name,'neondb_owner'::regrole,'MEMBER'\)/);
 assert.match(ownerReadinessSql,/aclexplode/);
 assert.match(ownerReadinessSql,/acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
 assert.match(ownerReadinessSql,/pp\.polcmd='r'/);
 assert.match(ownerReadinessSql,/pp\.polroles @> ARRAY\[o\.oid\]::oid\[\]/);
 assert.doesNotMatch(ownerReadinessSql,/\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b|\bALTER\s+ROLE\b/);
 assert.doesNotMatch(ownerReadinessSql,/SELECT\s+secret\s+FROM/);
});
