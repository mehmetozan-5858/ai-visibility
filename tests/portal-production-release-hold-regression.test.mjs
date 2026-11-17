import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY. This is a release-HOLD regression, not a live acceptance test.
// Until every entitlement writer shares the same transactional lock and the
// deployed report RPC / real customer session are accepted, the isolated
// proof-of-design must not be mistaken for production authorization.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('isolated locked-report HTTP adapter is not wired to production portal',async()=>{
 const [portal,http,gateway]=await Promise.all([
  read('app/api/client-portal/route.js'),
  read('lib/portal-report-http-review.mjs'),
  read('lib/portal-envelope-gateway-review.mjs')
 ]);
 assert.match(http,/REVIEW ONLY/);
 assert.match(gateway,/REVIEW ONLY/i);
 assert.doesNotMatch(portal,/createPortalReportHttpReview|createEnvelopeGatewayReview|portal_verified_one_time_envelope_review/);
 assert.match(portal,/verifyClientToken/);
 assert.match(portal,/privateJson/);
});

test('production portal report errors cannot silently assert fresh report availability',async()=>{
 const portal=await read('app/api/client-portal/route.js');
 assert.match(portal,/let reportEvidence=\{available:false,comparisonCount:0,\s*evidenceClass:'unknown',verifiedProviderEvidence:false\}/);
 assert.match(portal,/evidenceClass:'historical',verifiedProviderEvidence:false/);
 assert.match(portal,/let reportPreview=null/);
 assert.match(portal,/reportPreview=\{evidenceClass:'historical',verifiedProviderEvidence:false,reports:rows\}/);
 assert.match(portal,/catch\{\} \/\/ Keep the existing portal usable; do not claim evidence is ready on a read failure/);
 assert.match(portal,/if\(!portalReadDatabaseEnabled\(\)\)/);
 assert.match(portal,/if\(!privileges.ready\)/);
 assert.match(portal,/if\(!rls.ready\)/);
});

test('paid labels fail closed in review, while external entitlement writers remain blockers',async()=>{
 const [pilot,repository,auditSource]=await Promise.all([
  read('lib/pilot-access.js'),
  read('lib/repository.js'),
  read('lib/portal-entitlement-writer-audit-review.mjs')
 ]);
 const {auditPortalEntitlementWriterCoverage}=await import('../lib/portal-entitlement-writer-audit-review.mjs');
 const report=auditPortalEntitlementWriterCoverage({
  pilotSource:pilot,repositorySource:repository,
  reviewSource:await read('lib/portal-pilot-writes-review.mjs')
 });
 assert.equal(report.ready,false);
 assert.equal(report.findings.some(x=>x.code==='account-activation-not-coordinated'),false);
 assert.ok(report.unresolvedExternal.includes('external-payment-webhooks'));
 assert.ok(report.unresolvedExternal.includes('account-suspension-and-deletion'));
 assert.equal(report.findings.some(x=>x.code==='legacy-paid-label-entitlement-unverified'),false);
 assert.match(pilot,/await customerHasVerifiedSettlement\(account\.client\.id\)/);
 assert.match(auditSource,/external-entitlement-writers-not-exhaustively-verified/);
});
