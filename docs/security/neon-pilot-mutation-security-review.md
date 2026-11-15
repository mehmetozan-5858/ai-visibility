# PR #273 — mutation-path security review (2026-11-15)

**Decision: BLOCKED FOR EXECUTION.** The proposed row-trigger locking sketch in `neon-pilot-mutation-trigger-review.sql` MUST NOT be installed as-is. This is a design-review result, not evidence of a functional Neon test.

## Grounded isolated-branch facts
- `portal_authz_trial.guard_pilot_access_mutation` and `guard_client_mutation` do not exist on isolated branch `br-plain-poetry-b2u7f7a6`.
- `client_pilot_access` and `clients` have no RLS; database owner has INSERT/UPDATE/DELETE/TRUNCATE and DDL authority. The restricted report owner has SELECT only; gateway does not have USAGE on `portal_authz_trial`.
- The current one-time report function does not check pilot grant status or acquire the proposed advisory lock. No synthetic pilot grant exists on this isolated branch.
- GitHub repository code search returning no matching files does not prove application/API write paths are absent. The production write-path inventory is still unverified.

## Critical design flaws to resolve
1. **Potential lock-order inversion / deadlock:** A row-level BEFORE UPDATE trigger may run after PostgreSQL has acquired a tuple lock for the UPDATE. If the report path obtains advisory lock first, then tries to read data while a writer holds a tuple lock and waits for advisory lock, an inversion/deadlock or timeout is possible. Do not assume a BEFORE row trigger universally protects the critical section. Prove with independent sessions using the actual SQL execution path.
2. **Unprotected DDL/TRUNCATE or administrative mutation:** row-level triggers do not fire for TRUNCATE and can be disabled by table owners. Explicitly review OWNER and administrative pathways, bulk jobs, maintenance scripts, direct SQL, FK cascades and client suspension.
3. **Cooperative advisory locks:** an ordinary writer unaware of the protocol can commit revocation without waiting. Thus adding a lock only to the reader cannot guarantee serialized access.
4. **Revocation semantics:** define what counts as 'revoked before access'. The code must not emit a report after an already committed revocation. It may need transaction boundaries, session/token invalidation and cache control.
5. **Secrets and identities:** only the server signs one-time claims; no gateway/customer access to signing keys or consumed-claim rows; pilot and tenant authorization must be checked in the DB. Never grant broad UPDATE to the report owner.

## Safer implementation candidate to review (NOT DEPLOYED)
- Centralize pilot grant/revoke and account suspension into narrow, transaction-scoped, SECURITY DEFINER *writer* functions owned by a separate least-privileged role with only the required columns' UPDATE/INSERT rights.
- Revoke raw table DML from all non-admin runtime roles and route all app/agent/admin actions through the writer functions. Each writer obtains the exact same per-tenant advisory transaction lock **before any row DML**, validates actor/tenant, performs the operation and commits.
- Read function obtains the same advisory lock after signature verification and before authoritative pilot/client checks and claim consumption. Audit that each path uses the same key expression and transaction. Remove/deny all alternate write paths, or enforce with another independently audited mechanism.
- Keep a fail-closed rule: if any reachable mutation path bypasses coordination, remain HOLD. Treat database-owner maintenance actions as privileged operational exceptions requiring documented downtime/control.
- Confirm transaction-pooler behavior and session handoff: a transaction-scoped lock must remain on the same connection from acquisition through commit.
- No claim that this design is sufficient until reviewed and demonstrated with two independent DB sessions, reversals, rollback, timeout, deletion, suspension, grant expiry and replay cases.

## Required next evidence
1. Inventory exact application routes/jobs and SQL that INSERT/UPDATE/DELETE pilot grants and change client status (including elevated connections).
2. Document owner and caller privileges for each writer entrypoint and remove broad runtime DML access if present.
3. Get explicit approval for isolated-branch schema writes, snapshot, synthetic fixture and test credentials; no production change.
4. Attach redacted independent-session logs and exact git/Neon branch refs; record pass/fail for T01–T14.
5. Require exact-head CI, actual customer existing-password login, real report, live provider and Paddle evidence separately.

**Production HOLD. No merge/deploy.**
