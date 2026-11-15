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

## Follow-up: one-time nonce consumed inside the database (2026-11-15)

On the **same existing isolated Neon branch**, added trial-only `portal_authz_trial.consumed_claims` with `claim_id UUID PRIMARY KEY`, and `public.portal_trial_one_time_report(tenant UUID,expiry BIGINT,claim_id UUID,mac TEXT)`. The HMAC binds a fixed report audience, tenant, expiry, and unique claim ID; PostgreSQL inserts the verified ID using `ON CONFLICT DO NOTHING RETURNING` before returning any rows. The reader's EXECUTE privilege on the **old replayable** trial function was revoked. The reader has EXECUTE on only the one-time function, no direct table/key/claim-ledger permissions.

**Real test-branch synthetic SQL results:** first valid claim returned 1 row, identical replay returned **0**, cross-tenant reuse returned **0**, forged `app.tenant_id` + wrong claim returned **0**, empty and expired claims returned **0**. Synthetic customers, reports and consumed claim were explicitly cleaned up (0 remaining).

**Transaction and operational limitation:** the claim ledger must be written to prevent replay. A `BEGIN READ ONLY` gateway transaction **cannot** work with this design. An audited `BEGIN` transaction can remain narrowly scoped to a role with no table INSERT/UPDATE/DELETE grants, invoking only the reviewed `SECURITY DEFINER` function. A rollback also rolls back consumption, so one-time behavior is for **committed** reads. Network failures after the read may require a **new, freshly signed claim**; do not automatically replay the original claim or report acceptance. Real production requires secure claim-key provisioning/rotation, bounded ledger retention, key revocation, concurrent replay tests, function owner/EXECUTE safety review and a separate deployment decision.

Review-only JS integration modules: `lib/one-time-db-report-review.mjs` and `tests/one-time-db-report-review.test.mjs`; **not wired** into the customer API, no production secrets, migrations or deploys.

## 2026-11-15 follow-up: overlapping replay and suspended-account status

Two trial PostgreSQL transactions were requested concurrently with **the same signed claim** and wholly synthetic customer report. The returned row counts were **1** and **0**, and both calls completed. This confirms the unique nonce ledger did not permit two successful committed reads in this observation; request overlap at the PostgreSQL execution layer was **not independently established**, so a controlled synchronized race/lock test remains required.

A separate negative test exposed that the first version of `portal_trial_one_time_report` accepted a valid earlier-signed claim **after** its synthetic customer row was marked `status='suspended'`: returned **1**. The function was amended **only on the isolated test branch** to recheck `public.clients.status='active'` after validating the MAC but before nonce consumption. Direct PostgreSQL retest: active synthetic customer→**1**, suspended synthetic customer with a fresh valid claim→**0**, and the suspended claim was **not** entered in the consumption ledger. All synthetic client, report and claim records were cleaned up (0 remaining). This still does not enforce revocation of an individual HTTP session, pilot entitlement or issued claim outside account status.

The first review helper CI failed at `npm test` because its UUID validation regex omitted the complete fourth UUID segment, rejecting even valid signed A/B sessions. Fixed in review commit `e43998b72629a98fb258268fe0091a5c635e5477`; acceptance requires a **new completed CI**, not the previously failed run.

## 2026-11-15 follow-up: SQL client concurrency observations and CI correction

A further race experiment on the isolated branch submitted two claims with the exact same nonce/MAC in parallel via connected tools, including a first transaction that held its commit open with a four-second `pg_sleep`. Results still were **1 and 0**, but PostgreSQL server timestamps established the second transaction's report statement started **after** the first committed (first started 06:10:47.991Z, first end 06:10:51.996Z, second started 06:10:56.845Z). **No true overlapping transaction contention was demonstrated.** The connector/tool execution may serialize operations. The unique index provides atomic duplicate arbitration in PostgreSQL, but a separate two-connection controlled harness must test blocking, rollback and commit races before launch. Test customer, report and claim ledger rows were deleted and counts verified zero.

The `3f1cab76` GitHub commit CI ended **FAILURE** (778 of 779 passed): test `tests/one-time-db-report-review.test.mjs` counted four text mentions of the RPC, including two privilege-inspection queries, rather than two actual report SELECTs. In review commit `012b0333c6ba1956f9e8d917210fc2a9c6896ccd`, assertion was scoped to the actual `SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_one_time_report(...)` call. The resulting CI is a new verification gate; do not claim pass while it is pending.

## 2026-11-15 review: SECURITY DEFINER owner isolation trial (not accepted yet)

On the **isolated nonproduction Neon test branch only**, the one-time report function owner was changed from the broad `neondb_owner` (BYPASSRLS) to new `portal_report_fn_owner_trial_20261115`, a `NOLOGIN NOBYPASSRLS` role. The role has no SUPERUSER, CREATEDB, CREATEROLE, permanent public-schema CREATE, credential SELECT or payment SELECT. It was granted narrowly required SELECT on client identity, comparison reports and private test signing keys, INSERT on the private spent-claim ledger, and a specific RLS SELECT policy on comparisons for **only the NOLOGIN function owner**. Required temporary CREATE on public during ownership transfer was revoked within the same transaction. The application-facing reader is **not a member** of the function-owner role.

The first post-transfer synthetic invocation failed with PostgreSQL `42501` on `portal_authz_trial.consumed_claims`: INSERT with `ON CONFLICT ... RETURNING claim_id` additionally needs SELECT on the returned column. A column-scoped `SELECT(claim_id)` grant was subsequently made **to the NOLOGIN function owner only**, not to the SQL reader. Read-only catalog recheck confirms the function-owner role has NOLOGIN, no BYPASSRLS, no SUPERUSER, no public-schema CREATE, and no payment SELECT.

**Critical acceptance remains BLOCKED:** The follow-up end-to-end synthetic call after that column grant was rejected by the execution environment's safety control, so there is **no verified PASS** for post-transfer function execution. Do not call the new owner design production-ready or infer that existing replay/status tests still pass under this new owner. The previous successful replay and suspended-account tests were run when function owner still had BYPASSRLS. Reverify privilege details and code in a separately approved test harness before any promotion. No production changes.

## 2026-11-15 follow-up: bounded transaction waits (review source only)

The currently **unwired** JavaScript report gateway now begins with `BEGIN ISOLATION LEVEL READ COMMITTED`, applies transaction-local `lock_timeout='2500ms'` and `statement_timeout='10000ms'` before the role probe/report RPC, and rolls back/releases the same connection on errors. Review-only commit `a356c9f18c3adbfed1ba307d007f37b305a939a2`; tests updated at `be7ac0f885a717ba0bf27f0ac7b39a56bd11324f` and add a synthetic SQLSTATE 55P03 rollback/release negative test at `4fd7bb798ab8a81333aa6c3ae51c41e758417b05`.

These source tests do **not** establish actual concurrent PostgreSQL cancellation/replay safety: the trial Neon RPC remains `public.portal_trial_one_time_report(...)` and has not been updated to match the new `public.portal_verified_one_time_report(...)` migration design with client/pilot row `FOR SHARE` locks. The current draft is pilot-only; verified Paddle settlement must be implemented as a separately reviewed DB-side entitlement branch. Real E2E testing after the NOLOGIN owner transfer was previously blocked; keep this gate **HOLD**.

Next controlled two-connection PostgreSQL acceptance must verify: (A) revoke UPDATE commits first => waiting report sees revoked pilot and returns no rows, without consuming nonce; (B) report holds `FOR SHARE` first => revoker waits, and any report issued before committed revocation finishes before revocation returns; (C) canceled report or lock timeout => rollback, no report, no stale connection role/tenant; (D) report transaction rollback => consumed nonce insert rolls back (retry semantics require separate design); (E) pilot expiry during lock wait => access denied by expiration recheck. Capture independent server-side timestamps and prove operations actually overlap; an observed 1/0 result alone is not concurrency evidence. Test only with synthetic records and explicit isolated-branch authority.

## 2026-11-15 follow-up: FOR SHARE privilege blocker and safer alternative research

The exact-head review PR source tests were green at SHA `04cc6f64ea1e427eca1a9bec81fc31f799cb12d4` (CI 43687286885, browser 43687286915, smoke 43687286921). **This did not cover an executing FOR SHARE report RPC on the actual isolated Neon database.** Read-only Neon catalog review of `portal_report_fn_owner_trial_20261115` found `clients SELECT=true`, but `clients.id UPDATE=false`, `client_pilot_access SELECT=false`, `client_pilot_access.client_id UPDATE=false`; under PostgreSQL privilege rules these deficits block the proposed `SELECT ... FOR SHARE` implementation. SQL reader direct writes remain disabled. This is a genuine release BLOCKER, not a green gate.

A separate, **unwired** review alternative was drafted at `lib/portal-pilot-advisory-lock-review.mjs` (commit `ca890d5ca04e2d26267561b832ee0b25be659675`) with static negative tests at `tests/portal-pilot-advisory-lock-review.test.mjs` (commit `6e98d57e01d0f05b28f2a3acc77928733410b786`). Both report and all pilot grant/revoke paths would use a transaction-scoped key defined by `hashtextextended('portal-pilot-lock-v1:'||tenant_uuid::text,0)`; this approach can avoid granting UPDATE to the NOLOGIN function owner. A read-only Neon probe confirmed `hashtextextended` returns a numeric key and the SQL reader can execute the advisory lock function. The helper is not connected to report, grant or revoke flows and **must NOT be treated as protection today**. Advisory locks are cooperative: every entitlement writer, including direct admin SQL, pilot edits/deletions, account suspension and migrations, must be audited/instrumented or otherwise prevented from bypassing the lock; all holders must acquire locks in the same order. Without that writer-control evidence, this alternative cannot replace the existing blocker.

A collision between two advisory hash keys may serialize unrelated tenants, but should not itself grant access; the report function must always recheck signed tenant-specific entitlement and account state. Long waits/timeouts, rollback/connection-pool reuse, rogue writers and true overlapping two-connection trials remain mandatory. Keep both designs in review and do not automatically increase DB privileges or apply live changes.

## 2026-11-15 follow-up: real PostgreSQL writer acceptance and exact-head CI failure

CI run `43690488814` on exact commit `effb16e3f2e9b72f5e177dfde076faaae8254e6b` **FAILED** three review writer tests because an incomplete UUID regex rejected valid synthetic tenants **before SQL**. The latest review-branch source now contains the corrected version/variant UUID regex, but previous failing commits remain failing evidence. Do not mark a later commit successful until its exact-head CI passes.

Created `tests/portal-pilot-writes-real-postgres.test.mjs` (commit `05f5b0a1496e5dcb52c58abdfc13b3affcab6aab`) to test the two *review-only* pilot writer functions on the disposable PostgreSQL 16 GitHub Actions service: pilot grant and audit insert commit; failed grant audit rolls back pilot creation; revoke and audit commit; duplicate revoke creates no duplicate activity. These are synthetic database writes on the ephemeral CI fixture **only**, not Neon/live customers. The existing independent two-backend advisory-lock test separately checks actual lock contention in that disposable PostgreSQL service, but does not prove a production function or all external writers obey this protocol.

CI for commit `05f5b0a1` was pending at observation; its Browser workflow was cancelled by new review activity. Corrected-branch exact-head CI and all release gates remain required. No production migration, privilege GRANT, key, payment, deployment, merge or budget change.

## Mandatory blockers before anything can go live

1. Review an auditable DB-verification function migration for production; avoid PUBLIC EXECUTE and exposed private schemas. Confirm the owner can read only the required data and no broader SECURITY DEFINER capabilities escape. Validate lock and rollback.
2. Define a dedicated **new** `PORTAL_REPORT_CLAIM_SECRET` shared securely between trusted server-side claim signer and PostgreSQL verifier; **never reuse `AUTH_SECRET`**, hard-code secrets, emit them in CI logs or give them to SQL reader role. Plan key rotation/revocation, replay/nonce/session invalidation and expiry.
3. Bind every claim to an independently verified signed customer HTTP session, tenant, specific report audience and entitlement. Do not accept client-provided tenant ID or signed claim from arbitrary request fields.
4. Restrict the service's SQL login to executing the bounded report function; its readiness preflight must require **no raw comparison SELECT** (the older `trusted-report-reader-privileges-review.mjs` requires SELECT and is incompatible with this stronger design). Pin role attestation and function invocation to the **same acquired READ COMMITTED transaction**. It CANNOT be SQL READ ONLY, because the SECURITY DEFINER function inserts into the spent-claim ledger. The reader role itself must have no table INSERT privilege.
5. Include adversarial tests for A/B, forged GUC, forged/expired/replayed claims, revoked accounts, concurrent sessions, reader privilege escalation, function search_path hijack and arbitrary SQL calls; compare real PostgreSQL results on an isolated branch before authorizing production.
6. Existing verified settlement/real free AI receipts/real customer login and provider costs are independent HOLD gates.

**Decision:** proof-of-concept threat test succeeded, but release remains **HOLD**. No new production environment variables, LIVE migrations, passwords, customer data or payments.
