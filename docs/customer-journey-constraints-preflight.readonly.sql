-- READ-ONLY exact constraint-name audit for the review-only customer journey migrations.
-- Structural presence is necessary, but never sufficient for a production release.
-- Does not access application rows, personal information, token material, or secrets.
-- Expected names reflect PostgreSQL's default constraint names in these draft migrations.
-- If a reviewed migration renames a constraint, update this list only after inspecting its
-- actual columns and definition; do not mark a missing constraint as passing.
WITH expected(table_name,constraint_name,kind) AS (
 VALUES
 ('lead_email_challenges','lead_email_challenges_pkey','p'),
 ('lead_email_challenges','lead_email_challenges_lead_id_fkey','f'),
 ('applicant_assessment_links','applicant_assessment_links_pkey','p'),
 ('applicant_assessment_links','applicant_assessment_links_lead_id_fkey','f'),
 ('applicant_assessment_links','applicant_assessment_links_prospect_id_fkey','f'),
 ('applicant_assessment_links','applicant_assessment_links_prospect_id_key','u'),
 ('applicant_assessment_links','applicant_assessment_links_review_id_key','u'),
 ('applicant_domain_challenges','applicant_domain_challenges_pkey','p'),
 ('applicant_domain_challenges','applicant_domain_challenges_lead_id_fkey','f'),
 ('applicant_domain_challenges','applicant_domain_challenges_prospect_id_fkey','f'),
 ('applicant_domain_challenges','applicant_domain_challenges_review_id_key','u'),
 ('applicant_assessment_deliveries','applicant_assessment_deliveries_pkey','p'),
 ('applicant_assessment_deliveries','applicant_assessment_deliveries_lead_id_key','u'),
 ('applicant_assessment_deliveries','applicant_assessment_deliveries_lead_id_fkey','f'),
 ('applicant_assessment_deliveries','applicant_assessment_deliveries_prospect_id_fkey','f'),
 ('verified_customer_settlements','verified_customer_settlements_pkey','p'),
 ('verified_customer_settlements','verified_customer_settlements_payment_id_fkey','f'),
 ('verified_customer_settlements','verified_customer_settlements_client_id_fkey','f'),
 ('verified_customer_settlements','verified_customer_settlements_paddle_event_id_key','u'),
 ('verified_customer_settlements','verified_customer_settlements_transaction_id_key','u')
)
SELECT e.table_name,e.constraint_name,
 CASE e.kind WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'f' THEN 'FOREIGN KEY' END AS expected_kind,
 CASE WHEN c.oid IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS metadata_status,
 CASE WHEN c.oid IS NULL THEN NULL ELSE pg_catalog.pg_get_constraintdef(c.oid) END AS observed_definition
FROM expected e
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
LEFT JOIN pg_catalog.pg_class t ON t.relnamespace=n.oid AND t.relname=e.table_name AND t.relkind IN ('r','p')
LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid=t.oid AND c.conname=e.constraint_name AND c.contype=e.kind::"char"
ORDER BY e.table_name,e.constraint_name;
