# Paddle Sandbox preparation — 2026-10-13

GitHub main inspected at 90c12848901becc6acd3b6bac05364dd6e15fb31. Vercel project ai-visibility has ready production deployment dpl_DRYXGonMBPRZ3EpKvRJ4p7qEahU1. Its /pricing URL redirects to admin login; canonical prices live in lib/regional-pricing.js and are displayed at /hizmetler. No PRICE_* overrides or Paddle settings were present in the inspected Vercel environment metadata.

## Completed catalog
Eight sandbox products, each with four fixed price entities: TRY, USD, EUR, GBP (32 prices). Four one-time digital reports and four monthly software monitoring subscriptions. No trials, quantity 1, tax inclusive for deterministic sandbox totals. Mapping: lib/paddle-sandbox-catalog.js. Automated currency conversion must not be used to choose a different regional offer; the test page selects an explicit currency-specific price ID.

business-solution and social-solution excluded: their prices are "from" quotes, not fixed checkout offers. Human service eligibility must be verified with Paddle before live use. The catalog descriptions describe digital platform deliverables only; they do not establish approval by Paddle. Tax policy also requires a separate live review.

## Isolation and activation
The existing Vercel DATABASE_URL is scoped to both production and preview. Do not use it for Paddle tests. No production payment, client or provisioning functions are called by this integration.

The page /paddle-sandbox and webhook /api/webhooks/paddle-sandbox return 404 outside preview/development, or unless explicitly enabled with sandbox environment. Default is disabled. Production and live tokens are rejected. The webhook validates the raw-body HMAC signature with five-second freshness tolerance; repeated event IDs are ignored transactionally, older entity snapshots cannot overwrite newer ones. No test event grants real access.

Before enabling on this branch only:
- PADDLE_SANDBOX_ENABLED=true
- PADDLE_ENVIRONMENT=sandbox
- PADDLE_SANDBOX_CLIENT_TOKEN: test_ token from Paddle Authentication (public client token; never use an API key in the browser).
- PADDLE_SANDBOX_WEBHOOK_SECRET: server-only notification destination secret.
- PADDLE_SANDBOX_DATABASE_URL: dedicated database identity, with docs/paddle-sandbox-schema.sql applied. Not an alias of the production database.

Configure Paddle default payment link to the exact preview /paddle-sandbox URL after that preview exists. Configure notification destination to the exact preview /api/webhooks/paddle-sandbox URL. Keep Vercel protection enabled; a webhook needs an intentionally approved service access route, not a global disabling of protection.

Credential creation requires user confirmation in the browser. No API key, client token, destination secret or database was provisioned in this preparation. No payment was performed. No code merged to main or production deployed.

## Remaining end-to-end verification
Open checkout for each currency, one-time and monthly offers using Paddle test cards. Verify signed transaction.completed, subscription activation/update/cancellation/past_due, replay duplicates, reordered events, invalid signature, unknown price, storage failure retry and isolated records. Confirm production data remains unchanged. A completed checkout alone is not fulfillment. The current handler records sandbox billing state only; production entitlement and subscription management remain deliberately unimplemented.

Official references:
- https://developer.paddle.com/build/products/create-products-prices
- https://developer.paddle.com/get-started/quickstart
- https://developer.paddle.com/webhooks/about/signature-verification
- https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
