-- Review only. No production migration in this PR.
-- Evidence row may be inserted ONLY in the same transaction as a successfully
-- linked and amount/currency-validated signed Paddle transaction.completed event.
BEGIN;
CREATE TABLE IF NOT EXISTS public.verified_customer_settlements (
  payment_id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  paddle_event_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verified_settlements_paddle_event CHECK (paddle_event_id ~ '^(evt|ntfsimevt)_[a-z0-9]+$'),
  CONSTRAINT verified_settlements_transaction CHECK (transaction_id ~ '^txn_[a-z0-9]+$')
);
CREATE INDEX IF NOT EXISTS verified_customer_settlements_client_idx
  ON public.verified_customer_settlements(client_id);
COMMIT;
