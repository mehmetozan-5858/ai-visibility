import {acquirePilotAdvisoryLockReview} from './portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY: not wired into existing payment or customer routes.
// The trusted server chooses the lookup and mutation callback; neither a
// customer-provided tenant ID nor a database pool from HTTP input is accepted.
// NO mutation may occur before the shared tenant advisory lock is acquired.
// All other account / entitlement writers must adopt this same protocol.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function lookup(selector){
 if(!selector||typeof selector!=='object'||Array.isArray(selector))throw Error('payment-lock-selector-invalid');
 const keys=Object.keys(selector);
 if(keys.length!==1)throw Error('payment-lock-selector-invalid');
 if(keys[0]==='paymentId'&&typeof selector.paymentId==='string'&&UUID.test(selector.paymentId))
  return {sql:'SELECT client_id FROM public.payments WHERE id=$1',value:selector.paymentId};
 if(keys[0]==='merchantOid'&&typeof selector.merchantOid==='string'&&
    /^[a-zA-Z0-9_]{8,128}$/.test(selector.merchantOid))
  return {sql:"SELECT client_id FROM public.payments WHERE replace(reference_code,'-','')=$1",value:selector.merchantOid};
 throw Error('payment-lock-selector-invalid');
}
export async function withPaymentAccountLockReview(pool,selector,update){
 if(!pool||typeof pool.connect!=='function'||typeof update!=='function')
  throw Error('payment-lock-unavailable');
 const selected=lookup(selector);
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();
  throw Error('payment-lock-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  // Read only, not FOR UPDATE: avoid row-lock-before-tenant-lock deadlocks.
  const initial=(await tx.query(selected.sql,[selected.value])).rows||[];
  if(initial.length!==1||!UUID.test(String(initial[0].client_id||'')))
   throw Error('payment-lock-tenant-unverified');
  const tenant=await acquirePilotAdvisoryLockReview(tx,initial[0].client_id);
  // Fresh READ COMMITTED snapshot while holding shared account lock.
  const confirmed=(await tx.query(selected.sql,[selected.value])).rows||[];
  if(confirmed.length!==1||String(confirmed[0].client_id).toLowerCase()!==tenant)
   throw Error('payment-lock-tenant-changed');
  const result=await update(tx,tenant,selected.value);
  await tx.query('COMMIT');begun=false;
  return result;
 }catch(error){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{tx.release()}
}
