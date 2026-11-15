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
