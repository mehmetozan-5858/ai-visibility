import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getDatabaseUrl,getPortalReadDatabaseUrl,portalReadDatabaseEnabled} from '../lib/db.js';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('reader connection is opt-in, preserves legacy default, and never falls back after opt-in',()=>{
 const saved={DATABASE_URL:process.env.DATABASE_URL,STORAGE_URL:process.env.STORAGE_URL,
  PORTAL_READ_DB_ENABLED:process.env.PORTAL_READ_DB_ENABLED,
  PORTAL_READ_DATABASE_URL:process.env.PORTAL_READ_DATABASE_URL};
 try{
  process.env.DATABASE_URL='postgresql://writer@db.example.test/main';
  delete process.env.STORAGE_URL;
  delete process.env.PORTAL_READ_DB_ENABLED;
  delete process.env.PORTAL_READ_DATABASE_URL;
  assert.equal(portalReadDatabaseEnabled(),false);
  assert.equal(getPortalReadDatabaseUrl(),getDatabaseUrl());
  process.env.PORTAL_READ_DB_ENABLED='true';
  assert.equal(portalReadDatabaseEnabled(),true);
  assert.throws(()=>getPortalReadDatabaseUrl(),/portal-reader-database-not-configured/);
  process.env.PORTAL_READ_DATABASE_URL='invalid-dsn';
  assert.throws(()=>getPortalReadDatabaseUrl(),/portal-reader-database-invalid/);
  process.env.PORTAL_READ_DATABASE_URL=process.env.DATABASE_URL;
  assert.throws(()=>getPortalReadDatabaseUrl(),/portal-reader-database-not-isolated/);
  process.env.PORTAL_READ_DATABASE_URL='postgresql://writer@db.example.test/readonly';
  assert.throws(()=>getPortalReadDatabaseUrl(),/portal-reader-database-not-isolated/);
  process.env.PORTAL_READ_DATABASE_URL='postgresql://writer@other.example.test/readonly';
  assert.throws(()=>getPortalReadDatabaseUrl(),/portal-reader-database-not-isolated/);
  process.env.PORTAL_READ_DATABASE_URL='postgresql://reader@db.example.test/readonly';
  assert.equal(getPortalReadDatabaseUrl(),'postgresql://reader@db.example.test/readonly');
  assert.notEqual(getPortalReadDatabaseUrl(),getDatabaseUrl());
 }finally{
  for(const [key,value] of Object.entries(saved)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test('reader is wired ONLY to opt-in report evidence, not account/login/settlement paths',async()=>{
 const [route,repo,profile,pilot,settlement,credentials]=await Promise.all([
  read('app/api/client-portal/route.js'),read('lib/repository.js'),
  read('lib/client-profile.js'),read('lib/pilot-access.js'),
  read('lib/customer-settlement-proof.mjs'),read('lib/client-credentials.js')
 ]);
 assert.match(route,/process\.env\.PORTAL_TENANT_RLS_ENABLED==='true'/);
 assert.match(route,/getPortalReadDatabaseUrl/);
 assert.match(route,/inspectPortalReaderPrivileges/);
 assert.match(route,/withVerifiedClientTenantRead/);
 assert.match(route,/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session\.clientId\)/);
 for(const code of [repo,profile,pilot,settlement,credentials]){
  assert.doesNotMatch(code,/getPortalReadDatabaseUrl|PORTAL_READ_DB_ENABLED|PORTAL_TENANT_RLS_ENABLED/);
 }
 // Real role credentials, authenticated customer journeys and deployment remain blocked.
});

test('structurally valid tenant RLS must never authorize a forgeable session setting',async()=>{
 const {evaluateComparisonRlsPolicy,inspectComparisonRlsPolicy}=await import('../lib/portal-report-rls-readiness.mjs');
 const policy={policyname:'portal_verified_tenant_comparison_select',
  permissive:'PERMISSIVE',cmd:'SELECT',roles:['public'],
  qual:"(client_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"};
 const table={enabled:true,forced:true};
 assert.deepEqual(evaluateComparisonRlsPolicy({table,policies:[policy]}),
  {ready:false,reason:'comparison-tenant-setting-forgeable'});
 for(const candidate of [
  {table:{enabled:false,forced:true},policies:[policy]},
  {table:{enabled:true,forced:false},policies:[policy]},
  {table,policies:[]},
  {table,policies:[{...policy,qual:'true'}]},
  {table,policies:[{...policy,roles:['public','authenticated']}]}
 ]) assert.equal(evaluateComparisonRlsPolicy(candidate).ready,false);
 const pool={query:async(sql)=>{
  if(sql.includes('FROM pg_class'))return {rows:[table]};
  if(sql.includes('FROM pg_policies'))return {rows:[policy]};
  throw Error('unexpected query');
 }};
 assert.deepEqual(await inspectComparisonRlsPolicy(pool),
  {ready:false,reason:'comparison-tenant-setting-forgeable'});
 assert.deepEqual(await inspectComparisonRlsPolicy({query:async()=>{throw Error('offline')}}),
  {ready:false,reason:'comparison-rls-inspection-unavailable'});
});
