import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditPaddleWebhookLockReview} from '../lib/portal-paddle-webhook-lock-audit-review.mjs';

// REVIEW ONLY. Source audit is a RELEASE HOLD guard, never live proof.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('existing webhook still bypasses isolated signed tenant-lock router',async()=>{
 const [live,router,dispatcher]=await Promise.all([
  read('lib/paddle-live.js'),
  read('lib/portal-paddle-entitlement-router-review.mjs'),
  read('lib/portal-paddle-locked-dispatch-review.mjs')
 ]);
 assert.match(router,/REVIEW ONLY/);
 assert.match(dispatcher,/REVIEW ONLY/);
 assert.match(router,/dispatchSignedPaddleEventWithTenantLockReview/);
 assert.doesNotMatch(live,/routeSignedPaddleEntitlementReview|dispatchSignedPaddleEventWithTenantLockReview/);
 const audit=auditPaddleWebhookLockReview(live);
 assert.equal(audit.ready,false);
 for(const code of ['webhook-tenant-lock-missing',
  'transaction-completion-direct-activation',
  'subscription-direct-activation',
  'refund-reversal-event-coverage-unverified'])
  assert.ok(audit.findings.some(x=>x.code===code),'must preserve blocker '+code);
});

test('unverified source cannot claim webhook coverage or settled customer access',async()=>{
 const live=await read('lib/paddle-live.js');
 const audit=auditPaddleWebhookLockReview(live);
 assert.equal(audit.reason,'provider-and-entitlement-writers-not-end-to-end-verified');
 assert.ok(audit.unresolvedExternal.includes('live-Paddle-and-Neon-E2E'));
 const report=await read('app/api/client-portal/route.js');
 assert.doesNotMatch(report,/routeSignedPaddleEntitlementReview/);
});
