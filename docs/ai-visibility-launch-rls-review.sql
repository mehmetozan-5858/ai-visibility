-- AI Visibility launch: OPTIONAL PostgreSQL RLS policy template.
-- REVIEW ONLY; DO NOT APPLY. Requires trusted server-side transaction scope.
-- This migration must not run with untrusted client-settable tenant context.
-- First validate that clients.id is UUID and that app.current_client_id is set
-- only by authenticated server code via SET LOCAL in a dedicated transaction.
ALTER TABLE ai_visibility_launch_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_launch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_launch_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_launch_events FORCE ROW LEVEL SECURITY;
-- Do not grant table access to public/anonymous application roles.
REVOKE ALL ON ai_visibility_launch_entitlements FROM PUBLIC;
REVOKE ALL ON ai_visibility_launch_events FROM PUBLIC;
-- Explicit read policies; write operations require separately reviewed,
-- server-side roles and auditable stored procedures.
CREATE POLICY launch_entitlements_tenant_read ON ai_visibility_launch_entitlements
 FOR SELECT USING (client_id = NULLIF(current_setting('app.current_client_id', true),'')::uuid);
CREATE POLICY launch_events_tenant_read ON ai_visibility_launch_events
 FOR SELECT USING (client_id = NULLIF(current_setting('app.current_client_id', true),'')::uuid);
-- IMPORTANT: Custom PostgreSQL settings alone are NOT authentication.
-- An untrusted SQL client can set custom settings; do not grant direct DB access.
-- Confirm connection pooling, transaction scoping and app role grants before use.
