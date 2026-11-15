-- REVIEW ONLY: INERT FILE. NOT IN migrations/. DO NOT EXECUTE.
-- Target ONLY ancient-water-34496424 / br-plain-poetry-b2u7f7a6.
-- Requires separate explicit isolated-write approval, snapshot and rollback.
-- This script removes a known unrestricted owner policy, but must be deployed
-- atomically with the reviewed one-time-report function in the same transaction.
-- DANGER: run only after complete policy/role membership inventory,
-- signed tenant authorization and independent multi-session acceptance.
--
-- Intended sequence:
--   BEGIN;
--   [safe preconditions and DROP POLICY below]
--   [contents of neon-pilot-revocation-review.sql, omitting its own transaction]
--   [postcondition checks]
--   COMMIT;
-- NEVER commit this policy change alone or enable report calls mid-migration.
-- Running this standalone leaves the old report temporarily unable to see
-- comparisons under RLS and is not an approved acceptance path.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
 v_count integer;
 v_rls boolean;
 v_force boolean;
BEGIN
 SELECT relrowsecurity,relforcerowsecurity INTO v_rls,v_force
 FROM pg_catalog.pg_class
 WHERE oid='public.ai_provider_comparisons'::pg_catalog.regclass;
 IF NOT (v_rls AND v_force) THEN
   RAISE EXCEPTION 'blocked: comparison FORCE RLS must be enabled';
 END IF;
 -- Require the existing scoped PUBLIC SELECT policy to be exactly the known
 -- tenant expression before removing the old unrestricted owner policy.
 SELECT count(*) INTO v_count
 FROM pg_catalog.pg_policy pol
 WHERE pol.polrelid='public.ai_provider_comparisons'::pg_catalog.regclass
   AND pol.polname='portal_verified_tenant_comparison_select'
   AND pol.polcmd='r' AND pol.polpermissive
   AND 0::oid=ANY(pol.polroles)
   AND pg_catalog.pg_get_expr(pol.polqual,pol.polrelid)=
       '(client_id = (NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text))::uuid)';
 IF v_count<>1 THEN
   RAISE EXCEPTION 'blocked: expected tenant-scoped SELECT policy absent or changed';
 END IF;
 SELECT count(*) INTO v_count
 FROM pg_catalog.pg_policy pol
 WHERE pol.polrelid='public.ai_provider_comparisons'::pg_catalog.regclass
   AND pol.polname='portal_fn_owner_read_synthetic'
   AND pol.polcmd='r' AND pol.polpermissive
   AND pg_catalog.pg_get_expr(pol.polqual,pol.polrelid)='true'
   AND 'portal_report_fn_owner_trial_20261115'::pg_catalog.regrole::oid=ANY(pol.polroles);
 IF v_count<>1 THEN
   RAISE EXCEPTION 'blocked: unexpected owner policy state';
 END IF;
 IF (SELECT rolbypassrls OR rolcanlogin FROM pg_catalog.pg_roles
     WHERE rolname='portal_report_fn_owner_trial_20261115') THEN
   RAISE EXCEPTION 'blocked: report owner role must be NOLOGIN and not BYPASSRLS';
 END IF;
END;
$preflight$;

DROP POLICY portal_fn_owner_read_synthetic ON public.ai_provider_comparisons;

-- STOP: This script is a design component only.
-- DO NOT execute/commit without appending the complete revised report-function
-- SQL in the SAME transaction, then confirming its effective owner and RLS,
-- and checking no other permissive grants exist.
-- No COMMIT is supplied intentionally.
ROLLBACK;
