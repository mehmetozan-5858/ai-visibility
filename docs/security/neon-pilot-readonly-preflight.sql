-- READ-ONLY PREFLIGHT. Run only with explicit isolated branch targeting:
-- project ancient-water-34496424 / branch br-plain-poetry-b2u7f7a6.
-- All bool checks are observed metadata, NOT proof of real customer access.
SELECT
  current_database() AS database_name,
  current_user AS inspected_as,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS security_definer,
  has_function_privilege('portal_gateway_reader_trial_20261114',
    'public.portal_trial_one_time_report(uuid,bigint,uuid,text)', 'EXECUTE') AS gateway_execute,
  NOT has_function_privilege('portal_gateway_reader_trial_20261114',
    'public.portal_trial_verified_report(uuid,bigint,text)', 'EXECUTE') AS legacy_gateway_blocked,
  NOT has_table_privilege('portal_gateway_reader_trial_20261114',
    'portal_authz_trial.signing_keys', 'SELECT') AS secret_read_blocked,
  NOT has_table_privilege('portal_gateway_reader_trial_20261114',
    'portal_authz_trial.consumed_claims', 'SELECT') AS claim_read_blocked,
  (SELECT count(*) FROM public.client_pilot_access) AS pilot_access_rows,
  (SELECT count(*) FROM portal_authz_trial.consumed_claims) AS consumed_claim_rows,
  position('client_pilot_access' in pg_get_functiondef(p.oid)) > 0 AS revocation_check_present,
  position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0 AS advisory_lock_source_present
FROM pg_proc p
WHERE p.oid='public.portal_trial_one_time_report(uuid,bigint,uuid,text)'::regprocedure;

-- Never interpret a passing CI check or this preflight as a passed execution,
-- replay prevention, revocation, or two-session concurrency acceptance.

-- SECURITY DIFFERENCE REPORT (READ-ONLY). These are release blockers when false.
-- A matching string is only source-level evidence, not two-session concurrency proof.
SELECT
  position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0
    AS report_uses_transaction_advisory_lock,
  position('portal-pilot-lock-v1:' in pg_get_functiondef(p.oid)) > 0
    AS report_uses_canonical_lock_namespace,
  position('client_pilot_access' in pg_get_functiondef(p.oid)) > 0
    AS report_reads_authoritative_pilot_access,
  position('revoked_at' in pg_get_functiondef(p.oid)) > 0
    AS report_checks_revocation,
  position('client_pilot_access a' in pg_get_functiondef(p.oid)) > 0 AND
  position('a.expires_at' in pg_get_functiondef(p.oid)) > 0
    AS report_checks_pilot_expiration,
  NOT has_table_privilege('portal_gateway_reader_trial_20261114',
    'public.ai_provider_comparisons','SELECT') AS gateway_raw_comparison_read_blocked,
  NOT has_table_privilege('portal_gateway_reader_trial_20261114',
    'public.client_pilot_access','SELECT') AS gateway_raw_pilot_read_blocked,
  NOT has_table_privilege('portal_report_fn_owner_trial_20261115',
    'public.client_pilot_access','UPDATE') AS definer_pilot_update_blocked,
  NOT has_table_privilege('portal_report_fn_owner_trial_20261115',
    'public.clients','UPDATE') AS definer_client_update_blocked
FROM pg_proc p
WHERE p.oid='public.portal_trial_one_time_report(uuid,bigint,uuid,text)'::regprocedure;

-- Inventory non-internal mutation triggers. Empty result does NOT prove
-- writer coordination: app/API/direct SQL paths must be audited separately.
SELECT n.nspname AS schema_name,c.relname AS table_name,
       t.tgname AS trigger_name,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname='public'
  AND c.relname IN ('clients','client_pilot_access')
ORDER BY 1,2,3;

-- OWNER / RLS PRECONDITIONS (READ ONLY). Management-role membership is NOT
-- a substitute for the gateway role's own authenticated connection test.
SELECT current_user AS inspected_as,
       pg_get_userbyid(p.proowner) AS report_owner,
       pg_has_role(current_user,p.proowner,'MEMBER') AS inspector_member_of_owner,
       p.prosecdef AS security_definer,
       has_schema_privilege('portal_report_fn_owner_trial_20261115',
         'portal_authz_trial','USAGE') AS definer_auth_schema_usage,
       has_table_privilege('portal_report_fn_owner_trial_20261115',
         'public.client_pilot_access','SELECT') AS definer_pilot_read,
       has_table_privilege('portal_report_fn_owner_trial_20261115',
         'portal_authz_trial.signing_keys','SELECT') AS definer_signing_key_read,
       has_table_privilege('portal_report_fn_owner_trial_20261115',
         'portal_authz_trial.consumed_claims','INSERT') AS definer_claim_insert
FROM pg_proc p
WHERE p.oid='public.portal_trial_one_time_report(uuid,bigint,uuid,text)'::regprocedure;

SELECT c.relname AS object_name,c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pol.polname AS policy_name,pg_get_expr(pol.polqual,pol.polrelid) AS using_expression
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid=c.oid
WHERE n.nspname='public' AND c.relname='ai_provider_comparisons'
ORDER BY pol.polname;
-- A policy granting the definer USING(true) remains an independent
-- security review finding, even when a function filters by tenant.

-- FAIL-CLOSED RLS GATE (READ-ONLY). This catches an unrestricted permissive
-- SELECT policy for the SECURITY DEFINER owner. It is NOT a complete proof
-- against indirect membership, other permissive expressions, or definer abuse.
-- Current isolated branch is expected to return safe_for_release=false.
SELECT c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       EXISTS(
         SELECT 1 FROM pg_policy p
         WHERE p.polrelid=c.oid AND p.polpermissive
           AND p.polcmd IN ('r','*')
           AND pg_get_expr(p.polqual,p.polrelid)='true'
           AND (
             p.polroles=ARRAY[0::oid]
             OR 'portal_report_fn_owner_trial_20261115'::regrole::oid=ANY(p.polroles)
           )
       ) AS definer_has_permissive_true_policy,
       (c.relrowsecurity AND c.relforcerowsecurity AND NOT EXISTS(
         SELECT 1 FROM pg_policy p
         WHERE p.polrelid=c.oid AND p.polpermissive
           AND p.polcmd IN ('r','*')
           AND pg_get_expr(p.polqual,p.polrelid)='true'
           AND (
             p.polroles=ARRAY[0::oid]
             OR 'portal_report_fn_owner_trial_20261115'::regrole::oid=ANY(p.polroles)
           )
       )) AS safe_for_release
FROM pg_class c
WHERE c.oid='public.ai_provider_comparisons'::regclass;
-- A true safe_for_release is only a necessary condition; execution tests,
-- exact tenant authorization and complete role/policy audit remain required.

-- CALLER AND LEGACY SURFACE AUDIT (READ ONLY): owner may bypass RLS even if
-- gateway lacks EXECUTE. This is a separate release gate, not a grant proposal.
-- Record the exact legacy call sites and migration/retirement path before merge.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       pg_get_userbyid(p.proowner) AS function_owner,
       r.rolbypassrls AS owner_bypasses_rls,
       p.prosecdef AS security_definer,
       has_function_privilege('portal_gateway_reader_trial_20261114',
                              p.oid,'EXECUTE') AS gateway_can_execute,
       has_function_privilege('public',p.oid,'EXECUTE') AS public_can_execute,
       p.proacl::text AS explicit_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='public'
  AND p.proname IN ('portal_trial_one_time_report','portal_trial_verified_report')
ORDER BY p.proname;

-- Any production release requires exact-head tests and the gateway's actual
-- login session; has_function_privilege metadata cannot replace that evidence.
-- Privileged legacy owner with BYPASSRLS remains a REVIEW BLOCKER until every
-- reachable legacy entrypoint and privileged maintenance path is audited.

-- ACTUAL CONNECTION IDENTITY GATE (READ ONLY).
-- Verified isolated inspector is currently neondb_owner and cannot EXECUTE
-- portal_trial_one_time_report; the gateway role's ACL grant does not prove
-- its real login, password/TLS setup or its end-to-end execution.
-- Expected on the restricted gateway's independently authenticated session:
--   inspected_as = portal_gateway_reader_trial_20261114,
--   current_role_can_execute = true, and raw SELECT privileges remain false.
-- Do not run SET ROLE from owner and call that independent login proof.
SELECT current_user AS inspected_as,
       session_user AS session_as,
       current_user='portal_gateway_reader_trial_20261114' AS authenticated_gateway_identity,
       has_function_privilege(current_user,
         'public.portal_trial_one_time_report(uuid,bigint,uuid,text)',
         'EXECUTE') AS current_role_can_execute,
       NOT has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT')
         AS raw_comparisons_blocked,
       NOT has_table_privilege(current_user,'portal_authz_trial.signing_keys','SELECT')
         AS signing_key_read_blocked;

-- After independent gateway login, a malformed signature (no DML) should
-- return zero rows, not permission denied. This negative test alone is NOT
-- positive HMAC, tenant isolation, claim consumption or replay acceptance.
-- Execute it only using the gateway's real scoped credentials, never owner.
-- SELECT count(*) FROM public.portal_trial_one_time_report(
--   '00000000-0000-0000-0000-000000000001'::uuid, 0,
--   '00000000-0000-0000-0000-000000000002'::uuid, 'invalid');
