-- REVIEW ONLY — DO NOT APPLY TO PRODUCTION OR RUN AUTOMATICALLY.
-- Prerequisites: privileged-function security audit, pgcrypto extension review,
-- isolated signer/reader credentials, key provisioning, revocation semantics,
-- signed HTTP session E2E, live provider/settlement evidence, explicit release.
-- The only production key must be provisioned separately via an approved
-- secret-management process. NO key or password is included here.
-- This migration must be compared against the isolated Neon trial BEFORE use.
BEGIN;

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
CREATE OR REPLACE FUNCTION public.portal_verified_one_time_report(
  p_tenant UUID,p_expires BIGINT,p_claim_id UUID,p_mac TEXT)
RETURNS TABLE("clientId" UUID,query TEXT,results JSONB,"createdAt" TIMESTAMPTZ)
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
  -- Lock the exact tenant rows until the caller COMMIT/ROLLBACK.
  -- This serializes with normal UPDATE/DELETE on the same rows (including
  -- revokePilot's UPDATE client_pilot_access). Never use this procedure
  -- outside the gateway's explicit pinned-connection transaction.
  -- Acquire client first, pilot second, in the same order in all callers.
  PERFORM 1 FROM public.clients c
    WHERE c.id=p_tenant AND c.status='active' FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Re-evaluate the predicate after any competing row update completes.
  -- A stale pilot from a previous snapshot is not sufficient. READ COMMITTED
  -- isolation and bounded lock/statement timeout must be independently tested.
  PERFORM 1 FROM public.client_pilot_access pilot
    WHERE pilot.client_id=p_tenant AND pilot.revoked_at IS NULL
      AND pilot.expires_at>clock_timestamp() FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Recheck expiration after any lock wait, BEFORE nonce consumption.
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
  RETURN QUERY SELECT c.client_id,c.query,c.results,c.created_at
    FROM public.ai_provider_comparisons c
    WHERE c.client_id=p_tenant ORDER BY c.created_at DESC LIMIT 20;
END; $$;

REVOKE ALL ON FUNCTION public.portal_verified_one_time_report(UUID,BIGINT,UUID,TEXT) FROM PUBLIC;

-- Deliberately no reader role or EXECUTE GRANT in this review migration.
-- A distinct, audited role and a narrowly reviewed explicit grant are separate
-- mandatory steps. The owner currently bypasses RLS in the trial environment:
-- function ownership and all SECURITY DEFINER privileges must be reviewed;
-- the definer must also have narrowly scoped SELECT on client_pilot_access.
-- Explicitly separate nonce replay from account/session revocation, refunds,
-- pilot expiration, entitlement checks, signing key rotation and ledger cleanup.
COMMIT;
