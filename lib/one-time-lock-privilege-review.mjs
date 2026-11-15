/**
 * REVIEW ONLY: read-only PostgreSQL permission attestation for FOR SHARE.
 * PostgreSQL requires UPDATE privilege on at least one column for a SELECT
 * FOR SHARE, in addition to ordinary SELECT. No GRANTs are issued here.
 * NEVER treat a metadata-only PASS as actual 2-connection lock acceptance.
 */
export const lockPrivilegeSql=`SELECT
 p.proowner::regrole::text AS "ownerName",
 has_table_privilege(p.proowner,'public.clients','SELECT') AS "clientSelect",
 has_column_privilege(p.proowner,'public.clients','id','UPDATE') AS "clientLockUpdate",
 has_table_privilege(p.proowner,'public.client_pilot_access','SELECT') AS "pilotSelect",
 has_column_privilege(p.proowner,'public.client_pilot_access','client_id','UPDATE') AS "pilotLockUpdate",
 has_table_privilege($1::name,'public.clients','UPDATE') AS "readerClientUpdate",
 has_table_privilege($1::name,'public.client_pilot_access','UPDATE') AS "readerPilotUpdate",
 has_table_privilege($1::name,'public.client_pilot_access','SELECT') AS "readerPilotSelect"
 FROM pg_proc p WHERE p.oid='public.portal_trial_one_time_report(uuid,bigint,uuid,text)'::regprocedure`;

export function evaluateLockPrivilegeReview(value,{owner,reader}={}){
 if(typeof owner!=='string'||!/^portal_report_fn_owner_[a-z0-9_]+$/.test(owner)||
    typeof reader!=='string'||!/^portal_gateway_reader_[a-z0-9_]+$/.test(reader))
  return {ready:false,reason:'expected-role-identity-unconfigured'};
 if(!value||value.ownerName!==owner)
  return {ready:false,reason:'locked-function-owner-unverified'};
 const requirements=[
  ['clientSelect',true],['clientLockUpdate',true],
  ['pilotSelect',true],['pilotLockUpdate',true],
  ['readerClientUpdate',false],['readerPilotUpdate',false],['readerPilotSelect',false]
 ];
 for(const [field,want] of requirements){
  if(value[field]!==want)return {ready:false,reason:'lock-privilege-missing-or-unsafe:'+field};
 }
 return {ready:true,reason:'metadata-only-lock-privileges-verified'};
}
export async function inspectLockPrivilegeReview(pool,expected){
 if(!pool||typeof pool.query!=='function')
  return {ready:false,reason:'privilege-probe-unavailable'};
 if(!/^portal_gateway_reader_[a-z0-9_]+$/.test(String(expected?.reader||'')))
  return {ready:false,reason:'reader-identity-unconfigured'};
 try{
  const result=await pool.query(lockPrivilegeSql,[expected.reader]);
  return evaluateLockPrivilegeReview(result.rows?.[0],expected);
 }catch{
  return {ready:false,reason:'privilege-probe-failed'};
 }
}
