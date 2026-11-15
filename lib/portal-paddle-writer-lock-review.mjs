import {acquirePilotAdvisoryLockReview} from './portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. NOT wired to the real Paddle webhook.
// Must be invoked exclusively after authenticating the exact raw Paddle
// signature and independently validating event/amount/currency policy.
// Server resolves the tenant by payment UUID from its OWN database, not from
// callback client_id. Acquire shared tenant lock BEFORE any FOR UPDATE or
// payment/account mutation to avoid inversion with signed-report RPC.
// Caller-supplied callback is trusted server internal logic only, never HTTP.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOOKUP='SELECT client_id FROM public.payments WHERE id=$1::uuid';
export async function withPaddleEntitlementWriterLockReview(pool,paymentId,work){
 if(!pool||typeof pool.connect!=='function'||typeof work!=='function'||
    typeof paymentId!=='string'||!UUID.test(paymentId))
  throw Error('paddle-review-writer-invalid');
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();throw Error('paddle-review-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  // Never take row locks before the shared tenant advisory lock.
  const initial=(await tx.query(LOOKUP,[paymentId])).rows||[];
  if(initial.length!==1||typeof initial[0].client_id!=='string'||!UUID.test(initial[0].client_id))
   throw Error('paddle-review-tenant-missing');
  const tenant=await acquirePilotAdvisoryLockReview(tx,initial[0].client_id);
  const confirmed=(await tx.query(LOOKUP,[paymentId])).rows||[];
  if(confirmed.length!==1||String(confirmed[0].client_id).toLowerCase()!==tenant)
   throw Error('paddle-review-tenant-changed');
  const result=await work(tx,{paymentId:paymentId.toLowerCase(),tenantId:tenant});
  await tx.query('COMMIT');begun=false;
  return result;
 }catch(error){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{tx.release()}
}
