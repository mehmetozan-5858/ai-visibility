# Stage 5 verification failure follow-up — 2026-10-14

Owner Safari screenshots first showed invalid/expired code, later generic test-preparation failure. Credential values were not reused by the agent. Scoped application runtime query returned no diagnostic logs. Production storage-console access was rejected by automatic approval review as separately privileged production-data access; no workaround or production query followed.

Source review confirmed verification was consumed before credential creation/reset in separate database calls. Existing credentials were reset using the operator verification email, which can differ from the test account's stored login email. Exact cause of the observed live failure is not yet proven.

Prepared fix: a transaction includes verification consumption and synthetic credential create/reset; any failure rolls back both. Existing synthetic login email is preserved. A different account's unique email conflict is detected before code consumption and never overwrites that account. The workflow rejects non-synthetic client name/domain, returns no-store responses, emits sanitized diagnostic codes, and removes raw internal errors from responses. Test UI provides a new-code action and invalidation/expiry guidance.

Validation: 294 main-based tests pass, including four transaction/failure/ownership cases; Next.js build passes. This has not been released to production and no credential was changed by the agent. Existing live symptom remains unresolved until scoped live diagnosis and a separately authorized release, followed by owner-completed verification.
