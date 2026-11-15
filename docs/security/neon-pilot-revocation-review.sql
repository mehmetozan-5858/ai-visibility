-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION OR DEFAULT BRANCH.
-- Target: isolated Neon branch br-plain-poetry-b2u7f7a6.
-- Requires explicit approval, isolated synthetic fixture and gateway credentials
-- before executing this function replacement.
-- This file is intentionally outside migrations/ and is not auto-deployed.
--
-- Purpose: fail closed when a pilot has been revoked, expired or not granted.
-- Keep the preexisting HMAC, single-use claim and active-account checks.
-- Required least-privilege grant: the SECURITY DEFINER owner currently has
-- no direct SELECT on client_pilot_access. Without this, the guard fails with
-- a permission error. Apply ONLY on the isolated branch after review.
-- FAIL-CLOSED RLS PRECONDITION. This DDL draft MUST abort before any GRANT
-- while a permissive TRUE policy can expose comparisons to the report owner.
-- Do not remove this check as a shortcut. Replacing a policy requires its own
-- reviewed, reversible isolated migration and real tenant isolation tests.
DO $rls_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy pol
    WHERE pol.polrelid='public.ai_provider_comparisons'::pg_catalog.regclass
      AND pol.polpermissive AND pol.polcmd IN ('r','*')
      AND pg_catalog.pg_get_expr(pol.polqual,pol.polrelid)='true'
      AND (pol.polroles=ARRAY[0::oid] OR
           'portal_report_fn_owner_trial_20261115'::pg_catalog.regrole::oid=ANY(pol.polroles))
  ) THEN
    RAISE EXCEPTION 'blocked: unrestricted report-owner comparison RLS policy'
      USING ERRCODE='42501';
  END IF;
END
$rls_guard$;

GRANT SELECT (client_id, revoked_at, expires_at)
ON public.client_pilot_access TO portal_report_fn_owner_trial_20261115;

CREATE OR REPLACE FUNCTION public.portal_trial_one_time_report(
  p_tenant uuid, p_expires bigint, p_claim_id uuid, p_mac text
)
RETURNS TABLE("clientId" uuid, query text, results jsonb, "createdAt" timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_secret text;
  v_expected text;
  v_now bigint;
  v_payload text;
  v_consumed uuid;
BEGIN
  IF p_tenant IS NULL OR p_expires IS NULL OR p_claim_id IS NULL OR p_mac IS NULL
     OR p_mac !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  IF p_expires < v_now OR p_expires > v_now + 300 THEN RETURN; END IF;

  SELECT k.secret INTO v_secret
    FROM portal_authz_trial.signing_keys k
   WHERE k.key_id = 'trial-v1';
  IF v_secret IS NULL THEN RETURN; END IF;

  v_payload := 'portal-one-time-report-v1|' || p_tenant::text || '|'
               || p_expires::text || '|' || p_claim_id::text;
  v_expected := encode(
    portal_authz_trial.hmac(convert_to(v_payload, 'UTF8'),
                            convert_to(v_secret, 'UTF8'), 'sha256'),
    'hex'
  );
  IF p_mac <> v_expected THEN RETURN; END IF;

  -- Coordinate with pilot grant/revoke and approved account-suspension writers.
  -- Lock is transaction scoped; every relevant writer MUST acquire the same
  -- advisory lock BEFORE row DML, on the same transaction/connection.
  -- Does NOT protect uncoordinated owner/DDL/bulk write paths; HOLD until audited.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('portal-pilot-lock-v1:' || p_tenant::text, 0)
  );

  -- A valid claim may expire while waiting for the tenant lock. Recheck
  -- against real wall-clock time before reading authority or consuming nonce.
  -- Timeouts/errors must fail closed; never consume an expired claim.
  v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;
  IF p_expires < v_now OR p_expires > v_now + 300 THEN RETURN; END IF;

  -- Recheck authoritative state AFTER obtaining the per-tenant lock.
  -- Fail closed on account suspension AND pilot-access revocation/expiry.
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_tenant AND c.status = 'active'
  ) THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_pilot_access a
    WHERE a.client_id = p_tenant
      AND a.revoked_at IS NULL
      AND a.expires_at > clock_timestamp()
  ) THEN RETURN; END IF;

  -- A primary key on claim_id ensures no replay, including concurrent requests.
  INSERT INTO portal_authz_trial.consumed_claims(claim_id, tenant_id, expires_at)
  VALUES (p_claim_id, p_tenant, p_expires)
  ON CONFLICT (claim_id) DO NOTHING
  RETURNING claim_id INTO v_consumed;
  IF v_consumed IS NULL THEN RETURN; END IF;

  -- RLS is tenant-constrained only if the permissive TRUE owner policy is
  -- removed in the SAME approved isolated migration. This GUC is mutable and
  -- is not authentication: use only the MAC-verified, authorized p_tenant.
  -- Keep gateway direct SELECT revoked and the owner NOLOGIN.
  PERFORM pg_catalog.set_config('app.tenant_id', p_tenant::text, true);
  RETURN QUERY
    SELECT c.client_id, c.query, c.results, c.created_at
    FROM public.ai_provider_comparisons c
    WHERE c.client_id = p_tenant
    ORDER BY c.created_at DESC
    LIMIT 20;
  -- Do not leave the tenant setting available to later queries in a pooled
  -- transaction. An exception aborts the transaction; validate with sessions.
  PERFORM pg_catalog.set_config('app.tenant_id', '', true);
END;
$function$;

-- Must retain SECURITY DEFINER ownership by the restricted function owner.
-- CREATE OR REPLACE on the existing function preserves ownership, but validate
-- this after deployment. Never grant EXECUTE to PUBLIC.
--
-- Acceptance gates on isolated synthetic tenant/fixture, all must pass:
-- (1) no grant -> empty; (2) revoked -> empty; (3) expired -> empty;
-- (4) suspended account -> empty; (5) bad/expired HMAC -> empty;
-- (6) valid first claim -> own rows; (7) same claim -> empty;
-- (8) concurrent identical claims -> at most one successful consumption;
-- (9) cross-tenant claim -> empty; (10) gateway-only EXECUTE;
-- (11) no ability to SELECT signing_keys or consumed_claims as gateway.
-- For each failure check that consumed_claims count does not change.
-- For revocation between issue and consumption, perform revocation then call
-- with the already-signed claim: it must return zero rows.
--
-- IMPORTANT: Strict concurrency-safe revocation remains an OPEN BLOCKER.
-- This read-side lock must be paired with audited grant/revoke, suspension and
-- ALL other writers including admin/direct SQL; advisory locks are cooperative.
-- Never grant broad UPDATE or assume this design passed two-session tests.
-- Validate READ COMMITTED snapshot behavior, transaction boundaries, timeout
-- and rollback, claim replay, paid-access bypass and older report entrypoints.
-- Token issuance and session cache invalidation remain separate acceptance gates.
