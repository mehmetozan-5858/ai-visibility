-- READ-ONLY metadata inspection of customer-acceptance constraints.
-- No production migration, DML, user rows, API keys or tokens.
-- Run only against a verified target branch with a least-privileged reader.
-- Presence of constraints does not establish live payment, ownership or report access.
WITH expected(table_name,kind) AS (
 VALUES
 ('lead_email_challenges','p'),
 ('lead_email_challenges','f'),
 ('applicant_assessment_links','p'),
 ('applicant_assessment_links','f'),
 ('applicant_assessment_links','u'),
 ('applicant_domain_challenges','p'),
 ('applicant_domain_challenges','f'),
 ('applicant_assessment_deliveries','p'),
 ('applicant_assessment_deliveries','u'),
 ('applicant_assessment_deliveries','f'),
 ('verified_customer_settlements','p'),
 ('verified_customer_settlements','u'),
 ('verified_customer_settlements','f')
)
SELECT e.table_name,
 CASE e.kind WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'f' THEN 'FOREIGN KEY' END AS required_kind,
 CASE WHEN EXISTS (
   SELECT 1 FROM pg_catalog.pg_constraint c
   JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname=e.table_name AND c.contype=e.kind::"char"
 ) THEN 'PRESENT' ELSE 'MISSING' END AS metadata_status
FROM (SELECT DISTINCT table_name,kind FROM expected) e
ORDER BY e.table_name,e.kind;
