import {acquirePilotAdvisoryLockReview} from './portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. This is not a replacement for a database-enforced unique
// normalized merchant reference, independently verified signed settlement,
// or the production PayTR/Paddle callback acceptance flow.
// Call only on a trusted pinned READ COMMITTED transaction already in BEGIN.
// The merchant reference comes from verified server-side callback processing.
// Do not permit an HTTP caller to inject SQL, tx or arbitrary tenant IDs.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OID=/^[a-zA-Z0-9_]{8,128}$/;
const UNIQUE_MATCH_SQL=`SELECT id,client_id AS "clientId"
 FROM public.payments WHERE replace(reference_code,'-','')=$1
 ORDER BY id LIMIT 2`;

function soleMatch(rows){
 if(!Array.isArray(rows)||rows.length!==1||
    !UUID.test(String(rows[0]?.id||''))||
    !UUID.test(String(rows[0]?.clientId||'')))
  throw Error('merchant-reference-not-unique');
 return {id:rows[0].id.toLowerCase(),tenant:rows[0].clientId.toLowerCase()};
}
export async function resolveUniqueMerchantPaymentWithLockReview(tx,merchantOid){
 if(!tx||typeof tx.query!=='function'||typeof merchantOid!=='string'||!OID.test(merchantOid))
  throw Error('merchant-reference-unverified');
 // LIMIT 2 deliberately fails closed if two different raw reference codes
 // normalize to the same identifier. Never use rows[0] without this check.
 const first=soleMatch((await tx.query(UNIQUE_MATCH_SQL,[merchantOid])).rows);
 await acquirePilotAdvisoryLockReview(tx,first.tenant);
 // Recheck under the tenant lock. Resolve only a single stable payment id.
 const second=soleMatch((await tx.query(UNIQUE_MATCH_SQL,[merchantOid])).rows);
 if(second.id!==first.id||second.tenant!==first.tenant)
  throw Error('merchant-reference-changed');
 return {paymentId:first.id,tenantId:first.tenant};
}


/**
 * REVIEW ONLY: A resolved id+tenant is necessary but not sufficient to
 * confirm money or grant an entitlement. Caller MUST verify the signed
 * provider event, amount/currency, idempotence, and its trusted event source
 * independently before using this in a disposable acceptance test.
 * Caller owns BEGIN/COMMIT/ROLLBACK and the previously acquired tenant lock.
 */
export async function updateSingleMerchantPaymentReview(tx,resolved){
 if(!tx||typeof tx.query!=='function'||!resolved||typeof resolved!=='object'||
    !UUID.test(String(resolved.paymentId||''))||
    !UUID.test(String(resolved.tenantId||'')))
  throw Error('merchant-payment-update-unverified');
 const result=await tx.query(
  `UPDATE public.payments
   SET status='paid',method='card',paid_at=COALESCE(paid_at,clock_timestamp())
   WHERE id=$1::uuid AND client_id=$2::uuid AND status='pending'
   RETURNING id,client_id AS "clientId",status`,
  [resolved.paymentId.toLowerCase(),resolved.tenantId.toLowerCase()]);
 if(!Array.isArray(result?.rows)||result.rows.length!==1||
    String(result.rows[0].id).toLowerCase()!==resolved.paymentId.toLowerCase()||
    String(result.rows[0].clientId).toLowerCase()!==resolved.tenantId.toLowerCase()||
    result.rows[0].status!=='paid')
  throw Error('merchant-payment-not-transitioned');
 return result.rows[0];
}
