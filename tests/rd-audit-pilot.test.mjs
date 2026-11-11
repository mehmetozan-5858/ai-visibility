import test from 'node:test';
import assert from 'node:assert/strict';
import {runAuditPilot} from '../lib/rd-audit-pilot.mjs';

test('pilot exercises real policies without network or claiming customer acceptance',()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('network-forbidden-in-pilot')};
 try{
  const r=runAuditPilot();
  assert.equal(r.ok,true);assert.equal(r.passed,7);assert.equal(r.total,7);
  assert.equal(r.scope,'synthetic-only');assert.equal(r.customerDataRead,false);
  assert.equal(r.externalActions,false);assert.equal(r.persistentAudit,false);
  assert.equal(r.productionCustomerAcceptance,false);assert.equal(r.paidProviderCalls,0);
 }finally{globalThis.fetch=original}
});
test('public result exposes only aggregate synthetic scenarios with no random event or tenant payload',()=>{
 const r=runAuditPilot();
 assert.equal(r.results.length,new Set(r.results.map(x=>x.id)).size);
 for(const x of r.results)assert.deepEqual(Object.keys(x).sort(),['id','name','passed']);
 assert.doesNotMatch(JSON.stringify(r),/synthetic-tenant|synthetic-actor|aaaaaaaaaaaaaaaa|bbbbbbbbbbbbbbbb/);
 assert.deepEqual(runAuditPilot(),r);
});
