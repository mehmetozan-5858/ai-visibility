import {strictPaddleSubscriptionStateReview} from './portal-paddle-subscription-status-review.mjs';
import {applyOwnedPaddleCancellationReview} from './portal-paddle-cancellation-write-review.mjs';
import {applyOwnedPaddleResumeReview} from './portal-paddle-resume-write-review.mjs';

/**
 * REVIEW ONLY — trusted callback for an already HMAC-authenticated event
 * processed under the pinned per-tenant advisory lock. Never use this
 * callback on unverified request JSON or connect it to the live webhook
 * before payment, refund, role and replay acceptance.
 *
 * One transaction: require an exact tenant-owned payment/subscription
 * link -> advance current provider entity only for strictly newer
 * occurred_at -> apply cancellation or settlement-backed resume -> audit.
 * Reject equal-timestamp conflicting events by treating them as stale.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUB=/^sub_[a-z0-9]+$/i;
const EVENT=/^(?:evt|ntfsimevt)_[a-z0-9]+$/i;

export const UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL=`INSERT INTO public.paddle_live_entities
 (entity_id,event_type,status,payment_id,client_id,occurred_at,event_id)
 SELECT l.subscription_id,$4,$5,l.payment_id,l.client_id,$6::timestamptz,$7
 FROM public.paddle_live_subscription_links l
 JOIN public.payments p ON p.id=l.payment_id AND p.client_id=l.client_id
 WHERE l.client_id=$1::uuid AND l.payment_id=$2::uuid AND l.subscription_id=$3
 ON CONFLICT(entity_id) DO UPDATE
 SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,
     occurred_at=EXCLUDED.occurred_at,event_id=EXCLUDED.event_id,
     updated_at=clock_timestamp()
 WHERE public.paddle_live_entities.client_id=EXCLUDED.client_id
   AND public.paddle_live_entities.payment_id=EXCLUDED.payment_id
   AND public.paddle_live_entities.occurred_at<EXCLUDED.occurred_at
 RETURNING entity_id`;

// Only a verified already-suspended customer may accept a zero-row
// cancellation as idempotent. Every other zero-row outcome must roll back
// the just-advanced provider event so an active account cannot remain open.
export const READ_CANCELLATION_NOOP_ACCOUNT_SQL=`SELECT status FROM public.clients
 WHERE id=$1::uuid FOR UPDATE`;

export async function applyOwnedPaddleSubscriptionTransitionReview(tx,event){
 const state=strictPaddleSubscriptionStateReview(event);
 if(!tx||typeof tx.query!=='function'||!UUID.test(String(event?.clientId))||
   !UUID.test(String(event?.paymentId))||!SUB.test(String(event?.entityId))||
   !EVENT.test(String(event?.id))||!Number.isFinite(Date.parse(event?.occurredAt||''))||
   !['active','payment-review'].includes(state))
  throw Error('review-subscription-transition-invalid');
 const tenant=event.clientId.toLowerCase(),payment=event.paymentId.toLowerCase();
 const changed=await tx.query(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,[
  tenant,payment,event.entityId,event.type,event.status||'',event.occurredAt,event.id
 ]);
 if(changed.rows?.[0]?.entity_id!==event.entityId)
  return {accessChanged:false,staleOrUnlinked:true};
 const result=state==='active'
  ?await applyOwnedPaddleResumeReview(tx,event)
  :await applyOwnedPaddleCancellationReview(tx,event);
 // A signed newer resume arriving BEFORE independently verified payment
 // proof must not permanently consume the event timestamp. A zero-row
 // activation is ambiguous (already active vs absent proof/ownership);
 // reject and roll back the entity advance, so it can be retried after
 // the missing external evidence is verified. This is intentionally
 // conservative until a distinct already-active acceptance is audited.
 if(state==='active'&&result.accessChanged!==true)
  throw Error('review-resume-not-accepted-rollback-current-event');
 if(state==='payment-review'&&result.accessChanged!==true){
  const rows=(await tx.query(READ_CANCELLATION_NOOP_ACCOUNT_SQL,[tenant])).rows;
  if(!Array.isArray(rows)||rows.length!==1||
     rows[0]?.status!=='payment-review')
   throw Error('review-cancellation-unaccepted-rollback-current-event');
 }
 return {...result,entityAdvanced:true};
}
