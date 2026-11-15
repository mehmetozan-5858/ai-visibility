# Common agent control: first offline implementation

## Implemented
- Shared project allowlist: AI Visibility Works, Global Broker, Future Signal.
- Trusted in-process principal scopes for project, tenant and action. This is authorization policy, not an authentication provider.
- An offline acceptance-review queue with duplicate-ID rejection, guarded state transitions and current permission rechecks. An optional SQLite adapter persists local tasks and audit operations across process restarts.
- Identifier-only audit events with hash chaining and defensive snapshots. Hashes help detect modifications; they are not signatures or durable tamper-proof storage. Tenant-filtered snapshots may contain sequence gaps.
- A local operator CLI: `node scripts/review-agent-tasks.mjs local-input.json`. Each input item contains `task: {id,tenantId:"internal",project,action:"acceptance.review"}` and `gates: [{id,status}]`. Allowed statuses: verified, pending, unknown, blocked. No shell, URL, prompt, provider or arbitrary handler execution.
- Admin-authenticated, uncached GET `/api/command-control`, exposing capability status only. It does not expose tasks or customer records; storage is reported as not probed.
- Optional signed-agent POST `/api/command-control` accepts only enqueue and review commands. It is disabled unless explicitly configured. No model dispatch or release operation is supported.

All gate statuses are operator-reported. Even a batch reporting every gate verified does not establish independent verification or permit release. Empty gate lists are rejected. This patch does not connect existing agent execution routes to the policy or claim to secure them retroactively.

## Durable local execution
Use `node scripts/review-agent-tasks.mjs local-input.json --store /persistent/path/control.sqlite` on a single host with Node 24 and a persistent volume. The default CLI remains in memory/offline mode. SQLite is loaded only for the optional local adapter; it is not imported by the web route.

SQLite uses WAL, full synchronous commits and BEGIN IMMEDIATE for mutations. Each task transition and ledger entry is one transaction; unique task acceptance is enforced by serialized ledger replay. Startup and reads verify hashes and replay allowed transitions; corruption fails closed. Invalid input and failed writes roll back without consuming the task. Task IDs remain reserved across restarts. Authorization is rechecked for every new operation. Input files and store paths are trusted operator inputs.

The adapter limits the ledger to 10,000 operations and replays the full history on each operation. It is for small local pilots, not high-throughput production. Hashes are not signed: someone able to rewrite the database could rewrite hashes or remove a tail. Filesystem access controls, backups and external integrity checkpoints are still required. The store file is set to mode 0600; protect the parent directory and persistent volume as well. Do not use this adapter on Vercel's ephemeral filesystem or as multi-host shared storage.

CLI batches commit each enqueue/review separately, not the entire batch atomically. A failure may leave earlier tasks reviewed or the current task queued. Repeating a committed task ID fails instead of rerunning it; an operator can inspect the store and explicitly review a queued task through the scoped adapter API. No automatic retries are added.

## Observed external limit
On 2026-11-08 the connected AI Bridge reported: online, model inference disabled, read-only tools only. No model task was dispatched. Its deployment source was not found among accessible repositories. This implementation belongs to the existing AI Visibility repository and provides a shared contract, not a replacement remote bridge.

## Required before production execution
1. Apply and validate the PostgreSQL migration on an explicitly selected isolated environment, then verify multi-host concurrency, backup/recovery and retention. The shared PostgreSQL adapter is implemented and tested against PGlite's PostgreSQL engine; distributed connection/lock behavior still requires a real multi-client PostgreSQL acceptance test. The optional local SQLite adapter covers restart persistence, same-host concurrent duplicate rejection and write rollback. The default in-memory queue still loses duplicate protection when recreated.
2. Provision real agent identities and deliver short-lived tokens over a secure channel. The signed-token resolver is implemented with server-side project/tenant/action registry, expiry, key rotation support and registry revocation; no real credentials have been issued or configured. Never accept the principal from a client JSON body.
3. An actual bridge execution capability, validated zero-cost model routing, provider provenance, timeouts, budgets and explicit external-action approval.
4. Project adapters for Broker and Future Signal. Only the capability-status route is wired in this patch; the offline CLI can review all three projects.
5. Full application CI/build, web/mobile acceptance, privacy review and a separate merge/deploy decision.

## R&D disposition
| Candidate | This patch | Next gate |
| --- | --- | --- |
| Agent Audit & Control | Policy/queue/audit, local SQLite and PostgreSQL adapter implemented | Live migration/connection, distributed acceptance and real agent adapters |
| Agent Identity & Permissions | Signed expiring tokens with server-side scopes and revocation implemented | Real identity provisioning and secure token delivery |
| AI Command Center / Bridge | Local batch review plus admin capability endpoint | Bridge execution capability |
| Release Assurance | Reported gates summarized; no release authorization | Independent source-backed verification |
| Render Sandboxes / OIDC / credential brokering | Not integrated | Current official availability and free pilot feasibility |
| Runpod Batch / alternative models / ADK | Not integrated | Official compatibility, cost and isolated pilot checks |
| Churn / revenue / commerce / recruitment / proposal / advertising modules | Not integrated | Existing application acceptance, authorized data and module-specific tests |

No paid calls, customer writes, schema migration, live model execution, email, merge or production deployment is included.

## Shared PostgreSQL and signed-agent setup
The adapter uses the existing `pg`-compatible pool and explicit migration `migrations/agent-command-ledger.sql`. There is no automatic DDL in requests and no fallback to the application owner's DATABASE_URL. Writers use the fixed transaction advisory lock (846291,1) before replay/append; readers use BEGIN READ ONLY and read one committed ledger prefix without a write lock. A 5s lock timeout and 10s statement timeout fail closed without automatic retries. This is a bounded 10,000-operation pilot store with full replay, not a high-throughput queue.

Server-only environment configuration (never commit secrets):
- `AGENT_COMMAND_CONTROL_ENABLED=true` explicitly enables review-command POSTs.
- `AGENT_COMMAND_DATABASE_URL` selects a dedicated TLS-verified SELECT/INSERT-only writer for the ledger. `AGENT_COMMAND_READ_DATABASE_URL` optionally supplies a separate SELECT-only reader for admin snapshots; otherwise the existing writer connection is reused. The append-only writer needs no UPDATE/DELETE/DDL grant. `migrations/agent-command-access.sql` creates non-login permission groups only. Local PostgreSQL-engine tests now explicitly SET ROLE and verify the reader cannot append and the writer cannot update/delete history or read unrelated private tables; real deployment credentials and distributed connection behavior still require acceptance.
- `AGENT_COMMAND_KEYS_JSON` maps key IDs to cryptographically random secrets of at least 32 bytes. The implementation checks length; operators must generate high-entropy secrets.
- `AGENT_COMMAND_AGENTS_JSON` maps actor IDs to `{enabled,tenantId,projects,actions}`. Allowed action is only `acceptance.review`. Configuration is read on each request, so registry revocation is not cached by the handler.

The internal token format is a versioned HMAC-SHA256 envelope, not a general-purpose JWT/OIDC provider. `createAgentIdentityResolver().issue()` is a server/operator API, never a public endpoint. Tokens carry actor ID, audience, key ID and issue/expiry times; they carry no caller-defined scope grants. Maximum lifetime is 15 minutes. Bearer tokens are resolved before body parsing and database access. POSTs enforce a 64KiB body cap, no-store responses, generic error messages and the application's process-local rate limiter; distributed abuse protection remains an acceptance item.

POST request shapes: `{operation:"enqueue",task:{id,tenantId,project,action:"acceptance.review"}}` or `{operation:"review",taskId,gates:[{id,status}]}`. Raw evidence, secrets, prompts and provider calls are not accepted. The signed HTTP-to-PostgreSQL flow is tested locally through the actual handler and PostgreSQL adapter; this does not prove Next.js deployment behavior.

On 2026-11-08 the connected Neon SQL session returned `transaction_read_only=on` for `neondb`. No live migration or write was attempted through that read-only connection. List-projects capability was unavailable. This access limit remains open regardless of code readiness.


## Live access verification follow-up
On 2026-11-08 the project was resolved to `ancient-water-34496424` / `br-cool-cherry-b2r912on` on the existing free plan. SELECT inspection returned transaction_read_only=on but default_transaction_read_only=off and owner CREATE privilege. Therefore SELECT's read-only status alone is not sufficient to prove the account lacks write rights. Direct capability tests resolved the real boundary: create_branch and run_sql_transaction were not exposed by the connected server; a nonpersistent CREATE TEMP TABLE probe through run_sql was rejected with SQLSTATE 25006 (read-only transaction). No temporary table, test branch, role or migration was created. AI Bridge still reported inference disabled/read-only. Access changes require the connection's actual tool/OAuth capabilities; changing a ChatGPT ask-before-write preference would not grant them.
