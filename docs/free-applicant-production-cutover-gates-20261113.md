# Real-customer free assessment — production cutover gates (13 Nov 2026)

Status: **BLOCKED / DRAFT ONLY**. This checklist is not a deployment approval.

## What passed, exactly
- Draft PR #261 latest previously observed exact-head `10d79b26`: GitHub CI, web/mobile and customer journey checks succeeded.
- Pure receipt admission, transaction, PGlite foreign-key checks and query-side proof-link tests use **invented** provider data.
- This validates application-level policy and synthetic SQL shapes; it does **not** validate real AI provider billing, customer authentication, a real payment or production-schema compatibility.

## Cannot enable real-customer scoring until ALL independently evidenced
1. Authorized identity and domain: validated email + domain proof + trusted server-derived tenant scope; admin routes are not customer auth substitutes. Reject user-selected or historical prospect scope.
2. Provider identity + billing: exact raw provider response/model/responseId, independent server-side price evidence and persisted zero-USD cost per response. Neither fabricated `verifiedZeroPriceAtRequest:true` flags nor generic zero-cost rows qualify.
3. Atomic evidence: roll back receipt and observation together; composite key covers tenant/domain/provider/model/responseId/query, idempotent duplicate handling, dated immutable source references; migrations reviewed in isolated Postgres before any production DDL.
4. Read-side enforcement: tenant-scoped SQL join only, no fallback to old `answer_evidence_runs`, no score when proof is missing/stale/estimated/nonzero/ambiguous.
5. Six eligible actual samples across at least two truly independent permitted providers, two neutral queries, within 14 days. A provider rate limit or unavailable free quota means **insufficient**, not a synthetic score.
6. Actual Google Gemini free tier/quota/pricing/privacy permission explicitly verified before any provider call; no hidden paid fallback, retries, grounding or automatic spend.
7. Browser and mobile: login, free submission, signed/private report or PDF access and expiry validated against real permissions; demonstrate denial across accounts.
8. Payment: signed Paddle event, configured item/price/checkout, actual receipt and proper customer entitlement verified independently; do not infer payment from sandbox or zero-value mock.
9. Release: exact-head full CI green, least-privilege role, DB rollback, real customer acceptance evidence, incident monitoring and an explicit separate deploy decision.

## Related state
- ZERA is a test tenant only and must not count as a converted paying customer.
- R&D Gemini admission is not executable and the draft receipt store/read adapter are **not** connected to production routes.
- Site HTTP 200 / Vercel READY / GitHub green test results are not commercial acceptance.
- Do not merge, deploy, migrate, call paid APIs, send emails or enable checkout as part of this checklist.


## 13 Nov — external provider and production configuration inspection
- Official Google Gemini API pricing lists a free tier for Gemini 2.5
  Flash-Lite, but its free-tier terms say content may be used to improve
  Google's products. See https://ai.google.dev/gemini-api/docs/pricing .
  **This is not consent to send real customers' data.** Keep customer Gemini
  calls blocked until independently documented purpose-specific data permission,
  account/project free-tier eligibility, billing status and quota.
- Official OpenRouter free-model collection says `:free` models are zero
  priced but request-limited; it does not certify that any specific account
  can complete a request or that every result has a trustworthy zero-cost
  provider receipt. https://openrouter.ai/collections/free-models/
- Vercel production project environment name inventory (values **not**
  decrypted) includes `OPENROUTER_API_KEY`,
  `OPENROUTER_FREE_MODEL` and `APPLICANT_FREE_MEASUREMENT_ENABLED`.
  Variable presence is **not** evidence that a switch is enabled, a model is
  currently available, a key works or a provider returns accepted receipts.
  The inventory response was capped at 100 variables, so missing names must
  not be treated as proof of absence.
- Last exact-head successful CI is not production acceptance. The proposed
  verified receipt/observation table remains a draft, isolated from live routes.
