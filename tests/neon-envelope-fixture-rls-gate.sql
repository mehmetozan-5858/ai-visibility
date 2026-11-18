-- REVIEW ONLY / READ-ONLY: independent RLS release gate for the empty
-- portal_acceptance_fixture_20261118 Neon database.
-- Does not assert that no RLS is an actual customer data leak: this fixture
-- holds zero customer rows. Does not change privileges, schemas or policies.
-- The 18 signed-envelope metadata conditions do NOT cover this RLS gate.
WITH expected(name, sensitive) AS (
 VALUES ('clients',true),('client_pilot_access',true),
        ('ai_provider_comparisons',true),('client_credentials',true),
        ('payments',true)
), inventory AS (
 SELECT e.name, e.sensitive, c.oid,
        COALESCE(c.relrowsecurity,false) AS rls_enabled,
        COALESCE(c.relforcerowsecurity,false) AS rls_forced,
        CASE WHEN c.oid IS NULL THEN 0 ELSE
          (SELECT count(*)::integer FROM pg_catalog.pg_policy p
           WHERE p.polrelid=c.oid) END AS policy_count
 FROM expected e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
  AND c.relname=e.name AND c.relkind IN ('r','p')
)
SELECT current_database() AS inspected_database,
       current_database()='portal_acceptance_fixture_20261118' AS exact_fixture,
       count(*)::integer AS expected_tables,
       count(oid)::integer AS present_tables,
       count(*) FILTER (WHERE oid IS NOT NULL AND rls_enabled)::integer AS rls_enabled_tables,
       count(*) FILTER (WHERE oid IS NOT NULL AND rls_forced)::integer AS rls_forced_tables,
       jsonb_agg(jsonb_build_object(
         'name',name,'tablePresent',oid IS NOT NULL,
         'rlsEnabled',rls_enabled,'rlsForced',rls_forced,
         'policyCount',policy_count) ORDER BY name) AS table_evidence,
       bool_and(oid IS NOT NULL AND rls_enabled AND
         (NOT sensitive OR rls_forced)) AS rls_schema_precondition_pass
FROM inventory;
