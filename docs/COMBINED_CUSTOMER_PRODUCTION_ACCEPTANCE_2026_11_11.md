# Combined customer acceptance — exact-head and production divergence (2026-11-11)

This review document is evidence classification, not release approval. ZERA is a separate test customer and not a core tenant or proof of real customer revenue.

## Offline acceptance verified
- Draft PR #240 exact head `429958d7a30dd5aa6f2203ad83872e0637672a56` passed CI (run 43084561670), Customer Journey Browser Acceptance (43084561607), and Web & Mobile Production Smoke (43084561609).
- The run names do not signify a live production deploy: they exercise synthetic/local test fixtures and a local browser instance.

## Separately observed Vercel production target
- Read-only Vercel deployment listing returned a READY production-target record `dpl_BtqQYxFaPmGpzZmkvDqMhiu5x9mn`, source SHA `95b6b1bd03e15fac1092ec218ab7f1e91deb740a`, created 2026-11-11T19:03:27Z.
- It is **not** the PR #240 head. READY indicates deployment build state; it does not prove canonical domain routing, real AI responses, signup, payments, or tenant isolation.
- GitHub compare: PR #240 head vs this Vercel SHA = **diverged**; 39 commits unique to the Vercel SHA and 11 unique to the combined-review head; merge base `8f8a1bba57740c2b1b28d1a7871a724c4753a724`. Counts describe revision graph differences, not live acceptance.
- Diverged source paths include `lib/paddle-live.js`, `lib/pilot-access.js`, `proxy.js`, real audit/revenue pilot routes, and related tests. Treat payment, auth and proxy behavior as revalidation required rather than assuming reviewed behavior is deployed.

## Strict live acceptance gates — still HOLD
1. Confirm canonical production alias and authoritative deployed commit without making changes.
2. Review production-target source divergence for customer authentication, proxy boundaries, paid access, signed Paddle settlements, refunds and tenancy. Create a new exact-head isolated integration candidate; do not auto-merge either direction.
3. Query required Neon schema **metadata only** from a verified production branch using a restricted reader; inspect expected columns and exact key definitions. Do not mutate schema or access customer rows for this preflight.
4. Verify one explicitly consented external customer can claim a business, authenticate, receive a limited verified free report and view only their own account. Protect tokens and never automatically send outreach.
5. Verify dated real provider API answers and persisted results separately from historical dashboard summaries and synthetic fixtures, under existing free/cost controls.
6. Independently verify a signed Paddle checkout/event and the tenant-specific paid report admission, including duplicate event, cancellation, refund and failure modes. Neither a `paid` label nor a zero-charge synthetic test is revenue.
7. Require an explicit separate production release decision after merged exact-head tests and authoritative evidence. This file neither authorizes nor performs deploy, merge, email, paid API calls, or production database modifications.

Source URLs:
- https://github.com/mehmetozan-5858/ai-visibility/pull/240
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561670
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561607
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43084561609
- https://vercel.com/ai-visibility2/ai-visibility/BtqQYxFaPmGpzZmkvDqMhiu5x9mn


## Additional read-only acceptance evidence — 2026-11-13 (supersedes earlier snapshot where conflicting)
- Draft PR #240 exact head `e8ebf21fb355340413ac31fe2f2053a838eb7313`: CI run 43429820505, browser run 43429820316, and web/mobile run 43429820339 completed successfully. These are synthetic/offline checks, NOT verified external provider or payment acceptance.
- Latest observed Vercel READY production deployment `dpl_5CX3jNCEhwLVWtgFvscpmUT91CkB`, source SHA `832ceb246ed20e0218e19f628c162ea5426df35f`. GitHub compare PR head vs this production SHA: diverged, 127 production-specific commits and 29 PR-specific commits. Never merge or deploy the review head directly without an exact-head reconciliation review.
- Production `lib/ai-bridge-free-inference.mjs` already passes `usage:{cost:0}`, response identity and completion metadata; it also bounds response ID to 200 chars and refuses to mark truncated text complete. The draft PR was updated to preserve these safeguards. Do NOT count the draft improvement as a production fix or interpret a READY build as real API success.
- Production `app/api/admin/free-provider-preflight/route.js` requires admin authorization, is rate-limited, uses GET, and calls key/catalog inspection, not inference. Without an authenticated authorized call its outcome is UNKNOWN; env-key presence is not proof of credential acceptance, model availability, quota or zero-price request execution.
- Vercel production env metadata (no secret values read): `OPENROUTER_API_KEY` is defined; `OPENROUTER_FREE_MODEL=google/gemma-4-31b-it:free`, `APPLICANT_FREE_MEASUREMENT_ENABLED=true`; `GEMINI_API_KEY` and `PERPLEXITY_API_KEY` were observed only under Preview; no `CUSTOMER_SETTLEMENT_PROOF_ENABLED` production entry. A single enabled provider does not satisfy two-provider evidence acceptance.
- Neon production read-only aggregate at inspection: 52 answer-evidence runs in 14 days, 48 automatic-repeat runs with zero observations and generic Perplexity errors; 4 non-repeat runs, one actual observation (one provider and one query), and three OpenRouter 429 errors among seven OpenRouter error entries. Runs are not model responses. A six-observation/two-provider/two-query acceptance gate remains unsatisfied. The 7-day automatic failure cooldown and new error classes are draft-only and are not deployed.
- Neon production payment aggregate: one `transaction.completed` plus one `transaction.paid` event, neither with linked payment/client IDs; zero payment rows with `status='paid'` and `method='paddle'`. No customer settlement proof established.
- Composite `payments(id,client_id)` unique index and `verified_customer_settlements` tenant-linked foreign key applied successfully to an isolated Neon temporary branch. The migration was explicitly discarded using `apply_changes=false`; temporary branch deleted. Production `verified_customer_settlements` table and `payments_id_client_id_uniq` index remain absent.
- Production access is still HOLD: (1) reconcile live auth/payment/provider code and review head safely; (2) verify restricted reader and external customer authorization without passwords changing; (3) validate current zero-price model and quota with an authorized *no-inference* preflight; (4) obtain genuine consented multi-provider evidence without paid fallback; (5) prove signed, linked Paddle transaction and refund/cancellation/idempotency behavior. No release, merges, paid calls, emails, customer changes, payment, or production schema writes are authorized by this document.

Evidence links:
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43429820505
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43429820316
- https://github.com/mehmetozan-5858/ai-visibility/actions/runs/43429820339
- https://vercel.com/ai-visibility2/ai-visibility/5CX3jNCEhwLVWtgFvscpmUT91CkB
