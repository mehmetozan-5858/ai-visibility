# RD-04: revenue record consistency pilot

This increment is a live synthetic trial only. It does not connect to customer, CRM, payment or settlement tables.

- Page: `/arge/gelir-pilotu`.
- Read-only aggregate self-test: `GET /api/rd/revenue-pilot`.
- Ten fixed scenarios exercise `reviewRevenueRecords`, a pure tenant-scoped record comparison policy.
- Signals: missing/ambiguous proof, amount/currency mismatch, reused provider identity, refunded-but-active access, zero-value tests, unexpected positive charges, unconfirmed evidence and cross-tenant contamination.
- Matching records are `consistent-records`, never proof of actual revenue. Verified and recovered revenue remain null.
- Caller input is never consumed by the public pilot. POST and neighboring record paths retain authentication; sandbox isolation remains first.
- No database, schema change, provider call, charge/refund, account change, external email or scheduled job.

## Future trusted integration contract

Amounts are safe integer minor units, with explicit currency and immutable client/payment/provider identifiers. The future adapter must derive `independentlyConfirmed` from trusted stored signature/reconciliation evidence; the policy cannot validate signatures or accept this flag from a request body. Duplicate or mismatched records require human review and never trigger automatic corrections.

Real records remain out of scope until live payment acceptance and a minimally privileged source adapter are independently verified. An active pilot or legitimately suspended subscription can explain some access states; a review flag is not proof of revenue leakage.

## Acceptance and rollback

Require full suite/build and exact-head CI/browser checks. Live endpoint must report HTTP 200, synthetic-only scope, 10/10, no customer reads or payment changes, and null revenue claims. Public customer pages and private admin/customer boundaries must remain intact.

Rollback before this increment: `dpl_4FiP5fSn3ESfZ9JTyY8NEDjxXcuX`, source `861dd2e1df86965c1fc2d9faa423f26895f2128f`. No persistent data cleanup is needed.
