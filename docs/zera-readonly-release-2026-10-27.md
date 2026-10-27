# Minimal ZERA read-only diagnostics candidate — 27 October 2026

Base: main 532ef879660a44f993af8451588f962918d6b7ae. This candidate is independent of combined draft PR #154 and does not include its Ar-Ge, Paddle or provider-execution changes.

## Exact behavior

Adds GET /api/clients/zera-diagnostics, protected by the existing admin session and a six-per-minute limiter. It rejects selectors and write methods, disables response caching and never initializes or migrates database schema. Its transaction uses REPEATABLE READ READ ONLY, with local statement and lock timeouts.

Reads the fixed ZERA pilot identity, comparison schema, INSERT privilege metadata, a bounded customer-only comparison count, and the two existing AI task states. Optional legacy failure reasons are returned only from a fixed allowlist; raw provider errors, answers, SQL, connection strings and customer IDs are not returned. Ambiguous customer identity fails closed.

Reports whether a Gemini key exists, the configured/default model and the existing pilot flags. Key values are never returned. Model availability, provider permissions, quota and zero-cost status are explicitly NOT verified. There are no provider or model-list requests. Existing execution routes and settings are unchanged. Previously missing historical error details cannot be reconstructed by this endpoint, so it is diagnostic preparation, not a proven fix for the old provider failure.

## Verification

405 tests passed on the isolated main-based candidate (399 existing plus 6 new cases). File-backed PGlite tests verify read-only enforcement by rejecting an attempted DELETE inside the inspection transaction, historical schema compatibility, tenant isolation, optional reason filtering, ambiguous identity, missing-table reporting without provisioning, authentication/input boundaries and error redaction. Clean Next.js build passed.

The actual locally started production HTTP server used synthetic authentication and an explicit environment with no database URL. It returned:

```json
{"ok":true,"scope":"isolated-production-http","unauthenticated":401,"writeMethod":405,"customerSelector":400,"missingDatabase":503,"realProviderCalls":0,"productionDatabaseTouched":false}
```

The HTTP smoke runs after the build in GitHub CI. @electric-sql/pglite 0.5.12 is a development-only test dependency; the existing lockfile is extended only for this package. No production dependency was added.

## Proposed live action, not yet performed

After exact-head CI and web/mobile acceptance, review this minimal diff against the unchanged main, then obtain the user's separate production-change approval. A controlled deployment would expose this admin-only read endpoint; it would not reset an attempt, run a scan, enable a provider, change a budget or touch customer data. Inspect once through the existing admin session. A useful diagnosis may still require provider-side read-only records if no historical reason exists.

Rollback: redeploy the retained pre-change main 532ef879660a44f993af8451588f962918d6b7ae. There is no schema/data migration to reverse. The rollback source is retained; an actual production rollback was not performed or claimed as tested.

The candidate sets git.deploymentEnabled=false so its PR does not trigger a deployment. This is a release hold; deployment remains a separate approved operation. No merge, production deployment, live database read/write, provider call, payment, email or budget change was performed in preparing this candidate.
