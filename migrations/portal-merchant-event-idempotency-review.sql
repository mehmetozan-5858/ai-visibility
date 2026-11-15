-- REVIEW ONLY / NEVER APPLY TO NEON OR PRODUCTION AUTOMATICALLY.
-- Disposable PostgreSQL fixture candidate for durable, transaction-scoped
-- payment event idempotency; no real provider signatures or monetary events.
-- A production migration needs independently reviewed scope, retention,
-- event namespace, access grants, tenant isolation, rollback and approval.
BEGIN;
SET LOCAL lock_timeout = '2500ms';
SET LOCAL statement_timeout = '10000ms';
CREATE TABLE public.portal_merchant_event_claims_review (
  provider text NOT NULL CHECK(provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  event_id text NOT NULL CHECK(length(event_id) BETWEEN 8 AND 160),
  payment_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(provider,event_id)
);
REVOKE ALL ON public.portal_merchant_event_claims_review FROM PUBLIC;
COMMIT;
-- Test DB disposable teardown drops the database. This file is not deployed.
