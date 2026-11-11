# Private payment evidence readiness

The private real-events page adds an explicitly requested, admin-only payment evidence summary. A separate button queries GET /api/admin/rd-payment-evidence. It reports internal payment status labels from the latest 200 non-future records across all dates, with a 201st-record truncation check. No identifiers, amounts, customer information or payment modifications are returned.

Table presence is metadata only: it never verifies signature delivery, settlement, customer acceptance or revenue. Every response retains acceptance=not-verified and verifiedRevenue=null, even when all three source tables exist. Unknown/error responses use 503 rather than default zero counts. Provider account observations are not embedded as live measurements.

## Source access

migrations/rd-payment-evidence-reader.sql creates one security-barrier aggregate view and grants SELECT to the existing NOLOGIN rd_audit_reader. No raw payments access is granted. Runtime uses BEGIN READ ONLY, a 3-second statement timeout, SET LOCAL ROLE and verifies effective role and read-only mode. There is no owner-level fallback or runtime schema creation. The connection still uses the existing application account; a separate dedicated login is not configured.

The additive migration was rehearsed on the existing isolated review branch. That branch already has the settlement review table; its existence does not demonstrate production settlement acceptance. Tests cover source-table absence/presence, bounded samples, bank-transfer paid labels without verified revenue, denied raw reads/writes, wrong-role rejection and sanitized database failures.

## Release and rollback

Run tests/build, exact-source CI and browser acceptance before deploying. Apply the additive view migration to production before the release. Existing synthetic pilot pages remain synthetic; this route remains private. Verify unauthenticated access returns 401. Authenticated production HTTP retrieval still requires a legitimate administrator session and must not be inferred from SQL or CI checks.

Rollback application to dpl_BtqQYxFaPmGpzZmkvDqMhiu5x9mn. The unused additive view may remain; any removal is a separately reviewed maintenance action. No payment is created, refunded, replayed or represented as independently verified by this change.
