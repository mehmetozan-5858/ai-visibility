# Signed tenant claim enforced inside PostgreSQL — isolated Neon trial

Date: 2026-11-15. **REVIEW ONLY. Production HOLD. No live secrets, customers, money or deployment.**

## Actual test environment and boundary

Existing nonproduction Neon branch `br-plain-poetry-b2u7f7a6` of project `ancient-water-34496424`. Existing trial role `portal_gateway_reader_trial_20261114` remains a passwordless LOGIN (`PASSWORD NULL`) with **no direct SELECT** on `public.ai_provider_comparisons`, no USAGE on private schema `portal_authz_trial` and no SELECT on its synthetic signing key. No password is configured for an app connection.

A test-only `pgcrypto` extension, private `portal_authz_trial.signing_keys` table containing **only a synthetic HMAC key**, and `public.portal_trial_verified_report(uuid,bigint,text)` SECURITY DEFINER function were created **solely on that test branch**. Its sole SQL EXECUTE grant besides the owner is to the trial reader, not PUBLIC. The function uses `SET search_path=pg_catalog`, schema-qualified references, a 5-minute maximum future expiry, exact tenant/expiry/audience HMAC-SHA256 verification, then one bounded `WHERE client_id=p_tenant LIMIT 20` report query. The definer owner `neondb_owner` has BYPASSRLS; therefore key secrecy, owner integrity, explicit EXECUTE grants and function code review are essential. Never promote as-is to production.

## Real PostgreSQL adversarial results (synthetic identities)

- Valid signed claim for A: **1 A row**.
- B tenant ID combined with A signature: **0 B rows**.
- After the reader itself changed `app.tenant_id` to B, A's valid claim still returned A (**1**) and B with A signature still returned **0**.
- Valid signed B claim: **1 B row**.
- Missing or expired claim: **0 rows**.
- Trial role direct `SELECT` from `public.ai_provider_comparisons`: **permission denied (42501)**.
- Trial role direct `SELECT` from private signing-keys schema: **permission denied (42501)**.
- Client A/B fixture rows removed in same transaction; verified comparison/proof/settlement row counts all **0**.
- Independently checked parent production branch: no trial reader, no trial verification function and **0/3** new proof tables.

These observations show the prior forgeable `app.tenant_id` attack does not grant unauthorized reads through this **specific signed function**. It does **not** prove deployed signed HTTP sessions, real provider evidence or payments.

## Follow-up actual replay test (2026-11-15)

A fresh synthetic customer/report row was inserted on the **same isolated test branch**, and the passwordless trial reader invoked the scoped PostgreSQL verification function **twice with the same signed tenant, expiry and MAC** inside one transaction. The first call returned **1** row; the second identical call also returned **1** row. Both synthetic records were removed in the same transaction and cleanup was verified (0 remaining).

**Replay is currently accepted during the 90-second token lifetime.** Short expiry limits duration but is **not** one-time use. Production launch requires a reviewed nonce/jti-and-revocation mechanism or an explicitly justified bounded replay threat model with narrow network access and independently verified customer session. Do not claim replay denial or revocation acceptance from the previous A/B tests.

## Mandatory blockers before anything can go live

1. Review an auditable DB-verification function migration for production; avoid PUBLIC EXECUTE and exposed private schemas. Confirm the owner can read only the required data and no broader SECURITY DEFINER capabilities escape. Validate lock and rollback.
2. Define a dedicated **new** `PORTAL_REPORT_CLAIM_SECRET` shared securely between trusted server-side claim signer and PostgreSQL verifier; **never reuse `AUTH_SECRET`**, hard-code secrets, emit them in CI logs or give them to SQL reader role. Plan key rotation/revocation, replay/nonce/session invalidation and expiry.
3. Bind every claim to an independently verified signed customer HTTP session, tenant, specific report audience and entitlement. Do not accept client-provided tenant ID or signed claim from arbitrary request fields.
4. Restrict the service's SQL login to executing the bounded report function; its readiness preflight must require **no raw comparison SELECT** (the older `trusted-report-reader-privileges-review.mjs` requires SELECT and is incompatible with this stronger design). Pin attestation and function invocation to the **same acquired read-only transaction**.
5. Include adversarial tests for A/B, forged GUC, forged/expired/replayed claims, revoked accounts, concurrent sessions, reader privilege escalation, function search_path hijack and arbitrary SQL calls; compare real PostgreSQL results on an isolated branch before authorizing production.
6. Existing verified settlement/real free AI receipts/real customer login and provider costs are independent HOLD gates.

**Decision:** proof-of-concept threat test succeeded, but release remains **HOLD**. No new production environment variables, LIVE migrations, passwords, customer data or payments.
