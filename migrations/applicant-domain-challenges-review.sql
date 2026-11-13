-- Review only: applied to an isolated Neon branch, NEVER production.
-- Challenge issuance and successful DNS proof are distinct from customer payment/access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.applicant_domain_challenges (
  lead_id UUID PRIMARY KEY REFERENCES public.customer_leads(id) ON DELETE RESTRICT,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
  domain TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  review_id UUID UNIQUE,
  CONSTRAINT applicant_domain_nonce_format CHECK (nonce ~ '^[0-9a-f]{48}$'),
  CONSTRAINT applicant_domain_expiry_order CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS applicant_domain_challenges_expiry_idx ON public.applicant_domain_challenges(expires_at);
COMMIT;
