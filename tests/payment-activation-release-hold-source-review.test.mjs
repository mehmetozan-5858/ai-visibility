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
test('bank confirmation uses tenant lock but is not provider-signed Paddle settlement',async()=>{
 const src=await read('lib/repository.js');
 const bank=method(src,'confirmPayment','upsertSalesOpportunity');
 assert.match(bank,/BEGIN ISOLATION LEVEL READ COMMITTED/);
 assert.match(bank,/acquirePilotAdvisoryLockReview\(tx,bound\.clientId\)/);
 assert.match(bank,/UPDATE clients SET plan=\$2,status='active'/);
 assert.doesNotMatch(bank,/verified_customer_settlements|verifyPaddleSignature/);
});
test('card activation is atomic and tenant-locked but lacks signed Paddle settlement',async()=>{
 const src=await read('lib/repository.js');
 const card=method(src,'confirmCardPaymentByMerchantOid','markCardPaymentFailedByMerchantOid');
 assert.match(card,/BEGIN ISOLATION LEVEL READ COMMITTED/);
 assert.match(card,/acquirePilotAdvisoryLockReview\(tx,bound\.clientId\)/);
 assert.match(card,/UPDATE payments SET status='paid'/);
 assert.match(card,/UPDATE clients SET plan=\$2,status='active'/);
 assert.match(card,/await tx\.query\("ROLLBACK"\)/);
 assert.doesNotMatch(card,/pool\.query\("UPDATE clients SET|verified_customer_settlements|verifyPaddleSignature/);
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
