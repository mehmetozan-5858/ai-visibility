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


## Applicant-to-assessment verified identity mapping (11 Nov 2026)
- Added `lib/applicant-assessment-link-policy.mjs`: a **pure** fail-closed linking policy. Requires matched lead and prospect UUIDs, consumed/verified lead-specific email challenge, exact normalized website domain, and a separate trusted server-side verified ownership review tied to lead/prospect/domain/review UUID. Domain similarity and inbox possession alone never prove business ownership.
- Added `migrations/applicant-assessment-links-review.sql`: one-to-one lead↔prospect identity relation with external reviewer identity and revocation marker. It grants no login, report entitlement, tokens, customer account or provider execution.
- Isolated Neon rehearsal on `br-restless-thunder-b27p3xvv` succeeded: table exists, FK, unique keys, and review checks present; **zero actual link records**. Production does not have this table.
- Remaining implementation: trusted reviewer workflow and auditable ownership evidence, transactional link creation, revocation propagation, customer-owned scoped preview grant with expiry, measured score validation, and applicant-facing access after authenticated verification. Never expose a prospect report based on a domain match alone.
- These tests do not establish actual ownership of any existing lead. No customer was linked or contacted.


## Verified applicant preview integration — 11 Nov 2026
- `lib/applicant-assessment-grant.mjs` issues a purpose-scoped, lead/prospect-bound HMAC bearer token with a hard 15-minute limit. Disabled unless `APPLICANT_ASSESSMENT_PREVIEW_ENABLED=true`, with a strong server-side `APPLICANT_ASSESSMENT_SECRET`. Neither variable has been set in production.
- `POST /api/admin/applicant-assessment-grant`: admin-authenticated, same-origin, rate-limited read of stored active lead/prospect mapping and consumed email proof; returns a token for **manually approved** delivery. It creates no mapping or customer account and sends no email.
- `GET /api/applicant-assessment`: rechecks signed grant, active stored mapping, consumed email verification and domain continuity. Only returns limited aggregate measurements using existing `freeAssessmentEvidence` and does not call providers, expose raw answers or unlock paid access.
- `/basvuru-analiz#token=...`: new isolated applicant-facing UI; missing evidence is explicitly shown as insufficient rather than zero or a demo score.
- Remaining blockers: approved and auditable business ownership verification and actual persisted mapping (none exists), customer-controlled secure grant delivery/refresh, privacy and replay/expiry threat review, realistic HTTP/E2E tests, payment completion and panel integration. Tokens are bearer links; short TTL reduces but does not eliminate link-sharing risk. Do not send via unapproved outreach.
- **Release HOLD**. This is integration code in draft PR #229, not a live customer feature; no production migration, new email, merge, deployment, provider call or payment has been performed.


## Business ownership verification: DNS TXT proof (11 Nov 2026)
- New draft-only SQL migration: `migrations/applicant-domain-challenges-review.sql`. Challenge is one per lead, 24h validity, nonce is a random 24-byte hex value; no customer/pilot/report access is created on issuance.
- New server-only verification: `lib/applicant-domain-proof.mjs` looks up exact `_aiv-verify.<domain>` TXT value `aiv-lead=<nonce>`. A mismatched or missing record, invalid/internal domain, DNS timeout or exception fails closed. Ownership of DNS must be demonstrated by the business, rather than inferred from the website string or inbox alone.
- Admin-protected POST `/api/admin/applicant-domain-proof` accepts action `issue` or `verify`, lead ID and prospect ID. It requires verified+consumed lead email evidence, matching current lead/prospect domain, existing migration, and server-controlled feature flag `APPLICANT_DOMAIN_PROOF_ENABLED=true`. On successful DNS review only, it creates an exclusive lead/prospect link and review evidence. On conflict or challenge rotation it aborts; no email, payment, AI provider call, account, or preview token is started.
- The challenge record is given only to the authorized operator for approved manual coordination. No automatic outbound email or domain DNS writes are performed.
- Isolated Neon rehearsal `br-restless-thunder-b27p3xvv`: table migration succeeded; foreign keys, unique constraints and nonce format verified; **zero challenge records**. Production has no challenge table and flag is not enabled.
- **Remaining for live use:** actual applicant domain holder must add DNS record, approved production database migrations, trusted operator/customer delivery, a real DNS challenge exchange, HTTP/browser authorization and replay verification, production secrets and explicit deployment approval. A DNS proof is evidence of domain control, not guaranteed legal business ownership.
- Existing old `Web & Mobile Production Smoke` uses an unsupported Playwright/Ubuntu 26.04 combination; separate `Customer Journey Browser Acceptance (Ubuntu 24.04)` passed earlier. Exact-head retests are required.
- **Release state: HOLD.** No merge/deploy/paid actions or unsolicited messages authorized by this change.


## Revocation gate
- Admin-only `POST /api/admin/applicant-assessment-revoke` with explicit string confirmation marks `applicant_assessment_links.revoked_at` without deleting history.
- The applicant read route verifies `revoked_at IS NULL` on each request; revocation therefore denies even an otherwise unexpired signed bearer grant on its next use.
- Revocation is disabled with the other domain-ownership controls unless separately enabled. No production revocation occurred.


## Explicit, one-attempt applicant preview delivery (11 Nov 2026)
- Added `migrations/applicant-assessment-deliveries-review.sql`: one ledger row per lead, stores only lead/prospect/review identifiers, email SHA-256 fingerprint, reservation time, and delivery attempt status. Does not store bearer tokens or email content.
- Added `lib/applicant-assessment-delivery.mjs` and admin-only `POST /api/admin/applicant-assessment-deliver`. Route requires an authenticated administrator, origin check, rate limit, explicit `confirm="send-one-applicant-assessment-email"`, existing non-revoked applicant/prospect link, verified lead email, matching domain, and persisted DNS review. Server-only flags `APPLICANT_ASSESSMENT_DELIVERY_ENABLED=true`, `APPLICANT_ASSESSMENT_PREVIEW_ENABLED=true`, `APPLICANT_DOMAIN_PROOF_ENABLED=true` are all required; default is disabled.
- Concurrent attempts are serialized per lead, and the unique lead ledger means no second automatic attempt even if provider delivery is uncertain. Sender never logs token, recipient or external response bodies; a short-lived token is embedded only in an HTTPS URL fragment.
- Ledger status `provider-accepted` means only the provider API accepted the request. **This is not an inbox delivery, read, click, or customer result-access confirmation**. Provider failures record `failed`; storage failures block retry pending operator review. There is no provider callback or delivery-status confirmation in this draft.
- Isolated Neon rehearsal `br-restless-thunder-b27p3xvv` succeeded; zero delivery rows. Production lacks the ledger. No real email was sent.
- IMPORTANT: This is not full user self-service; operator intervention and explicit approval remain necessary. Completing the full workflow requires safe applicant initiation, delivery/receipt audit, a real consenting customer E2E test, and production release approval. Email delivery is currently disabled.


## Paid customer access: independent signed Paddle settlement gate (11 Nov 2026)
- Current legacy `accountHasPaidAccess` accepts client payment rows marked `paid`. Production contains historical bank-transfer statuses; these must **not** be represented as independently verified Paddle revenue or automatic account entitlements.
- New review-only `migrations/verified-customer-settlements-review.sql` stores immutable client/payment/provider event/transaction linkage. Trial migration succeeded in isolated branch `br-restless-thunder-b27p3xvv`; nothing was inserted and production remains unchanged.
- `lib/paddle-live.js` now records settlement proof atomically inside the existing signed webhook transaction **only when** `CUSTOMER_SETTLEMENT_PROOF_ENABLED=true`, the exact validated completed transaction matched client, payment, currency and billed amount, and it is not a recurring renewal. Existing webhook verification remains mandatory; an inserted event alone is not valid proof.
- `lib/pilot-access.js` can demand a persisted tenant-owned proof before the paid account unlock if the same server-side flag is explicitly enabled. Missing proof/migration/database reads fail closed. This flag defaults disabled; it intentionally does not affect current production or retroactively mark legacy bank records verified.
- Scope: provider-confirmed Paddle payments only. Reconciled bank transfers would require a separate trusted bank verification mechanism; no new provider expenditure or payment occurs here.
- **Critical release sequence:** review and approve SQL migration → assure signed completed webhook integration and subscription/reversal behavior with no real charge → isolate tenant/account tests → configure feature flag and credentials only with release approval → verify actual customer portal outcomes. Do not set the flag before the schema and end-to-end proof are ready.
- Passing local policy or CI tests does not prove a real Paddle checkout, payment settlement, external callback delivery, or customer access. **Production HOLD.**
