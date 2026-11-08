# Neon isolated acceptance — 9 November 2026 (Türkiye)

Project: ancient-water-34496424. Test branch: review-agent-control-20261109 (br-fragrant-snow-b248fia4), parent br-cool-cherry-b2r912on.

OAuth reconnection verified: SQL transaction read_only=off and a temporary-table INSERT succeeded; ON COMMIT DROP removed the probe.

Created a separate branch with compute min/max 0.25 CU. Account rejected a custom 60-second suspend timeout (HTTP 412); that failed attempt created no branch. Retried using the account default suspend timeout. No plan or budget setting changed.

Applied agent-command-ledger.sql and agent-command-access.sql statements atomically on the test branch only. Created NOLOGIN reader/writer group roles. Granted those groups to the test-branch neondb_owner for SET LOCAL ROLE testing, after Neon denied SET ROLE without membership.

Actual Neon permission tests passed:
- reader SELECT succeeds, INSERT raises insufficient_privilege;
- writer INSERT succeeds inside a deliberately rolled-back PL/pgSQL subtransaction;
- writer UPDATE and DELETE raise insufficient_privilege;
- final ledger row count is zero for both roles.

Production SELECT to_regclass('public.agent_command_ledger') returned NULL: no production ledger migration was applied.

This proves isolated schema installation and role permissions. It does not prove the application's full PostgreSQL adapter, concurrent clients, signed HTTP route, deployment, or production acceptance. No dedicated LOGIN/service secrets issued, no Vercel configuration or deployment changed. The OAuth connection still uses database-owner access; permanent least-privilege connection remains outstanding.

## Dedicated login follow-up
Created agent_test_reader_20261109 and agent_test_writer_20261109 on the isolated branch, with random passwords, no elevated privileges, and password expiry 10 November 2026 00:00 Türkiye. Each inherits only its corresponding command-control group. Credentials were not written to the repository or report.

Both identities successfully connected via Neon MCP and SELECTed the empty ledger. Under the writer LOGIN, INSERT succeeded in a rolled-back subtransaction and UPDATE/DELETE were rejected. Under the reader LOGIN, INSERT was rejected. Final ledger remains empty.

Added scripts/verify-neon-command-control.mjs for an explicit environment-supplied real-database test of signed commands, duplicate rejection, tenant isolation, revoked tokens, separate-reader replay and append-only grants. Direct execution from this workspace failed DNS resolution with EAI_AGAIN for the Neon endpoint; the handler correctly returned 503. Therefore this is NOT a passing application-to-Neon end-to-end result. Do not enable production based on this test.
