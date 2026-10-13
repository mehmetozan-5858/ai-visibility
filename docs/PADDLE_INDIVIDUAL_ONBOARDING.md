# Paddle individual-seller onboarding gate — AI Visibility

Status: PREPARATION ONLY. Not an approved Paddle merchant. No live checkout or Paddle keys configured.

## Seller identity (owner action)
- [ ] Confirm legal full name **exactly as shown on official ID** (do not guess from account/profile display names).
- [ ] Use the same name on Paddle individual application, settlement account, and truthful public legal disclosures as legally required.
- [ ] Verify individual eligibility, supported Turkish payout bank and payout currency directly in Paddle dashboard.
- [ ] Complete identity/address verification using Paddle's secure onboarding; never place ID, home address, tax number, bank details or ID photos in GitHub.
- [ ] Discuss Turkey tax registration, invoices and employment constraints with a qualified Turkish accountant before charging customers. Merchant of Record does not remove supplier's own tax obligations.

## Product eligibility (Paddle approval required)
- [ ] Submit an accurate product description: AI visibility monitoring SaaS dashboard, evidence explorer, reports, alerts and self-service access — only for features actually working.
- [ ] Explicitly disclose any manual reports, GEO/AEO implementation, consulting, marketing and outreach components. Do not sell prohibited service categories through Paddle.
- [ ] Ask Paddle to confirm in writing whether each proposed SKU (business-diagnosis, business-solution, business-monitoring) is eligible. Do not assume all three are eligible because SaaS generally is.
- [ ] Keep unsupported products on a separate payment path until legally/provider approved.

## Domain & customer flow
- [x] Custom HTTPS domain linked to production.
- [x] Product descriptions, country prices, refund, privacy and terms pages published.
- [ ] Publish real, verified seller/legal contact details; do not invent a company, company number or tax ID.
- [ ] Validate public site -> onboarding -> email verification -> customer dashboard -> actual report on production.
- [ ] Validate subscription disclosure, cancellation route, refund contact, support email and merchant-of-record wording before checkout.
- [ ] Configure Paddle sandbox credentials in Vercel secrets only after account is created; implement verified Paddle webhook signature, idempotency, service-price matching and atomic subscription activation.
- [ ] Run controlled sandbox end-to-end tests and obtain Paddle domain/identity/product approval before enabling live checkout.

Official references (checked 2026-10-13):
- https://www.paddle.com/help/start/account-verification/what-is-account-verification
- https://www.paddle.com/help/start/account-verification/what-is-identity-verification
- https://www.paddle.com/help/start/account-verification/what-is-business-verification
- https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
- https://www.paddle.com/legal/terms
