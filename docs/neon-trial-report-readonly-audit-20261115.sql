-- REVIEW ONLY. Read-only Neon TRIAL branch audit; never execute against production.
-- Intended branch: br-plain-poetry-b2u7f7a6.
-- Catalog evidence is NOT actual signed RPC / replay / revoke acceptance.
-- No customer identifiers, credentials, report rows, or secrets are retrieved.
-- This audit intentionally performs no DDL, role grants or report RPC calls.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5000ms';

-- 1. Capture database identity and bounded role privilege inventory.
SELECT current_database() AS database_name, current_user AS audit_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       clock_timestamp() AS observed_at;
SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls,
       r.rolcreatedb, r.rolcreaterole, r.rolreplication,
       has_database_privilege(r.oid,current_database(),'CREATE') AS database_create,
       has_schema_privilege(r.oid,'public','CREATE') AS public_schema_create,
       has_schema_privilege(r.oid,'public','USAGE') AS public_schema_usage,
       EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
               WHERE m.member=r.oid) AS member_of_another_role,
       has_table_privilege(r.oid,'public.ai_provider_comparisons','SELECT') AS raw_report_select,
       has_table_privilege(r.oid,'public.client_credentials','SELECT') AS credential_select,
       has_table_privilege(r.oid,'public.payments','SELECT') AS payment_select
FROM pg_catalog.pg_roles r
WHERE r.rolname IN ('portal_gateway_reader_trial_20261114',
                    'portal_report_fn_owner_trial_20261115')
ORDER BY r.rolname;

-- 2. Exact trial RPC definition/owner, EXECUTE, default search_path.
-- NULL function_oid means the expected function is missing, NOT accepted.
WITH expected AS (
 SELECT to_regprocedure('public.portal_trial_one_time_report(uuid,bigint,uuid,text)') AS function_oid
), reader AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname='portal_gateway_reader_trial_20261114'
)
SELECT expected.function_oid::text AS function_signature,
       p.prosecdef AS security_definer,
       owner.rolname AS function_owner,
       p.proconfig AS function_settings,
       CASE WHEN reader.oid IS NULL OR expected.function_oid IS NULL THEN NULL
            ELSE has_function_privilege(reader.oid,expected.function_oid,'EXECUTE')
       END AS reader_can_execute,
       CASE WHEN expected.function_oid IS NULL THEN NULL
            ELSE EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
       END AS public_can_execute
FROM expected
LEFT JOIN pg_catalog.pg_proc p ON p.oid=expected.function_oid
LEFT JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
LEFT JOIN reader ON true;

-- 3. Find ANY other callable SECURITY DEFINER entry point in public.
WITH reader AS (
 SELECT oid FROM pg_catalog.pg_roles
 WHERE rolname='portal_gateway_reader_trial_20261114'
)
SELECT p.oid::regprocedure::text AS callable_function,
       owner.rolname AS function_owner,
       CASE WHEN reader.oid IS NULL THEN NULL
            ELSE has_function_privilege(reader.oid,p.oid,'EXECUTE')
       END AS reader_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
LEFT JOIN reader ON true
WHERE n.nspname='public' AND p.prosecdef
ORDER BY callable_function;

-- 4. RLS status and policy metadata only (no rows).
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='ai_provider_comparisons';
SELECT schemaname,tablename,policyname,permissive,roles,cmd,
       qual AS using_predicate, with_check AS check_predicate
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='ai_provider_comparisons'
ORDER BY policyname;

COMMIT;

-- Required next, in a separate controlled synthetic TRIAL transaction:
-- authorized one-time signed envelope, denied replay, denied revoked pilot.
-- The RPC may write a consumed-claim nonce. It is NOT a read-only audit.
-- NEVER infer real customer acceptance or authorize production from catalog results.
