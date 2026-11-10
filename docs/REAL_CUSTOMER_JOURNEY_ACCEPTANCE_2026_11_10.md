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


## Admin-only applicant ↔ existing prospect review (added)
- New read-only endpoint: `GET /api/admin/customer-assessment-review`. Requires authenticated admin; it returns only lead IDs, candidate IDs and status, not names, email addresses or tokens.
- `lib/customer-assessment-candidates.mjs` performs conservative normalized exact website-domain matching, rejects ambiguous duplicate matches and requires manual ownership verification.
- No automatic lead→prospect binding, provider call, token issuance, account creation or enrollment. **A matching domain is never proof of identity.**
- Read-only production aggregate as checked 10 Nov 2026: 3 current leads, 0 exact website-domain matches (approximate SQL preflight, not the runtime matcher or customer authentication).
- Next implementation gate: verify applicant email ownership with a persisted, single-use, expiry-bound challenge; separately verify business/domain ownership where needed, then bind immutable lead/prospect identities with tenant isolation. Never use discovered prospect contact emails as customer consent.

## Lead email ownership proof candidate (draft, disabled)
- Added `migrations/lead-email-challenges-review.sql` to define one challenge per lead; not applied anywhere.
- Added `lib/lead-email-verification.mjs` and `POST /api/lead-email/issue`, `POST /api/lead-email/verify`. By default these return unavailable until an explicitly approved `LEAD_EMAIL_VERIFICATION_ENABLED=true` setting, a server-only `LEAD_EMAIL_CHALLENGE_SECRET` (at least 32 characters), reviewed migration, email provider and E2E tests exist.
- Six-digit random code, 10-minute expiry, 60-second resend cooldown, six attempts, lead+email-bound HMAC digest, atomic single-use verification. No plaintext code committed or logged. Public issue response does not distinguish ineligible/already-verified/cooldown leads.
- Uses existing email sender only when explicitly enabled and requested by the applicant. No real email was sent in development.
- Email verification proves inbox control **only**, NOT corporate domain ownership, entitlement, real assessment evidence or verified payment.
- Outstanding: review persistence/restart, concurrent double-submit and cooldown behavior against a fresh isolated database; add applicant-controlled UI after verified lead submission; bind a verified lead to prospect through separately checked business domain/consent; production configuration and release approval.


## Applicant UI and isolated database rehearsal
- Added `components/LeadEmailVerification.js`; shown after successful `/api/leads` only if `NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED=true`. Existing lead form remains usable when disabled. This is NOT proof of provider delivery.
- Production does not have `lead_email_challenges`. Isolated branch `br-restless-thunder-b27p3xvv` received the review migration and its FK, max-attempts CHECK and index were inspected; **zero actual challenge records were created**.
- To activate later requires a separately approved production migration, server-only random `LEAD_EMAIL_CHALLENGE_SECRET`, server and public enable flags, verified email sender configuration, live consent/abuse and E2E concurrency checks.
- Caveat: The existing email sender has provider-dependent failure logging; review suppression of provider response bodies before enabling, and validate fail-closed behavior for send failures and concurrent code issuance. No new applicant email was actually sent in this work.
