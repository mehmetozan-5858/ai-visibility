import {randomUUID} from 'node:crypto';
import {withPilotWriteLockReview} from './portal-pilot-advisory-lock-review.mjs';

/**
 * REVIEW ONLY — NOT WIRED TO PRODUCTION ROUTES.
 * Two trusted server-side pilot write operations share the exact same
 * transaction-scoped advisory lock as the separate report SQL candidate.
 * The transaction helper owns BEGIN/COMMIT/ROLLBACK and connection release.
 * Never allow request input to supply the DB pool or a write callback.
 *
 * IMPORTANT: account suspension, deletion, expiry editing, manual SQL and
 * other writers must also participate before any concurrency GO decision.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function grantPilotWithLockReview(pool,clientId,email,days,reason){
 if(!UUID.test(String(clientId))||!EMAIL.test(String(email))||
  !Number.isInteger(days)||days<1||days>30||
  typeof reason!=='string'||reason.length<10)
  throw Error('review-pilot-grant-invalid');
 return withPilotWriteLockReview(pool,clientId,async(tx,tenant)=>{
  await tx.query(`INSERT INTO public.client_pilot_access
   (client_id,email,reason,expires_at)
   VALUES($1,$2,$3,clock_timestamp()+($4 * INTERVAL '1 day'))
   ON CONFLICT(client_id) DO UPDATE SET email=EXCLUDED.email,
    reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,
   [tenant,email.toLowerCase(),reason,days]);
  await tx.query(`INSERT INTO public.client_activity
    (id,client_id,event_type,title,detail,metadata)
    VALUES($1,$2,'pilot-granted','Ücretsiz analiz pilotu açıldı',$3,$4::jsonb)`,
   [randomUUID(),tenant,reason,JSON.stringify({days,scope:'diagnosis-report',noPayment:true})]);
  return {granted:true};
 });
}

export async function revokePilotWithLockReview(pool,clientId){
 if(!UUID.test(String(clientId)))throw Error('review-pilot-revoke-invalid');
 return withPilotWriteLockReview(pool,clientId,async(tx,tenant)=>{
  const result=await tx.query(`UPDATE public.client_pilot_access
   SET revoked_at=clock_timestamp()
   WHERE client_id=$1 AND revoked_at IS NULL
   RETURNING expires_at`,[tenant]);
  const row=result.rows?.[0];
  if(row){
   await tx.query(`INSERT INTO public.client_activity
    (id,client_id,event_type,title,detail,metadata)
    VALUES($1,$2,'pilot-revoked','Ücretsiz analiz pilotu kapatıldı',
    'Yönetici pilot erişimini kaldırdı.',$3::jsonb)`,
    [randomUUID(),tenant,JSON.stringify({
     scope:'diagnosis-report',noPayment:true,previousExpiresAt:row.expires_at
    })]);
  }
  return {revoked:Boolean(row)};
 });
}
