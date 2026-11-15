/**
 * REVIEW ONLY: inspect privileges of the DB-verifiable report function.
 * This is a read-only acceptance probe; it never changes a role or migration.
 * It does not prove true concurrent replay, claim-key protection at rest,
 * revoked HTTP sessions or real customer payment entitlement.
 */
const OWNER=/^portal_report_fn_owner_[a-z0-9_]+$/;
const READER=/^portal_gateway_reader_[a-z0-9_]+$/;
const TRIAL_FUNCTION='public.portal_trial_one_time_report(uuid,bigint,uuid,text)';
export const ownerReadinessSql=`SELECT
 p.proowner::regrole::text AS "ownerName",
 o.rolcanlogin AS "ownerLogin",o.rolsuper AS "ownerSuper",
 o.rolbypassrls AS "ownerBypassRls",o.rolcreaterole AS "ownerCreateRole",
 o.rolcreatedb AS "ownerCreateDb",o.rolinherit AS "ownerInherit",
 has_schema_privilege(o.rolname,'public','CREATE') AS "ownerSchemaCreate",
 has_table_privilege(o.rolname,'public.clients','SELECT') AS "ownerClientSelect",
 has_table_privilege(o.rolname,'public.ai_provider_comparisons','SELECT') AS "ownerReportSelect",
 has_table_privilege(o.rolname,'portal_authz_trial.signing_keys','SELECT') AS "ownerSigningKeySelect",
 has_table_privilege(o.rolname,'portal_authz_trial.consumed_claims','INSERT') AS "ownerNonceInsert",
 has_column_privilege(o.rolname,'portal_authz_trial.consumed_claims','claim_id','SELECT') AS "ownerNonceIdSelect",
 has_table_privilege(o.rolname,'public.payments','SELECT') AS "ownerPaymentSelect",
 has_table_privilege(o.rolname,'public.client_credentials','SELECT') AS "ownerCredentialSelect",
 p.prosecdef AS "securityDefiner",
 (p.proconfig @> ARRAY['search_path=pg_catalog']) AS "safeSearchPath",
 (SELECT count(*)::int FROM pg_policy pp
   WHERE pp.polrelid='public.ai_provider_comparisons'::regclass
   AND pp.polname='portal_fn_owner_read_synthetic'
   AND pp.polcmd='r' AND pp.polroles @> ARRAY[o.oid]::oid[]
   AND pg_get_expr(pp.polqual,pp.polrelid)='true') AS "ownerPolicyCount",
 EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
   WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS "publicExecute",
 (SELECT count(*)::int FROM pg_proc proc JOIN pg_namespace ns ON ns.oid=proc.pronamespace
   WHERE proc.oid=p.oid) AS "functionCount",
 has_function_privilege($1::name,${"'"+TRIAL_FUNCTION+"'"},'EXECUTE') AS "readerExecute",
 has_table_privilege($1::name,'public.ai_provider_comparisons','SELECT') AS "readerRawSelect",
 has_schema_privilege($1::name,'portal_authz_trial','USAGE') AS "readerPrivateSchema",
 has_table_privilege($1::name,'portal_authz_trial.signing_keys','SELECT') AS "readerSigningKeySelect",
 has_table_privilege($1::name,'portal_authz_trial.consumed_claims','SELECT') AS "readerNonceSelect",
 has_table_privilege($1::name,'portal_authz_trial.consumed_claims','INSERT') AS "readerNonceInsert"
 FROM pg_proc p JOIN pg_roles o ON o.oid=p.proowner
 WHERE p.oid=${"'"+TRIAL_FUNCTION+"'"}::regprocedure`;

export function evaluateOneTimeOwnerReadiness(v,{owner,reader}={}){
 const fail=reason=>({ready:false,reason});
 if(!OWNER.test(String(owner||''))||!READER.test(String(reader||'')))
  return fail('expected-narrow-roles-unconfigured');
 if(!v||v.ownerName!==owner)return fail('function-owner-identity-unverified');
 const checks=[
  ['ownerLogin',false],['ownerSuper',false],['ownerBypassRls',false],
  ['ownerCreateRole',false],['ownerCreateDb',false],['ownerInherit',false],
  ['ownerSchemaCreate',false],['ownerClientSelect',true],['ownerReportSelect',true],
  ['ownerSigningKeySelect',true],['ownerNonceInsert',true],['ownerNonceIdSelect',true],
  ['ownerPaymentSelect',false],['ownerCredentialSelect',false],
  ['securityDefiner',true],['safeSearchPath',true],['ownerPolicyCount',1],
  ['publicExecute',false],['functionCount',1],['readerExecute',true],['readerRawSelect',false],
  ['readerPrivateSchema',false],['readerSigningKeySelect',false],
  ['readerNonceSelect',false],['readerNonceInsert',false]
 ];
 for(const [key,want] of checks)if(v[key]!==want)return fail('one-time-owner-privilege-unverified:'+key);
 return {ready:true,reason:'isolated-test-function-owner-role-verified'};
}
export async function inspectOneTimeOwnerReadiness(pool,expected){
 if(!pool||typeof pool.query!=='function')
  return {ready:false,reason:'function-owner-connection-unavailable'};
 if(!OWNER.test(String(expected?.owner||''))||!READER.test(String(expected?.reader||'')))
  return {ready:false,reason:'expected-narrow-roles-unconfigured'};
 try{
  const r=await pool.query(ownerReadinessSql,[expected.reader]);
  return evaluateOneTimeOwnerReadiness(r.rows?.[0],expected);
 }catch{
  return {ready:false,reason:'function-owner-inspection-error'};
 }
}
