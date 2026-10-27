-- Explicit operator migration. Never run automatically from an HTTP request.
BEGIN;
CREATE TABLE IF NOT EXISTS arge_memberships (
 tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','manager','analyst','viewer','agent')),
 enabled BOOLEAN NOT NULL DEFAULT FALSE,PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE IF NOT EXISTS arge_entitlements (
 tenant_id TEXT NOT NULL,service_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'inactive',
 revoked BOOLEAN NOT NULL DEFAULT FALSE,expires_at TIMESTAMPTZ NOT NULL,not_before TIMESTAMPTZ,
 consent_verified BOOLEAN NOT NULL DEFAULT FALSE,consent_revoked BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(tenant_id,service_id),CHECK(not_before IS NULL OR not_before<expires_at)
);
CREATE TABLE IF NOT EXISTS arge_revenue_ledger (
 tenant_id TEXT NOT NULL,record_kind TEXT NOT NULL CHECK(record_kind IN ('expected','invoiced')),
 id TEXT NOT NULL,subscription_id TEXT NOT NULL,source_id TEXT NOT NULL,
 period TEXT NOT NULL CHECK(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 amount_minor TEXT NOT NULL CHECK(amount_minor ~ '^(-?[1-9][0-9]{0,17}|0)$'),
 PRIMARY KEY(tenant_id,record_kind,id)
);
CREATE TABLE IF NOT EXISTS arge_audit_events (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,service_id TEXT NOT NULL,
 event_type TEXT NOT NULL,occurred_at TIMESTAMPTZ NOT NULL,payload JSONB NOT NULL,
 UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS arge_report_previews (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,request_id TEXT NOT NULL,kind TEXT NOT NULL,
 report JSONB NOT NULL,audit_event_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(tenant_id,request_id),
 FOREIGN KEY(tenant_id,audit_event_id) REFERENCES arge_audit_events(tenant_id,id) DEFERRABLE INITIALLY DEFERRED
);
-- A persisted audit event may justify exactly one report for a tenant.
-- This idempotent index also protects tables created by an earlier migration run.
CREATE UNIQUE INDEX IF NOT EXISTS arge_report_previews_tenant_audit_unique
 ON arge_report_previews(tenant_id,audit_event_id);
-- BEGIN ARGE AUDIT INDEX GUARD
-- IF NOT EXISTS alone does not verify an existing same-named index is unique
-- or covers the intended columns. Fail the whole operator transaction closed.
DO $audit_guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1
  FROM pg_class idx
  JOIN pg_namespace ns ON ns.oid=idx.relnamespace
  JOIN pg_index meta ON meta.indexrelid=idx.oid
  JOIN pg_class tbl ON tbl.oid=meta.indrelid
  WHERE ns.nspname=current_schema()
   AND tbl.relname='arge_report_previews'
   AND idx.relname='arge_report_previews_tenant_audit_unique'
   AND meta.indisunique AND meta.indisvalid AND meta.indisready
   AND meta.indnkeyatts=2 AND meta.indnatts=2
   AND meta.indpred IS NULL
   AND pg_get_indexdef(idx.oid,1,true)='tenant_id'
   AND pg_get_indexdef(idx.oid,2,true)='audit_event_id'
 ) THEN
  RAISE EXCEPTION 'arge_report_previews_tenant_audit_unique is missing or invalid';
 END IF;
END
$audit_guard$;
-- END ARGE AUDIT INDEX GUARD
-- BEGIN ARGE REQUEST IDEMPOTENCY GUARD
-- CREATE TABLE IF NOT EXISTS does not repair an existing table lacking
-- tenant-scoped request uniqueness. Without this index, concurrent requests
-- can duplicate reports or fail ON CONFLICT(tenant_id,request_id).
DO $request_guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1
  FROM pg_class idx
  JOIN pg_namespace ns ON ns.oid=idx.relnamespace
  JOIN pg_index meta ON meta.indexrelid=idx.oid
  JOIN pg_class tbl ON tbl.oid=meta.indrelid
  WHERE ns.nspname=current_schema()
   AND tbl.relname='arge_report_previews'
   AND meta.indisunique AND meta.indisvalid AND meta.indisready
   AND meta.indnkeyatts=2 AND meta.indnatts=2
   AND meta.indpred IS NULL AND meta.indexprs IS NULL
   AND pg_get_indexdef(idx.oid,1,true)='tenant_id'
   AND pg_get_indexdef(idx.oid,2,true)='request_id'
 ) THEN
  RAISE EXCEPTION 'arge_report_previews tenant request uniqueness is missing or invalid';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_attribute col
  JOIN pg_class tbl ON tbl.oid=col.attrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  WHERE ns.nspname=current_schema()
   AND tbl.relname='arge_report_previews'
   AND col.attname='request_id'
   AND col.attnum>0 AND NOT col.attisdropped AND col.attnotnull
 ) THEN
  RAISE EXCEPTION 'arge_report_previews request_id must be NOT NULL';
 END IF;
END
$request_guard$;
-- END ARGE REQUEST IDEMPOTENCY GUARD
-- BEGIN ARGE TENANT AUDIT FK GUARD
-- CREATE TABLE IF NOT EXISTS does not repair an existing table with a missing
-- or weakened foreign key. Require the exact tenant-scoped, validated FK.
DO $audit_fk_guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1
  FROM pg_constraint fk
  JOIN pg_class report_table ON report_table.oid=fk.conrelid
  JOIN pg_namespace report_ns ON report_ns.oid=report_table.relnamespace
  JOIN pg_class audit_table ON audit_table.oid=fk.confrelid
  JOIN pg_namespace audit_ns ON audit_ns.oid=audit_table.relnamespace
  WHERE report_ns.nspname=current_schema()
   AND audit_ns.nspname=current_schema()
   AND report_table.relname='arge_report_previews'
   AND audit_table.relname='arge_audit_events'
   AND fk.contype='f' AND fk.convalidated
   AND fk.condeferrable AND fk.condeferred
   -- NO ACTION preserves audit evidence; a legacy CASCADE FK must not pass.
   AND fk.confdeltype='a' AND fk.confupdtype='a'
   -- A second legacy FK can cascade even when the intended NO ACTION FK exists.
   AND NOT EXISTS (
    SELECT 1 FROM pg_constraint competing_fk
    WHERE competing_fk.conrelid=report_table.oid
     AND competing_fk.confrelid=audit_table.oid
     AND competing_fk.contype='f'
     AND (competing_fk.confdeltype<>'a' OR competing_fk.confupdtype<>'a')
   )
   AND fk.conkey=ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid=report_table.oid AND attname='tenant_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute WHERE attrelid=report_table.oid AND attname='audit_event_id' AND NOT attisdropped)
   ]
   AND fk.confkey=ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid=audit_table.oid AND attname='tenant_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute WHERE attrelid=audit_table.oid AND attname='id' AND NOT attisdropped)
   ]
 ) THEN
  RAISE EXCEPTION 'arge_report_previews tenant audit foreign key is missing or invalid';
 END IF;
END
$audit_fk_guard$;
-- END ARGE TENANT AUDIT FK GUARD
-- BEGIN ARGE REQUIRED AUDIT COLUMNS GUARD
-- An existing table may have nullable tenant/audit references even though
-- CREATE TABLE IF NOT EXISTS specifies NOT NULL. NULL bypasses composite FK
-- enforcement, allowing unscoped or unaudited report evidence.
DO $audit_not_null_guard$
BEGIN
 IF (
  SELECT COUNT(*)
  FROM pg_attribute col
  JOIN pg_class tbl ON tbl.oid=col.attrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  WHERE ns.nspname=current_schema()
   AND tbl.relname='arge_report_previews'
   AND col.attname IN ('tenant_id','audit_event_id')
   AND col.attnum>0 AND NOT col.attisdropped AND col.attnotnull
 ) <> 2 THEN
  RAISE EXCEPTION 'arge_report_previews required audit columns must be NOT NULL';
 END IF;
END
$audit_not_null_guard$;
-- END ARGE REQUIRED AUDIT COLUMNS GUARD
COMMIT;
