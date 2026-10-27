import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRevenue} from '../lib/revenue-integrity.mjs';
import {assessRelease} from '../lib/release-assurance.mjs';
const row=(id,amountMinor,extra={})=>({id,tenantId:'tenant1',subscriptionId:'sub1',period:'2026-10',currency:'EUR',amountMinor,sourceId:'source1',...extra});
test('large amounts and signed credits reconcile exactly without floating point',()=>{
 const r=reconcileRevenue({tenantId:'tenant1',expected:[row('e1','999999999999999999'),row('e2','-100')],invoiced:[row('i1','999999999999999899')]});
 assert.equal(r.comparisons[0].status,'matched');assert.equal(r.comparisons[0].differenceMinor,'0');assert.equal(r.collectionPerformed,false);
});
test('period and currency boundaries never offset unrelated invoices',()=>{
 const r=reconcileRevenue({tenantId:'tenant1',expected:[row('e1','100')],invoiced:[row('i1','100',{currency:'USD'}),row('i2','100',{period:'2026-11'})]});
 assert.equal(r.comparisons.length,3);assert.equal(r.comparisons.filter(x=>x.status==='missing-invoice').length,1);
});
test('duplicate ingestion is idempotent; conflicting record reuse is rejected',()=>{
 const x=row('e1','100');const r=reconcileRevenue({tenantId:'tenant1',expected:[x,x],invoiced:[]});
 assert.equal(r.duplicatesIgnored,1);assert.equal(r.comparisons[0].expectedMinor,'100');
 assert.throws(()=>reconcileRevenue({tenantId:'tenant1',expected:[x,{...x,amountMinor:'101'}],invoiced:[]}),/conflicting/);
});
test('cross-tenant records, fractional money and malformed periods are rejected',()=>{
 for(const extra of [{tenantId:'other'},{amountMinor:'1.2'},{amountMinor:100},{period:'2026-99'}])
  assert.throws(()=>reconcileRevenue({tenantId:'tenant1',expected:[row('e1','100',extra)],invoiced:[]}));
});
test('missing zero-value invoice remains incomplete evidence',()=>{
 assert.equal(reconcileRevenue({tenantId:'tenant1',expected:[row('e1','0')],invoiced:[]}).comparisons[0].status,'missing-invoice');
});
const targetSha='a'.repeat(40),rollbackSha='b'.repeat(40);
const check={id:1,name:'build',head_sha:targetSha,status:'completed',conclusion:'success'};
const release=checks=>assessRelease({targetSha,rollbackSha,requiredChecks:['build'],checks});
test('exact commit success is required and never authorizes deployment',()=>{
 assert.equal(release([check]).state,'checks-verified');assert.equal(release([check]).deploymentAuthorized,false);
 assert.equal(release([{...check,head_sha:rollbackSha}]).state,'blocked');
});
test('pending, failed, skipped and ambiguous checks block release',()=>{
 for(const conclusion of ['failure','skipped','neutral',null])assert.equal(release([{...check,conclusion}]).state,'blocked');
 assert.equal(release([{...check,status:'in_progress'}]).state,'blocked');
 assert.equal(release([check,{...check,id:2}]).state,'blocked');
});
