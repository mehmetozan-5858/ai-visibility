import {
 transactionPricedAmount,expectedPaddleItemAmount,
 validPaddleCompletionTotals,isPaddleRenewal
} from './paddle-live.js';

/**
 * REVIEW ONLY, UNWIRED. Trusted callback after raw Paddle signature validation
 * and per-tenant transaction advisory lock. Validates a final non-renewal
 * settlement under a payment-row FOR UPDATE, atomically records paid status
 * and immutable signed settlement evidence. DOES NOT activate any account.
 * Refunds, adjustments, old payment writers, and actual provider E2E remain
 * independent HOLD gates. Never pass callback from HTTP input.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXN=/^txn_[a-z0-9]+$/i;
const EVENT=/^(?:evt|ntfsimevt)_[a-z0-9]+$/i;

export const READ_OWNED_PAYMENT_FOR_COMPLETION_SQL=`SELECT
 id,client_id,status,currency,setup_amount,monthly_amount
 FROM public.payments
 WHERE id=$1::uuid AND client_id=$2::uuid FOR UPDATE`;

export const MARK_VERIFIED_PADDLE_PAYMENT_SQL=`UPDATE public.payments
 SET status='paid',method='paddle',paid_at=COALESCE(paid_at,$3::timestamptz)
 WHERE id=$1::uuid AND client_id=$2::uuid
   AND status NOT IN ('paid','refunded')
 RETURNING id,client_id`;

export const INSERT_VERIFIED_PADDLE_PROOF_SQL=`INSERT INTO public.verified_customer_settlements
 (payment_id,client_id,paddle_event_id,transaction_id)
 VALUES($1::uuid,$2::uuid,$3,$4)
 ON CONFLICT DO NOTHING RETURNING payment_id`;

export async function applyOwnedPaddleCompletionReview(tx,event){
 if(!tx||typeof tx.query!=='function'||event?.type!=='transaction.completed'||
    !UUID.test(String(event?.clientId))||!UUID.test(String(event?.paymentId))||
    !TXN.test(String(event?.entityId))||!EVENT.test(String(event?.id))||
    !Number.isFinite(Date.parse(event?.occurredAt||''))||isPaddleRenewal(event))
  throw Error('review-completion-event-invalid');
 const tenant=event.clientId.toLowerCase(),paymentId=event.paymentId.toLowerCase();
 const owned=(await tx.query(READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,
  [paymentId,tenant])).rows?.[0];
 if(!owned||String(owned.client_id).toLowerCase()!==tenant||
   String(owned.id).toLowerCase()!==paymentId)
  throw Error('review-completion-unowned-payment');
 if(owned.status==='paid'||owned.status==='refunded')
  return {paymentChanged:false,reason:'already-paid-or-refunded'};
 const expected=expectedPaddleItemAmount(event,owned);
 const currency=String(event.data?.currency_code||event.data?.currency||'').toUpperCase();
 if(!/^[A-Z]{3}$/.test(currency)||currency!==owned.currency||
    expected===null||transactionPricedAmount(event.data)!==expected||
    !validPaddleCompletionTotals(event.data,expected,currency))
  throw Error('review-completion-pricing-unverified');
 const updated=(await tx.query(MARK_VERIFIED_PADDLE_PAYMENT_SQL,
  [paymentId,tenant,event.occurredAt])).rows?.[0];
 if(!updated||String(updated.client_id).toLowerCase()!==tenant)
  throw Error('review-completion-payment-update-conflict');
 const proof=(await tx.query(INSERT_VERIFIED_PADDLE_PROOF_SQL,
  [paymentId,tenant,event.id,event.entityId])).rows?.[0];
 if(!proof||String(proof.payment_id).toLowerCase()!==paymentId)
  throw Error('review-completion-settlement-proof-conflict');
 // Explicitly leave clients.status unchanged. Activation is a separate
 // current-subscription-and-settlement conditional acceptance gate.
 return {paymentChanged:true,settlementRecorded:true,accountActivated:false};
}
