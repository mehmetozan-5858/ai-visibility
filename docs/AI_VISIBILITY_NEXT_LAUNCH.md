# AI Visibility Works — next launch preparation

**Destination:** existing AI Visibility Works product, repository `mehmetozan-5858/ai-visibility`. No standalone Observability application.

**State:** PREPARED / NOT RUNNING. Live site and existing commercial operations unchanged. Manual Vercel release only after validation and owner approval.

## Four new services inside AI Visibility
1. Agent Audit & Control: agent run reviews, errors/costs, Release Assurance, agent identity/permissions, Revenue Leakage Monitor. The latter three are features of Audit & Control, not apps.
2. Agent Commerce Intelligence: build on existing `lib/commerce-signals.js`, commerce readiness, catalog evidence and customer reports.
3. Candidate Rediscovery: separately permissioned data, documented permitted processing, customer-managed candidate records, human-reviewed shortlists; never automated applicant rejection.
4. Voice Revenue Agent: consented inbound-first workflow, appointments and human handoff; no outbound cold calls or live voice provider connections enabled.

Regulatory product lines (DPP, EUDR, PPWR, CBAM, tax, e-invoicing and legal compliance) are excluded from this launch.

## Three-stage build order
1. Implement real tenant-scoped persistence, authorization, budget limits, audit logs, flags, UI, safe domain adapters for the four services. Reuse existing customer portal and commerce infrastructure. Add isolation, misuse, cost and end-to-end tests.
2. Prepare existing AI Visibility R&D features: shared read-only reports, event-triggered visibility agents and evidence-backed prioritized action timelines.
3. Prepare ethical lead acquisition, visibility growth measurement and permissioned Global Broker handoff. No unapproved outgoing communication.

## Safety, costs and publishing
- Fail closed: the registry is intentionally not an executable provider integration.
- Authentication/session must determine tenant on server; browser tenant IDs are not authority.
- Do not store resumes or voice recordings in shared logs; use scoped retention and deletion when real storage is added.
- Real API calls require provenance, consent where applicable, approvals and explicit spend ceilings.
- Draft pull requests are not merged or deployed automatically.
- Run `npm test`, `npm run build`, auth and customer-journey checks before manual release.
- Do not alter Paddle live billing, secrets, production flags, or existing Vercel deployment until separately approved.

## Created in this stage
`lib/ai-visibility-launch-services.mjs`: initial service boundaries and non-executing plans.
`tests/ai-visibility-launch-services.test.mjs`: initial safety/consent contract tests.

These files do not complete the service engines. Keep remaining items visible; never report a new service as live merely because it is listed.
