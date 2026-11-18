-- REVIEW ONLY: read-only Neon fixture isolation and permission preflight.
-- Run ONLY with database_name=portal_acceptance_fixture_20261118 on
-- project ancient-water-34496424, branch br-fragrant-snow-b248fia4.
-- This query never provisions roles, migrates a database or reads customer rows.
-- A PASS is metadata evidence, NOT production or report-RPC acceptance.
WITH context AS (
 SELECT current_database() = 'portal_acceptance_fixture_20261118' AS exact_fixture,
        current_database() <> 'neondb' AS not_existing_customer_db
), metadata AS (
 SELECT to_regclass('public.clients') IS NOT NULL AS synthetic_client_table,
        to_regclass('public.client_pilot_access') IS NOT NULL AS synthetic_pilot_table,
        to_regclass('public.ai_provider_comparisons') IS NOT NULL AS synthetic_report_table,
        to_regclass('portal_authz.signing_keys') IS NOT NULL AS private_key_table,
        to_regclass('portal_authz.consumed_claims') IS NOT NULL AS private_nonce_table,
        to_regprocedure('public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)') IS NOT NULL AS report_rpc_present,
        EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='portal_report_fn_owner'
         AND rolcanlogin=false AND rolsuper=false AND rolbypassrls=false) AS narrow_definer_owner,
        NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles r ON m.member=r.oid
          WHERE r.rolname='portal_report_fn_owner') AS owner_has_no_role_membership,
        NOT has_table_privilege('portal_report_fn_owner','public.payments','SELECT') AS no_payment_read,
        NOT has_table_privilege('portal_report_fn_owner','public.client_credentials','SELECT') AS no_credential_read,
        NOT has_table_privilege('portal_report_fn_owner','portal_authz.signing_keys','INSERT') AS no_key_write,
        NOT has_table_privilege('portal_report_fn_owner','portal_authz.consumed_claims','DELETE') AS no_nonce_delete
)
SELECT current_database() AS inspected_database,
       context.exact_fixture AND context.not_existing_customer_db AS fixture_identity_ok,
       metadata.synthetic_client_table AND metadata.synthetic_pilot_table
        AND metadata.synthetic_report_table AND metadata.private_key_table
        AND metadata.private_nonce_table AS fixture_structure_ok,
       metadata.narrow_definer_owner AND metadata.owner_has_no_role_membership
        AND metadata.no_payment_read AND metadata.no_credential_read
        AND metadata.no_key_write AND metadata.no_nonce_delete AS owner_least_privilege_ok,
       metadata.report_rpc_present AS report_rpc_present,
       NOT metadata.report_rpc_present AS expected_preinstall_hold
FROM context CROSS JOIN metadata;
