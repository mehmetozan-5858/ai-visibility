# PR #273 — coordinated per-tenant revocation design (review only)

**Status: NOT IMPLEMENTED / NOT ACCEPTED.** This document describes an alternative to giving the restricted report-function owner UPDATE privilege. It must not be treated as production-ready or as a passed concurrency test.

## Why the prior approach is blocked
The restricted SECURITY DEFINER function owner cannot use SELECT ... FOR SHARE on clients or client_pilot_access with its existing privileges. Widening its UPDATE scope would violate least privilege. A basic revoked_at predicate can reject a claim revoked *before* the read but does not serialize a revocation racing a read.

## Proposed narrow coordination contract
Use a per-tenant **transaction-scoped PostgreSQL advisory lock**, acquired under the same deterministic key in BOTH read-claim and authorized revocation transactions. A lock namespace + tenant UUID is hashed to a bigint. Hash collisions only over-serialize unrelated tenants; they must never cause cross-tenant access. Use only bound, server-provided tenant UUIDs.

1. **Read path** inside public.portal_trial_one_time_report, *after signature and TTL checks, before any authoritative client/pilot checks*: `PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-pilot-v1:' || p_tenant::text, 0));`
2. Re-read clients status, client_pilot_access revoked_at/expiry, and consume one-time claim while lock is held. The transaction-scope lock releases on commit/rollback. The caller MUST complete the transaction before replying to the customer, and must not cache results across revocation.
3. **Revoke path** must execute under its own appropriately authorized identity in a SINGLE database transaction: verify actor permission using server-side authenticated identity, obtain **exactly the same** advisory lock for that tenant, update pilot revoked_at, and commit. Avoid letting arbitrary gateway/customer callers revoke other tenants; no direct UPDATE rights for gateway.
4. **Grant path** and **account status suspension** must participate in the same coordination protocol or have separately proven equivalent serialization. All paths, including admin UI, jobs, direct SQL and API, must be audited. Direct uncoordinated UPDATE/DELETE can bypass the lock: BLOCK production until eliminated or covered.
5. Token issuance, post-revocation existing sessions and app-level cache invalidation remain separate acceptance controls.

## Critical limits
- Advisory locks are cooperative. They do not automatically block ordinary UPDATE/DELETE. The above is safe ONLY if every relevant writer uses the same lock, in the same transaction, with audited permissions.
- Advisory locks do not themselves authorize a principal. Validate the authenticated actor, membership and tenant before generating a claim/revocation. Never accept caller-controlled tenant scope as proof.
- Exact linearization with concurrent commits and token expiry should be tested in separate sessions. Beware transaction-pooling: use lock-and-update in the same database transaction and connection. Compare commit order, not wall-clock guesses.
- A report's result must not be streamed outside a still-open transaction if it needs revocation ordering guarantees.
- Must test lock timeouts, deadlocks, rollback, client suspension, revocation-before-read, read-before-revocation, and stale valid MAC after revocation.
- Do not place the signing secret or a real customer identifier in acceptance logs.

## Minimal test outline (synthetic isolated tenant only)
- Fixture: synthetic clients row, synthetic report, pilot access grant, valid short-lived claim. Use protected test runner secrets; no DB owner impersonation.
- Session A: BEGIN; call one-time report, keep transaction open; Session B: BEGIN; acquire same tenant lock and revoke pilot. Confirm B waits; commit A then B; new signed claim from Session C must yield no rows.
- Reverse: B obtains lock and revokes/commits first; A's pending signed claim must yield no rows and must not consume claim.
- Repeat with account suspension, grant expiry, concurrent same-claim submissions, wrong tenant, bad signature and rollback. Verify no results leak and no claim consumed on deny.
- Before executing, secure explicit approval for isolated DB writes, verify exact project/branch, role credentials, snapshot/restore and CI exact-head. Never use production.

## Exit requirements
A reviewed read/revoke/grant coordination patch; independent-session evidence (not only static SQL); gateway role proof; authenticated real-customer session and report; CI exact-head; Paddle/provider live-evidence acceptance. Until then: **PRODUCTION HOLD**.
