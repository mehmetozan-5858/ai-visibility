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
 assert.ok(names.includes('legacy-paid-label-entitlement-unverified:customerAccess'),
  'historical paid status cannot be silently accepted as verified settlement');
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
 assert.ok(audit.findings.some(f=>f.code==='account-activation-not-coordinated'));
});

test('bank confirmation is atomic but remains outside the cooperative report lock',async()=>{
 const repositorySource=await read('lib/repository.js');
 const start=repositorySource.indexOf('export async function confirmPayment(');
 const end=repositorySource.indexOf('export async function upsertSalesOpportunity',start);
 assert.ok(start>=0&&end>start,'must locate the exact bank confirmation function');
 const body=repositorySource.slice(start,end);
 assert.match(body,/const tx=await pool\.connect\(\)/);
 assert.match(body,/await tx\.query\("BEGIN"\)/);
 assert.match(body,/await tx\.query\("UPDATE clients SET plan=\$2,status='active'/);
 assert.match(body,/await tx\.query\("COMMIT"\)/);
 assert.match(body,/await tx\.query\("ROLLBACK"\)/);
 assert.doesNotMatch(body,/withPilotWriteLockReview|acquirePilotAdvisoryLockReview|pg_advisory_xact_lock/,
  'payment activation must remain blocked until tenant lock is adopted');
 const audit=auditPortalEntitlementWriterCoverage({
  pilotSource:await read('lib/pilot-access.js'),
  repositorySource,
  reviewSource:await read('lib/portal-pilot-writes-review.mjs')
 });
 assert.equal(audit.ready,false);
 assert.ok(audit.findings.some(x=>x.method==='confirmPayment'&&
  x.code==='account-activation-not-coordinated'));
 assert.ok(audit.findings.some(x=>x.method==='confirmCardPaymentByMerchantOid'&&
  x.code==='card-activation-not-atomic'));
});
