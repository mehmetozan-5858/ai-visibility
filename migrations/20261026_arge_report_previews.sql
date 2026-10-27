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
COMMIT;
