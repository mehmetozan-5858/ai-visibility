# Observability Business Modules — integration staging

State: PREPARED / NOT RUNNING. No Vercel deployment, background worker, cron, customer migration, charge, external outreach, or automatic production enablement.

## Existing-app target
Current implementation is staged in `mehmetozan-5858/ai-visibility`, a Next.js application. An independently named Observability repository or Vercel project was not identified. Do not silently create another production app. Final UI placement must be resolved against the existing AI Visibility navigation and access-control design before release.

## Business modules and placement
1. **Agent Audit & Control** — main Observability control center; run/error/cost/event evidence.
   - **Release Assurance** — read-only release evidence and risk.
   - **Agent Identity & Permissions** — least-privilege identities and permission audits.
   - **Revenue Leakage Monitor** — consented read-only reconciliation and anomalies, *not* fund movement.
2. **Agent Commerce Intelligence** — shares AI Visibility Commerce Readiness reporting; remains separately scoped by tenant.
3. **Candidate Rediscovery** — isolated talent dataset; documented lawful basis, consent/retention controls, manual shortlist review; never automatic rejection.
4. **Voice Revenue Agent** — inbound-first, with disclosure/consent and escalation; no unsolicited outbound calls.

This includes seven registry identifiers across four independently marketable service areas. Excluded: DPP, EUDR, PPWR, CBAM, company compliance, tax, e-invoicing, legal alerting, cyber-regulatory tracking, and pay-transparency compliance.

## Three-stage sequence
- Stage 1: Implement tested domain boundaries, tenant auth, event contracts, audit persistence, cost caps, per-module flags, demo/fixture workflows. Finish the integration tests before enabling anything.
- Stage 2: Connect existing visibility R&D (shareable customer dashboards, measurable visibility agent tasks, evidence-weighted action prioritization and timelines).
- Stage 3: Add consent-based acquisition, Growth Engine metrics, and review-before-apply Global Broker company handoff.

## Planned integration contracts
All persistent records must contain tenantId, actorId, moduleId, eventId, timestamp, provenance, data-classification and retention metadata. Server derives tenantId from authenticated session; never trust one sent by a browser. Disable cross-tenant access by default. Do not persist raw candidate resumes or voice recordings in the shared Observability audit stream. Store only pseudonymous identifiers and non-sensitive metrics; sensitive data remains isolated with deletion and retention controls.

Jobs must be idempotent, budget-limited, retryable and abortable. Feature flags default off; API endpoints require auth, action-scoped authorization and recorded approval for external effects. Billing, outbound messages, recording, purchases, deployments, credential changes and destructive actions remain disabled until separately approved. Unknown provider data is `unverified`, never fabricated.

## Remaining implementation (not represented as complete)
- Production tenant/role middleware and permission enforcement.
- Persistent schema, isolated storage/retention, audit events and migrations.
- Per-module handlers/adapters and realistic fixtures.
- Owner/customer UI and dashboard routing.
- Local unit tests, full integration tests, security review and a real user journey.
- Provider credentials/agreements where applicable and optional runtime budgets.
- Merge review and a *single manual Vercel release only after explicit owner approval*.

## Current code
`lib/observability-module-registry.mjs` contains the offline-only catalog and fail-closed preparation function. `tests/observability-module-registry.test.mjs` contains initial contract tests. They perform no network or side effects. Not proof of deployed features.
