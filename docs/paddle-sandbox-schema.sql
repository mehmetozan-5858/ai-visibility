-- Apply ONLY to a dedicated sandbox database. Never to the production DATABASE_URL.
CREATE TABLE IF NOT EXISTS paddle_sandbox_events (
 event_id text PRIMARY KEY, event_type text NOT NULL, entity_id text NOT NULL,
 occurred_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS paddle_sandbox_entities (
 entity_id text PRIMARY KEY, event_type text NOT NULL, status text NOT NULL,
 price_ids jsonb NOT NULL, occurred_at timestamptz NOT NULL, event_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS paddle_sandbox_checkout_intents (
 id uuid PRIMARY KEY, client_id text NOT NULL, service_code text NOT NULL,
 price_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('monthly','one-time')),
 created_at timestamptz NOT NULL DEFAULT NOW(), expires_at timestamptz NOT NULL,
 paddle_customer_id text, subscription_id text UNIQUE, initial_transaction_id text UNIQUE
);
CREATE INDEX IF NOT EXISTS paddle_sandbox_intents_client ON paddle_sandbox_checkout_intents(client_id);
CREATE TABLE IF NOT EXISTS paddle_sandbox_customers (customer_id text PRIMARY KEY, client_id text NOT NULL);
