import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
const source=(await fs.readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
let pilot=null,queries=[],failAudit=false,failLock=false;
const p={connect:async()=>p,release(){},async query(sql,a){queries.push(sql);if(sql.includes('pg_advisory_xact_lock')){assert.deepEqual(a,['client']);if(failLock)throw Error('lock-failed');return {rows:[{}]}}if(sql.startsWith('SELECT')){assert.match(sql,/revoked_at IS NULL AND expires_at>NOW\(\)/);return {rows:pilot?[pilot]:[]}}if(sql.includes('INSERT INTO client_activity')){assert.ok(a[3]);if(failAudit)throw Error('audit-failed')}return {rows:[]}}};
const {customerAccess,grantPilot,revokePilot}=new Function('crypto','databasePool','getDatabaseUrl','initializeSchema',source+';return {customerAccess,grantPilot,revokePilot}')(crypto,()=>p,()=>'',async()=>{});
test('unpaid customer requires active pilot; revoked/expired pilot is denied',async()=>{const a={client:{id:'client',status:'active'},payments:[]};assert.equal((await customerAccess(a)).allowed,false);pilot={email:'owner@example.com',expiresAt:'2026-11-01'};assert.equal((await customerAccess(a)).kind,'pilot');pilot=null;assert.equal((await customerAccess(a)).allowed,false);assert.equal((await customerAccess({...a,payments:[{status:'paid'}]})).kind,'paid');assert.equal((await customerAccess({...a,client:{id:'client',status:'payment-review'},payments:[{status:'paid'}]})).allowed,false)});
test('pilot grant audits atomically without writing payments and validates limits',async()=>{queries=[];await grantPilot('client','owner@example.com',7,'Free analysis pilot');assert.ok(queries.includes('COMMIT'));assert.ok(!queries.some(s=>/INSERT INTO payments|UPDATE payments/.test(s)));failAudit=true;await assert.rejects(grantPilot('client','owner@example.com',7,'Free analysis pilot'),/audit-failed/);assert.ok(queries.includes('ROLLBACK'));await assert.rejects(grantPilot('client','owner@example.com',31,'Free analysis pilot'),/invalid-pilot/)});

// Regression guard: an explicitly granted pilot must reach the same report
// UI that the server-side customerAccess and PDF endpoint authorize.
test('pilot report UI is reachable and paid implementation actions stay hidden',async()=>{
 const gate=await fs.readFile(new URL('../components/CustomerPortalGate.js',import.meta.url),'utf8');
 const portal=await fs.readFile(new URL('../components/CustomerPortal.js',import.meta.url),'utf8');
 assert.match(gate,/account\?\.access\?\.kind==="pilot"\|\|unlocked/);
 assert.match(portal,/account\?\.access\?\.kind==="paid"/);
 assert.match(portal,/account\?\.access\?\.kind==="pilot"\?<StatusPill/);
});

test('pilot grant and revoke take the identical tenant lock before row DML',async()=>{
 failAudit=false;failLock=false;queries=[];
 await grantPilot('client','owner@example.com',7,'Free analysis pilot');
 const grantBegin=queries.indexOf('BEGIN');
 const grantLock=queries.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 const grantWrite=queries.findIndex(x=>x.includes('INSERT INTO client_pilot_access'));
 assert.equal(grantLock,grantBegin+1);
 assert.ok(grantWrite>grantLock);
 assert.equal(queries.at(-1),'COMMIT');
 queries=[];
 await revokePilot('client');
 const revokeLock=queries.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 const revokeWrite=queries.findIndex(x=>x.includes('UPDATE client_pilot_access'));
 assert.equal(revokeLock,1);
 assert.ok(revokeWrite>revokeLock);
 assert.equal(queries.at(-1),'COMMIT');
 assert.equal(queries[revokeLock], 'SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(\'portal-pilot-lock-v1:\' || $1::uuid::text, 0))');
});

test('failed tenant lock rolls back without writing pilot grant or revoke',async()=>{
 failAudit=false;failLock=true;queries=[];
 await assert.rejects(grantPilot('client','owner@example.com',7,'Free analysis pilot'),/lock-failed/);
 assert.equal(queries.at(-1),'ROLLBACK');
 assert.ok(!queries.some(x=>x.includes('INSERT INTO client_pilot_access')));
 queries=[];
 await assert.rejects(revokePilot('client'),/lock-failed/);
 assert.equal(queries.at(-1),'ROLLBACK');
 assert.ok(!queries.some(x=>x.includes('UPDATE client_pilot_access')));
 failLock=false;
});
