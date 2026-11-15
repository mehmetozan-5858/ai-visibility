import test from 'node:test';
import assert from 'node:assert/strict';
import {lockPrivilegeSql,evaluateLockPrivilegeReview,inspectLockPrivilegeReview}
 from '../lib/one-time-lock-privilege-review.mjs';

const expected={
 owner:'portal_report_fn_owner_trial_20261115',
 reader:'portal_gateway_reader_trial_20261114'
};
const allowed={ownerName:expected.owner,clientSelect:true,clientLockUpdate:true,
 pilotSelect:true,pilotLockUpdate:true,readerClientUpdate:false,
 readerPilotUpdate:false,readerPilotSelect:false};

test('a SELECT-only SECURITY DEFINER owner must not be marked safe for FOR SHARE',()=>{
 const observed={...allowed,clientLockUpdate:false,pilotSelect:false,pilotLockUpdate:false};
 assert.deepEqual(evaluateLockPrivilegeReview(observed,expected),{
  ready:false,reason:'lock-privilege-missing-or-unsafe:clientLockUpdate'
 });
 for(const key of ['clientSelect','clientLockUpdate','pilotSelect','pilotLockUpdate']){
  assert.equal(evaluateLockPrivilegeReview({...allowed,[key]:false},expected).ready,false,key);
 }
 for(const key of ['readerClientUpdate','readerPilotUpdate','readerPilotSelect']){
  assert.equal(evaluateLockPrivilegeReview({...allowed,[key]:true},expected).ready,false,key);
 }
 assert.deepEqual(evaluateLockPrivilegeReview(allowed,expected),{
  ready:true,reason:'metadata-only-lock-privileges-verified'
 });
 assert.equal(evaluateLockPrivilegeReview({...allowed,ownerName:'neondb_owner'},expected).ready,false);
 assert.equal(evaluateLockPrivilegeReview(null,expected).ready,false);
});

test('read-only catalog probe binds the expected reader and denies missing results',async()=>{
 let count=0;
 const pool={query:async(sql,args)=>{
  count++;
  assert.equal(sql,lockPrivilegeSql);
  assert.deepEqual(args,[expected.reader]);
  return {rows:[allowed]};
 }};
 assert.equal((await inspectLockPrivilegeReview(pool,expected)).ready,true);
 assert.equal(count,1);
 assert.equal((await inspectLockPrivilegeReview(pool,{...expected,reader:'neondb_owner'})).ready,false);
 assert.equal(count,1);
 assert.equal((await inspectLockPrivilegeReview({query:async()=>({rows:[]})},expected)).ready,false);
 assert.equal((await inspectLockPrivilegeReview({query:async()=>{throw Error('probe fails')}},expected)).ready,false);
});

test('probe cannot create roles, grant UPDATE or touch real customer records',()=>{
 assert.match(lockPrivilegeSql,/has_column_privilege/);
 assert.match(lockPrivilegeSql,/client_pilot_access/);
 assert.doesNotMatch(lockPrivilegeSql,/\bGRANT\b|\bREVOKE\b|\bALTER ROLE\b|\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b/i);
});
