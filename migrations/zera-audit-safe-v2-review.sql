-- REVIEW ONLY. Do not execute automatically on production.
-- ZERA is a pilot customer, never part of the platform's own tenant structure.
-- Apply only after human verification of the pinned UUID and approved release window.
-- This creates NO LOGIN or secrets and does not deploy the application.
BEGIN;

DO $guard$
DECLARE
  found_id uuid;
  matching_count bigint;
BEGIN
  SELECT count(*), min(id)
    INTO matching_count, found_id
    FROM public.clients
   WHERE name = 'ZERA Clothing';
  IF matching_count <> 1 OR found_id IS DISTINCT FROM
      '760cfa32-4fbc-479c-91df-d72d93ca3300'::uuid THEN
    RAISE EXCEPTION 'ZERA identity mismatch; abort safe audit migration';
  END IF;
  IF to_regclass('zera_audit.attempt_status_safe_v2') IS NOT NULL THEN
    RAISE EXCEPTION 'Safe audit view already exists; inspect rather than replace';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='zera_audit_safe_reader') THEN
    RAISE EXCEPTION 'Audit role already exists; inspect grants rather than modify';
  END IF;
END
$guard$;

CREATE ROLE zera_audit_safe_reader
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  NOBYPASSRLS NOINHERIT;
CREATE VIEW zera_audit.attempt_status_safe_v2
  WITH (security_barrier=true)
AS
  SELECT task_id, status, created_at
    FROM public.zera_ai_task_attempts
   WHERE client_id = '760cfa32-4fbc-479c-91df-d72d93ca3300'::uuid;

GRANT USAGE ON SCHEMA zera_audit TO zera_audit_safe_reader;
GRANT SELECT ON zera_audit.attempt_status_safe_v2 TO zera_audit_safe_reader;

-- The service LOGIN is deliberately not created here.
-- Never grant it generic schema-wide read_only: that grants old/future views.
-- Future LOGIN provisioning must use a separate approval with explicit
-- SELECT-only grant on this view, negative tests and secret storage.
COMMIT;
