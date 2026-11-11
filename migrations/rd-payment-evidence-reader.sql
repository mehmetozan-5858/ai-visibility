-- Additive, one-time review migration; no customer rows are changed.
BEGIN;
CREATE VIEW rd_audit.payment_evidence_readiness WITH (security_barrier=true) AS
WITH candidates AS (
 SELECT status,method,created_at,id FROM public.payments WHERE created_at<=NOW()
 ORDER BY created_at DESC,id DESC LIMIT 201
), sample AS (SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT 200)
SELECT NOW() AS "checkedAt",
 (SELECT COUNT(*)::int FROM sample) AS "recordCount",
 (SELECT COUNT(*)>200 FROM candidates) AS "limited",
 (SELECT COUNT(*)::int FROM sample WHERE status='paid') AS "paidLabelCount",
 (SELECT COUNT(*)::int FROM sample WHERE status='paid' AND method='bank-transfer') AS "bankPaidLabelCount",
 (SELECT COUNT(*)::int FROM sample WHERE status='pending') AS "pendingCount",
 (SELECT COUNT(*)::int FROM sample WHERE status='customer-reported') AS "reportedCount",
 to_regclass('public.verified_customer_settlements') IS NOT NULL AS "settlementTablePresent",
 to_regclass('public.paddle_live_events') IS NOT NULL AS "eventTablePresent",
 to_regclass('public.paddle_live_entities') IS NOT NULL AS "entityTablePresent";
GRANT SELECT ON rd_audit.payment_evidence_readiness TO rd_audit_reader;
DO $$ BEGIN
 IF has_table_privilege('rd_audit_reader','public.payments','SELECT,INSERT,UPDATE,DELETE') OR
 has_table_privilege('rd_audit_reader','rd_audit.payment_evidence_readiness','INSERT,UPDATE,DELETE') THEN
 RAISE EXCEPTION 'Unexpected payment reader privileges';
 END IF;
END $$;
COMMIT;
