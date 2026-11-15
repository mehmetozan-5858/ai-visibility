import test from 'node:test';
import assert from 'node:assert/strict';
import {grantPilotWithLockReview,revokePilotWithLockReview,changePilotExpiryWithLockReview}
 from '../lib/portal-pilot-writes-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const TENANT='11111111-1111-4111-8111-111111111111';
const start=['BEGIN ISOLATION LEVEL READ COMMITTED',
 "SET LOCAL lock_timeout = '2500ms'",
 "SET LOCAL statement_timeout = '10000ms'",
 PILOT_LOCK_SQL];

function mockPool({returnRevokeRow=true,failOn}={}){
 const calls=[];let releases=0;
 const tx={query:async(sql,args)=>{
  calls.push({sql,args});
  if(failOn&&sql.includes(failOn))throw Error('synthetic-sql-failure');
  if(sql.includes('RETURNING expires_at'))
   return {rows:returnRevokeRow?[{expires_at:'2030-01-01T00:00:00Z'}]:[]};
  return {rows:[]};
 },release:()=>{releases++}};
 return {pool:{connect:async()=>tx},calls,get releases(){return releases}};
}

test('grant uses same tenant lock before INSERT and activity audit inside one transaction',async()=>{
 const m=mockPool();
 const result=await grantPilotWithLockReview(m.pool,TENANT,'USER@example.com',7,'Synthetic review pilot');
 assert.deepEqual(result,{granted:true});
 assert.deepEqual(m.calls.slice(0,4).map(c=>c.sql),start);
 assert.deepEqual(m.calls[3].args,[TENANT]);
 assert.match(m.calls[4].sql,/INSERT INTO public\.client_pilot_access/);
 assert.deepEqual(m.calls[4].args,[TENANT,'user@example.com','Synthetic review pilot',7]);
 assert.match(m.calls[5].sql,/INSERT INTO public\.client_activity/);
 assert.equal(m.calls[5].args[1],TENANT);
 assert.equal(m.calls[6].sql,'COMMIT');
 assert.equal(m.releases,1);
});

test('revoke locks same tenant before update and writes audit iff pilot was active',async()=>{
 for(const returnRevokeRow of [true,false]){
  const m=mockPool({returnRevokeRow});
  assert.deepEqual(await revokePilotWithLockReview(m.pool,TENANT),{revoked:returnRevokeRow});
  assert.deepEqual(m.calls.slice(0,4).map(c=>c.sql),start);
  assert.deepEqual(m.calls[3].args,[TENANT]);
  assert.match(m.calls[4].sql,/UPDATE public\.client_pilot_access/);
  assert.deepEqual(m.calls[4].args,[TENANT]);
  assert.doesNotMatch(m.calls[4].sql,/\\$2(?:\\b|::)/,
   'pilot revocation SQL must not require an unbound second parameter');
  assert.equal(m.calls.some(c=>c.sql.includes('INSERT INTO public.client_activity')),returnRevokeRow);
  assert.equal(m.calls.at(-1).sql,'COMMIT');
  assert.equal(m.releases,1);
 }
});

test('failed pilot mutation or audit rolls back the same pinned connection',async()=>{
 for(const mutation of ['INSERT INTO public.client_pilot_access',
   'UPDATE public.client_pilot_access','INSERT INTO public.client_activity']){
  const m=mockPool({failOn:mutation});
  const action=mutation.startsWith('UPDATE')
   ?revokePilotWithLockReview(m.pool,TENANT)
   :grantPilotWithLockReview(m.pool,TENANT,'user@example.com',7,'Synthetic review pilot');
  await assert.rejects(action,/synthetic-sql-failure/);
  assert.equal(m.calls.at(-1).sql,'ROLLBACK');
  assert.equal(m.calls.some(c=>c.sql==='COMMIT'),false);
  assert.equal(m.releases,1);
 }
});

test('invalid grant/revoke input never opens a database connection',async()=>{
 let opens=0;const pool={connect:async()=>{opens++;throw Error('unexpected connection')}};
 await assert.rejects(revokePilotWithLockReview(pool,'wrong'),/review-pilot-revoke-invalid/);
 await assert.rejects(grantPilotWithLockReview(pool,TENANT,'invalid',7,'Synthetic review pilot'),/review-pilot-grant-invalid/);
 await assert.rejects(grantPilotWithLockReview(pool,TENANT,'user@example.com',31,'Synthetic review pilot'),/review-pilot-grant-invalid/);
 assert.equal(opens,0);
});


test('pilot expiry change is locked and can only shorten an unrevoked entitlement',async()=>{
 for(const changed of [true,false]){
  const m=mockPool({returnRevokeRow:changed});
  assert.deepEqual(await changePilotExpiryWithLockReview(
   m.pool,TENANT,'2027-01-01T00:00:00.000Z'),{changed});
  assert.deepEqual(m.calls.slice(0,4).map(c=>c.sql),start);
  const update=m.calls[4];
  assert.match(update.sql,/SET expires_at=\$2::timestamptz/);
  assert.match(update.sql,/revoked_at IS NULL/);
  assert.match(update.sql,/expires_at >= \$2::timestamptz/,
   'expiry update must refuse extensions and revoked pilots');
  assert.deepEqual(update.args,[TENANT,'2027-01-01T00:00:00.000Z']);
  assert.equal(m.calls.at(-1).sql,'COMMIT');
 }
});

test('invalid pilot expiry change rejects without opening database connection',async()=>{
 let opened=false;const pool={connect:async()=>{opened=true;throw Error('unexpected connection')}};
 for(const expiry of ['not-a-date','2030-01-01','2030-01-01T00:00:00Z','2026-02-30T00:00:00.000Z','2026-13-01T00:00:00.000Z']){
  await assert.rejects(changePilotExpiryWithLockReview(pool,TENANT,expiry),/review-pilot-expiry-invalid/);
 }
 assert.equal(opened,false);
});
