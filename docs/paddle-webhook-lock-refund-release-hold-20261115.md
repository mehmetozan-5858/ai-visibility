# Paddle webhook release HOLD — 2026-11-15 (review only)

Observed source at parent PR #269 commit `cede0cfc5e8640e2bbaefabde1e8f6cea37cf18b`. The real Paddle route authenticates raw payload signatures (HMAC + timestamp) and the event handler checks paid amounts, currencies, final totals, event ID uniqueness and transaction rollback. These are **code controls**, not evidence of a live checkout or revenue.

## Remaining blockers in required order

1. **Tenant-first lock before any event or payment row writes.** Current `recordPaddleLiveEvent` inserts `paddle_live_events` before `applyTransaction`, whose first payment read uses `FOR UPDATE`. `applySubscriptionAccess` also locks a payment row before any shared tenant advisory lock. Review-only `withPaddleEntitlementWriterLockReview` and two-backend tests show an alternative sequence, but no production path is connected.
2. **Real provider linkage and reversals.** `ALLOWED_EVENTS` recognizes completion, failures and subscription lifecycle, but explicit refund/adjustment events are not in the allowlist. The `refunded` state is protected against being reactivated by a delayed transaction; this does **not** establish that a refund event actually transitions paid entitlements to revoked. Must validate and implement supported Paddle adjustment/refund semantics against official current docs before rollout.
3. **Bounded, pinned transaction.** Resolve trusted tenant by stored payment UUID, acquire advisory lock, confirm tenant/payment still match, only then insert event dedup and take `FOR UPDATE`; apply payment, settlement proof, subscription and access updates within the **same transaction**, all fail closed with rollback.
4. **Out-of-order and duplicate webhooks.** Replays and stale events must not restore access. Refund/cancel/past-due must be reconciled to the same tenant and verified payment. Ensure multi-event ordering does not cause event-table-row / tenant-lock deadlocks.
5. **Acceptance gates.** Disposable two-connection PG races for completion vs suspend, refund vs delayed completion, duplicate event vs crash/rollback, wrong client, missing subscription link and event reordering. Then production Neon least-privilege RPC and existing-password customer report acceptance, without treating synthetics as live proof.

The accompanying `tests/portal-paddle-live-release-hold-audit-review.test.mjs` intentionally records unresolved blockers: **a passing test signals the blocker inventory remains accurate, NOT that the blockers were solved**. Refresh these checks against new parent commit hashes; parent #269 changes independently.


## Paddle official adjustment semantics (verified 2026-11-15)

Paddle Billing documents **`adjustment.created`** and **`adjustment.updated`** for refunds, not a `transaction.refunded` webhook. An approved refund may be reported immediately in `adjustment.created`, without any later `adjustment.updated`; approval-required refunds start as `pending_approval`. The `action` can be `refund`, `credit`, `chargeback` etc. `status` can be `approved`, `pending_approval`, `rejected`, `reversed`. `type` distinguishes `full` and `partial`. Never auto-revoke an entire customer entitlement for pending approval or a partial refund, and never treat a credit or chargeback as a confirmed full refund.

Official references:
- https://developer.paddle.com/webhooks/adjustments/adjustment-created/
- https://developer.paddle.com/webhooks/adjustments/adjustment-updated/
- https://developer.paddle.com/build/transactions/create-transaction-adjustments/

Review-only classifier `lib/portal-paddle-adjustment-classifier-review.mjs` and tests are **not** connected to the production webhook. Even a classified approved full refund must prove its transaction belongs to the expected tenant, payment and subscription, use tenant-first lock and atomic audited persistence, enforce currency/amount and block delayed completion/reinstatement. A real signed event is not reproduced by a synthetic classifier.

## Safety

No merge, deploy, production Neon DDL/DML/GRANT, Paddle checkout, real customer payment, password reset, budget change or secret inspection. Production HOLD. ZERA remains test-only.
