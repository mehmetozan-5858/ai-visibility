# Enabled applicant verification acceptance — 2026-11-12

Application code remains 4d6f83eeadfb9643e0c7285c852b8ed6baf33475, with its previous three hosted checks successful. Production configuration was rebuilt as dpl_3WJgSBBYwTSTh6vbtEniWmnw2311 (READY); previous deployment dpl_BBdN9eHiLCHE75nFrr8JcQCtboM5 retained.

Direct settings search confirmed no LEAD_EMAIL or APPLICANT entries before creation; RESEND_API_KEY and RESEND_FROM_EMAIL production definitions were present (values not opened). The connector environment list had been truncated and was not treated as proof of absence.

Created two independent 32-byte random purpose-specific secrets using create-only semantics, stored as sensitive production-only variables: LEAD_EMAIL_CHALLENGE_SECRET and APPLICANT_ASSESSMENT_SECRET. Existing secrets/customer credentials were not read or changed. No secret values are included here.

Enabled production-only LEAD_EMAIL_VERIFICATION_ENABLED, NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED, APPLICANT_ASSESSMENT_PREVIEW_ENABLED and APPLICANT_DOMAIN_PROOF_ENABLED. APPLICANT_ASSESSMENT_DELIVERY_ENABLED remains unset/default false. These gates do not waive verified email, active reviewed lead/prospect link, domain ownership, signed short-lived grant, or paid/pilot entitlement checks.

Validation:
- Build with public email verification enabled passed.
- 29 focused existing applicant/email/domain tests passed locally.
- New local Chromium fixture: 3/3 passed (TR 390px, EN 390px, EN 1440px). Exercises hidden-before-application, explicit send, delivery failure/retry, invalid code, successful verification, and width. All API requests intercepted; no real email, database write, customer access grant, or inference.
- New public application page HTTP 200 and deployment marker matches this release.
- Live unauthenticated applicant preview returned Invalid or expired preview grant, showing the runtime gate is enabled and still rejects a missing grant. No prospect/customer data displayed.
- Short error/fatal runtime query returned no entries; this small window is not full production acceptance.

The new spec is intentionally opt-in: build with NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED=true; run against localhost:3000 with APPLICANT_VERIFICATION_SMOKE_ENABLED=true. It must not be run as a live email test.

Remaining: actual applicant-initiated receipt/code verification, domain proof and reviewed link, real permitted provider response saved to the correct customer, authenticated result/PDF acceptance. Provider quota/free-tier status and actual customer password login remain unproven. No paid AI or automatic mail delivery was enabled by this release.
