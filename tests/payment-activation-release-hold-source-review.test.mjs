import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: fail-closed negative acceptance of the currently deployed-style
// legacy payment writers. Passing these tests means blockers remain visible,
// NOT that payment routes, signatures, or customer entitlement are accepted.
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
function method(source,name,next){
 const start=source.indexOf('export async function '+name+'(');
 const end=source.indexOf('export async function '+next+'(',start);
 assert.ok(start>=0&&end>start,'expected '+name+' boundary');
 return source.slice(start,end);
}
test('bank-confirmation transaction cannot masquerade as lock-coordinated signed settlement',async()=>{
 const src=await read('lib/repository.js');
 const bank=method(src,'confirmPayment','upsertSalesOpportunity');
 assert.match(bank,/await tx\.query\("BEGIN"\)/);
 assert.match(bank,/UPDATE clients SET plan=\$2,status='active'/);
 assert.doesNotMatch(bank,/withPilotWriteLockReview|acquirePilotAdvisoryLockReview|pg_advisory_xact_lock/);
 // Bank evidence is distinct from provider-signed Paddle settlement.
 assert.doesNotMatch(bank,/verified_customer_settlements|verifyPaddleSignature/);
});
test('legacy card update is non-atomic and not linked to signed proof',async()=>{
 const src=await read('lib/repository.js');
 const card=method(src,'confirmCardPaymentByMerchantOid','markCardPaymentFailedByMerchantOid');
 assert.match(card,/pool\.query\([\s\S]*UPDATE payments/);
 assert.match(card,/pool\.query\("UPDATE clients SET plan=/);
 assert.doesNotMatch(card,/BEGIN|withPilotWriteLockReview|verified_customer_settlements/);
});
test('isolated card transaction cannot establish verified Paddle entitlement',async()=>{
 const [card,strict,repository]=await Promise.all([
  read('lib/portal-card-activation-transaction-review.mjs'),
  read('lib/portal-verified-account-activation-review.mjs'),
  read('lib/repository.js')
 ]);
 assert.match(card,/REVIEW ONLY/);
 assert.match(card,/withPilotWriteLockReview/);
 assert.doesNotMatch(card,/VERIFIED_PADDLE_SETTLEMENT_SQL|verified_customer_settlements/);
 assert.match(strict,/VERIFIED_PADDLE_SETTLEMENT_SQL/);
 assert.match(strict,/p\.method='paddle'/);
 assert.doesNotMatch(repository,/activateVerifiedPaddleAccountReview|confirmCardPaymentLockedReview/);
});
