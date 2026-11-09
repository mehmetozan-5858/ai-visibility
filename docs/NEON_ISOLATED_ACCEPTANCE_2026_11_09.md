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

## Runner path prepared
GitHub PostgreSQL 18 transport job 42525413645 passed at 786fbc2d5e6e733482a08075a49d42573a9083cc, including concurrent duplicate submissions (one 200, one 409), separate-reader replay, token revocation and denied history mutations. CI 42525413600 and web/mobile 42525413599 also passed at that head.

Prepared an opt-in Neon-specific GitHub job pinned to the isolated endpoint host and expected writer LOGIN. Requires encrypted repository secrets NEON_ACCEPTANCE_WRITER_URL and NEON_ACCEPTANCE_READER_PASSWORD plus variable RUN_NEON_ISOLATED_ACCEPTANCE=true. Disabled/skipped is not Neon acceptance. Connection must verify TLS certificate. Run only from the same-repository integration branch; never put credentials into source or PR text. Test writes only three ledger records per execution and never issues release authority.

Connected GitHub tools cannot write repository secrets. No existing Vercel named sandbox was available. No paid sandbox or plan change was started. A browser session authorized for repository settings can provision these scoped test secrets, then the failed/skipped Neon workflow can be re-run on the integration candidate. The dedicated passwords expire 10 November 2026 00:00 Türkiye; renew securely if execution occurs after expiry.

## GitHub runner credentials provisioned
On 9 November, both encrypted repository secrets were saved through the signed-in GitHub settings UI and their names verified in the repository secret list. RUN_NEON_ISOLATED_ACCEPTANCE=true was saved and verified. No credential value was printed or committed. Added a fail-closed credential-presence preflight to the isolated Neon job; actual runner result must be checked before claiming acceptance.
