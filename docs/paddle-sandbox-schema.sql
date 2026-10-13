-- Apply ONLY to a dedicated sandbox database. Never to the production DATABASE_URL.
CREATE TABLE IF NOT EXISTS paddle_sandbox_events (
 event_id text PRIMARY KEY, event_type text NOT NULL, entity_id text NOT NULL,
 occurred_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS paddle_sandbox_entities (
 entity_id text PRIMARY KEY, event_type text NOT NULL, status text NOT NULL,
 price_ids jsonb NOT NULL, occurred_at timestamptz NOT NULL, event_id text NOT NULL
);
