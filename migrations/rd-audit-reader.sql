-- One-time migration. Rehearse on an isolated branch before production.
BEGIN;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rd_audit_reader') OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='rd_audit') THEN
  RAISE EXCEPTION 'Audit reader objects already exist; manual review required';
 END IF;
 CREATE ROLE rd_audit_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 CREATE SCHEMA rd_audit;
END $$;
CREATE VIEW rd_audit.real_record_summary WITH (security_barrier=true) AS
WITH event_candidates AS (
 SELECT status,created_at FROM public.agent_shared_board
 WHERE created_at>=NOW()-INTERVAL '7 days' AND created_at<=NOW()
 ORDER BY created_at DESC LIMIT 201
), event_sample AS (SELECT * FROM event_candidates ORDER BY created_at DESC LIMIT 200),
cost_candidates AS (
 SELECT amount,currency,estimated,metadata->>'pricingSource' AS pricing_source,created_at
 FROM public.cost_ledger WHERE created_at>=NOW()-INTERVAL '7 days' AND created_at<=NOW()
 ORDER BY created_at DESC LIMIT 201
), cost_sample AS (SELECT * FROM cost_candidates ORDER BY created_at DESC LIMIT 200)
SELECT NOW() AS "checkedAt",
 (SELECT COUNT(*)::int FROM event_sample) AS "eventCount",
 (SELECT COUNT(*)>200 FROM event_candidates) AS "eventLimited",
 (SELECT MAX(created_at) FROM event_sample) AS "latestEventAt",
 (SELECT COUNT(*)::int FROM event_sample WHERE status='completed') AS "completedCount",
 (SELECT COUNT(*)::int FROM event_sample WHERE status IN ('failed','error','needs-attention')) AS "attentionCount",
 (SELECT COUNT(*)::int FROM event_sample WHERE status IS NULL OR status NOT IN ('completed','failed','error','needs-attention')) AS "otherCount",
 (SELECT COUNT(*)::int FROM cost_sample) AS "costCount",
 (SELECT COUNT(*)>200 FROM cost_candidates) AS "costLimited",
 (SELECT COUNT(*)::int FROM cost_sample WHERE estimated IS TRUE) AS "estimatedCostCount",
 (SELECT COUNT(*)::int FROM cost_sample WHERE estimated IS NULL OR pricing_source='unconfigured-zero' OR amount IS NULL OR amount<0 OR amount::text IN ('NaN','Infinity','-Infinity')) AS "unknownCostCount";
GRANT USAGE ON SCHEMA rd_audit TO rd_audit_reader;
GRANT SELECT ON rd_audit.real_record_summary TO rd_audit_reader;
DO $$
BEGIN
 IF has_table_privilege('rd_audit_reader','public.agent_shared_board','SELECT') OR
    has_table_privilege('rd_audit_reader','public.cost_ledger','SELECT') OR
    has_table_privilege('rd_audit_reader','rd_audit.real_record_summary','INSERT,UPDATE,DELETE') OR
    has_schema_privilege('rd_audit_reader','rd_audit','CREATE') THEN
  RAISE EXCEPTION 'Unexpected audit reader privileges';
 END IF;
 EXECUTE format('GRANT rd_audit_reader TO %I WITH INHERIT FALSE, SET TRUE',current_user);
END $$;
COMMIT;

