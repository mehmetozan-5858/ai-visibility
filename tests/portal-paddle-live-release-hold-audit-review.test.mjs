import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: executable list of known production release blockers.
// This test detects the EXISTENCE of blockers; green CI must NOT be read
// as production readiness. Change these assertions only once the complete
// signed-event/tenant-lock/refund proof has been independently accepted.
const live=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
const route=await readFile(new URL('../app/api/paddle/webhook/route.js',import.meta.url),'utf8');
const review=await readFile(new URL('../lib/portal-paddle-writer-lock-review.mjs',import.meta.url),'utf8');

const within=(start,end)=>{const i=live.indexOf(start);return i<0?'':live.slice(i,live.indexOf(end,i+start.length)<0?undefined:live.indexOf(end,i+start.length));};

test('Paddle real route authenticates raw bytes and never claims review helper is wired',()=>{
 assert.match(route,/verifyPaddleLiveSignature\(raw,req\.headers\.get\('paddle-signature'\),secret\)/);
 assert.doesNotMatch(route,/withPaddleEntitlementWriterLockReview/);
 assert.doesNotMatch(live,/acquirePilotAdvisoryLockReview|withPaddleEntitlementWriterLockReview/);
 assert.match(review,/acquirePilotAdvisoryLockReview/);
});

test('release HOLD: event claim precedes tenant row lock and must not be confused with correct ordering',()=>{
 const record=within('export async function recordPaddleLiveEvent','\n}\n');
 const eventInsert=record.indexOf('INSERT INTO paddle_live_events');
 const process=record.indexOf('applyTransaction(tx,item)');
 assert.ok(eventInsert>=0&&process>eventInsert,'real event-id insert precedes payment row-locking flow');
 assert.doesNotMatch(record.slice(0,process),/pg_advisory_xact_lock|acquirePilotAdvisoryLockReview/);
 const transaction=within('async function applyTransaction','async function applySubscriptionAccess');
 const subscription=within('async function applySubscriptionAccess','export async function recordPaddleLiveEvent');
 assert.match(transaction,/FROM payments WHERE id=\$1 AND client_id=\$2 FOR UPDATE/);
 assert.match(subscription,/FROM payments WHERE id=\$1 AND client_id=\$2 FOR UPDATE/);
 assert.doesNotMatch(transaction,/acquirePilotAdvisoryLockReview/);
 assert.doesNotMatch(subscription,/acquirePilotAdvisoryLockReview/);
});

test('release HOLD: normalized merchant-reference uniqueness is not related to Paddle signed settlement',()=>{
 const repository=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.match(repository,/confirmCardPaymentByMerchantOid/);
 assert.match(repository,/WHERE replace\(reference_code,'-',\s*''\)=\$1/);
 assert.doesNotMatch(repository,/resolveUniqueMerchantPaymentWithLockReview/);
});

test('release HOLD: real Paddle event allowlist omits explicit refund and adjustment evidence',()=>{
 const allowlist=within('const ALLOWED_EVENTS=new Set([','const UUID=');
 assert.match(allowlist,/transaction\.completed/);
 assert.doesNotMatch(allowlist,/transaction\.refunded|adjustment\.created|adjustment\.updated/);
 const body=within('async function applyTransaction','async function applySubscriptionAccess');
 assert.match(body,/payment\.status==='refunded'/);
 assert.doesNotMatch(body,/item\.type==='transaction\.refunded'|item\.type==='adjustment\.updated'/);
});

test('release HOLD: source must retain disabled-by-default settlement access flag',async()=>{
 const s=await readFile(new URL('../lib/customer-settlement-proof.mjs',import.meta.url),'utf8');
 assert.match(s,/process\.env\.CUSTOMER_SETTLEMENT_PROOF_ENABLED==="true"/);
 assert.match(live,/process\.env\.CUSTOMER_SETTLEMENT_PROOF_ENABLED==='true'/);
});
