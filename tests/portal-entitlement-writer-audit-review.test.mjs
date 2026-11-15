import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditPortalEntitlementWriterCoverage} from '../lib/portal-entitlement-writer-audit-review.mjs';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('locked pilot and payment writers remain NO-GO without verified external entitlements',async()=>{
 const [pilotSource,repositorySource,reviewSource]=await Promise.all([
  read('lib/pilot-access.js'),read('lib/repository.js'),
  read('lib/portal-pilot-writes-review.mjs')
 ]);
 const audit=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(audit.ready,false);
 assert.equal(audit.reason,'external-entitlement-writers-not-exhaustively-verified');
 const names=audit.findings.map(f=>f.code+':'+(f.method||''));
 assert.equal(names.some(x=>x.startsWith('account-activation-not-coordinated:')),false);
 assert.equal(names.some(x=>x.startsWith('legacy-pilot-write-unlocked:')),false);
 assert.ok(names.includes('legacy-paid-label-entitlement-unverified:customerAccess'));
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

test('card account activation uses pinned atomic transaction, but release remains HOLD',async()=>{
 const repositorySource=await read('lib/repository.js');
 const pilotSource=await read('lib/pilot-access.js');
 const reviewSource=await read('lib/portal-pilot-writes-review.mjs');
 const report=auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource});
 assert.equal(report.findings.some(f=>f.code==='card-activation-not-atomic'),false);
 assert.equal(report.ready,false);
 assert.match(repositorySource,/acquirePilotAdvisoryLockReview/);
});

test('review card transaction must not be mistaken for independently verified settlement',async()=>{
 const candidate=await read('lib/portal-card-activation-transaction-review.mjs');
 const live=await read('lib/repository.js');
 const verified=await read('lib/portal-verified-account-activation-review.mjs');
 assert.match(candidate,/withPilotWriteLockReview/);
 assert.doesNotMatch(candidate,/VERIFIED_PADDLE_SETTLEMENT_SQL|activateVerifiedPaddleAccountReview/);
 assert.match(verified,/VERIFIED_PADDLE_SETTLEMENT_SQL/);
 assert.doesNotMatch(live,/portal-card-activation-transaction-review/);
 assert.doesNotMatch(live,/activateVerifiedPaddleAccountReview/);
 // Stronger than a green unit test: production acceptance is still withheld.
 const audit=auditPortalEntitlementWriterCoverage({
  pilotSource:await read('lib/pilot-access.js'),
  repositorySource:live,
  reviewSource:await read('lib/portal-pilot-writes-review.mjs')
 });
 assert.equal(audit.ready,false);
 assert.ok(audit.unresolvedExternal.includes('external-payment-webhooks'));
});

test('bank confirmation now shares tenant lock, but external settlement writers remain unverified',async()=>{
 const repositorySource=await read('lib/repository.js');
 const start=repositorySource.indexOf('export async function confirmPayment(');
 const end=repositorySource.indexOf('export async function upsertSalesOpportunity',start);
 assert.ok(start>=0&&end>start);
 const body=repositorySource.slice(start,end);
 assert.match(body,/const tx=await pool\.connect\(\)/);
 assert.match(body,/BEGIN ISOLATION LEVEL READ COMMITTED/);
 assert.match(body,/acquirePilotAdvisoryLockReview\(tx,bound\.clientId\)/);
 assert.match(body,/await tx\.query\(\"COMMIT\"\)/);
 assert.match(body,/await tx\.query\(\"ROLLBACK\"\)/);
 const audit=auditPortalEntitlementWriterCoverage({
  pilotSource:await read('lib/pilot-access.js'),repositorySource,
  reviewSource:await read('lib/portal-pilot-writes-review.mjs')
 });
 assert.equal(audit.ready,false);
 assert.equal(audit.findings.some(x=>x.code==='account-activation-not-coordinated'),false);
 assert.equal(audit.findings.some(x=>x.code==='card-activation-not-atomic'),false);
 assert.ok(audit.unresolvedExternal.includes('account-suspension-and-deletion'));
});
