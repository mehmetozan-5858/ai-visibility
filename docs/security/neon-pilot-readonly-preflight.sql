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
