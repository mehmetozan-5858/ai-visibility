# Real Paddle Sandbox checkout lifecycle — 2026-10-13

## Verified from browser through signed webhooks to isolated database
Checkout application: hardened preview https://ai-visibility-ktcx8zpgl-ai-visibility2.vercel.app/paddle-sandbox (production routes blocked). Event receiver: separate preview service dpl_8ZuA9RxySgj1c5rVEsS9aAt5MEka. Only the dedicated test database and Sandbox signing secret were used.

1. Monthly business-monitoring USD price: $169.00 including tax, quantity one. Official successful Sandbox card completed checkout. Paddle created sub_01m4vezcbzynp52vtptq16q2w4 and transaction txn_01m4vexgkkrdrxk882m5sdghzf. Real platform events subscription.created, subscription.activated and transaction.completed reached isolated storage.
2. The same real Sandbox subscription was canceled immediately in the vendor dashboard. subscription.updated and subscription.canceled arrived. Database entity status was confirmed canceled.
3. One-time business-diagnosis USD price: $129.00 including tax. Official declined Sandbox card displayed a declined-payment message and emitted transaction.payment_failed for txn_01m4vf788s576437e62bf8jqd0. Retrying with the successful Sandbox card completed the same transaction, followed by transaction.completed.
4. Read-only query confirmed seven real platform events after 20:21 UTC, distinct from earlier ntfsimevt_ simulator records. Two test checkout completions were observed in the browser. Synthetic customer details were used, no live card or real customer information.

## Renewal boundary
Attempting to bring the next billing date to a few minutes ahead showed Paddle validation: billing date must be at least 31 minutes in the future. The edit was closed without saving; the original next-payment date was retained before canceling the test subscription. A real timed renewal was not executed. A subscription_recurring transaction fixture was verified earlier with Paddle simulator, which is not equivalent to real scheduled billing.

## UI follow-up
Sandbox checkout clears the previous result when a new checkout opens, handles checkout.payment.failed with a retry message, and handles checkout.error/checkout.payment.error with a generic failure message. Completion continues to require separate signed webhook verification before claiming subscription state; no customer entitlement is activated by browser callbacks.

## Cleanup
The temporary automation key scoped only to the separate test project was revoked (regenerate=false; protectionBypass empty). Its query was removed from Paddle destination; destination deactivated after tests. Test subscription canceled; no scheduled renewal left active for this test. No source secrets, production database writes, main merge, live launch or real payment.

## Remaining before commercial release
Real timed Sandbox renewal; authenticated customer-to-Paddle identity mapping and entitlement integration; production credentials/catalog plus separately approved production verification. Existing GO_LIVE.md production authentication, recovery, email, backup/restore, mobile and legal identity gates remain open. This evidence closes Sandbox checkout/creation/cancellation/payment-failure checks only, not overall application or commercial launch.
