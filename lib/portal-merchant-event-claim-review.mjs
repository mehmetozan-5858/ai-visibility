// REVIEW ONLY: must run inside the same pinned transaction AFTER trusted
// provider verification + tenant advisory lock, BEFORE payment mutation.
// A duplicate event must abort the caller's whole transaction. This does not
// verify signatures, amounts, currency, refund semantics or provider source.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER=/^[a-z][a-z0-9_]{1,31}$/;
const EVENT=/^[a-zA-Z0-9_.:-]{8,160}$/;
export async function claimMerchantEventOnceReview(tx,{provider,eventId,paymentId,tenantId}={}){
 if(!tx||typeof tx.query!=='function'||typeof provider!=='string'||!PROVIDER.test(provider)||
  typeof eventId!=='string'||!EVENT.test(eventId)||
  typeof paymentId!=='string'||!UUID.test(paymentId)||
  typeof tenantId!=='string'||!UUID.test(tenantId))
  throw Error('merchant-event-claim-invalid');
 const result=await tx.query(`INSERT INTO public.portal_merchant_event_claims_review
  (provider,event_id,payment_id,tenant_id) VALUES($1,$2,$3::uuid,$4::uuid)
  ON CONFLICT(provider,event_id) DO NOTHING
  RETURNING event_id`,
  [provider,eventId,paymentId.toLowerCase(),tenantId.toLowerCase()]);
 if(result?.rows?.length!==1||result.rows[0].event_id!==eventId)
  throw Error('merchant-event-already-claimed');
 return {claimed:true};
}
