/**
 * REVIEW ONLY. Not wired to production or exposed to callers.
 * The DB pool must be a trusted server-only entitlement authority, distinct
 * from the low-privilege report reader. Never accept a pool or callback from
 * an HTTP request. This is a preflight, not atomic revocation at DB read-time.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ACTIVE_PILOT_SQL=`SELECT
 EXISTS(SELECT 1 FROM public.clients c WHERE c.id=$1::uuid AND c.status='active') AS "activeClient",
 EXISTS(SELECT 1 FROM public.client_pilot_access p
   WHERE p.client_id=$1::uuid AND p.revoked_at IS NULL AND
   p.expires_at>clock_timestamp()) AS "activePilot"`;
export const SIGNED_SETTLEMENT_SQL=`SELECT EXISTS(
 SELECT 1 FROM public.verified_customer_settlements s
 JOIN public.payments p ON p.id=s.payment_id AND p.client_id=s.client_id
 JOIN public.clients c ON c.id=s.client_id
 WHERE s.client_id=$1::uuid AND c.status='active'
 AND p.status='paid' AND p.method='paddle'
) AS "signedSettlement"`;

/**
 * Enables a fresh, tenant-bound DB-backed preflight used only by the review
 * gateway. No user-provided boolean, tenant override or historical paid label.
 *
 * Real Paddle settlement proof additionally requires signed transaction event
 * ingestion and an independently verified zero-cost test before production.
 */
export function createReviewReportEntitlementAuthority(authorityPool,{allowSignedSettlement=false}={}){
 if(!authorityPool||typeof authorityPool.query!=='function')
  throw Error('review-authority-pool-unavailable');
 return async function verifyReviewEntitlement(tenantId){
  if(typeof tenantId!=='string'||!UUID.test(tenantId))return null;
  try{
   const first=await authorityPool.query(ACTIVE_PILOT_SQL,[tenantId]);
   const row=first.rows?.[0];
   if(row?.activeClient!==true)return null;
   if(row.activePilot===true)
    return {tenantId,active:true,source:'verified-pilot',checkedAt:Date.now()};
   // The missing settlement migration, disabled launch gate, or bad provider
   // ledger must never turn a legacy payment label into verified entitlement.
   if(allowSignedSettlement!==true||process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED!=='true')
    return null;
   const paid=await authorityPool.query(SIGNED_SETTLEMENT_SQL,[tenantId]);
   if(paid.rows?.[0]?.signedSettlement!==true)return null;
   return {tenantId,active:true,source:'signed-paddle-settlement',checkedAt:Date.now()};
  }catch{return null}
 };
}
