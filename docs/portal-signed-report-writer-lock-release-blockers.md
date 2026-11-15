# Customer report signed-RPC release blocker: writer coordination

**Scope:** Draft PR #269, source inspection updated on 2026-11-15. **Decision: Production HOLD.** This is a review artifact, not authorization to merge, deploy, alter Neon, change passwords, or enable payments.

## Verified from branch source

| Surface | Verified source behavior | Release consequence |
|---|---|---|
| `lib/portal-pilot-writes-review.mjs` | `grantPilotWithLockReview` and `revokePilotWithLockReview` use `withPilotWriteLockReview` | Only these two controlled pilot write paths share the proposed advisory lock |
| `lib/pilot-access.js` | `grantPilot` and `revokePilot` call the review lock-backed writer | Useful branch-level integration; does not prove all other writers are coordinated |
| `lib/repository.js` — `confirmPayment` | Draft branch now resolves the tenant from the stored payment, takes the shared advisory lock on a pinned transaction, then writes the payment and account state | **Partial progress:** source-level coordination exists; real payment/refund and race acceptance still **BLOCKED** |
| `lib/repository.js` — `confirmCardPaymentByMerchantOid` | Draft branch now resolves tenant from payment reference, locks before writes and commits card payment and account activation together | **Partial progress:** source-level coordination exists; independent payment event verification and race acceptance still **BLOCKED** |
| `migrations/portal-one-time-explicit-envelope-review.sql` | Report RPC takes `pg_advisory_xact_lock(hashtextextended('portal-pilot-lock-v1:'||tenant,0))`, then checks active client and unrevoked active pilot | Cooperative lock gives no guarantee unless every relevant writer uses matching key and transaction |
| `app/api/client-portal/route.js` | Live route uses legacy/strict RLS paths, **not** the review signed one-time envelope gateway | Source-level review RPC and simulated HTTP tests do not constitute real customer acceptance |
| `lib/customer-settlement-proof.mjs` | Strict Paddle settlement gated separately; historic paid label is not sufficient | Payment/refund/reversal acceptance remains independent and **BLOCKED** |

## Open after the two payment-activation writer patches

The bank/card activation paths now have a shared transaction-scoped lock in the draft branch; this does **not** prove all account-state writers are locked. In particular, suspension, deletion, pilot expiry edits, admin/manual SQL and settlement cancellation/refunds remain to be inventoried and independently tested. Payment business logic and provider authenticity must be validated separately. The production report route is not connected to the signed report RPC.

## Minimum safe follow-up

1. Inventory **all** client-status, entitlement, pilot-expiry, deletion and payment/refund writers (including admin routes, jobs, SQL migrations and manual operations), not just the two pilot helpers. Require explicit owner, source path and atomic tenant lock evidence.
2. For every customer-affecting transaction: acquire the exact `portal-pilot-lock-v1:` advisory lock on a **pinned** DB connection before any state or entitlement change; commit or roll back before the lock releases. For payment ID writers, resolve `client_id` first and lock by tenant; do not accept tenant IDs supplied by a client.
3. Prove synthetic **two-backend** races in disposable PostgreSQL: queued activation vs revocation, suspension vs in-flight report, account deletion/expiry vs report, rollback, and timeout. No raw cross-tenant report reads.
4. Verify existing customer password unchanged, signed session and single-use RPC using independently approved **least-privileged** Neon role and audited SECURITY DEFINER ownership in a genuinely isolated branch. Do not infer these from CI fixtures.
5. Require independent provider response evidence and signed Paddle settlement/cancel/refund/reversal acceptance. ZERA remains test-only, not a revenue event.
6. Recheck exact HEAD CI, Browser and Smoke **after** every code change. No implicit release approval even when tests pass.

## Evidence classification

Branch code and disposable tests: **synthetic/offline**. Actual Neon reader ACL, live role, production route integration, customer session, Paddle, provider receipt: **not verified**. Maintain **Production HOLD** until separate explicit acceptance of all gates.
