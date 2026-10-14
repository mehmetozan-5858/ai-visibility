# Direct Paddle simulation follow-up — 2026-10-13

The user explicitly approved transmitting a temporary Vercel preview share URL to Paddle Sandbox. The existing subscription.activated payload was preserved and replayed with the real sandbox business-monitoring USD price.

Paddle returned HTTP 307 with a redirect to /api/webhooks/paddle-sandbox. Vercel share-link access establishes browser access through a redirect; this simulation did not follow it to deliver the signed POST. Direct Paddle acknowledgement remains unverified. Deployment Protection and application signature freshness were not weakened.

Cleanup completed: the temporary access query was removed from Paddle, the isolated notification destination was deactivated to prevent failed retries, and the exact temporary Vercel share link was revoked with regenerate=false (protectionBypass empty). No secret appears in these docs.

Previously verified manual signed HTTP fixtures and isolated database checks remain valid (see paddle-sandbox-webhook-verification.md). Those tests are distinct from provider-generated delivery. No checkout payment, real subscription, production deploy, main merge or live payment occurred.

Next integration requirement: a protected preview webhook delivery method that supports Paddle POSTs without a browser-cookie redirect; assess endpoint-scoped access before any further access change. Real sandbox checkout and subscription lifecycle tests remain pending.
