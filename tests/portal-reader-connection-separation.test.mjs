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
  process.env.PORTAL_READ_DATABASE_URL='postgresql://reader@db.example.test/readonly';
  assert.equal(getPortalReadDatabaseUrl(),'postgresql://reader@db.example.test/readonly');
  assert.notEqual(getPortalReadDatabaseUrl(),getDatabaseUrl());
 }finally{
  for(const [key,value] of Object.entries(saved)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test('all customer portal reads use dedicated connection while login remains independent',async()=>{
 const [route,repo,profile,pilot,settlement,credentials]=await Promise.all([
  read('app/api/client-portal/route.js'),read('lib/repository.js'),
  read('lib/client-profile.js'),read('lib/pilot-access.js'),
  read('lib/customer-settlement-proof.mjs'),read('lib/client-credentials.js')
 ]);
 assert.match(route,/if\(portalReadDatabaseEnabled\(\)\)/);
 assert.match(route,/inspectPortalReaderPrivileges\(databasePool\(getPortalReadDatabaseUrl\(\)\)\)/);
 assert.match(route,/if\(!probe\.ready\)return privateJson\(/);
 assert.match(route,/readCustomerComparisonReport\(databasePool\(getPortalReadDatabaseUrl\(\)\)/);
 assert.match(repo,/portalRead\?getPortalReadDatabaseUrl\(\):getDatabaseUrl\(\)/);
 assert.match(repo.slice(repo.indexOf('export async function getClientAccount'),repo.indexOf('export async function getPaymentByMerchantOid')),/ensureSchema:false,portalRead:true/);
 assert.match(profile,/portalRead\?getPortalReadDatabaseUrl\(\):getDatabaseUrl\(\)/);
 assert.match(profile,/ensureSchema:false,portalRead:true/);
 assert.match(pilot,/pool\(\{ensureSchema:false,portalRead:true\}\)/);
 assert.match(settlement,/const url=getPortalReadDatabaseUrl\(\)/);
 assert.doesNotMatch(credentials,/getPortalReadDatabaseUrl|PORTAL_READ_DB_ENABLED/);
});
