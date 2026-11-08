-- Run through an explicitly selected migration connection, never an HTTP request.
BEGIN;
CREATE TABLE public.agent_command_ledger (
 sequence INTEGER PRIMARY KEY CHECK (sequence BETWEEN 1 AND 10000),
 operation TEXT NOT NULL CHECK (octet_length(operation) <= 65536),
 previous_hash TEXT CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
 hash TEXT NOT NULL UNIQUE CHECK (hash ~ '^[0-9a-f]{64}$')
);
REVOKE ALL ON public.agent_command_ledger FROM PUBLIC;
COMMIT;
