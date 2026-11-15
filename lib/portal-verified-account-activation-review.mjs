import {withPilotWriteLockReview} from './portal-pilot-advisory-lock-review.mjs';

/**
 * REVIEW ONLY — NOT WIRED TO EXISTING PAYMENT ROUTES.
 * Strict post-settlement activation design; never converts an old 'paid'
 * label, a bank transfer or a client-supplied boolean into entitlement.
 * The proof is verified INSIDE the same pinned transaction, after taking
 * the same cooperative tenant lock used by pilot grant/revoke.
 *
 * This DOES NOT secure legacy confirmPayment/confirmCardPayment... writers,
 * direct admin SQL or webhook account mutations until all are coordinated.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const VERIFIED_PADDLE_SETTLEMENT_SQL=`SELECT
 EXISTS(
  SELECT 1 FROM public.verified_customer_settlements s
  JOIN public.payments p ON p.id=s.payment_id AND p.client_id=s.client_id
  WHERE s.client_id=$1::uuid AND p.status='paid' AND p.method='paddle'
 ) AS "verifiedSettlement"`;

export const LOCKED_ACCOUNT_ACTIVATION_SQL=`UPDATE public.clients
 SET status='active'
 WHERE id=$1::uuid AND status='payment-review'
 RETURNING id`;

export async function activateVerifiedPaddleAccountReview(pool,tenantId){
 if(typeof tenantId!=='string'||!UUID.test(tenantId))
  throw Error('review-activation-tenant-invalid');
 // The independent settlement registry must itself be populated only by
 // audited signed Paddle webhook processing; that is a separate HOLD gate.
 return withPilotWriteLockReview(pool,tenantId,async(tx,tenant)=>{
  const proof=await tx.query(VERIFIED_PADDLE_SETTLEMENT_SQL,[tenant]);
  if(proof.rows?.[0]?.verifiedSettlement!==true)
   throw Error('review-activation-independent-settlement-required');
  const updated=await tx.query(LOCKED_ACCOUNT_ACTIVATION_SQL,[tenant]);
  return {activated:updated.rows?.[0]?.id===tenant};
 });
}
