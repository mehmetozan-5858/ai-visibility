import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditPaddleWebhookLockReview} from '../lib/portal-paddle-webhook-lock-audit-review.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('live webhook completion and subscription writers are explicit advisory-lock release blockers',async()=>{
 const src=await read('lib/paddle-live.js');
 const audit=auditPaddleWebhookLockReview(src);
 assert.equal(audit.ready,false);
 const keys=audit.findings.map(f=>f.code+':'+(f.method||''));
 for(const finding of [
  'webhook-account-writer-unlocked:applyTransaction',
  'webhook-account-writer-unlocked:applySubscriptionAccess',
  'webhook-tenant-lock-missing:',
  'transaction-completion-direct-activation:',
  'subscription-direct-activation:',
  'refund-reversal-event-coverage-unverified:'
 ])assert.ok(keys.includes(finding),'missing BLOCKER: '+finding);
 assert.ok(audit.unresolvedExternal.includes('live-Paddle-and-Neon-E2E'));
});
test('missing source always fails closed',()=>{
 const audit=auditPaddleWebhookLockReview(undefined);
 assert.equal(audit.ready,false);
 assert.deepEqual(audit.findings,[{code:'webhook-source-unavailable'}]);
});
test('even synthetic fully coordinated source cannot alone assert live readiness',()=>{
 const src=`const ALLOWED_EVENTS=new Set(['adjustment.updated']);
const UUID=/uuid/;
async function applyTransaction(){await acquirePilotAdvisoryLockReview(tx,id)}
async function applySubscriptionAccess(){await acquirePilotAdvisoryLockReview(tx,id)}
export async function recordPaddleLiveEvent(){
await tx.query('BEGIN');await acquirePilotAdvisoryLockReview(tx,id);
await applyTransaction(tx,item);
await tx.query('INSERT INTO public.verified_customer_settlements');
}`;
 const result=auditPaddleWebhookLockReview(src);
 assert.equal(result.ready,false);
});
