-- REVIEW ONLY — DO NOT APPLY to Neon, staging, or production.
-- Requires preflight and explicit DBA decision. Concurrent normalized reference
-- conflicts must be remediated by an owner, never silently changed/deleted.
-- A UNIQUE index on reference_code does not guarantee uniqueness of
-- replace(reference_code,'-','') which legacy callback lookups use.
--
-- READ-ONLY preflight (reviewed by a DBA before *any* migration):
-- SELECT replace(reference_code,'-','') AS normalized, count(*)
-- FROM public.payments
-- GROUP BY replace(reference_code,'-','')
-- HAVING count(*) > 1;
--
-- Migration candidate: atomic PostgreSQL DDL. Duplicates or lock timeouts
-- abort all changes. A production installation needs separate timeout,
-- maintenance/concurrent-index strategy and rollback approval.
BEGIN;
SET LOCAL lock_timeout = '2500ms';
SET LOCAL statement_timeout = '10000ms';
CREATE UNIQUE INDEX payments_merchant_oid_normalized_unique_review
ON public.payments ((replace(reference_code,'-','')));
COMMIT;
-- Rollback candidate (ONLY with separate explicit DBA approval):
-- DROP INDEX IF EXISTS public.payments_merchant_oid_normalized_unique_review;
