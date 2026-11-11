-- READ-ONLY preflight for a separately approved production acceptance review.
-- Do not interpret presence of a table as proof that an applicant, provider or payment works.
-- NO data rows, customer identities, tokens or secrets are accessed.
-- Run with a restricted reader role against the independently verified TARGET database.
WITH requirements(table_name,column_name) AS (
 VALUES
 ('customer_leads','id'),('customer_leads','email'),('customer_leads','website'),
 ('prospects','id'),('prospects','domain'),
 ('answer_evidence_runs','entity_id'),('answer_evidence_runs','result'),
 ('lead_email_challenges','lead_id'),('lead_email_challenges','consumed_at'),
 ('applicant_assessment_links','lead_id'),('applicant_assessment_links','prospect_id'),
 ('applicant_assessment_links','review_id'),('applicant_assessment_links','revoked_at'),
 ('applicant_domain_challenges','lead_id'),('applicant_domain_challenges','verified_at'),
 ('applicant_assessment_deliveries','lead_id'),('applicant_assessment_deliveries','status'),
 ('verified_customer_settlements','payment_id'),('verified_customer_settlements','client_id'),
 ('verified_customer_settlements','paddle_event_id'),('verified_customer_settlements','transaction_id'),
 ('payments','id'),('payments','client_id'),('payments','status'),('payments','method'),
 ('clients','id'),('clients','status')
)
SELECT r.table_name,r.column_name,
 CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS schema_status
FROM requirements r
LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
ORDER BY r.table_name,r.column_name;
