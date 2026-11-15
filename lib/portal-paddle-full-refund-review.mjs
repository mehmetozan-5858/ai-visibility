import {classifyPaddleAdjustmentReview} from './portal-paddle-adjustment-classifier-review.mjs';
import {acquirePilotAdvisoryLockReview} from './portal-pilot-advisory-lock-review.mjs';
import {claimMerchantEventOnceReview} from './portal-merchant-event-claim-review.mjs';

// REVIEW ONLY: never wire this to live Paddle or production data without
// authenticated raw-webhook verification, exact refund amount/currency,
// refund completion evidence, independently reviewed ownership mappings,
// durable settlement reversal and complete audit/rollout authorization.
// The passed verifier is a trusted SERVER function, not HTTP supplied.
// No refund data by itself can grant an entitlement.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCH=`SELECT DISTINCT p.id AS "paymentId",p.client_id AS "tenantId"
 FROM public.payments p
 JOIN public.paddle_live_events e ON e.payment_id=p.id AND e.client_id=p.client_id
 WHERE e.entity_id=$1 AND e.event_type='transaction.completed'
 ORDER BY p.id LIMIT 2`;
function sole(rows){
 if(!Array.isArray(rows)||rows.length!==1||
  !UUID.test(String(rows[0]?.paymentId||''))||
  !UUID.test(String(rows[0]?.tenantId||'')))throw Error('refund-ownership-not-unique');
 return {paymentId:rows[0].paymentId.toLowerCase(),tenantId:rows[0].tenantId.toLowerCase()};
}
export async function reviewApprovedFullPaddleRefund(pool,event,trustedVerify){
 if(!pool||typeof pool.connect!=='function'||typeof trustedVerify!=='function')
  throw Error('refund-review-verifier-unavailable');
 const classification=classifyPaddleAdjustmentReview(event);
 if(classification.decision!=='verified-refund-needs-ownership')
  throw Error('refund-review-unaccepted-adjustment');
 // No connection acquired until independent authenticated proof is checked.
 const verified=await trustedVerify(event);
 if(!verified||verified.authenticated!==true||
  verified.refundFinal===false||verified.fullRefundMatched!==true||
  verified.currencyMatched!==true||
  verified.eventId!==event.event_id||
  verified.adjustmentId!==event.data.id||
  verified.transactionId!==event.data.transaction_id)
  throw Error('refund-review-proof-denied');
 // refundFinal must be affirmative, not omitted; no accepting inferred success.
 if(verified.refundFinal!==true)throw Error('refund-review-proof-denied');
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();throw Error('refund-review-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  const first=sole((await tx.query(MATCH,[event.data.transaction_id])).rows);
  await acquirePilotAdvisoryLockReview(tx,first.tenantId);
  const second=sole((await tx.query(MATCH,[event.data.transaction_id])).rows);
  if(first.paymentId!==second.paymentId||first.tenantId!==second.tenantId)
   throw Error('refund-ownership-changed');
  await claimMerchantEventOnceReview(tx,{
   provider:'paddle',eventId:event.event_id,
   paymentId:first.paymentId,tenantId:first.tenantId
  });
  const updated=(await tx.query(`UPDATE public.payments SET status='refunded'
   WHERE id=$1::uuid AND client_id=$2::uuid AND status='paid'
   RETURNING id,client_id`,[first.paymentId,first.tenantId])).rows;
  if(!Array.isArray(updated)||updated.length!==1)
   throw Error('refund-review-payment-not-paid');
  // Conservative multi-payment rule: do not suspend an entire tenant if
  // another paid payment is still present. This is NOT full entitlement
  // reconciliation; subscription and settlement linkage need separate proof.
  const other=(await tx.query(`SELECT id FROM public.payments
   WHERE client_id=$1::uuid AND id<>$2::uuid AND status='paid'
   LIMIT 1`,[first.tenantId,first.paymentId])).rows;
  if(!Array.isArray(other))throw Error('refund-other-payment-unknown');
  if(other.length===0){
   await tx.query(`UPDATE public.clients SET status='payment-review'
    WHERE id=$1::uuid AND status IS DISTINCT FROM 'payment-review'`,[first.tenantId]);
  }
  await tx.query('COMMIT');begun=false;
  return {paymentId:first.paymentId,tenantId:first.tenantId,reviewOnly:true};
 }catch(e){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw e;
 }finally{tx.release()}
}
