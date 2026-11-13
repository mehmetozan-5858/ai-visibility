-- Explicit review-only migration; NOT applied to production.
-- Applicant email proof does NOT create a customer account or authorize payment.
BEGIN;
CREATE TABLE IF NOT EXISTS public.lead_email_challenges (
  lead_id UUID PRIMARY KEY REFERENCES public.customer_leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_digest TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lead_email_challenges_expiry_idx
  ON public.lead_email_challenges(expires_at);
COMMIT;
