import {randomUUID} from 'node:crypto';
import {subscriptionAccessState} from './paddle-live.js';

/**
 * REVIEW ONLY — UNWIRED callback for an already verified signed event
 * and an already acquired pinned tenant advisory transaction lock.
 * Current subscription event and tenant-owned payment must match, and
 * independent verified settlement evidence must still exist in the same
 * conditional account UPDATE. Historical paid labels cannot restore access.
 *
 * No replacement for audited webhook event ordering, refund/adjustment
 * processing or a real production acceptance test.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUB=/^sub_[a-z0-9]+$/i;
const EVENT=/^(?:evt|ntfsimevt)_[a-z0-9]+$/i;

export const RESUME_OWNED_ACCESS_SQL=`UPDATE public.clients c
 SET status='active'
 WHERE c.id=$1::uuid AND c.status='payment-review'
 AND EXISTS(
   SELECT 1 FROM public.paddle_live_subscription_links l
   JOIN public.payments p ON p.id=l.payment_id AND p.client_id=l.client_id
   JOIN public.verified_customer_settlements s ON s.payment_id=p.id AND s.client_id=p.client_id
   JOIN public.paddle_live_entities e ON e.entity_id=l.subscription_id
     AND e.client_id=l.client_id AND e.payment_id=l.payment_id
   WHERE l.client_id=c.id AND l.payment_id=$2::uuid AND l.subscription_id=$3
     AND e.event_id=$4 AND e.occurred_at=$5::timestamptz
     AND (
       e.event_type IN ('subscription.activated','subscription.resumed')
       OR (e.event_type='subscription.updated' AND e.status='active')
     )
     AND p.status='paid' AND p.method='paddle'
 )
 RETURNING c.id`;

export const AUDIT_RESUME_SQL=`INSERT INTO public.client_activity
 (id,client_id,event_type,title,detail,metadata)
 VALUES($1,$2,'payment','Paddle abonelik erişimi doğrulandı',
 'Doğrulanmış güncel abonelik ve ödeme kanıtıyla müşteri erişimi açıldı.',$3::jsonb)`;

export async function applyOwnedPaddleResumeReview(tx,event){
 if(!tx||typeof tx.query!=='function'||!UUID.test(String(event?.clientId))||
   !UUID.test(String(event?.paymentId))||!SUB.test(String(event?.entityId))||
   !EVENT.test(String(event?.id))||!Number.isFinite(Date.parse(event?.occurredAt||''))||
   subscriptionAccessState(event)!=='active')
  throw Error('review-resume-invalid-or-unsupported');
 const tenant=event.clientId.toLowerCase(),payment=event.paymentId.toLowerCase();
 const result=await tx.query(RESUME_OWNED_ACCESS_SQL,
  [tenant,payment,event.entityId,event.id,event.occurredAt]);
 const row=result.rows?.[0];
 if(!row)return {accessChanged:false};
 if(row.id!==tenant)throw Error('review-resume-tenant-mismatch');
 await tx.query(AUDIT_RESUME_SQL,[randomUUID(),tenant,JSON.stringify({
  source:'signed-paddle-review',subscriptionId:event.entityId,
  reason:event.type,eventId:event.id,noPayment:true
 })]);
 return {accessChanged:true,clientStatus:'active'};
}
