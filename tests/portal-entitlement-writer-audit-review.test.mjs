import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditPortalEntitlementWriterCoverage} from '../lib/portal-entitlement-writer-audit-review.mjs';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('locked pilot writers remove two bypasses but account activations remain NO-GO',async()=>{
 const [pilotSource,repositorySource,reviewSource]=await Promise.all([
  read('lib/pilot-access.js'),read('lib/repository.js'),
  read('lib/portal-pilot-writes-review.mjs')
 ]);
 const audit=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(audit.ready,false);
 assert.equal(audit.reason,'external-entitlement-writers-not-exhaustively-verified');
 const names=audit.findings.map(f=>f.code+':'+(f.method||''));
 for(const path of [
  'account-activation-not-coordinated:confirmPayment',
  'account-activation-not-coordinated:confirmCardPaymentByMerchantOid'
 ])assert.ok(names.includes(path),'must expose active bypass: '+path);
 assert.equal(names.some(x=>x.startsWith('legacy-pilot-write-unlocked:')),false);
 assert.ok(audit.unresolvedExternal.includes('direct-admin-sql'));
 assert.ok(audit.unresolvedExternal.includes('external-payment-webhooks'));
});

test('audit fails closed for missing or changed repository source',()=>{
 const audit=auditPortalEntitlementWriterCoverage({});
 assert.equal(audit.ready,false);
 assert.ok(audit.findings.some(f=>f.reason==='source-or-required-writer-missing'));
 assert.equal(audit.unresolvedExternal.length,4);
});

test('an apparently locked implementation cannot self-certify unknown external writers',()=>{
 const pilotSource=`export async function grantPilot(){return grantPilotWithLockReview(x)}
export async function revokePilot(){return revokePilotWithLockReview(x)}`;
 const repositorySource=`export async function confirmPayment(){return withPilotWriteLockReview(x)}
export async function upsertSalesOpportunity(){}
export async function confirmCardPaymentByMerchantOid(){return withPilotWriteLockReview(x)}
export async function markCardPaymentFailedByMerchantOid(){}`;
 const reviewSource='withPilotWriteLockReview';
 const result=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(result.ready,false,'source-only checks must not claim all writers verified');
 assert.equal(result.findings.length,0);
});

test('card payment activation must be atomic as well as tenant-lock-coordinated',async()=>{
 const repositorySource=await read('lib/repository.js');
 const pilotSource=await read('lib/pilot-access.js');
 const reviewSource=await read('lib/portal-pilot-writes-review.mjs');
 const audit=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.ok(audit.findings.some(f=>f.code==='card-activation-not-atomic'&&
  f.method==='confirmCardPaymentByMerchantOid'),
  'payment and customer activation cannot commit as separate pool queries');
 assert.equal(audit.ready,false);
});

test('writer audit loads as executable JavaScript and detects split card transaction',async()=>{
 const {auditPortalEntitlementWriterCoverage:check}=await import('../lib/portal-entitlement-writer-audit-review.mjs');
 const repositorySource=await read('lib/repository.js');
 const pilotSource=await read('lib/pilot-access.js');
 const reviewSource=await read('lib/portal-pilot-writes-review.mjs');
 const report=check({pilotSource,repositorySource,reviewSource});
 assert.ok(report.findings.some(f=>f.code==='card-activation-not-atomic'));
 assert.equal(report.ready,false);
});
