# Live checkout readiness

API credentials establish configuration, not permission to accept live payments.
The payment information response and direct Paddle transaction endpoint now use
the same server-side readiness decision. The admin status response distinguishes
configured credentials from checkoutEnabled and seller/domain approval.

Live checkout requires all three live credentials (API key, client token and
webhook secret), the Vercel production environment, an eligible software service,
explicit seller approval and the exact approved HTTPS hostname. Manual solution,
pilot and service-unbound links cannot advertise Paddle availability. A rejected
request stops before profile lookup, local payment creation, provider transaction
creation or consent recording. Webhook processing and existing entitlements are
unchanged.

The new non-secret operational settings default to closed:

- PADDLE_LIVE_SELLER_APPROVED: exact string `true` only after Paddle confirms the
  merchant can accept live payments. This is an operator attestation, not an
  automated provider approval check.
- PADDLE_LIVE_APPROVED_DOMAINS: JSON array of exact lower-case hostnames copied
  from confirmed approved Paddle domains, e.g. `["www.example.com"]`. Do not
  include URL schemes, paths, wildcards or unapproved subdomains. Apex and www
  approvals are separate. Each host used for checkout must be approved itself.

Do not enable these settings based only on API authentication, sandbox success,
an appeal submission, or an elapsed waiting period. Revoke the attestation if the
provider withdraws approval. No approval flags, credentials, domain submissions,
provider payments or customer records were changed for this implementation.

Tests use synthetic configuration and mocked route dependencies. They verify that
missing/invalid approval, domain mismatch, malformed domain lists, preview scope
and missing webhook credentials prevent any local/provider transaction writes.
The positive path is mocked; it is not a real payment or commercial acceptance.

Reference: https://www.paddle.com/help/start/account-verification/what-is-domain-verification
