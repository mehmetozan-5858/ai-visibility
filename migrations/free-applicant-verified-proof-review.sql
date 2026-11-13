-- REVIEW ONLY. Not applied to any live Neon database.
-- Evidence is written only by an authenticated server-side collector after
-- the provider response and zero-cost provider receipt have been checked.
-- This schema never authenticates users, invokes AI, charges money or
-- approves customer-visible scores. No automatic migration/deploy.
BEGIN;

CREATE TABLE IF NOT EXISTS public.free_applicant_verified_receipts (
 id TEXT PRIMARY KEY,
 tenant_id UUID NOT NULL,
 domain TEXT NOT NULL,
 provider TEXT NOT NULL CHECK (provider IN ('OpenRouter','Gemini')),
 model TEXT NOT NULL,
 response_id TEXT NOT NULL CHECK (length(response_id) BETWEEN 1 AND 200),
 query_text TEXT NOT NULL,
 amount NUMERIC NOT NULL CHECK (amount = 0),
 currency TEXT NOT NULL CHECK (currency = 'USD'),
 estimated BOOLEAN NOT NULL CHECK (estimated = FALSE),
 operation TEXT NOT NULL CHECK (operation = 'answer-evidence'),
 verified_zero_price BOOLEAN NOT NULL CHECK (verified_zero_price = TRUE),
 response_complete BOOLEAN NOT NULL CHECK (response_complete = TRUE),
 verified_model_identity BOOLEAN NOT NULL CHECK (verified_model_identity = TRUE),
 CONSTRAINT free_applicant_receipt_scope_unique
   UNIQUE (id,tenant_id,domain,provider,model,response_id,query_text),
 CONSTRAINT free_applicant_response_identity_unique
   UNIQUE (tenant_id,provider,response_id)
);

CREATE TABLE IF NOT EXISTS public.free_applicant_verified_observations (
 receipt_id TEXT PRIMARY KEY,
 tenant_id UUID NOT NULL,
 domain TEXT NOT NULL,
 provider TEXT NOT NULL,
 model TEXT NOT NULL,
 response_id TEXT NOT NULL,
 query_text TEXT NOT NULL,
 result_text TEXT NOT NULL,
 brand_mentioned BOOLEAN NOT NULL,
 brand_prompted BOOLEAN NOT NULL CHECK (brand_prompted=FALSE),
 truncated BOOLEAN NOT NULL CHECK (truncated=FALSE),
 mode TEXT NOT NULL CHECK (mode IN ('api-no-search','openrouter-free-api-no-search')),
 recorded_at TIMESTAMPTZ NOT NULL,
 CONSTRAINT free_applicant_observation_scope_fk
   FOREIGN KEY (receipt_id,tenant_id,domain,provider,model,response_id,query_text)
   REFERENCES public.free_applicant_verified_receipts
     (id,tenant_id,domain,provider,model,response_id,query_text)
   ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS free_applicant_observation_recent_scope_idx
 ON public.free_applicant_verified_observations(tenant_id,domain,recorded_at DESC);

-- Never grant these tables to PUBLIC or browser-facing roles.
-- Review least-privilege DB grants, GDPR/data retention, provider provenance,
-- duplicate backfills, and rollback before any production migration.
COMMIT;
