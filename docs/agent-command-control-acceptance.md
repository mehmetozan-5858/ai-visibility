# Common agent control: first offline implementation

## Implemented
- Shared project allowlist: AI Visibility Works, Global Broker, Future Signal.
- Trusted in-process principal scopes for project, tenant and action. This is authorization policy, not an authentication provider.
- An offline acceptance-review queue with duplicate-ID rejection, guarded state transitions and current permission rechecks.
- Identifier-only audit events with hash chaining and defensive snapshots. Hashes help detect modifications; they are not signatures or durable tamper-proof storage. Tenant-filtered snapshots may contain sequence gaps.
- A local operator CLI: `node scripts/review-agent-tasks.mjs local-input.json`. Each input item contains `task: {id,tenantId:"internal",project,action:"acceptance.review"}` and `gates: [{id,status}]`. Allowed statuses: verified, pending, unknown, blocked. No shell, URL, prompt, provider or arbitrary handler execution.
- Admin-authenticated, uncached GET `/api/command-control`, exposing capability status only. It does not expose tasks or customer records.

All gate statuses are operator-reported. Even a batch reporting every gate verified does not establish independent verification or permit release. Empty gate lists are rejected. This patch does not connect existing agent execution routes to the policy or claim to secure them retroactively.

## Observed external limit
On 2026-11-08 the connected AI Bridge reported: online, model inference disabled, read-only tools only. No model task was dispatched. Its deployment source was not found among accessible repositories. This implementation belongs to the existing AI Visibility repository and provides a shared contract, not a replacement remote bridge.

## Required before production execution
1. Durable transactional task/audit storage, unique idempotency keys, concurrency tests, recovery and retention. Current queue is process-memory; duplicate protection ends when it is recreated. CLI emits a report; it does not retain a persistent queue.
2. A server identity resolver with verified per-agent identities, project/tenant scopes, revocation, expiry and a secure credentials channel. Never accept the principal from a client JSON body.
3. An actual bridge execution capability, validated zero-cost model routing, provider provenance, timeouts, budgets and explicit external-action approval.
4. Project adapters for Broker and Future Signal. Only the capability-status route is wired in this patch; the offline CLI can review all three projects.
5. Full application CI/build, web/mobile acceptance, privacy review and a separate merge/deploy decision.

## R&D disposition
| Candidate | This patch | Next gate |
| --- | --- | --- |
| Agent Audit & Control | Offline policy/queue/audit implemented | Durable storage and real agent adapters |
| Agent Identity & Permissions | Scoped trusted-principal checks | Actual identity and credential resolver |
| AI Command Center / Bridge | Local batch review plus admin capability endpoint | Bridge execution capability |
| Release Assurance | Reported gates summarized; no release authorization | Independent source-backed verification |
| Render Sandboxes / OIDC / credential brokering | Not integrated | Current official availability and free pilot feasibility |
| Runpod Batch / alternative models / ADK | Not integrated | Official compatibility, cost and isolated pilot checks |
| Churn / revenue / commerce / recruitment / proposal / advertising modules | Not integrated | Existing application acceptance, authorized data and module-specific tests |

No paid calls, customer writes, schema migration, live model execution, email, merge or production deployment is included.
