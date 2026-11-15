import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditPortalEntitlementWriterCoverage} from '../lib/portal-entitlement-writer-audit-review.mjs';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('known legacy pilot and account activation paths remain explicit NO-GO blockers',async()=>{
 const [pilotSource,repositorySource,reviewSource]=await Promise.all([
  read('lib/pilot-access.js'),read('lib/repository.js'),
  read('lib/portal-pilot-writes-review.mjs')
 ]);
 const audit=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(audit.ready,false);
 assert.equal(audit.reason,'external-entitlement-writers-not-exhaustively-verified');
 const names=audit.findings.map(f=>f.code+':'+(f.method||''));
 for(const path of [
  'legacy-pilot-write-unlocked:grantPilot',
  'legacy-pilot-write-unlocked:revokePilot',
  'account-activation-not-coordinated:confirmPayment',
  'account-activation-not-coordinated:confirmCardPaymentByMerchantOid'
 ])assert.ok(names.includes(path),'must expose active bypass: '+path);
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
 const pilotSource=`export async function grantPilot(){return withPilotWriteLockReview(x)}
export async function revokePilot(){return withPilotWriteLockReview(x)}`;
 const repositorySource=`export async function confirmPayment(){return withPilotWriteLockReview(x)}
export async function upsertSalesOpportunity(){}
export async function confirmCardPaymentByMerchantOid(){return withPilotWriteLockReview(x)}
export async function markCardPaymentFailedByMerchantOid(){}`;
 const reviewSource='withPilotWriteLockReview';
 const result=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(result.ready,false,'source-only checks must not claim all writers verified');
 assert.equal(result.findings.length,0);
});
