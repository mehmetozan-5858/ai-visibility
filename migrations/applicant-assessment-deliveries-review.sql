-- Review-only migration for explicitly approved free-assessment email delivery.
-- No real email or production migration is performed by this file.
BEGIN;
CREATE TABLE IF NOT EXISTS public.applicant_assessment_deliveries (
 id UUID PRIMARY KEY,
 lead_id UUID NOT NULL UNIQUE REFERENCES public.customer_leads(id) ON DELETE RESTRICT,
 prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
 review_id UUID NOT NULL,
 email_fingerprint TEXT NOT NULL CHECK (email_fingerprint ~ '^[0-9a-f]{64}$'),
 status TEXT NOT NULL DEFAULT 'reserved'
   CHECK (status IN ('reserved','provider-accepted','failed')),
 reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 completed_at TIMESTAMPTZ,
 error_code TEXT,
 CONSTRAINT applicant_delivery_completion CHECK (
   (status='reserved' AND completed_at IS NULL)
   OR (status IN ('provider-accepted','failed') AND completed_at IS NOT NULL)
 )
);
COMMIT;
