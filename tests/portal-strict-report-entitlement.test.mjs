import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strictReportEntitlementReady} from '../lib/portal-report-entitlement.mjs';

test('legacy paid label never opens optional tenant-RLS report without strict settlement mode',()=>{
 const paid={allowed:true,kind:'paid'};
 assert.equal(strictReportEntitlementReady(paid,false),false);
 assert.equal(strictReportEntitlementReady(paid,undefined),false);
 assert.equal(strictReportEntitlementReady(paid,'true'),false);
 assert.equal(strictReportEntitlementReady(paid,true),true);
 assert.equal(strictReportEntitlementReady({allowed:true,kind:'pilot'},false),true);
 for(const value of [null,{allowed:false,kind:'paid'},{allowed:true,kind:'payment-review'},
  {allowed:true,kind:'unknown'},{kind:'paid'}])
  assert.equal(strictReportEntitlementReady(value,true),false);
});

test('strict report branch rejects historical paid labels before database reader checks',async()=>{
 const route=await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8');
 const idx=route.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED==='true')");
 const scope=route.slice(idx,route.indexOf("}else{\n      try{",idx));
 const entitlement=scope.indexOf('strictReportEntitlementReady(access,strictCustomerSettlementEnabled())');
 const reader=scope.indexOf('databasePool(getPortalReadDatabaseUrl())');
 const rls=scope.indexOf('inspectComparisonRlsPolicy(reader)');
 assert.ok(entitlement>=0&&reader>entitlement&&rls>reader);
 assert.match(scope,/if\(!strictReportEntitlementReady/);
 assert.match(scope,/return privateJson\(\{error:'Verified customer entitlement is required\.'/);
 assert.doesNotMatch(scope,/databasePool\(getDatabaseUrl\(\)\)/);
});
