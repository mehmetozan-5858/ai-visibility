import {randomUUID} from 'node:crypto';
import {strictPaddleSubscriptionStateReview} from './portal-paddle-subscription-status-review.mjs';

/**
 * REVIEW ONLY — trusted callback for the UNWIRED signed and locked dispatcher.
 * Never call directly from HTTP. Caller must verify Paddle signature and
 * start the pinned tenant-locked transaction beforehand.
 *
 * This checks exact subscription/payment/tenant ownership and atomically
 * suspends customer access, with an audit in the SAME transaction. It does
 * not implement upstream event ordering writes or adjustment/refund semantics:
 * those are independent release blockers.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUB=/^sub_[a-z0-9]+$/i;
const EVENT=/^(?:evt|ntfsimevt)_[a-z0-9]+$/i;

export const CANCEL_OWNED_ACCESS_SQL=`UPDATE public.clients c
 SET status='payment-review'
 WHERE c.id=$1::uuid AND c.status IS DISTINCT FROM 'payment-review'
 AND EXISTS(
   SELECT 1 FROM public.paddle_live_subscription_links l
   JOIN public.payments p ON p.id=l.payment_id AND p.client_id=l.client_id
   JOIN public.paddle_live_entities e ON e.entity_id=l.subscription_id
     AND e.client_id=l.client_id AND e.payment_id=l.payment_id
   WHERE l.client_id=c.id AND l.payment_id=$2::uuid AND l.subscription_id=$3
     AND e.event_id=$4 AND e.occurred_at=$5::timestamptz
     AND (
       e.event_type IN ('subscription.paused','subscription.canceled','subscription.past_due')
       OR (e.event_type='subscription.updated'
         AND e.status IN ('paused','canceled','past_due'))
     )
 )
 RETURNING c.id`;

export const AUDIT_CANCELLATION_SQL=`INSERT INTO public.client_activity
 (id,client_id,event_type,title,detail,metadata)
 VALUES($1,$2,'payment','Paddle abonelik erişimi askıya alındı',
 'Doğrulanmış abonelik durumu nedeniyle müşteri erişimi kapatıldı.',$3::jsonb)`;

export async function applyOwnedPaddleCancellationReview(tx,event){
 if(!tx||typeof tx.query!=='function'||!UUID.test(String(event?.clientId))||
  !UUID.test(String(event?.paymentId))||!SUB.test(String(event?.entityId))||
  !EVENT.test(String(event?.id))||!Number.isFinite(Date.parse(event?.occurredAt||''))||
  strictPaddleSubscriptionStateReview(event)!=='payment-review')
  throw Error('review-cancellation-invalid-or-unsupported');
 const tenant=event.clientId.toLowerCase(),payment=event.paymentId.toLowerCase();
 const changed=await tx.query(CANCEL_OWNED_ACCESS_SQL,[tenant,payment,event.entityId,event.id,event.occurredAt]);
 const row=changed.rows?.[0];
 if(!row)return {accessChanged:false};
 if(row.id!==tenant)throw Error('review-cancellation-tenant-mismatch');
 await tx.query(AUDIT_CANCELLATION_SQL,[
  randomUUID(),tenant,JSON.stringify({
   source:'signed-paddle-review',subscriptionId:event.entityId,
   reason:event.type,eventId:event.id||null,noPayment:true
  })
 ]);
 return {accessChanged:true,clientStatus:'payment-review'};
}
