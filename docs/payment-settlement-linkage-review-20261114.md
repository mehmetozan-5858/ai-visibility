# Paddle settlement-to-customer linkage — review hold (2026-11-14)

Status: **HOLD, read-only evidence only**. This file creates no payment entitlement and does not enable live checkout or change a production database.

## Verified production facts (aggregate SELECT only)
- `public.payments`: `bank-transfer/paid = 17`, `bank-transfer/pending = 3`, `bank-transfer/customer-reported = 1`; `method='paddle'` rows = **0**.
- `public.paddle_live_events`: **2** event rows; one `transaction.completed`; **0** events with *both* `payment_id IS NOT NULL` and `client_id IS NOT NULL`.
- `public.paddle_live_entities`: **0** rows with both payment and client linked.
- `public.paddle_live_subscription_links`: **0** rows.
- `public.verified_customer_settlements`: absent.
- Existing `client_credentials`: one hash row linked to an active customer; current active pilots: zero. No passwords or personally identifying row contents were retrieved.

These do not demonstrate a paid, non-test, customer-bound Paddle settlement. Do not promote zero-value test checkouts, arbitrary webhook events, or internal `paid` labels to verified revenue or access.

## Reproducible, bounded read-only checks
Use only the established production Neon branch via a read-only authorized connection; do not copy raw events, customer IDs, email or secrets into logs.

```sql
SELECT method,status,COUNT(*)::int AS count
FROM public.payments
GROUP BY method,status
ORDER BY method,status;

SELECT
  COUNT(*)::int AS event_count,
  COUNT(*) FILTER (WHERE event_type='transaction.completed')::int AS completed_events,
  COUNT(*) FILTER (WHERE payment_id IS NOT NULL AND client_id IS NOT NULL)::int AS linked_events
FROM public.paddle_live_events;

SELECT COUNT(*) FILTER (WHERE payment_id IS NOT NULL AND client_id IS NOT NULL)::int AS linked_entities
FROM public.paddle_live_entities;

SELECT to_regclass('public.verified_customer_settlements') IS NOT NULL AS proof_table_present;
```

## Required acceptance before payment-backed customer access
1. Verified signed Paddle webhook, exact event type/status and transaction identity; reject unsigned, duplicate, replayed, cross-tenant or stale events.
2. Independently verified **positive final settled amount**, tax/discount arithmetic, currency and non-test status. A zero-value transaction is a checkout test, not proven revenue. Review draft PR #243 before promoting any settlement.
3. Exact bound `payment_id`, `client_id` and transaction/event identifiers; do not infer a customer from a bank-transfer label or free-form custom data.
4. Review subscription cancellation, refund and delayed event ordering (see draft PR #234); payment history alone is not active entitlement.
5. Review additive settlement-proof migration on an isolated PostgreSQL branch with privileges, constraints, rollback and historical customer access checks. No production migration/flag changes until separately approved.
6. Preserve existing password hashes and deny cross-customer report access. Test actual login and authorization separately with authorized session, **without transmitting credentials to the review process**.

## Release notes
The deployed code still contains a legacy server-side fallback: when `CUSTOMER_SETTLEMENT_PROOF_ENABLED!='true'`, an internal `paid` label may return `kind:'paid'`. PR #268 fixes UI trust in the server authorization, not this upstream fallback. Flipping the strict flag while its proof table is absent could revoke legacy access; **do not do this in production**.

PR #268 passing synthetic CI/browser tests does not verify an actual charge, signed delivery, independent settlement, or real customer password.

- PR #268: https://github.com/mehmetozan-5858/ai-visibility/pull/268
- PR #243: https://github.com/mehmetozan-5858/ai-visibility/pull/243
- PR #234: https://github.com/mehmetozan-5858/ai-visibility/pull/234
