-- REVIEW ONLY / DO NOT RUN. Isolated Neon branch only.
-- Project ancient-water-34496424, branch br-plain-poetry-b2u7f7a6.
-- This is an intentionally rollback-only retirement sketch, NOT a migration.
-- Do not drop the old RPC until ALL caller paths, grants, and dependent
-- database objects have been audited AND the replacement report RPC has
-- passed synthetic read, revocation, replay and independent-session tests.
-- Do not apply in production or bypass HOLD to simplify a migration.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $old_rpc_guard$
DECLARE
 v_owner text;
 v_acl text;
 v_definer boolean;
 v_owner_bypass boolean;
 v_gateway boolean;
 v_public boolean;
BEGIN
 SELECT pg_get_userbyid(p.proowner),p.proacl::text,p.prosecdef,r.rolbypassrls,
        has_function_privilege('portal_gateway_reader_trial_20261114',p.oid,'EXECUTE'),
        has_function_privilege('public',p.oid,'EXECUTE')
 INTO v_owner,v_acl,v_definer,v_owner_bypass,v_gateway,v_public
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
 WHERE p.oid='public.portal_trial_verified_report(uuid,bigint,text)'::pg_catalog.regprocedure;

 IF v_owner IS DISTINCT FROM 'neondb_owner' OR v_definer IS DISTINCT FROM true
   OR v_owner_bypass IS DISTINCT FROM true OR v_gateway IS DISTINCT FROM false
   OR v_public IS DISTINCT FROM false THEN
   RAISE EXCEPTION 'blocked: unexpected legacy RPC owner or privileges';
 END IF;

 IF v_acl IS DISTINCT FROM '{neondb_owner=X/neondb_owner}' THEN
   RAISE EXCEPTION 'blocked: legacy RPC ACL changed';
 END IF;

 -- A database dependency check is insufficient: external JavaScript, jobs,
 -- admin SQL, connection pools and deployed older revisions are not tracked.
 -- Retire only after source and deployment references have been inventoried.
END;
$old_rpc_guard$;

-- The safe *proposal* once all caller/replacement checks are proven:
-- DROP FUNCTION public.portal_trial_verified_report(uuid,bigint,text);
-- This DROP is commented out intentionally. Never use CASCADE.
-- Running this file cannot remove a function or change live privileges.
ROLLBACK;
