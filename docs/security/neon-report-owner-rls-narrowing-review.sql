-- REVIEW ONLY / DO NOT EXECUTE. Not a migration; no automatic deployment.
-- Isolated Neon branch only: br-plain-poetry-b2u7f7a6.
-- Security owner approval, snapshot, rollback, and synthetic two-tenant tests
-- are required BEFORE running any statement.
--
-- Planned ordering: narrow the owner's broad permissive RLS policy FIRST
-- (fail-closed: existing RPC may return zero rows), then replace the
-- signed-report RPC with the MAC-verified transaction-local tenant scope.
-- Do not reverse the order or independently promote one half to production.
--
-- RLS is not the authorization source. A custom app.tenant_id GUC can be
-- set by a SQL session. Only an authenticated signed RPC may derive/set it,
-- and gateway must have NO raw SELECT privilege. Audit all other owner
-- SECURITY DEFINER entrypoints and role memberships independently.

-- Precondition read: expected exactly one named, permissive SELECT policy
-- for the restricted report owner with USING (true).
SELECT p.polname,p.polpermissive,p.polcmd,
       pg_get_expr(p.polqual,p.polrelid) AS using_expression
FROM pg_policy p
WHERE p.polrelid='public.ai_provider_comparisons'::regclass
  AND p.polname='portal_fn_owner_read_synthetic';

-- CANDIDATE DDL ONLY (intentionally not executed).
-- Must be applied in an isolated, reversible, explicitly approved migration.
-- Existing PUBLIC permissive policy also applies; as both policies become
-- tenant-scoped, OR semantics no longer grant every tenant to this owner.
ALTER POLICY portal_fn_owner_read_synthetic
  ON public.ai_provider_comparisons
  TO portal_report_fn_owner_trial_20261115
  USING (
    client_id = NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid
  );

-- Required verification: no permissive USING(true) owner policy remains;
-- no other owner-effective policies yield unscoped read access; FORCE RLS
-- retained; role gateway has EXECUTE only and no raw comparison SELECT.
-- Verify candidate RPC sets the transaction-local GUC ONLY after valid MAC,
-- TTL, tenant lock, account/pilot grant/expiry, and one-time claim acceptance.
-- Synthetic tenant A/B positive, negative, replay and parallel revocation
-- tests are mandatory. Do not treat this file as a passed test.
