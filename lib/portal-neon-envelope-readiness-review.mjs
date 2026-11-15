/**
 * REVIEW ONLY — metadata-only acceptance inventory for the proposed signed
 * report RPC. No migrations, secret reads, client-row reads or grants.
 *
 * A failed inventory is a HOLD, not a request to silently provision roles.
 * A passing inventory is still NOT replay/revocation/concurrency E2E proof.
 */
export const signedEnvelopeReadinessSql = `
WITH expected AS (
 SELECT r.oid, r.rolcanlogin, r.rolsuper, r.rolbypassrls,
        r.rolcreatedb, r.rolcreaterole, r.rolreplication
 FROM pg_catalog.pg_roles r WHERE r.rolname='portal_report_fn_owner'
),
hmac_extension AS (
 SELECT p.oid
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_proc'::regclass
  AND d.objid=p.oid AND d.deptype='e'
 JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid AND e.extname='pgcrypto'
 WHERE n.nspname='portal_authz'
   AND p.oid=to_regprocedure('portal_authz.hmac(bytea,bytea,text)')
)
SELECT
 EXISTS(SELECT 1 FROM expected) AS "ownerExists",
 COALESCE((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
  AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
  FROM expected),false) AS "ownerNarrow",
 COALESCE((SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
  WHERE m.member=e.oid) FROM expected e),false) AS "ownerNoMembership",
 COALESCE((SELECT NOT has_database_privilege(e.oid,current_database(),'CREATE')
  AND NOT has_schema_privilege(e.oid,'public','CREATE')
  FROM expected e),false) AS "ownerNoCreate",
 to_regnamespace('portal_authz') IS NOT NULL AS "privateSchema",
 EXISTS(SELECT 1 FROM hmac_extension) AS "approvedHmac",
 COALESCE((SELECT has_schema_privilege(e.oid,'portal_authz','USAGE')
  FROM expected e),false) AS "ownerPrivateSchemaUsage",
 COALESCE((SELECT has_function_privilege(e.oid,(SELECT oid FROM hmac_extension LIMIT 1),'EXECUTE')
  FROM expected e),false) AS "ownerHmacExecute",
 COALESCE((SELECT has_table_privilege(e.oid,to_regclass('public.clients'),'SELECT')
  FROM expected e),false) AS "ownerClientSelect",
 COALESCE((SELECT has_table_privilege(e.oid,to_regclass('public.client_pilot_access'),'SELECT')
  FROM expected e),false) AS "ownerPilotSelect",
 COALESCE((SELECT has_table_privilege(e.oid,to_regclass('public.ai_provider_comparisons'),'SELECT')
  FROM expected e),false) AS "ownerComparisonSelect",
 COALESCE((SELECT NOT has_table_privilege(e.oid,to_regclass('public.client_credentials'),'SELECT')
  FROM expected e),false) AS "ownerNoCredentials",
 COALESCE((SELECT NOT has_table_privilege(e.oid,to_regclass('public.payments'),'SELECT')
  FROM expected e),false) AS "ownerNoPayments",
 COALESCE((SELECT has_table_privilege(e.oid,to_regclass('portal_authz.signing_keys'),'SELECT')
  FROM expected e),false) AS "ownerSigningKeySelect",
 COALESCE((SELECT has_table_privilege(e.oid,to_regclass('portal_authz.consumed_claims'),'INSERT')
  FROM expected e),false) AS "ownerNonceInsert",
 COALESCE((SELECT has_column_privilege(e.oid,to_regclass('portal_authz.consumed_claims'),'claim_id','SELECT')
  FROM expected e),false) AS "ownerNonceIdSelect",
 to_regprocedure('public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)')
  IS NOT NULL AS "rpcInstalled"`;

export const signedEnvelopeRequiredChecks = Object.freeze([
 'ownerExists','ownerNarrow','ownerNoMembership','ownerNoCreate',
 'privateSchema','approvedHmac','ownerPrivateSchemaUsage',
 'ownerHmacExecute','ownerClientSelect','ownerPilotSelect',
 'ownerComparisonSelect','ownerNoCredentials','ownerNoPayments',
 'ownerSigningKeySelect','ownerNonceInsert','ownerNonceIdSelect',
 'rpcInstalled'
]);

// Stage these checks explicitly: the migration creates signing_keys,
// consumed_claims and the new RPC only AFTER preinstallation requirements
// have been independently reviewed. Never treat post-install components
// as prerequisites to issuing the first approved migration.
// The postinstall gate rechecks ALL requirements, including preinstall
// requirements: missing owner identity must not be hidden by installed tables.
// A PASS in either stage remains metadata-only, never live acceptance.
export const signedEnvelopePreinstallChecks = Object.freeze([
 'ownerExists','ownerNarrow','ownerNoMembership','ownerNoCreate',
 'privateSchema','approvedHmac','ownerPrivateSchemaUsage',
 'ownerHmacExecute','ownerClientSelect','ownerPilotSelect',
 'ownerComparisonSelect','ownerNoCredentials','ownerNoPayments'
]);

export const signedEnvelopePostinstallChecks = Object.freeze([
 'ownerSigningKeySelect','ownerNonceInsert','ownerNonceIdSelect',
 'rpcInstalled'
]);

export function evaluateSignedEnvelopeStage(row,stage){
 const required=stage==='preinstall'?signedEnvelopePreinstallChecks
  :stage==='postinstall'?signedEnvelopeRequiredChecks:null;
 if(!required)return {ready:false,stage:'invalid',blocked:['invalid-stage'],
  reason:'reviewed-envelope-stage-unverified'};
 const blocked=required.filter(check=>row?.[check]!==true);
 return {ready:blocked.length===0,stage,blocked,
  reason:blocked.length?'reviewed-envelope-stage-blocked':'metadata-only-stage-present'};
}

export function evaluateSignedEnvelopeReadiness(row){
 const blocked=signedEnvelopeRequiredChecks.filter(check=>row?.[check]!==true);
 return {ready:blocked.length===0,blocked,
  reason:blocked.length?'reviewed-envelope-prerequisites-blocked':'metadata-only-prerequisites-present'};
}

export async function inspectSignedEnvelopeReadiness(pool){
 if(!pool||typeof pool.query!=='function')
  return {ready:false,blocked:[...signedEnvelopeRequiredChecks],reason:'read-only-inspection-unavailable'};
 try{
  const results=await pool.query(signedEnvelopeReadinessSql);
  if(results.rows?.length!==1)throw Error('unexpected-inspection-cardinality');
  return evaluateSignedEnvelopeReadiness(results.rows[0]);
 }catch{
  return {ready:false,blocked:[...signedEnvelopeRequiredChecks],reason:'read-only-inspection-failed'};
 }
}
