# Sandbox customer identity mapping — 2026-10-13

## Implemented
Authenticated Sandbox checkout now creates a server-side, UUIDv4 checkout intent with a validated catalog price and 30-minute first-claim window. The customer comes exclusively from the verified ai_client session; request bodies containing a customer ID are rejected. Same-origin JSON is required. Only the opaque intent ID is sent to Paddle custom_data; the internal customer ID is not sent by the application.

The raw-signature-verified webhook links intents in the same database transaction as event recording. It requires the exact price and quantity one, consistent Paddle customer/subscription/initial transaction, and a unique customer owner. Unknown, expired or conflicting references roll back event insertion and entity changes. Timely provider occurrence timestamps permit delayed first delivery; subsequent correctly bound renewal/cancellation events can arrive after initial intent expiry. Anonymous Sandbox checkouts remain recorded without customer linkage.

An authenticated /api/paddle-sandbox/account endpoint lists only records selected by session client ID, not query parameters. The Sandbox page has a manual test-status refresh for signed-in customers. Both added endpoints are disabled in production and write/read only the dedicated Sandbox database. No production entitlements or customer records are changed.

## Verification
- 302 application tests pass, including CSRF, invalid/forged session, caller-supplied customer rejection, unknown catalog/prototype keys, expired/wrong-price/quantity/customer/subscription intents, cross-owner rejection, late bound renewal and rollback tests.
- A separate local fixture using the actual createClientToken/verifyClientToken HMAC implementation verified the correct actor and rejected a modified identity. No external or production authentication secret was used for this fixture.
- Local Next.js build passed. Application preview dpl_HC6BGMp5Rz3wm4Zo15Wu7fhj9Ysr and isolated receiver dpl_4JdszUry4Ec1gZzXJp1vXzLj4Jpc reached READY, source b63ce95169709c8d5a259ecbbc6dab8a9151cb22, target staging.
- Test-only intent/customer ownership tables were created in store_ObUCJUy1fyj09cnt. SQL editor restored to read-only.
- A synthetic server-owned intent was seeded for sandbox-identity-fixture-a. A new Paddle subscription.activated simulation included that opaque intent plus a misleading client_id=attacker-supplied-ignored field. Direct provider delivery returned 200; SQL join confirmed stored owner sandbox-identity-fixture-a, Paddle sample customer ctm_01hv6y1jedq4p1n0yqn5ba3ky4, sample subscription sub_01hv8x29kz0t586xy6zn1a62ny, status active. This is a provider-signed simulator fixture, not a newly created real subscription or browser-authenticated intent issuance.
- The previously used simulator showed stale delivery output after destination activation. A new independent simulation verified actual delivery; old output was not counted as fresh evidence.

## Cleanup and remaining checks
The separate-project automation key was revoked (regenerate=false; empty protectionBypass), removed from Paddle URL and destination deactivated. A temporary preview read-access share link created by a protected-fetch attempt was also revoked. The attempted browser/account-endpoint smoke was blocked by the browser client, and connector fetch remained behind Vercel authentication; do not count this as authenticated account UI verification.

Remaining: authenticated browser session -> intent endpoint -> real Sandbox checkout -> own status UI; real timed renewal (Paddle requires at least 31 minutes ahead); production billing/entitlement wiring and separately approved launch gates. Main remains unmerged; no live payment or production deployment.
