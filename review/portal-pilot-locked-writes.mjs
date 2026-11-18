/** Review-only SQL statements. Do not wire these into production routes until acceptance. */
export const pilotTenantLockSql = "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-pilot-lock-v1:'||$1::uuid::text,0))";

export async function grantPilotLocked(tx,{clientId,email,reason,days,eventId}){
  if(!clientId||!email||!reason||!eventId||!Number.isInteger(days)||days<1||days>30)throw Error('invalid-pilot');
  await tx.query(pilotTenantLockSql,[clientId]);
  await tx.query(`INSERT INTO public.client_pilot_access(client_id,email,reason,expires_at)
 VALUES($1,$2,$3,clock_timestamp()+($4::integer * INTERVAL '1 day'))
 ON CONFLICT(client_id) DO UPDATE SET email=EXCLUDED.email,reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,[clientId,email,reason,days]);
  await tx.query(`INSERT INTO public.client_activity(id,client_id,event_type,title,detail,metadata)
 VALUES($1,$2,'pilot-granted','Ücretsiz analiz pilotu açıldı',$3,$4::jsonb)`,[eventId,clientId,reason,JSON.stringify({days,scope:'diagnosis-report',noPayment:true})]);
}
export async function revokePilotLocked(tx,{clientId,eventId}){
  if(!clientId||!eventId)throw Error('invalid-pilot');
  await tx.query(pilotTenantLockSql,[clientId]);
  const r=await tx.query('UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1 AND revoked_at IS NULL RETURNING expires_at',[clientId]);
  if(r.rows.length)await tx.query(`INSERT INTO public.client_activity(id,client_id,event_type,title,detail,metadata)
 VALUES($1,$2,'pilot-revoked','Ücretsiz analiz pilotu kapatıldı','Yönetici pilot erişimini kaldırdı.',$3::jsonb)`,[eventId,clientId,JSON.stringify({scope:'diagnosis-report',noPayment:true,previousExpiresAt:r.rows[0].expires_at})]);
  return {revoked:Boolean(r.rows.length)};
}
