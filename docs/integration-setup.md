# AI Visibility integration setup

Changes released October 6, 2026. Configure production variables in Vercel, then redeploy. Never put service credentials in chat or the public repository. `/ayarlar` reports missing variable names; configured means credentials exist, not that a live transaction was verified.

## Admin recovery

Email and SMS are both required. SMS needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` and the existing `ADMIN_RECOVERY_PHONE`. Use E.164 phone numbers. Verify the sender/account can deliver to the recovery phone. Test both channels from `/sifremi-unuttum`. Reset codes are consumed together in a transaction.

## Shopier

This adapter opens an existing hosted product checkout. It does not create products, verify Shopier payment notifications or activate accounts automatically. The admin checks the order/bank record and confirms the invoice. Customer order notes must contain the AIV reference code; customers use “Ödeme yaptım” after checkout.

Configure `SHOPIER_PRODUCTS_JSON` keyed by service code and invoice currency. Each record contains the real HTTPS Shopier product URL, currency and exact initial payment amount:

```json
{"business-diagnosis:TRY":{"url":"https://www.shopier.com/REPLACE_WITH_REAL_PRODUCT","currency":"TRY","amount":4990}}
```

The example is a placeholder, not an activated product. The adapter rejects an amount/currency mismatch, non-Shopier hosts and URLs containing credentials. A service can be monthly in the app, but a hosted product checkout pays one invoice only; no automatic subscription renewal is implemented. Configure each supported market separately. PayTR, if selected instead, requires its merchant ID/key/salt and is limited to TRY invoices.

## Receiving replies

1. In Resend, configure a receiving domain/subdomain with the provider’s MX records. Do not overwrite the existing business inbox MX records.
2. Set `INBOUND_EMAIL_ADDRESS` to the receiving address and grant the existing `RESEND_API_KEY` permission to retrieve received emails.
3. Create a webhook for `email.received` at `https://www.aivisibilityworks.com/api/webhooks/resend` and place its signing secret in `RESEND_WEBHOOK_SECRET`.
4. Send a test reply and check Ajanlar → İletişim → Gelen Yanıtlar. The webhook validates the raw signature and stores each event/email once. The hourly `inbox-cycle` retrieves the body and processes two pending messages per run; the admin can also process the queue.

A message is automatically classified only if the receiving provider reports DMARC pass, the recipient matches, and exactly one previously contacted business or creator matches its sender. Other messages require human review. Attachments are not opened. Reply drafts are not automatically sent. Messages with transient failures retry up to five times; then require review.

References: https://resend.com/docs/webhooks/verify-webhooks-requests and https://resend.com/docs/api-reference/emails/retrieve-received-email.

## WordPress delivery

Configure `WORDPRESS_SITE_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APPLICATION_PASSWORD`. Use an application password for a user with draft creation permission. The site hostname must match the work item’s client domain and use public HTTPS. This initial adapter connects one configured site; adding other clients requires separate connection management.

Ajanlar → İş ve Onay Merkezi → “WordPress taslağı oluştur” transfers a paid client’s ready content/FAQ/location text to a new draft. It never publishes automatically, changes site settings or installs a plugin. The task remains in progress pending review/publication. Meta tags and schema integration are outside this draft adapter.

Draft delivery is recorded per task. After an uncertain timeout, inspect WordPress and the delivery record before retrying; automatic retries are blocked to avoid duplicate posts. A `delivery-failed` record also requires manual review/reset after the underlying issue is corrected.

References: https://developer.wordpress.org/rest-api/reference/posts/ and https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/.

## AI costs and budgets

Configure `DAILY_AI_BUDGET_USD`, `MONTHLY_AI_BUDGET_USD` to positive numeric budgets. Optional `AI_COST_CHATGPT_USD`, `AI_COST_GEMINI_USD`, `AI_COST_PERPLEXITY_USD` specify your estimate per successful provider call. These are estimates, not provider invoices. Token usage returned by HTTP providers is retained as metadata where available. Calls without configured estimates are explicitly counted as unknown; their zero placeholder cannot be interpreted as free service or used to claim net profit.

Daily guard uses the Istanbul day. The business hunt checks the guard before discovery, reduces markets under caution, and skips new hunts when the configured estimate budget is exhausted. Existing customer service is not paused. Other agent routes are not all enforced by the business-hunt budget gate. Reconcile estimates against provider billing before relying on budget totals. Network failures may have charged the provider without producing a usable response and are not included in successful-call estimates.

## Verification

`npm test` covers scheduler access boundaries, migrations, request deadlines, credential reuse, invoice persistence/atomic activation, currency/service binding, webhook signatures/timestamp expiry, receiving identity checks, Istanbul date boundaries and WordPress draft validation. CI runs these tests before the production build. Real SMS, paid Shopier/PayTR checkout, inbound MX delivery and WordPress draft creation require the external connections above and remain unverified until configured.
