-- BLOCKED DESIGN SKETCH / NOT A MIGRATION / DO NOT EXECUTE.
-- Security review identified potential row-lock/advisory-lock inversion.
-- See docs/security/neon-pilot-mutation-security-review.md.
-- Prefer an audited writer function that acquires the advisory transaction
-- lock BEFORE table DML; no row trigger installation until independently proven.
-- Scope: isolated Neon branch br-plain-poetry-b2u7f7a6.
-- A design sketch to force writers through the same per-tenant transaction lock
-- without granting UPDATE on clients or client_pilot_access to the report owner.
-- All functions/triggers here are UNDEPLOYED and UNTESTED.
--
-- Risk review required: trigger firing order, transactions, failure semantics,
-- READ COMMITTED snapshot visibility, signing/grant paths, and rollbacks.
-- PostgreSQL advisory locks are cooperative; the triggers below enforce this
-- only for changes to the two audited tables. Other data sources require audit.
--
-- Proposed canonical lock key expression (same on every path):
-- pg_catalog.hashtextextended('portal-pilot-v1:' || tenant_uuid::text, 0)

-- 1. Proposed trigger guarding all writes to pilot grants.
CREATE OR REPLACE FUNCTION portal_authz_trial.guard_pilot_access_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'pg_catalog'
AS $$
DECLARE
 v_tenant uuid;
BEGIN
 IF TG_OP = 'INSERT' THEN
   v_tenant := NEW.client_id;
 ELSIF TG_OP = 'DELETE' THEN
   v_tenant := OLD.client_id;
 ELSE
   IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
     RAISE EXCEPTION 'pilot grant reassignment forbidden';
   END IF;
   v_tenant := OLD.client_id;
 END IF;
 IF v_tenant IS NULL THEN
   RAISE EXCEPTION 'pilot tenant is required';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('portal-pilot-v1:' || v_tenant::text, 0)
 );
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Installing triggers is intentionally left to an explicitly approved
-- isolated-branch migration. Proposed attachment:
-- CREATE TRIGGER portal_pilot_grant_lock BEFORE INSERT OR UPDATE OR DELETE
-- ON public.client_pilot_access FOR EACH ROW
-- EXECUTE FUNCTION portal_authz_trial.guard_pilot_access_mutation();

-- 2. Proposed client status/delete guard (all mutations of clients instead of
-- only status gives conservative serialization; validate operational cost).
CREATE OR REPLACE FUNCTION portal_authz_trial.guard_client_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'pg_catalog'
AS $$
DECLARE
 v_tenant uuid;
BEGIN
 IF TG_OP = 'INSERT' THEN
   v_tenant := NEW.id;
 ELSIF TG_OP = 'DELETE' THEN
   v_tenant := OLD.id;
 ELSE
   IF NEW.id IS DISTINCT FROM OLD.id THEN
     RAISE EXCEPTION 'client primary-key reassignment forbidden';
   END IF;
   v_tenant := OLD.id;
 END IF;
 IF v_tenant IS NULL THEN
   RAISE EXCEPTION 'client tenant is required';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('portal-pilot-v1:' || v_tenant::text, 0)
 );
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Proposed attachment after separate review:
-- CREATE TRIGGER portal_client_status_lock BEFORE INSERT OR UPDATE OR DELETE
-- ON public.clients FOR EACH ROW
-- EXECUTE FUNCTION portal_authz_trial.guard_client_mutation();

-- 3. The reader must acquire the identical advisory_xact_lock after HMAC and
-- expiry validation and BEFORE client/pilot access lookups and claim INSERT:
-- PERFORM pg_catalog.pg_advisory_xact_lock(
--   pg_catalog.hashtextextended('portal-pilot-v1:' || p_tenant::text, 0)
-- );
-- Then check client.status='active', pilot.revoked_at IS NULL, pilot expiry
-- and consumed_claims uniqueness, and select only p_tenant rows.
--
-- 4. IMPORTANT: This is not a complete deploy-ready SQL migration.
-- Validate trigger permission to execute functions from the target role,
-- schema USAGE restrictions, safe naming, owner privileges, and redefinition.
-- Audit TRUNCATE (row triggers do NOT fire for it), table owner/DDL bypass,
-- foreign keys/cascades, COPY, bulk backfills, and administrative bypasses.
-- Disallow or handle pilot TRUNCATE separately before production.
-- If long transactions can block revocation, enforce timeouts and operational
-- safeguards. Need at least two independent DB sessions to prove behavior.
-- Rollout requires safe trigger install, rollback plan and isolated synthetic data.
