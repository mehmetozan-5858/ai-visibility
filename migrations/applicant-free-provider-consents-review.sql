-- REVIEW ONLY. Not applied to production. Consent must be collected by a
-- verified applicant action via a separate authenticated flow, never inferred
-- from email verification, a reviewed domain link or admin intent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.applicant_free_provider_consents (
  lead_id UUID NOT NULL REFERENCES public.customer_leads(id) ON DELETE RESTRICT,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('OpenRouter','Gemini')),
  purpose TEXT NOT NULL CHECK (purpose='free-ai-assessment'),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 3 AND 80),
  source TEXT NOT NULL CHECK (source='verified-applicant-action'),
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id,prospect_id,provider,purpose),
  CONSTRAINT applicant_free_provider_consent_valid_time CHECK (expires_at>granted_at)
);
CREATE INDEX IF NOT EXISTS applicant_free_provider_consents_active_idx
 ON public.applicant_free_provider_consents(prospect_id,provider,expires_at)
 WHERE revoked_at IS NULL;
-- No INSERT/UPDATE permission for the public app client. A future verified
-- applicant consent endpoint must enforce anti-CSRF, exact ownership link,
-- source attestation, policy purpose and refusal/withdrawal.
-- An applicant's consent is sensitive permission history. Never grant the
-- anonymous/default role direct table access or a permissive RLS policy.
REVOKE ALL ON TABLE public.applicant_free_provider_consents FROM PUBLIC;
ALTER TABLE public.applicant_free_provider_consents ENABLE ROW LEVEL SECURITY;
-- The server's effective role/ownership and any grants require separate review.
COMMIT;
