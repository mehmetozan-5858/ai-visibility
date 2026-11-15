import test from 'node:test';
import assert from 'node:assert/strict';
import {suspendAndRevokeClientWithLockReview} from '../lib/portal-pilot-writes-review.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
function fixture({missing=false,suspended=false,revoked=false,failRevoke=false}={}){
 const calls=[];
 const pool={connect:async()=>({
  query:async(sql,args=[])=>{
   calls.push({sql,args});
   if(sql.includes('UPDATE public.clients'))return {rows:missing||suspended?[]:[{id:tenant}]};
   if(sql.includes('SELECT id FROM public.clients'))return {rows:missing?[]:[{id:tenant}]};
   if(sql.includes('UPDATE public.client_pilot_access')){
    if(failRevoke)throw Error('synthetic-revoke-failure');
    return {rows:revoked?[]:[{client_id:tenant}]};
   }
   return {rows:[]};
  },
  release:()=>calls.push({sql:'RELEASE'})
 })};
 return {pool,calls};
}
test('retirement uses single tenant lock and transaction for suspension plus revoke',async()=>{
 const {pool,calls}=fixture();
 assert.deepEqual(await suspendAndRevokeClientWithLockReview(pool,tenant),{
  accountPresent:true,suspended:true,pilotRevoked:true
 });
 const statements=calls.map(x=>x.sql);
 const find=q=>statements.findIndex(x=>q==='COMMIT'||q==='ROLLBACK' ? x===q : x.includes(q));
 assert.ok(find('BEGIN ISOLATION LEVEL READ COMMITTED')<find('pg_advisory_xact_lock'));
 assert.ok(find('pg_advisory_xact_lock')<find('UPDATE public.clients'));
 assert.ok(find('UPDATE public.clients')<find('UPDATE public.client_pilot_access'));
 assert.ok(find('UPDATE public.client_pilot_access')<statements.indexOf('COMMIT'));
 assert.deepEqual(calls[find('UPDATE public.clients')].args,[tenant]);
 assert.deepEqual(calls[find('UPDATE public.client_pilot_access')].args,[tenant]);
 assert.equal(statements.at(-1),'RELEASE');
 assert.doesNotMatch(statements.join('\n'),/\bDELETE\s+FROM\b/i,
  'hard deletion is forbidden until separate cascade / retention audit');
});
test('already-suspended account still revokes any remaining active pilot',async()=>{
 const {pool}=fixture({suspended:true});
 assert.deepEqual(await suspendAndRevokeClientWithLockReview(pool,tenant),{
  accountPresent:true,suspended:false,pilotRevoked:true
 });
});
test('missing account never mutates pilot access',async()=>{
 const {pool,calls}=fixture({missing:true});
 assert.deepEqual(await suspendAndRevokeClientWithLockReview(pool,tenant),{
  accountPresent:false,suspended:false,pilotRevoked:false
 });
 assert.equal(calls.some(x=>x.sql.includes('UPDATE public.client_pilot_access')),false);
});
test('failure in revocation rolls back account suspension',async()=>{
 const {pool,calls}=fixture({failRevoke:true});
 await assert.rejects(suspendAndRevokeClientWithLockReview(pool,tenant),/synthetic-revoke-failure/);
 assert.ok(calls.some(x=>x.sql==='ROLLBACK'));
 assert.equal(calls.at(-1).sql,'RELEASE');
});
test('invalid tenant cannot open connection',async()=>{
 let connected=false;
 await assert.rejects(suspendAndRevokeClientWithLockReview({
  connect:async()=>{connected=true}
 },'invalid'),/review-client-retirement-invalid/);
 assert.equal(connected,false);
});