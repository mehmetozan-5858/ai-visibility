-- REVIEW ONLY — EXPLICIT AUTHORIZED ENVELOPE CANDIDATE. NEVER AUTO-APPLY.
-- This is NOT deployed: separate new function; no grants or runtime wiring.
-- Requires all grant/revoke/account-state writers to use same lock BEFORE
-- any state change; missing owner SELECT on client_pilot_access is BLOCKED.
-- Runtime owner, ACL, RLS, HMAC extension, nonce, source and true concurrency
-- acceptance must be separately reviewed on an isolated test branch.
-- REVIEW ONLY — DO NOT APPLY TO PRODUCTION OR RUN AUTOMATICALLY.
-- Prerequisites: privileged-function security audit, pgcrypto extension review,
-- isolated signer/reader credentials, key provisioning, revocation semantics,
-- signed HTTP session E2E, live provider/settlement evidence, explicit release.
-- The only production key must be provisioned separately via an approved
-- secret-management process. NO key or password is included here.
-- This migration must be compared against the isolated Neon trial BEFORE use.
BEGIN;

-- Fail closed if the separately reviewed NOLOGIN function-owner role is absent.
-- NEVER let SECURITY DEFINER retain the migration runner's broad privileges.
-- This role is NOT auto-created or granted privileges by this review script.
DO $owner_gate$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_roles
   WHERE rolname='portal_report_fn_owner'
     AND rolcanlogin=false AND rolsuper=false AND rolbypassrls=false
     AND rolcreatedb=false AND rolcreaterole=false AND rolreplication=false
 ) THEN
   RAISE EXCEPTION 'review-report-function-owner-unverified';
 END IF;
END;
$owner_gate$;

-- pgcrypto availability and extension placement must be independently approved.
-- Do not silently install or relocate extensions in a live database.
CREATE SCHEMA IF NOT EXISTS portal_authz;
REVOKE ALL ON SCHEMA portal_authz FROM PUBLIC;

CREATE TABLE IF NOT EXISTS portal_authz.signing_keys (
  key_id TEXT PRIMARY KEY,
  secret TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_authz.consumed_claims (
  claim_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  expires_at BIGINT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE portal_authz.signing_keys FROM PUBLIC;
REVOKE ALL ON TABLE portal_authz.consumed_claims FROM PUBLIC;

-- Requires approved pgcrypto installed with hmac(bytea,bytea,text)
-- under portal_authz, without placing keys in the reader's search path.
CREATE OR REPLACE FUNCTION public.portal_verified_one_time_envelope_review(
  p_tenant UUID,p_expires BIGINT,p_claim_id UUID,p_mac TEXT)
RETURNS TABLE("authorized" BOOLEAN,"tenantId" UUID,"reports" JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_secret TEXT;
  v_expected TEXT;
  v_now BIGINT;
  v_payload TEXT;
  v_consumed UUID;
BEGIN
  IF p_tenant IS NULL OR p_expires IS NULL OR p_claim_id IS NULL OR p_mac IS NULL
     OR p_mac !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  v_now=floor(extract(epoch from clock_timestamp()))::bigint;
  IF p_expires<v_now OR p_expires>v_now+90 THEN RETURN; END IF;
  SELECT k.secret INTO v_secret FROM portal_authz.signing_keys k WHERE k.key_id='review-v1';
  IF v_secret IS NULL THEN RETURN; END IF;
  v_payload='portal-one-time-report-v1|'||p_tenant::text||'|'||p_expires::text||'|'||p_claim_id::text;
  v_expected=encode(portal_authz.hmac(convert_to(v_payload,'UTF8'),
    convert_to(v_secret,'UTF8'),'sha256'),'hex');
  IF p_mac<>v_expected THEN RETURN; END IF;
  -- ALTERNATIVE DESIGN, NOT PRODUCTION-APPROVED:
  -- All pilot entitlement writers and account-state writers MUST take the
  -- identical transaction-scoped advisory lock before any grant/revoke.
  -- Merely adding this lock to the report reader is NOT effective.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('portal-pilot-lock-v1:'||p_tenant::text,0));
  -- Lock is held until the gateway's explicit COMMIT/ROLLBACK.
  -- READ COMMITTED provides a fresh snapshot after waiting for revocation.
  IF NOT EXISTS(SELECT 1 FROM public.clients c
    WHERE c.id=p_tenant AND c.status='active') THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_pilot_access pilot
    WHERE pilot.client_id=p_tenant AND pilot.revoked_at IS NULL
      AND pilot.expires_at>clock_timestamp()) THEN RETURN; END IF;
  -- Review-only pilot entitlement. Paid Paddle entitlement is intentionally
  -- not supported in this DB function until a separately approved design.
  -- Lock ordering/rollback and session-revocation must be evaluated E2E.
  -- Unique key arbitrates competing claims; return no rows on replay.
  INSERT INTO portal_authz.consumed_claims(claim_id,tenant_id,expires_at)
    VALUES(p_claim_id,p_tenant,p_expires)
    ON CONFLICT(claim_id) DO NOTHING RETURNING claim_id INTO v_consumed;
  IF v_consumed IS NULL THEN RETURN; END IF;
  -- One authoritative envelope only after the signed one-use claim succeeds.
  -- Denial/replay return ZERO rows; authorized zero-comparison returns ONE row
  -- with authorized=true and reports=[], avoiding the old ambiguity.
  RETURN QUERY SELECT true,p_tenant,COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'clientId',c.client_id,'query',c.query,
      'results',c.results,'createdAt',c.created_at)
      ORDER BY c.created_at DESC)
    FROM (SELECT client_id,query,results,created_at
      FROM public.ai_provider_comparisons
      WHERE client_id=p_tenant ORDER BY created_at DESC LIMIT 20) c
  ),'[]'::jsonb);
END; $$;

ALTER FUNCTION public.portal_verified_one_time_envelope_review(UUID,BIGINT,UUID,TEXT)
  OWNER TO portal_report_fn_owner;

REVOKE ALL ON FUNCTION public.portal_verified_one_time_envelope_review(UUID,BIGINT,UUID,TEXT) FROM PUBLIC;

-- Deliberately no reader role or EXECUTE GRANT in this review migration.
-- A distinct, audited role and a narrowly reviewed explicit grant are separate
-- mandatory steps. The previous broad owner bypassed RLS; the current isolated trial owner does not:
-- function ownership and all SECURITY DEFINER privileges must be reviewed;
-- the definer must also have narrowly scoped SELECT on client_pilot_access.
-- Explicitly separate nonce replay from account/session revocation, refunds,
-- pilot expiration, entitlement checks, signing key rotation and ledger cleanup.
COMMIT;
