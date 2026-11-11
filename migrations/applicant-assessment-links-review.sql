-- Review only. Not applied on production.
-- Records a human-reviewed identity link, never proof of payment or analysis delivery.
BEGIN;
CREATE TABLE IF NOT EXISTS public.applicant_assessment_links (
  lead_id UUID PRIMARY KEY REFERENCES public.customer_leads(id) ON DELETE RESTRICT,
  prospect_id UUID NOT NULL UNIQUE REFERENCES public.prospects(id) ON DELETE RESTRICT,
  review_id UUID NOT NULL UNIQUE,
  verified_domain TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT assessment_link_domain_nonempty CHECK (length(trim(verified_domain))>=4)
);
CREATE INDEX IF NOT EXISTS applicant_assessment_links_active_idx
 ON public.applicant_assessment_links(prospect_id) WHERE revoked_at IS NULL;
COMMIT;
