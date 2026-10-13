# Paddle sandbox catalog plan (NOT deployed, NOT created in Paddle)

Source of truth: `lib/regional-pricing.js`. Paddle's sample Starter/Pro/Advanced amounts are unrelated to AI Visibility. No free trial or annual pricing has been approved.

## Proposed SaaS-only pilot product — subject to Paddle eligibility approval

**Business – Continuous Monitoring + Optimization** (`business-monitoring`): recurring monthly. Website describes a blend of monitoring software and human optimization planning; **do not create or enable a Paddle checkout until Paddle confirms this SKU is acceptable**. Consider separating pure self-service dashboard subscription from manual services before listing.

Current regional website prices (may be overridden by Vercel `PRICE_BUSINESS_MONITORING_<CURRENCY>` env vars; verify actual effective prices before catalog creation):

| Region/currency | Monthly amount |
|---|---:|
| Turkey TRY | 6990 |
| Europe EUR | 159 |
| UK GBP | 139 |
| Other USD | 169 |

Paddle modeling: product `tax_category: saas` **only if it is actually software access**, recurring price `billing_cycle: {interval: month, frequency: 1}`; each price uses smallest currency unit, no trial unless separately approved. Confirm supported currencies and local overrides in Paddle account.

## Exclude from automatic Paddle catalog until provider confirms eligibility

- `business-diagnosis`: one-time analysis + report, TRY 4990 / EUR 119 / GBP 99 / USD 129. May be a service rather than self-serve software.
- `business-solution`: scoped implementation, starting at TRY 19900 / EUR 449 / GBP 399 / USD 499. Variable scope and human services: **not suitable as a fixed automated checkout**.
- Social analysis, implementation and monitoring SKUs: need separate Paddle eligibility review, especially human/manual work.

## Integration and launch safeguards

- No Paddle account access has been authorized to this ChatGPT integration. Do not claim Paddle catalog objects or credentials exist.
- Only create sandbox products after confirming eligible SKU and effective prices; avoid duplicates by matching a stable internal `custom_data.service_code` and checking existing products before POST.
- Paddle sandbox API keys belong in secure server-side environment variables, never chat, repository, client JS or screenshots. Never use a live key in sandbox.
- Store sandbox price IDs from Paddle responses; do not invent `pro_` or `pri_` identifiers.
- Paddle.js client-side token is distinct from server API key; configure checkout domain/default payment link and verify webhooks and idempotent provisioning before live activation.
- Webhook signature verification, entitlement matching, duplicate-event protection, refund/cancellation reconciliation and end-to-end tests required.
- Merchant approval, website review, seller verification and Turkish seller tax obligations remain separate gates.

References: https://developer.paddle.com/build/products/create-products-prices/ and https://developer.paddle.com/api-reference/about/authentication/.
