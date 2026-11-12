# Applicant verification schema release — 2026-11-12

Production application source remains 4d6f83eeadfb9643e0c7285c852b8ed6baf33475. This is a database-only additive release, not proof of a completed customer journey.

Applied the table/index definitions from migrations/lead-email-challenges-review.sql, applicant-domain-challenges-review.sql, applicant-assessment-links-review.sql, and applicant-assessment-deliveries-review.sql. Their review-only comments describe their earlier preparation stage; this release records the later authorized application. No DROP, ALTER of existing objects, role grant, account mutation, feature activation, or email/provider execution was included.

Migration payload SHA-256 (comments and per-file BEGIN/COMMIT removed, payload trimmed): 359ed3c7a8d79059d6555d7f347ec26e939ce3a4355973ca1b95ce3d52b4d808.

Validation:
- 29 focused lead-email, applicant grant/delivery, and domain proof tests passed locally.
- Migration prepared against a fresh branch of production; all four tables and foreign-key/check/unique constraints present and validated.
- Prepared migration applied to production; temporary migration branch cleaned up.
- Production readback confirmed all constraints validated and all four new tables empty. Existing aggregate application/account counts unchanged; no customer comparison result was created.

Remaining: verify effective runtime flags and required signing-secret presence, then a separately authorized applicant email/domain proof and actual analysis/result flow. The environment metadata response was truncated at 100 of 131 entries, so absence from that response is not evidence that any setting is missing. No secret values were read or emitted. Schema availability alone does not authorize access, prove ownership, deliver mail, or establish a provider result.

Rollback posture: keep runtime gates disabled until acceptance; retain these empty additive tables. Do not drop them autonomously or delete customer records.
