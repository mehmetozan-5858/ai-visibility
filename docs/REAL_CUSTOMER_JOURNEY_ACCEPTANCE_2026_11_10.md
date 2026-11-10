# AI Visibility Works — real customer journey release contract (10 Nov 2026)

This is a pure server-side acceptance policy and offline tests, **not a working customer signup or payment integration**. Its purpose is to make the real launch criteria explicit without conflating records, demos, and revenue.

## Verified gaps from source review
- `/yeni-musteri` submits a lead to `/api/leads`. A successful application does not create a verified login or deliver an assessment.
- `/api/free-assessment` needs a separately issued signed token associated with a prospect and existing eligible observations. It is not automatically linked to new leads.
- `/api/client-auth/login` exists for provisioned credentials and the customer portal enforces server-side access, but this is not equivalent to self-service account activation from the first form.
- `/odeme` has a Paddle checkout integration, but a checkout start or database `paid` flag alone is not settlement proof. Provider-signed and tenant-linked completed evidence is needed.
- Customer reports must exist, be verified, tenant-scoped and visible before promising results.

## What this PR implements
- `lib/customer-launch-journey-gates.mjs` — pure, fail-closed evidence contract for application, verified email, sufficiently measured assessment, independently reconciled payment, trusted entitlement and visible report.
- `tests/customer-launch-journey-gates.test.mjs` — tests positive and negative paths including demos, insufficient observations, spoofed emails, unsigned webhooks, unreconciled bank payments and cross-tenant reports.

## What is still required to ship
1. Provide trusted storage and server-only verification for ownership of applicant email.
2. Link lead to prospect/measurement by verified identity and consent; never make a provider call just because the lead form submitted.
3. Create a safe customer-facing assessment/result grant with proper privacy, expiry, tenant isolation and rate limits.
4. Enable account creation only after verified pilot approval or independently settled payment, with email verification.
5. Integrate backend sources into these gates and actual routes/UI; add database-backed E2E and real external Paddle signed webhook acceptance.
6. Verify current production deployment, rollback path, pricing/countries, quotas, provider spending guards and release approval.

No production database migration, deployment, payment creation, email send or customer mutation in this PR. ZERA is **test-only** and is not a member of the product stack or a regular paying customer.

**Release status: HOLD**. Passing pure tests is not a real customer E2E pass.
