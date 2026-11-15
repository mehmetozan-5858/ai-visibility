import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src=(await fs.readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'').replace(/export /g,'');
function fixture({failLock=false,failBuild=false}={}){
 const calls=[];
 const tx={release(){calls.push('release')},async query(sql,args){
  calls.push(sql);
  if(sql.includes('pg_advisory_xact_lock')){
   assert.deepEqual(args,['00000000-0000-0000-0000-000000000001']);
   if(failLock)throw Error('lock-failed');
  }
  return {rows:[]};
 }};
 const pool={connect:async()=>tx};
 const lock=new Function('databasePool','getDatabaseUrl','initializeSchema','crypto',src+';return withTenantReportLock;')(()=>pool,()=> 'test-url',async()=>{},{});
 return {calls,lock,failBuild};
}
test('report builds response entirely inside tenant lock and commits afterwards',async()=>{
 const {calls,lock}=fixture();
 const response=await lock('00000000-0000-0000-0000-000000000001',async()=>{
  calls.push('build-pdf');
  return {status:200};
 });
 assert.equal(response.status,200);
 const acquired=calls.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 assert.ok(calls.indexOf('BEGIN')<acquired);
 assert.ok(acquired<calls.indexOf('build-pdf'));
 assert.ok(calls.indexOf('build-pdf')<calls.indexOf('COMMIT'));
 assert.equal(calls.at(-1),'release');
});
test('failed read lock or PDF generation never authorizes report',async()=>{
 for(const settings of [{failLock:true},{failBuild:true}]){
  const {calls,lock}=fixture(settings);
  await assert.rejects(lock('00000000-0000-0000-0000-000000000001',async()=>{
   if(settings.failBuild)throw Error('pdf-failed');
   return {status:200};
  }),settings.failLock?/lock-failed/:/pdf-failed/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.includes('COMMIT'));
  assert.equal(calls.at(-1),'release');
 }
});
test('customer PDF route keeps account access, evidence and build within lock callback',async()=>{
 const route=await fs.readFile(new URL('../app/api/client-portal/report/route.js',import.meta.url),'utf8');
 const lock=route.indexOf('return await withTenantReportLock(session.clientId,async()=>');
 const account=route.indexOf('getClientAccount(session.clientId)',lock);
 const access=route.indexOf('customerAccess(account)',account);
 const evidence=route.indexOf('readCustomerComparisonReport(',access);
 const pdf=route.indexOf('buildReportResponse(',access);
 const commitBoundary=route.indexOf('});',pdf);
 assert.ok(lock>0&&account>lock&&access>account&&evidence>access&&pdf>evidence&&commitBoundary>pdf);
 assert.match(route,/Cache-Control","private, no-store, max-age=0"/);
});
