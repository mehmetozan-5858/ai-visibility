-- REVIEW ONLY / NOT APPLIED TO PRODUCTION.
-- Candidate for the pilot-only one-time report RPC.
-- The caller must already be authorized by the server and the signed claim.
-- Paid customer entitlements MUST use a separate, independently verified path.
-- Every grant/revoke/expiry/suspension writer must share the same tenant lock
-- before this advisory-lock strategy is approved for production.
CREATE OR REPLACE FUNCTION public.portal_trial_one_time_report_pilot_review(
 p_tenant uuid,p_expires bigint,p_claim_id uuid,p_mac text
) RETURNS TABLE("clientId" uuid,query text,results jsonb,"createdAt" timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_secret text;v_expected text;v_now bigint;v_payload text;v_consumed uuid;
BEGIN
 IF p_tenant IS NULL OR p_expires IS NULL OR p_claim_id IS NULL OR
    p_mac IS NULL OR p_mac !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 v_now=floor(extract(epoch FROM clock_timestamp()))::bigint;
 IF p_expires<v_now OR p_expires>v_now+300 THEN RETURN; END IF;
 SELECT k.secret INTO v_secret FROM portal_authz_trial.signing_keys k
 WHERE k.key_id='trial-v1';
 IF v_secret IS NULL THEN RETURN; END IF;
 v_payload='portal-one-time-report-v1|'||p_tenant::text||'|'||
           p_expires::text||'|'||p_claim_id::text;
 v_expected=encode(portal_authz_trial.hmac(
  convert_to(v_payload,'UTF8'),convert_to(v_secret,'UTF8'),'sha256'),'hex');
 IF p_mac<>v_expected THEN RETURN; END IF;
 -- This lock is cooperative. All entitlement writers MUST use the same key.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('portal-pilot-lock-v1:'||p_tenant::text,0));
 IF NOT EXISTS (
  SELECT 1 FROM public.clients c
  JOIN public.client_pilot_access a ON a.client_id=c.id
  WHERE c.id=p_tenant AND c.status='active'
    AND a.revoked_at IS NULL AND a.expires_at>clock_timestamp()
 ) THEN RETURN; END IF;
 INSERT INTO portal_authz_trial.consumed_claims(claim_id,tenant_id,expires_at)
 VALUES(p_claim_id,p_tenant,p_expires)
 ON CONFLICT(claim_id) DO NOTHING RETURNING claim_id INTO v_consumed;
 IF v_consumed IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT r.client_id,r.query,r.results,r.created_at
 FROM public.ai_provider_comparisons r WHERE r.client_id=p_tenant
 ORDER BY r.created_at DESC LIMIT 20;
END $$;
-- Intentionally no GRANT EXECUTE or production route wiring.
