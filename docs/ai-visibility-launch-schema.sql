-- AI Visibility Works: prospective launch service storage.
-- NOT APPLIED. Requires DB-owner migration approval and rollout review.
-- All business rows are scoped to an existing clients.id.
CREATE TABLE IF NOT EXISTS ai_visibility_launch_entitlements (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL CHECK (service_id IN ('agent-audit-control','agent-commerce-intelligence','candidate-rediscovery','voice-revenue-agent')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','suspended')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  consent_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(client_id,service_id),
  CONSTRAINT valid_launch_window CHECK (expires_at IS NULL OR expires_at > valid_from)
);
CREATE TABLE IF NOT EXISTS ai_visibility_launch_events (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  actor_id TEXT NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  event_type TEXT NOT NULL CHECK (event_type IN ('authorization-allowed','authorization-denied','report-prepared','agent-plan-prepared','approval-requested','service-error')),
  source_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT launch_events_service_fk FOREIGN KEY (client_id,service_id)
    REFERENCES ai_visibility_launch_entitlements(client_id,service_id)
);
CREATE INDEX IF NOT EXISTS launch_events_customer_time_idx
 ON ai_visibility_launch_events(client_id,occurred_at DESC);
-- NOTE: Neither table is exposed to browsers. Server must authenticate, derive
-- client_id from session, check entitlement/approval and use parameterized SQL.
-- In PostgreSQL installations with direct tenant DB connections, add and test
-- RLS with authenticated tenant identity before granting any direct SELECT.
