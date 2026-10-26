import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAuthorizedAuditReport} from '../lib/authorized-audit-report.mjs';
const context={actor:{id:'owner1',authenticated:true},membership:{actorId:'owner1',tenantId:'tenant1',role:'owner',verified:true},
 sessionClientId:'tenant1',accountClientId:'tenant1',entitlement:{source:'server',clientId:'tenant1',serviceId:'agent-audit-control',status:'active',expiresAt:'2026-11-06T00:00:00.000Z'},
 featureEnabled:true,globallyEnabled:true,now:Date.parse('2026-10-26T00:00:00.000Z'),kind:'revenue-integrity',input:{expected:[],invoiced:[]}};
test('authorized module produces report and audit together without delivering',()=>{
 const r=prepareAuthorizedAuditReport(context);assert.equal(r.ok,true);assert.equal(r.auditEvent.tenantId,'tenant1');
 assert.equal(r.customerDeliveryAuthorized,false);assert.equal(r.requiresAuditPersistence,true);
});
test('scope, role, revoked grant and flags all block report preparation',()=>{
 for(const change of [{sessionClientId:'other'},{actor:{id:'owner1',authenticated:false}},
 {membership:{...context.membership,role:'analyst'}},{entitlement:{...context.entitlement,revoked:true}},
 {featureEnabled:false},{globallyEnabled:false}])assert.equal(prepareAuthorizedAuditReport({...context,...change}).ok,false);
});
test('caller cannot override account scope inside report input',()=>{
 const r=prepareAuthorizedAuditReport({...context,input:{tenantId:'other',expected:[{id:'record1',tenantId:'other'}],invoiced:[]}});
 assert.equal(r.ok,false);assert.equal(r.reason,'invalid-report-evidence');
});
