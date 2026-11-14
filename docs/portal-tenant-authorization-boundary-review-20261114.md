# AI Visibility Works — Trusted tenant authorization boundary (review only)

Status: **HOLD** — isolated test-branch security finding, no deployment approval.

## Observed PostgreSQL evidence (2026-11-14)

Existing Neon test branch `br-plain-poetry-b2u7f7a6` (not production):

- `portal_reader_isolated_20261114` has no password-table SELECT, no BYPASSRLS, cannot SET ROLE to `neondb_owner` or the credential-verifier role.
- The comparison-table RLS policy checks `client_id = nullif(current_setting('app.tenant_id', true), '')::uuid`.
- With two **synthetic** client records, tenant A initially saw A only. The same reader SQL role could run `set_config('app.tenant_id', tenant_b, true)` and then read B's synthetic row.
- Synthetic records were removed within the test transaction. This proves that the GUC is forgeable by someone holding the SQL reader connection, **not** an attack on the public HTTP portal or a real data breach.
- Review PR #269's `inspectComparisonRlsPolicy()` now returns `comparison-tenant-setting-forgeable` even for a structurally matching policy.

## Required architecture decision

A tenant ID supplied to the database by an arbitrary SQL caller is not an identity proof. Do not make the optional `PORTAL_TENANT_RLS_ENABLED` path ready by changing a policy string, enabling a flag, or granting broad SELECT.

Choose and security-review one independently trusted authorization boundary before proposing production DDL:

1. **Trusted server-side report gateway**: validate the existing signed HTTP customer session server-side and enforce entitlement; allow only one audited, parameterized customer report query with the verified client ID, no user-authored SQL/query fragments and no direct SQL credentials in the browser. Restrict network ingress and DB privileges to the gateway. Explicitly document that compromise of the gateway's DB login is outside the protected isolation boundary; the GUC alone does not protect against that compromise.
2. **DB-enforced tenant claim** (stronger boundary, requires additional design): verify a short-lived cryptographic claim **inside PostgreSQL** using a verification key the reader cannot read or use to sign. Bind tenant, audience, expiry and session/replay semantics. Only trusted server code may create claims; no free-form GUC can substitute. Carefully review function security, key custody/rotation, revocation, transaction semantics and whether a captured valid claim can be replayed. Avoid a PUBLIC-executable `SECURITY DEFINER` that bypasses RLS.

Do not introduce real signing keys, create credentials, open SQL endpoints or deploy code as part of this review.

## Blocking acceptance tests

- Valid customer A signed HTTP session reads only tenant A; B reads only B; unsigned, expired and cross-tenant sessions fail.
- SQL reader **cannot** change a setting or argument to expose tenant B without a separate valid, independently verified proof. Repeat the exact prior `set_config` attack, not just a `pg_policies` string assertion.
- Customer-facing SQL roles cannot assume owner/credential role; cannot SELECT passwords, settlements, unrelated tenant rows or mutate records.
- Independently verify the runtime database role and network trust boundary. Current trial roles are NOLOGIN and are not deployment-ready.
- A/B E2E uses synthetic records only. Verify cleanup. Preserve existing passwords and legacy customer access.
- Require real zero-cost provider receipts, signed tenant-linked Paddle settlement and explicit production release approval separately.

**Current decision:** migration rehearsal passed on a test branch, but customer report authorization is **HOLD**, even when offline CI is green.
