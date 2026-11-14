import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
const source=(await fs.readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
let pilot=null,queries=[],failAudit=false;
const p={connect:async()=>p,release(){},async query(sql,a){queries.push(sql);if(sql.startsWith('SELECT')){assert.match(sql,/revoked_at IS NULL AND expires_at>NOW\(\)/);return {rows:pilot?[pilot]:[]}}if(sql.includes('INSERT INTO client_activity')){assert.ok(a[3]);if(failAudit)throw Error('audit-failed')}return {rows:[]}}};
const {customerAccess,grantPilot}=new Function('crypto','databasePool','getDatabaseUrl','initializeSchema','customerHasVerifiedSettlement',source+';return {customerAccess,grantPilot}')(crypto,()=>p,()=>'',async()=>{},async()=>false);
test('unpaid customer requires active pilot; revoked/expired pilot is denied',async()=>{const a={client:{id:'client',status:'active'},payments:[]};assert.equal((await customerAccess(a)).allowed,false);pilot={email:'owner@example.com',expiresAt:'2026-11-01'};assert.equal((await customerAccess(a)).kind,'pilot');pilot=null;assert.equal((await customerAccess(a)).allowed,false);assert.equal((await customerAccess({...a,payments:[{status:'paid'}]})).kind,'paid');assert.equal((await customerAccess({...a,client:{id:'client',status:'payment-review'},payments:[{status:'paid'}]})).allowed,false)});
test('payment review overrides a preexisting active pilot without reading entitlement storage',async()=>{
 pilot={email:'owner@example.com',expiresAt:'2099-11-01'};
 try{
  for(const payments of [[],[{status:'paid'}]]){
   queries=[];
   assert.deepEqual(await customerAccess({client:{id:'client',status:'payment-review'},payments}),{allowed:false});
   assert.deepEqual(queries,[]);
  }
 }finally{pilot=null}
});
test('pilot grant audits atomically without writing payments and validates limits',async()=>{queries=[];await grantPilot('client','owner@example.com',7,'Free analysis pilot');assert.ok(queries.includes('COMMIT'));assert.ok(!queries.some(s=>/INSERT INTO payments|UPDATE payments/.test(s)));failAudit=true;await assert.rejects(grantPilot('client','owner@example.com',7,'Free analysis pilot'),/audit-failed/);assert.ok(queries.includes('ROLLBACK'));await assert.rejects(grantPilot('client','owner@example.com',31,'Free analysis pilot'),/invalid-pilot/)});

// Regression guard: an explicitly granted pilot must reach the same report
// UI that the server-side customerAccess and PDF endpoint authorize.
test('pilot report UI is reachable and paid implementation actions stay hidden',async()=>{
 const gate=await fs.readFile(new URL('../components/CustomerPortalGate.js',import.meta.url),'utf8');
 const portal=await fs.readFile(new URL('../components/CustomerPortal.js',import.meta.url),'utf8');
 assert.match(gate,/account\?\.access\?\.allowed===true&&\(account\?\.access\?\.kind==="pilot"\|\|unlocked\)/);
 assert.match(portal,/account\?\.access\?\.kind==="paid"/);
 assert.match(portal,/account\?\.access\?\.kind==="pilot"\?<StatusPill/);
});

test('customer gate ignores historical paid labels unless server grants explicit paid access',async()=>{
 const gate=await fs.readFile(new URL('../components/CustomerPortalGate.js',import.meta.url),'utf8');
 assert.match(gate,/const unlocked=account\?\.access\?\.allowed===true&&account\?\.access\?\.kind==="paid"/);
 assert.doesNotMatch(gate,/account\?\.payments\|\|\[\]/);
 assert.match(gate,/account\?\.access\?\.allowed===true&&\(account\?\.access\?\.kind==="pilot"\|\|unlocked\)/);
});

test('strict settlement rollout rejects legacy paid labels without independently verified Paddle proof',async()=>{
 const old=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED='true';
 const account={client:{id:'11111111-1111-4111-8111-111111111111',status:'active'},payments:[{status:'paid',method:'bank-transfer'}]};
 const prior=pilot;
 pilot=null;
 try{
  const result=await customerAccess(account);
  assert.equal(result.allowed,false);
  assert.equal(result.kind,'payment-review');
  assert.equal(result.reason,'independent-settlement-proof-required');
 }finally{
  pilot=prior;
  if(old===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=old;
 }
});

test('server allowed false cannot unlock pilot or paid report screens',async()=>{
 const gate=await fs.readFile(new URL('../components/CustomerPortalGate.js',import.meta.url),'utf8');
 assert.match(gate,/if\(account\?\.access\?\.allowed===true&&\(account\?\.access\?\.kind==="pilot"\|\|unlocked\)\)return <CustomerPortal\/>/);
});
