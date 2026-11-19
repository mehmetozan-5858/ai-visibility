-- REVIEW ONLY: executable deny-all RLS fixture probe.
-- Must be run on Neon project ancient-water-34496424,
-- branch br-fragrant-snow-b248fia4,
-- database portal_acceptance_fixture_20261118,
-- *as* portal_rls_fixture_reader_20261119, NOT neondb_owner.
-- Requires two synthetic fixture customers; never use real customer rows.
-- This validates negative access only, NOT tenant-positive acceptance.
WITH identity AS (
 SELECT current_database()='portal_acceptance_fixture_20261118' AS fixture,
        current_user='portal_rls_fixture_reader_20261119' AS restricted_reader,
        COALESCE((SELECT NOT rolbypassrls AND NOT rolsuper
          FROM pg_roles WHERE rolname=current_user),false) AS cannot_bypass_rls
), visible AS (
 SELECT (SELECT count(*) FROM public.clients) AS clients,
        (SELECT count(*) FROM public.client_pilot_access) AS pilots,
        (SELECT count(*) FROM public.ai_provider_comparisons) AS reports,
        (SELECT count(*) FROM public.ai_provider_comparisons
          WHERE client_id='11111111-1111-4111-8111-111111111111') AS tenant_a_reports,
        (SELECT count(*) FROM public.ai_provider_comparisons
          WHERE client_id='22222222-2222-4222-8222-222222222222') AS tenant_b_reports
)
SELECT current_database() AS inspected_db, current_user AS inspected_role,
       identity.fixture AND identity.restricted_reader
        AND identity.cannot_bypass_rls AS identity_gate,
       visible.clients=0 AND visible.pilots=0 AND visible.reports=0
        AND visible.tenant_a_reports=0 AND visible.tenant_b_reports=0
        AS deny_all_behavior_pass,
       false AS tenant_positive_behavior_verified,
       false AS signed_rpc_verified
FROM identity CROSS JOIN visible;
