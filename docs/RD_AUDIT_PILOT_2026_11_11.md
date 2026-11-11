# RD-03: limited live synthetic pilot

The user's 11 November request authorizes gradual live R&D trials. The earlier backlog rule remains the gate for customer-facing rollout; this trial does not claim the three core applications have completed acceptance.

## First increment

- Module: AI Agent Audit & Control, release evidence and audit envelope checks.
- Page: `/arge/denetim-pilotu`.
- Aggregate endpoint: `GET /api/rd/audit-pilot`.
- Input: fixed synthetic fixtures only. No caller-supplied payload is consumed.
- Output: seven pass/fail scenario results, with explicit synthetic scope and false customer acceptance.
- No customer database, model/API call, paid service, email, scheduler, queue mutation, credential issuance or durable audit write.
- The existing release, audit and launch-plan policies run in the production runtime; the result does not establish actual CI health, live tenant isolation or persistence.

## Acceptance and rollback

Require the existing suite/build, then verify the production endpoint returns HTTP 200 with `ok:true`, `passed:7`, `total:7`, `customerDataRead:false`, `externalActions:false`, `persistentAudit:false`, `productionCustomerAcceptance:false` and `paidProviderCalls:0`. Verify the page identifies the trial as synthetic, while customer pages and unauthenticated access denials remain intact.

Rollback target before this increment: production deployment `dpl_G8VmfqpjzjcA2a8p4xbMk4apiUEp`, source `eb599694715c4378db8027d7cac7549f1e4a6926`. The pilot adds no persistent data requiring cleanup.

## Gradual expansion

1. This synthetic live policy check.
2. Separately implemented, least-privilege read-only review of real audit events; confirm redaction, tenant scope and bounded queries first.
3. Revenue Leakage Monitor with synthetic settlement/CRM mismatches, then consented read-only evidence only after payment acceptance.
4. Churn/commerce/proposal and media experiments remain pending their data, source and quality prerequisites.
5. Render/Runpod execution remains pending verified availability, cost and scope. No spending approval is inferred.

Each increment requires its own evidence. A successful self-test does not authorize actual agent actions or close any core application acceptance gate.
