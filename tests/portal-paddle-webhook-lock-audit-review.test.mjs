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
  'transaction-completion-direct-activation:',
  'subscription-direct-activation:',
  'refund-reversal-event-coverage-unverified:'
 ])assert.ok(keys.includes(finding),'missing BLOCKER: '+finding);
 assert.equal(keys.some(x=>x.startsWith('webhook-tenant-lock-missing:')),false,
  'linked Paddle writer must join the tenant advisory lock');
 assert.equal(keys.some(x=>x.startsWith('webhook-account-writer-unlocked:')),false,
  'transaction-scoped lock applies to both private account writers');
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

test('full webhook handler body is scanned; transaction without tenant lock remains blocked',()=>{
 const source=`const ALLOWED_EVENTS=new Set(['transaction.completed']);
const UUID=/uuid/;
async function applyTransaction(){await tx.query("UPDATE clients SET status='active'")}
async function applySubscriptionAccess(){await tx.query("UPDATE clients SET status='payment-review'")}
export async function recordPaddleLiveEvent(event){
 const tx=await pool.connect();
 await tx.query('BEGIN');
 await applyTransaction(tx,event);
 await tx.query('COMMIT');
}`;
 const audit=auditPaddleWebhookLockReview(source);
 assert.ok(audit.findings.some(f=>f.code==='webhook-tenant-lock-missing'),
  'missing lock in the full body of recordPaddleLiveEvent must not be lost');
});

test('live webhook lock must be tenant-bound before event insert and payment row locks',async()=>{
 const src=await read('lib/paddle-live.js');
 const audit=auditPaddleWebhookLockReview(src);
 assert.equal(audit.ready,false,'source review must never promote production');
 assert.equal(audit.findings.some(f=>f.code==='webhook-tenant-lock-missing'),false);
 const noLock=auditPaddleWebhookLockReview(src.replace(
  'await acquirePilotAdvisoryLockReview(tx,item.clientId);',
  '/* removed tenant lock */'));
 assert.ok(noLock.findings.some(f=>f.code==='webhook-tenant-lock-missing'));
 const inverted=auditPaddleWebhookLockReview(src.replace(
  'await acquirePilotAdvisoryLockReview(tx,item.clientId);','')
  .replace('const paymentResult=item.type.startsWith',
   'await acquirePilotAdvisoryLockReview(tx,item.clientId);\n    const paymentResult=item.type.startsWith'));
 assert.ok(inverted.findings.some(f=>f.code==='webhook-tenant-lock-missing'),
  'locking after event insert and payment row lock must be rejected');
 const unbound=auditPaddleWebhookLockReview(src.replace(
  'UUID.test(item.clientId)&&UUID.test(item.paymentId)',
  'UUID.test(item.clientId)'));
 assert.ok(unbound.findings.some(f=>f.code==='webhook-tenant-lock-missing'));
});
