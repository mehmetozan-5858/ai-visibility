# Paddle Sandbox status — 2026-10-14, Europe/Istanbul

This is the current consolidated status. Earlier preparation/runtime notes are historical snapshots, not current readiness claims.

## Completed and verified

- Catalog: eight products, 32 explicit TRY/USD/EUR/GBP prices, four one-time reports and four monthly monitoring offers. Quote-based services excluded.
- Real Sandbox checkout: monthly payment and activation, immediate cancellation, declined one-time payment and successful retry. Seven actual platform events confirmed in the isolated database; simulator events are distinguished from them.
- Raw signature verification, freshness, duplicate/reordered event handling, catalog validation, rollback and production-route isolation covered by automated tests.
- Customer binding: server-owned opaque checkout intents, session-only identity, exact price/quantity checks, unique Paddle customer ownership. Signed Paddle simulator delivery confirmed linkage to a seeded synthetic intent.
- Account-route behavioral checks now execute the actual GET route with an isolated database adapter: production/unauthenticated requests never open the pool; two customers each see only their own records despite a foreign customer query parameter; error responses omit private details and close the pool. Responses are no-store. Full test suite: 307 passed, zero failed.
- Main application's separate Stage 5 customer journey passed after PR #29 publication. Owner screenshot at 00:40 showed email verification, account preparation, login, portal, score-42 synthetic data and PDF completion. This is not Paddle customer-session verification.

## Safely stopped test resources

The earlier real Sandbox test subscription was canceled. Temporary test-project automation bypass keys and the preview share key were revoked. Paddle notification destination was deactivated after successful delivery tests. Thus new provider events will not reach the protected receiver until an authorized test session temporarily restores that specific route and destination. No renewal is currently scheduled and no 31-minute countdown is running.

## Still open

1. Browser-authenticated customer session on the isolated preview → server intent → real Sandbox checkout → own subscription-status UI. API behavior and seeded provider binding are verified separately; they do not replace this complete browser journey. The preview intentionally blocks production sign-in/account routes, so this requires a scoped test-session provisioning design and owner authentication participation, without opening production routes or reading production customer data.
2. Real timed renewal: create a new Sandbox subscription, save a billing date at least 31 minutes ahead, retain only temporary test receiver access, observe actual recurring transaction and subscription events, then cancel the test subscription and revoke access. Simulator renewal evidence does not close this check.
3. Production entitlement wiring and commercial launch gates remain separate and are not authorized by Sandbox testing. No live payment credentials/catalog migration or real charge has been performed.

Current Sandbox application preview: dpl_HC6BGMp5Rz3wm4Zo15Wu7fhj9Ysr. Receiver: dpl_4JdszUry4Ec1gZzXJp1vXzLj4Jpc. Sandbox PR #28 remains unmerged. Main Stage 5 fix is f00ebf7be8ccb8ad2211498c8b896652fde1941a, independently published with owner approval.
