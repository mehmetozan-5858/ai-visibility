# Common agent control: first offline implementation

## Implemented
- Shared project allowlist: AI Visibility Works, Global Broker, Future Signal.
- Trusted in-process principal scopes for project, tenant and action. This is authorization policy, not an authentication provider.
- An offline acceptance-review queue with duplicate-ID rejection, guarded state transitions and current permission rechecks. An optional SQLite adapter persists local tasks and audit operations across process restarts.
- Identifier-only audit events with hash chaining and defensive snapshots. Hashes help detect modifications; they are not signatures or durable tamper-proof storage. Tenant-filtered snapshots may contain sequence gaps.
- A local operator CLI: `node scripts/review-agent-tasks.mjs local-input.json`. Each input item contains `task: {id,tenantId:"internal",project,action:"acceptance.review"}` and `gates: [{id,status}]`. Allowed statuses: verified, pending, unknown, blocked. No shell, URL, prompt, provider or arbitrary handler execution.
- Admin-authenticated, uncached GET `/api/command-control`, exposing capability status only. It does not expose tasks or customer records.

All gate statuses are operator-reported. Even a batch reporting every gate verified does not establish independent verification or permit release. Empty gate lists are rejected. This patch does not connect existing agent execution routes to the policy or claim to secure them retroactively.

## Durable local execution
Use `node scripts/review-agent-tasks.mjs local-input.json --store /persistent/path/control.sqlite` on a single host with Node 24 and a persistent volume. The default CLI and web capability endpoint remain in memory/offline mode. SQLite is loaded only for the optional local adapter; it is not imported by the web route.

SQLite uses WAL, full synchronous commits and BEGIN IMMEDIATE for mutations. Each task transition and ledger entry is one transaction; unique task acceptance is enforced by serialized ledger replay. Startup and reads verify hashes and replay allowed transitions; corruption fails closed. Invalid input and failed writes roll back without consuming the task. Task IDs remain reserved across restarts. Authorization is rechecked for every new operation. Input files and store paths are trusted operator inputs.

The adapter limits the ledger to 10,000 operations and replays the full history on each operation. It is for small local pilots, not high-throughput production. Hashes are not signed: someone able to rewrite the database could rewrite hashes or remove a tail. Filesystem access controls, backups and external integrity checkpoints are still required. The store file is set to mode 0600; protect the parent directory and persistent volume as well. Do not use this adapter on Vercel's ephemeral filesystem or as multi-host shared storage.

CLI batches commit each enqueue/review separately, not the entire batch atomically. A failure may leave earlier tasks reviewed or the current task queued. Repeating a committed task ID fails instead of rerunning it; an operator can inspect the store and explicitly review a queued task through the scoped adapter API. No automatic retries are added.

## Observed external limit
On 2026-11-08 the connected AI Bridge reported: online, model inference disabled, read-only tools only. No model task was dispatched. Its deployment source was not found among accessible repositories. This implementation belongs to the existing AI Visibility repository and provides a shared contract, not a replacement remote bridge.

## Required before production execution
1. Production shared transactional storage, multi-host concurrency, backup/recovery and retention. The optional local SQLite adapter now covers restart persistence, same-host concurrent duplicate rejection and write rollback in focused tests. The default in-memory queue still loses duplicate protection when recreated.
2. A server identity resolver with verified per-agent identities, project/tenant scopes, revocation, expiry and a secure credentials channel. Never accept the principal from a client JSON body.
3. An actual bridge execution capability, validated zero-cost model routing, provider provenance, timeouts, budgets and explicit external-action approval.
4. Project adapters for Broker and Future Signal. Only the capability-status route is wired in this patch; the offline CLI can review all three projects.
5. Full application CI/build, web/mobile acceptance, privacy review and a separate merge/deploy decision.

## R&D disposition
| Candidate | This patch | Next gate |
| --- | --- | --- |
| Agent Audit & Control | Offline policy/queue/audit and optional durable local SQLite adapter implemented | Shared production storage and real agent adapters |
| Agent Identity & Permissions | Scoped trusted-principal checks | Actual identity and credential resolver |
| AI Command Center / Bridge | Local batch review plus admin capability endpoint | Bridge execution capability |
| Release Assurance | Reported gates summarized; no release authorization | Independent source-backed verification |
| Render Sandboxes / OIDC / credential brokering | Not integrated | Current official availability and free pilot feasibility |
| Runpod Batch / alternative models / ADK | Not integrated | Official compatibility, cost and isolated pilot checks |
| Churn / revenue / commerce / recruitment / proposal / advertising modules | Not integrated | Existing application acceptance, authorized data and module-specific tests |

No paid calls, customer writes, schema migration, live model execution, email, merge or production deployment is included.
