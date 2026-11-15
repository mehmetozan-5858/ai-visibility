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
  position('FOR SHARE' in pg_get_functiondef(p.oid)) > 0 AS lock_check_present
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
