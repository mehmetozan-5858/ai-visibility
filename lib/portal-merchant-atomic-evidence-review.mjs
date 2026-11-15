import {resolveUniqueMerchantPaymentWithLockReview,updateSingleMerchantPaymentReview}
 from './portal-merchant-reference-uniqueness-review.mjs';
import {claimMerchantEventOnceReview} from './portal-merchant-event-claim-review.mjs';

// REVIEW ONLY. Not wired to callbacks, customer routes, Paddle or PayTR.
// Trusted server-side verifier MUST independently authenticate provider raw
// signed event AND validate the exact invoice amount, currency, reference,
// event type and webhook tolerance window. This module does NOT do that.
// The verifier is injected by the server only, NEVER by the HTTP caller.
// Provider verification must finish before any database connection is used.
// A successful synthetic review does not prove settled money or entitlement.
const OID=/^[a-zA-Z0-9_]{8,128}$/;
const EVENT=/^[a-zA-Z0-9_.:-]{8,160}$/;
const PROVIDER=/^[a-z][a-z0-9_]{1,31}$/;
export async function withVerifiedMerchantPaymentTransactionReview(
 pool,merchantOid,rawEvent,verifyAuthenticProviderEvent){
 if(!pool||typeof pool.connect!=='function'||
    typeof verifyAuthenticProviderEvent!=='function'||
    typeof merchantOid!=='string'||!OID.test(merchantOid)||
    !rawEvent||typeof rawEvent!=='object'||Array.isArray(rawEvent))
  throw Error('merchant-transaction-unavailable');
 const proof=await verifyAuthenticProviderEvent(rawEvent);
 if(!proof||proof.authenticated!==true||proof.amountMatched!==true||
    proof.currencyMatched!==true||proof.eventNotReplayed!==true||
    proof.reference!==merchantOid||
    typeof proof.provider!=='string'||!PROVIDER.test(proof.provider)||
    typeof proof.eventId!=='string'||!EVENT.test(proof.eventId))
  throw Error('merchant-transaction-proof-denied');
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();throw Error('merchant-transaction-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  // This function owns the pinned transaction. Resolve tenant only from DB,
  // acquire tenant advisory lock, re-check the exact payment.
  const resolved=await resolveUniqueMerchantPaymentWithLockReview(tx,merchantOid);
  // Claim and transition share one commit boundary. Any denial rolls back
  // both, so a transient SQL failure never consumes an event permanently.
  await claimMerchantEventOnceReview(tx,{
   provider:proof.provider,eventId:proof.eventId,
   paymentId:resolved.paymentId,tenantId:resolved.tenantId
  });
  const row=await updateSingleMerchantPaymentReview(tx,resolved);
  await tx.query('COMMIT');begun=false;
  return {paymentId:row.id,tenantId:row.clientId,reviewOnly:true};
 }catch(error){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{tx.release()}
}
