import {withPilotWriteLockReview} from './portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. Not wired into payment endpoints, checkout or production.
// Resolve the tenant before locking, then recheck the exact payment inside the
// SAME pinned READ COMMITTED transaction after taking its advisory tenant lock.
// This coordinates with cooperative pilot writers; it does NOT establish
// independent Paddle settlement or paid access authorization.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OID=/^[a-z0-9]{8,128}$/i;

export async function confirmCardPaymentLockedReview(pool,merchantOid){
 if(!pool||typeof pool.query!=='function'||!OID.test(String(merchantOid||'')))
  throw Error('review-card-confirmation-invalid');
 // A non-locking lookup precedes the tenant lock, avoiding reversed lock order.
 // Refuse ambiguous merchant OIDs rather than activating multiple accounts.
 const found=(await pool.query(
  "SELECT id,client_id AS \"clientId\" FROM public.payments WHERE replace(reference_code,'-','')=$1 LIMIT 2",
  [merchantOid])).rows;
 if(!Array.isArray(found)||found.length!==1||!UUID.test(String(found[0].clientId))||
  !UUID.test(String(found[0].id)))throw Error('review-card-payment-unresolved');
 const {id,clientId}=found[0];
 return withPilotWriteLockReview(pool,clientId,async(tx,tenant)=>{
  // Guard against changes between lookup and lock; no payment write happens
  // until both IDs and the current eligibility are rechecked in this tx.
  const payment=(await tx.query(
   `UPDATE public.payments SET status='paid',method='card',
      paid_at=COALESCE(paid_at,NOW())
      WHERE id=$1 AND client_id=$2
       AND replace(reference_code,'-','')=$3
       AND status<>'paid'
      RETURNING id,client_id AS "clientId",reference_code AS "referenceCode",
       method,status,plan,currency,setup_amount AS "setupAmount",
       monthly_amount AS "monthlyAmount",created_at AS "createdAt",
       reported_at AS "reportedAt",paid_at AS "paidAt"`,
   [id,tenant,merchantOid])).rows?.[0];
  if(payment){
   const changed=await tx.query(
    "UPDATE public.clients SET plan=$2,status='active' WHERE id=$1 RETURNING id",
    [tenant,payment.plan]);
   if(changed.rows?.length!==1)throw Error('review-card-client-unavailable');
   return payment;
  }
  // Existing paid rows remain a read-only idempotent result, not a new grant.
  const current=(await tx.query(
   `SELECT id,client_id AS "clientId",reference_code AS "referenceCode",
    method,status,plan,currency,setup_amount AS "setupAmount",
    monthly_amount AS "monthlyAmount",created_at AS "createdAt",
    reported_at AS "reportedAt",paid_at AS "paidAt"
    FROM public.payments WHERE id=$1 AND client_id=$2
      AND replace(reference_code,'-','')=$3`,
   [id,tenant,merchantOid])).rows?.[0];
  if(!current)throw Error('review-card-payment-changed');
  return current;
 });
}
